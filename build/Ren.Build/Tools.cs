using System.Diagnostics;
using System.Formats.Tar;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Ren.Build;

/// <summary>
/// The native programs the build runs: Dart Sass, Lightning CSS and esbuild.  Each is a pinned
/// release, downloaded the first time it's needed into .tools/ (which git ignores; see
/// ToolsDirectory), and checked against the SHA-256 recorded here before it's unpacked, so a build
/// always runs exactly these programs.  Nothing has to be installed beyond the .NET SDK.
///
/// To move to a new version: change its version and URLs, download each archive, and record its
/// SHA-256 (sha256sum, or Get-FileHash in PowerShell).  The npm registry archives can be checked
/// against the "integrity" the registry gives for them, too.
/// </summary>
internal static class Tools
{
    private sealed record Download(string Url, string Sha256);

    private sealed record Tool(string Name, string Version, Dictionary<string, Download> Downloads);

    private static readonly Tool DartSass = new("dart-sass", "1.104.1", new()
    {
        ["win-x64"] = new("https://github.com/sass/dart-sass/releases/download/1.104.1/dart-sass-1.104.1-windows-x64.zip",
            "b1d51698b28a952ef8c9ad7f6c32f5c0f9a05c7989da37562297c092b770a034"),
        ["linux-x64"] = new("https://github.com/sass/dart-sass/releases/download/1.104.1/dart-sass-1.104.1-linux-x64.tar.gz",
            "85f31863aa62a1ba93158105609b94206fe9e17a37ad2855a69c543f83d1abae"),
        ["osx-arm64"] = new("https://github.com/sass/dart-sass/releases/download/1.104.1/dart-sass-1.104.1-macos-arm64.tar.gz",
            "1ef58a518ab901c1c4f08890537e111f690c375d984927dafd1decb1c5e6b680")
    });

    private static readonly Tool LightningCss = new("lightningcss", "1.32.0", new()
    {
        ["win-x64"] = new("https://registry.npmjs.org/lightningcss-cli-win32-x64-msvc/-/lightningcss-cli-win32-x64-msvc-1.32.0.tgz",
            "93f783cdbb1668478c2e46fa85baa6a3cf713e891c7bc35ce1cc221ff03c35f8"),
        ["linux-x64"] = new("https://registry.npmjs.org/lightningcss-cli-linux-x64-gnu/-/lightningcss-cli-linux-x64-gnu-1.32.0.tgz",
            "4f821eb5ea1078b8fd10adbe4efd06978edee236f8e6f7f84a3c5d87b74b5505"),
        ["osx-arm64"] = new("https://registry.npmjs.org/lightningcss-cli-darwin-arm64/-/lightningcss-cli-darwin-arm64-1.32.0.tgz",
            "2d3b35acef94f2ace79ca3184555edd05476fe84de4e9596d1165f7da204c33a")
    });

    private static readonly Tool Esbuild = new("esbuild", "0.23.1", new()
    {
        ["win-x64"] = new("https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.23.1.tgz",
            "e0db49b7f1296e0529b5332bba326eb188cf9a04f3ce1d62e16b9f6930c6ee49"),
        ["linux-x64"] = new("https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.23.1.tgz",
            "2b59309c23de8066466519c8b1cdb2efb28b0869a2f6fce2fcd86f7f4e7ed9ba"),
        ["osx-arm64"] = new("https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.23.1.tgz",
            "bbaa79ff0160c6185837531be886fdb9c43c6e337a60e2731eda4fd417691f0d")
    });

    private static readonly SemaphoreSlim InstallLock = new(1, 1);

    /// <summary>
    /// The folder the tools are kept in: .tools/, or the folder REN_TOOLS names, which lets an
    /// export's worktree use the tools this repo has already downloaded.
    /// </summary>
    public static string ToolsDirectory =>
        Environment.GetEnvironmentVariable("REN_TOOLS") is { Length: > 0 } directory
            ? directory
            : Path.Combine(Repo.Root, ".tools");

    private static string Rid =>
        RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && RuntimeInformation.OSArchitecture == Architecture.X64 ? "win-x64"
        : RuntimeInformation.IsOSPlatform(OSPlatform.Linux) && RuntimeInformation.OSArchitecture == Architecture.X64 ? "linux-x64"
        : RuntimeInformation.IsOSPlatform(OSPlatform.OSX) && RuntimeInformation.OSArchitecture == Architecture.Arm64 ? "osx-arm64"
        : throw new BuildException("The build's tools are only set up for Windows x64, Linux x64 and macOS arm64, not " +
            RuntimeInformation.RuntimeIdentifier + ".");

