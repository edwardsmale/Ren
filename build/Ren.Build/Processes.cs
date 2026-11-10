using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace Ren.Build;

/// <summary>
/// Runs git in the repo's folder.
/// </summary>
internal static class Git
{
    /// <summary>
    /// The trimmed output of the specified git command, or null when it fails.
    /// </summary>
    public static string? TryRun(params string[] args)
    {
        try
        {
            var (exitCode, output, _) = Capture(args);

            return exitCode == 0 ? output : null;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// The trimmed output of the specified git command, which fails the build when it fails.
    /// </summary>
    public static string Run(params string[] args)
    {
        (int ExitCode, string Output, string Error) result;

        try
        {
            result = Capture(args);
        }
        catch (System.ComponentModel.Win32Exception)
        {
            throw new BuildException("Can't run git.  Is it on the PATH?");
        }

        if (result.ExitCode != 0)
        {
            throw new BuildException($"git {string.Join(" ", args)} failed:\n{(result.Error + result.Output).Trim()}");
        }

        return result.Output;
    }

    private static (int ExitCode, string Output, string Error) Capture(string[] args)
    {
        var startInfo = new ProcessStartInfo("git")
        {
            WorkingDirectory = Repo.Root,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };

        foreach (var arg in args) startInfo.ArgumentList.Add(arg);

        using var process = Process.Start(startInfo)!;

        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEnd();

        process.WaitForExit();

        return (process.ExitCode, output.Result.Trim(), error);
    }
}

/// <summary>
/// Runs a step of the build that's another program, such as dotnet test, with its output going
/// straight to this console.
/// </summary>
internal static class Step
{
    /// <summary>
    /// Runs the program, in the specified folder (the repo's, by default), with any environment
    /// variables given set for it, and fails the build when it fails.
    /// </summary>
    public static async Task RunAsync(string what, string program, IEnumerable<string> args,
        string? workingDirectory = null, IDictionary<string, string>? environment = null)
    {
        Log.Info(what);

        var startInfo = new ProcessStartInfo(program)
        {
            WorkingDirectory = workingDirectory ?? Repo.Root,
            UseShellExecute = false
        };

        foreach (var arg in args) startInfo.ArgumentList.Add(arg);

        if (environment != null)
        {
            foreach (var (name, value) in environment) startInfo.Environment[name] = value;
        }

        using var process = Process.Start(startInfo) ?? throw new BuildException("Couldn't start " + program + ".");

        await process.WaitForExitAsync();

        if (process.ExitCode != 0) throw new BuildException(what + " failed.");
    }
}

/// <summary>
/// Runs dotnet test, showing on one line of the console, which it rewrites as the tests run, how
/// many of them have run so far, out of how many, and for how long.  The tests' results go to
/// dotnet test's console logger at normal verbosity, which writes a line for each test, and this
/// shows the lines for the tests that fail (and their errors), but counts the rest.
///
/// When this console's output is redirected (as on CI), it runs dotnet test as it is, with its
/// output going straight to the console.
/// </summary>
internal static class TestStep
{
    /// <summary>
    /// Runs dotnet test with the specified arguments (those after "test"), with any environment
    /// variables given set for it, and fails the build when it fails.
    /// </summary>
    public static async Task RunAsync(string what, IEnumerable<string> testArgs, IDictionary<string, string>? environment = null)
    {
        var args = testArgs.ToList();

        if (Console.IsOutputRedirected)
        {
            await Step.RunAsync(what, "dotnet", new[] { "test" }.Concat(args), environment: environment);

            return;
        }

        Log.Info(what);

        // dotnet test lists every test whatever the filter, so there's no total for a filtered run.
        var total = args.Contains("--filter") ? null : await CountTestsAsync(args, environment);

        using var process = Start(["test", "--logger", "console;verbosity=normal", .. args], environment);

        using (var progress = new TestProgress(total))
        {
            while (await process.StandardOutput.ReadLineAsync() is { } line) progress.OnLine(line);

            await process.WaitForExitAsync();
        }

        if (process.ExitCode != 0) throw new BuildException(what + " failed.");
    }

    /// <summary>
    /// The number of tests that dotnet test lists, or null when it can't list them.  Listing
    /// builds the tests first, unless the arguments include --no-build.
    /// </summary>
    private static async Task<int?> CountTestsAsync(List<string> args, IDictionary<string, string>? environment)
    {
        using var process = Start(["test", "--list-tests", .. args], environment, redirectError: true);

        var error = process.StandardError.ReadToEndAsync();
        var count = 0;
        var listing = false;

        while (await process.StandardOutput.ReadLineAsync() is { } line)
        {
            // Each project (and target framework) lists its tests, indented, after this line.
            if (line.StartsWith("The following Tests are available", StringComparison.Ordinal)) listing = true;
            else if (!line.StartsWith("    ", StringComparison.Ordinal)) listing = false;
            else if (listing) count++;
        }

        await error;
        await process.WaitForExitAsync();

        return process.ExitCode == 0 && count > 0 ? count : null;
    }

    private static Process Start(IEnumerable<string> args, IDictionary<string, string>? environment, bool redirectError = false)
    {
        var startInfo = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = Repo.Root,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = redirectError,
            StandardOutputEncoding = Encoding.UTF8
        };

        foreach (var arg in args) startInfo.ArgumentList.Add(arg);

        if (environment != null)
        {
            foreach (var (name, value) in environment) startInfo.Environment[name] = value;
        }

        return Process.Start(startInfo) ?? throw new BuildException("Couldn't start dotnet.");
    }
}

/// <summary>
/// The line of the console that shows how a dotnet test run is going, which it redraws every
/// second, and as each test finishes.  Other lines of dotnet test's output are written above it.
/// </summary>
internal sealed partial class TestProgress : IDisposable
{
    private const int BarWidth = 20;

