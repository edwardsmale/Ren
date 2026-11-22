namespace Ren.Client.Tests;

/// <summary>
/// Finds the repo's files: its root, the built library and the folders it's built from.
/// </summary>
internal static partial class RepoFiles
{
    private static readonly string[] SourceDirectories = ["src", "vendor", "templates"];

    /// <summary>
    /// Gets the repo's root folder, the nearest folder above the tests that has src/ren----init.js.
    /// </summary>
    public static string Root { get; } = FindRoot();

    /// <summary>
    /// Gets whether to test the minified build, as REN_TEST_MINIFIED=1 asks.
    /// </summary>
    public static bool TestMinified =>
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("REN_TEST_MINIFIED"));

    /// <summary>
    /// Gets whether to trace each browser test, keeping the traces of those that fail, as
    /// REN_TEST_TRACE=1 asks.  It's off by default, as tracing every test slows a full run enough
    /// for tests to time out on a busy machine.
    /// </summary>
    public static bool TestTraced =>
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("REN_TEST_TRACE"));

    /// <summary>
    /// Gets the built file under test, as a path from the repo's root.
    /// </summary>
    public static string BuiltScript => TestMinified ? "/dist/ren.min.js" : "/dist/ren.js";

    /// <summary>
    /// Gets the full path of a file, from its path from the repo's root (such as "/dist/ren.js"),
    /// or null when that path would be outside the repo.
    /// </summary>
    public static string? GetFullPath(string repoPath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(Root, repoPath.TrimStart('/')));
        var rootWithSeparator = Root.EndsWith(Path.DirectorySeparatorChar) ? Root : Root + Path.DirectorySeparatorChar;

        return fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase) ? fullPath : null;
    }

    /// <summary>
    /// Throws when the built file is missing or older than its sources, so the tests never pass or
    /// fail against a stale build.
    /// </summary>
    public static void CheckBuild()
    {
        var builtFile = GetFullPath(BuiltScript)!;
        const string Build = "Run `dotnet run --project build/Ren.Build`.";

        if (!File.Exists(builtFile))
        {
            throw new InvalidOperationException($"{BuiltScript.TrimStart('/')} hasn't been built.  {Build}");
        }

        var builtTime = File.GetLastWriteTimeUtc(builtFile);

        foreach (var directory in SourceDirectories)
        {
            var latest = Directory.EnumerateFiles(Path.Combine(Root, directory), "*", SearchOption.AllDirectories)
                .Select(File.GetLastWriteTimeUtc)
                .DefaultIfEmpty(DateTime.MinValue)
                .Max();

            if (latest > builtTime)
            {
                throw new InvalidOperationException($"{BuiltScript.TrimStart('/')} is older than {directory}/.  {Build}");
            }
        }
    }

    private static string FindRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory != null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "src", "ren----init.js"))) return directory.FullName;
        }

        throw new InvalidOperationException("Couldn't find the repo's root above " + AppContext.BaseDirectory);
    }
}