    private static string Exe(string name) => RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? name + ".exe" : name;

    /// <summary>
    /// Runs Dart Sass with the specified arguments, in the repo's folder.
    /// </summary>
    public static async Task<ProcessResult> RunSassAsync(IEnumerable<string> args)
    {
        var directory = await InstallAsync(DartSass);
        var src = Path.Combine(directory, "dart-sass", "src");

        return await RunAsync(Path.Combine(src, Exe("dart")), new[] { Path.Combine(src, "sass.snapshot") }.Concat(args));
    }

    public static async Task<ProcessResult> RunLightningCssAsync(IEnumerable<string> args)
    {
        var directory = await InstallAsync(LightningCss);

        return await RunAsync(Path.Combine(directory, "package", Exe("lightningcss")), args);
    }

    public static async Task<ProcessResult> RunEsbuildAsync(IEnumerable<string> args)
    {
        var directory = await InstallAsync(Esbuild);
        var package = Path.Combine(directory, "package");
        var exe = File.Exists(Path.Combine(package, "esbuild.exe")) ? Path.Combine(package, "esbuild.exe")
            : Path.Combine(package, "bin", "esbuild");

        return await RunAsync(exe, args);
    }

    /// <summary>
    /// Downloads, checks and unpacks the specified tool, unless it already has been, and gets its
    /// folder.
    /// </summary>
    private static async Task<string> InstallAsync(Tool tool)
    {
        var rid = Rid;
        var directory = Path.Combine(ToolsDirectory, $"{tool.Name}-{tool.Version}-{rid}");
        var marker = Path.Combine(directory, ".installed");

        if (File.Exists(marker)) return directory;

        await InstallLock.WaitAsync();

        try     
        {
            if (File.Exists(marker)) return directory;

            var download = tool.Downloads[rid];

            Log.Info($"Downloading {tool.Name} {tool.Version} from {download.Url}");

            using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };

            byte[] archive;

            try
            {
                archive = await client.GetByteArrayAsync(download.Url);
            }
            catch (HttpRequestException e)
            {
                throw new BuildException($"Couldn't download {tool.Name} from {download.Url}: {e.Message}");
            }

            var hash = Convert.ToHexString(SHA256.HashData(archive)).ToLowerInvariant();

            if (hash != download.Sha256)
            {
                throw new BuildException($"{download.Url} has SHA-256 {hash}, not the {download.Sha256} the build expects, " +
                    "so it hasn't been used.");
            }

            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);

            Directory.CreateDirectory(directory);

            using (var stream = new MemoryStream(archive))
            {
                if (download.Url.EndsWith(".zip", StringComparison.Ordinal))
                {
                    ZipFile.ExtractToDirectory(stream, directory);
                }
                else
                {
                    using var gzip = new GZipStream(stream, CompressionMode.Decompress);

                    TarFile.ExtractToDirectory(gzip, directory, overwriteFiles: true);
                }
            }

            if (!OperatingSystem.IsWindows())
            {
                foreach (var file in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories))
                {
                    if (Path.GetExtension(file) == "") File.SetUnixFileMode(file, File.GetUnixFileMode(file) | UnixFileMode.UserExecute);
                }
            }

            File.WriteAllText(marker, download.Sha256);

            return directory;
        }
        finally
        {
            InstallLock.Release();
        }
    }

    private static async Task<ProcessResult> RunAsync(string exe, IEnumerable<string> args)
    {
        var startInfo = new ProcessStartInfo(exe)
        {
            WorkingDirectory = Repo.Root,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        foreach (var arg in args) startInfo.ArgumentList.Add(arg);

        using var process = Process.Start(startInfo) ?? throw new BuildException("Couldn't start " + exe + ".");

        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        return new ProcessResult(process.ExitCode, await output, await error);
    }
}

internal sealed record ProcessResult(int ExitCode, string Output, string Error)
{
    /// <summary>
    /// Fails the build, with the tool's output, when it didn't succeed.
    /// </summary>
    public ProcessResult EnsureSuccess(string what)
    {
        if (ExitCode != 0)
        {
            throw new BuildException($"{what} failed:\n{(Error + Output).Trim()}");
        }

        return this;
    }
}