    private readonly object sync = new();

    private readonly int? total;

    private readonly Stopwatch stopwatch = Stopwatch.StartNew();

    private readonly Timer timer;

    private int run;

    private int failed;

    // Whether the lines dotnet test writes under a test's result are hidden: they are for a test
    // that passed (or was skipped), but shown for one that failed.
    private bool hidingDetails;

    private int drawnLength;

    public TestProgress(int? total)
    {
        this.total = total;

        lock (sync) Draw();

        timer = new Timer(_ => { lock (sync) Draw(); }, null, 1000, 1000);
    }

    [GeneratedRegex(@"^  (Passed|Failed|Skipped) \S")]
    private static partial Regex ResultPattern();

    public void OnLine(string line)
    {
        lock (sync)
        {
            var result = ResultPattern().Match(line);

            if (result.Success)
            {
                run++;

                if (result.Groups[1].Value == "Failed")
                {
                    failed++;
                    hidingDetails = false;

                    Write(line);
                }
                else
                {
                    hidingDetails = true;

                    Draw();
                }
            }
            else if (hidingDetails && (line.Length == 0 || line.StartsWith(' ')))
            {
                // A detail of a test that passed, such as its output.
            }
            else
            {
                hidingDetails = false;

                Write(line);
            }
        }
    }

    public void Dispose()
    {
        timer.Dispose();

        lock (sync) Clear();
    }

    private void Write(string line)
    {
        Clear();
        Console.WriteLine(line);
        Draw();
    }

    private void Draw()
    {
        var elapsed = stopwatch.Elapsed;
        var time = $"{(int)elapsed.TotalMinutes}:{elapsed.Seconds:00}";
        var failures = failed > 0 ? $", {failed} failed" : "";
        string text;

        if (total is { } count && run <= count)
        {
            var filled = run * BarWidth / count;

            text = $"  [{new string('#', filled)}{new string('-', BarWidth - filled)}] {run} of {count} tests run{failures}  {time}";
        }
        else
        {
            text = $"  {run} tests run{failures}  {time}";
        }

        var width = GetConsoleWidth();

        if (text.Length > width - 1) text = text[..(width - 1)];

        Console.Write("\r" + text.PadRight(drawnLength));

        drawnLength = text.Length;
    }

    private void Clear()
    {
        if (drawnLength == 0) return;

        Console.Write("\r" + new string(' ', drawnLength) + "\r");

        drawnLength = 0;
    }

    private static int GetConsoleWidth()
    {
        try
        {
            return Console.WindowWidth > 0 ? Console.WindowWidth : 80;
        }
        catch (IOException)
        {
            return 80;
        }
    }
}
