using System.Diagnostics;

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
