using System.Security.Cryptography;
using System.Text;

namespace Ren.Build;

/// <summary>
/// Writes ren.manifest.json beside the built files, saying which version and commit they were
/// built from, whether that's a release, the branch for a development build (see BuildIdentity),
/// and each file's SHA-256 hash.  A host keeps the manifest with its copy of the files, so it can
/// tell which Ren it has, and check the files haven't changed since.  The hashes are of each file's
/// text with CRLF line endings changed to LF, so a host whose git converts line endings on checkout
/// still gets the same hashes.
/// </summary>
internal static class Manifest
{
    public const string FileName = "ren.manifest.json";

    private static readonly string[] HashedFileNames =
    [
        "ren.js",
        "ren.min.js",
        "ren.esm.js",
        "ren.esm.min.js",
        "ren.css",
        "ren.min.css",
        Repo.SchemaFileName
    ];

    private static readonly object WriteLock = new();

    /// <summary>
    /// Writes the manifest of the specified build into dist/, hashing whichever of the built files
    /// are there.
    /// </summary>
    public static void Write(BuildIdentity identity)
    {
        lock (WriteLock)
        {
            var files = new List<string>();

            foreach (var name in HashedFileNames)
            {
                var path = Path.Combine(Repo.Dist, name);

                if (!File.Exists(path)) continue;

                var text = Repo.ReadText(path).Replace("\r\n", "\n");
                var hash = Convert.ToHexString(SHA256.HashData(Repo.Utf8.GetBytes(text))).ToLowerInvariant();

                files.Add($"        {JsJson.Quote(name)}: \"{hash}\"");
            }

            // As JSON.stringify(contents, null, 4) wrote it.
            var json = new StringBuilder()
                .Append("{\n")
                .Append("    \"version\": ").Append(JsJson.Quote(identity.Version)).Append(",\n")
                .Append("    \"commit\": ").Append(identity.Commit == null ? "null" : JsJson.Quote(identity.Commit)).Append(",\n")
                .Append("    \"isRelease\": ").Append(identity.IsRelease ? "true" : "false").Append(",\n")
                .Append("    \"branch\": ").Append(identity.Branch == null ? "null" : JsJson.Quote(identity.Branch)).Append(",\n")
                .Append("    \"files\": ").Append(files.Count == 0 ? "{}" : "{\n" + string.Join(",\n", files) + "\n    }").Append('\n')
                .Append("}\n");

            Repo.WriteText(Path.Combine(Repo.Dist, FileName), json.ToString());
        }
    }
}

/// <summary>
/// Rewrites the manifest to cover a build as each of its files is written, then copies the file,
/// its source map if it has one, and the manifest into each host's folder given with --statics.
/// A folder in a git repo only gets them while that repo has a branch checked out with the same
/// name as Ren's, as the host's build (Ren.targets) only keeps them then, and otherwise puts the
/// package's back.  The branches are read each time, so switching either repo takes effect on
/// the next build.  A folder that isn't in a git repo always gets them.
/// </summary>
internal sealed class Publisher(IReadOnlyList<string> staticsDirectories)
{
    private readonly object copyLock = new();

    // The reason each folder was last skipped, so that it's only logged when it changes.
    private readonly Dictionary<string, string?> skipReasons = new(StringComparer.OrdinalIgnoreCase);

    public void Publish(BuildIdentity identity, string fileName, bool hasSourceMap = true)
    {
        Manifest.Write(identity);

        if (staticsDirectories.Count == 0) return;

        lock (copyLock)
        {
            string[] fileNames = hasSourceMap
                ? [fileName, fileName + ".map", Manifest.FileName]
                : [fileName, Manifest.FileName];

            var renBranch = GitBranch.Read(Repo.Root).Branch;

            foreach (var directory in staticsDirectories)
            {
                var skipReason = GetSkipReason(directory, renBranch);

                if (skipReasons.GetValueOrDefault(directory) != skipReason)
                {
                    skipReasons[directory] = skipReason;

                    if (skipReason != null) Log.Warning($"Not copying builds to {directory}: {skipReason}");
                }

                if (skipReason != null) continue;

                Directory.CreateDirectory(directory);

                foreach (var name in fileNames)
                {
                    Repo.CopyFile(Path.Combine(Repo.Dist, name), Path.Combine(directory, name));
                }

                Log.Info($"Copied {fileName} ({identity.Version}) to {directory}");
            }
        }
    }

    /// <summary>
    /// Gets why a build shouldn't be copied into the specified folder, or null if it should.
    /// </summary>
    private static string? GetSkipReason(string directory, string? renBranch)
    {
        var host = GitBranch.Read(directory);

        if (!host.IsRepo || (renBranch != null && host.Branch == renBranch)) return null;

        var hostBranch = host.Branch == null ? "has no branch checked out" : $"is on {host.Branch}";
        var renOn = renBranch == null ? "has no branch checked out" : $"is on {renBranch}";

        return $"its repo {hostBranch}, and Ren {renOn}.  Builds are copied to a host only while " +
            "its branch has the same name as Ren's (until then, the host's build puts the package's files back).";
    }
}

/// <summary>
/// The branch a git repo has checked out, read from the HEAD file in its .git folder (or, in a
/// worktree, the folder its .git file names), as Ren.targets reads it.
/// </summary>
internal readonly record struct GitBranch(bool IsRepo, string? Branch)
{
    /// <summary>
    /// Reads the branch of the repo that the specified folder is in, which needn't exist yet.
    /// </summary>
    public static GitBranch Read(string path)
    {
        for (var directory = new DirectoryInfo(Path.GetFullPath(path)); directory != null; directory = directory.Parent)
        {
            var git = Path.Combine(directory.FullName, ".git");
            string? gitDirectory = null;

            if (Directory.Exists(git))
            {
                gitDirectory = git;
            }
            else if (File.Exists(git))
            {
                var match = System.Text.RegularExpressions.Regex.Match(File.ReadAllText(git), @"gitdir:\s*([^\r\n]+)");

                if (match.Success) gitDirectory = Path.GetFullPath(match.Groups[1].Value.Trim(), directory.FullName);
            }

            if (gitDirectory == null) continue;

            var head = Path.Combine(gitDirectory, "HEAD");

            if (!File.Exists(head)) return new GitBranch(true, null);

            var branch = System.Text.RegularExpressions.Regex.Match(File.ReadAllText(head), @"ref:\s*refs/heads/(\S+)");

            return new GitBranch(true, branch.Success ? branch.Groups[1].Value : null);
        }

        return new GitBranch(false, null);
    }
}

internal static class Log
{
    private static readonly object ConsoleLock = new();

    public static void Info(string message) => Write(message, null);

    public static void Warning(string message) => Write(message, ConsoleColor.Yellow);

    public static void Error(string message) => Write(message, ConsoleColor.Red);

    private static void Write(string message, ConsoleColor? colour)
    {
        lock (ConsoleLock)
        {
            var time = DateTime.Now.ToString("HH:mm:ss");

            if (colour != null) Console.ForegroundColor = colour.Value;

            Console.WriteLine($"[{time}] {message}");

            if (colour != null) Console.ResetColor();
        }
    }
}
