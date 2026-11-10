using System.Text.Json;
using System.Text.RegularExpressions;

namespace Ren.Build;

/// <summary>
/// Builds a released version of Ren from its tag, and either copies the build into one or more
/// hosts' folders for it, or packs it, with the .NET library, as the NuGet package.  It builds in a
/// worktree of its own, in .release-builds/, so whatever you're working on isn't involved, and
/// removes the worktree afterwards.  It refuses to use anything that doesn't build as that release.
/// </summary>
internal static partial class Exporter
{
    private static readonly string[] FileNames =
    [
        "ren.js",
        "ren.js.map",
        "ren.min.js",
        "ren.min.js.map",
        "ren.esm.js",
        "ren.esm.js.map",
        "ren.esm.min.js",
        "ren.esm.min.js.map",
        "ren.css",
        "ren.css.map",
        "ren.min.css",
        "ren.min.css.map",
        Repo.SchemaFileName,
        Manifest.FileName
    ];

    public static bool IsVersion(string version) => VersionPattern().IsMatch(version);

    public static async Task RunAsync(string? version, IReadOnlyList<string> directories)
    {
        if (version == null || !IsVersion(version) || directories.Count == 0)
        {
            throw new BuildException("Give the version and the folders to copy it into, as in " +
                "\"export 1.1.0 C:\\site\\Statics\\ren\".");
        }

        await BuildReleaseAsync(version, (worktree, distDirectory) =>
        {
            foreach (var directory in directories)
            {
                Directory.CreateDirectory(directory);

                foreach (var fileName in FileNames)
                {
                    File.Copy(Path.Combine(distDirectory, fileName), Path.Combine(directory, fileName), overwrite: true);
                }

                Log.Info($"Copied Ren {version} to {directory}");
            }

            return Task.CompletedTask;
        });
    }

    /// <summary>
    /// Packs the release as the Ren NuGet package, into packages/.  Publishing it to a feed is up to
    /// you.
    /// </summary>
    public static async Task PackAsync(string? version)
    {
        if (version == null || !IsVersion(version)) throw new BuildException("Give the version to pack, as in \"pack 1.1.0\".");

        var packagesDirectory = Path.Combine(Repo.Root, "packages");

        await BuildReleaseAsync(version, async (worktree, distDirectory) =>
        {
            var project = Path.Combine(worktree, "dotnet", "src", "Ren");

            if (!File.Exists(Path.Combine(project, "build", "Ren.targets")))
            {
                throw new BuildException($"v{version} is from before the package carried the client files, so it can't be packed this way.");
            }

            await Step.RunAsync(
                $"Packing v{version}",
                "dotnet",
                ["pack", project, "-c", "Release", "-o", packagesDirectory, "-nologo", "--disable-build-servers"],
                workingDirectory: worktree);
        });

        Log.Info($"Packed Ren {version} into {Path.Combine(packagesDirectory, $"Ren.{version}.nupkg")}");
    }

    /// <summary>
    /// Builds the release in a worktree, checks it built as the release, and passes the worktree
    /// and its dist/ to the action given.
    /// </summary>
    private static async Task BuildReleaseAsync(string version, Func<string, string, Task> use)
    {
        var tag = "v" + version;

        if (Git.Run("tag", "--list", tag).Length == 0) throw new BuildException($"{tag} isn't tagged.  Release it first.");

        var worktree = Path.Combine(Repo.Root, ".release-builds", tag);

        RemoveWorktree(worktree);
        Git.Run("-c", "core.longpaths=true", "worktree", "add", "--detach", worktree, tag);

        try
        {
            var buildProject = Path.Combine(worktree, "build", "Ren.Build", "Ren.Build.csproj");

            if (!File.Exists(buildProject))
            {
                throw new BuildException($"{tag} is from before Ren was built with .NET, so it can't be exported this way.");
            }

            // The worktree's build uses the tools this repo has already downloaded.  Build servers
            // would outlive the build holding files in the worktree, so it can't be removed.
            await Step.RunAsync(
                $"Building {tag}",
                "dotnet",
                ["run", "--project", buildProject, "-c", "Release", "--disable-build-servers", "--", "build"],
                workingDirectory: worktree,
                environment: new Dictionary<string, string> { ["REN_TOOLS"] = Tools.ToolsDirectory });

            var distDirectory = Path.Combine(worktree, "dist");

            using (var manifest = JsonDocument.Parse(Repo.ReadText(Path.Combine(distDirectory, Manifest.FileName))))
            {
                var builtVersion = manifest.RootElement.GetProperty("version").GetString();

                if (!manifest.RootElement.GetProperty("isRelease").GetBoolean() || builtVersion != version)
                {
                    throw new BuildException($"{tag} built as {builtVersion}, which isn't the release.");
                }
            }

            await use(worktree, distDirectory);
        }
        finally
        {
            // The release has been used by now, so a worktree that won't go only needs a warning.
            // The next export or pack tries again.
            if (!await TryRemoveWorktreeAsync(worktree))
            {
                Log.Warning($"Couldn't remove {worktree}, as something still has files open in it.  " +
                    "Close it in any editor, run \"dotnet build-server shutdown\", and delete the " +
                    "folder.");
            }
        }
    }

    private static void RemoveWorktree(string worktree)
    {
        if (!TryRemoveWorktree(worktree, out var error))
        {
            throw new BuildException($"Couldn't remove {worktree}, as something still has files open in it:\n{error}");
        }
    }

    /// <summary>
    /// Removes the worktree, retrying for a few seconds while processes that have just exited
    /// let go of its files, and gets whether it was removed.
    /// </summary>
    private static async Task<bool> TryRemoveWorktreeAsync(string worktree)
    {
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            if (TryRemoveWorktree(worktree, out _)) return true;

            await Task.Delay(TimeSpan.FromSeconds(attempt));
        }

        return false;
    }

    private static bool TryRemoveWorktree(string worktree, out string? error)
    {
        error = null;

        // A removal that failed part way can leave the folder behind with git no longer knowing it
        // as a worktree, so git can't remove it.
        if (Directory.Exists(worktree)
            && Git.TryRun("-c", "core.longpaths=true", "worktree", "remove", "--force", worktree) == null)
        {
            try
            {
                Directory.Delete(worktree, recursive: true);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                error = exception.Message;

                return false;
            }
        }

        Git.TryRun("worktree", "prune");

        return true;
    }

    [GeneratedRegex(@"^\d+\.\d+\.\d+$")]
    private static partial Regex VersionPattern();
}
