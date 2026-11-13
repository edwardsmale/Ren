namespace Ren.Build;

/// <summary>
/// Releases a version of Ren: checks the repo is ready, dates the version's section of the
/// changelog, sets VERSION (which the client build and the .NET package both read), runs CI, then
/// commits and tags the release.  It doesn't publish or push anything.
///
/// The changelog section it dates is "## &lt;version&gt; (not released yet)" when there is one, which
/// "Unreleased" must then be empty of, or otherwise "## Unreleased" itself.
///
/// The release commit records the branch whose work it releases in a Ren-Branch trailer, for the
/// manifest (see BuildIdentity.cs).  Branches are merged by fast-forwarding, so there's no merge
/// commit to say which it was: it's the branch given with --branch, or else the one local branch
/// that main has merged since the last release.  A release of work done on main itself has none.
/// </summary>
internal static class Releaser
{
    private static string ChangelogFile => Path.Combine(Repo.Root, "CHANGELOG.md");

    private static string VersionFile => Path.Combine(Repo.Root, "VERSION");

    private sealed class Section(string heading)
    {
        public string Heading { get; set; } = heading;

        public List<string> Lines { get; } = [];

        public bool HasContent => Lines.Any(line => line.Trim().Length > 0);
    }

    public static async Task RunAsync(string? version, string? branch, Publisher publisher)
    {
        if (version == null || !Exporter.IsVersion(version))
        {
            throw new BuildException("Give the version to release, as in \"release 1.1.0\".");
        }

        if (Git.Run("rev-parse", "--abbrev-ref", "HEAD") != "main") throw new BuildException("Releases are made from main.");

        if (Git.Run("status", "--porcelain").Length > 0)
        {
            throw new BuildException("Commit or stash your changes first, so that the release is only what's committed.");
        }

        if (Git.Run("tag", "--list", "v" + version).Length > 0) throw new BuildException($"v{version} is already tagged.");

        branch ??= GetMergedBranch();

        var changelog = GetReleasedChangelog(Repo.ReadText(ChangelogFile), version, DateTime.Now.ToString("yyyy-MM-dd"));

        Repo.WriteText(ChangelogFile, changelog);
        Repo.WriteText(VersionFile, version + "\n");

        Log.Info($"Set the version to {version}.  Running CI...");

        try
        {
            await Testing.RunCiAsync(publisher);
        }
        catch (BuildException e)
        {
            Git.Run("checkout", "--", "CHANGELOG.md", "VERSION");

            throw new BuildException($"{e.Message}\nCI failed, so nothing was released, and the version changes were undone.");
        }

        if (branch == null)
        {
            Git.Run("commit", "-q", "-am", "Ren " + version);
        }
        else
        {
            Git.Run("commit", "-q", "-am", "Ren " + version, "-m", $"{BuildIdentity.BranchTrailer}: {branch}");
        }

        Git.Run("tag", "-a", "v" + version, "-m", "Ren " + version);

        Log.Info($"Released {version} as v{version}{(branch == null ? "" : $", from {branch}")}.  Pack it with \"pack {version}\", or push the tag to publish it (see \"Releasing\" in docs/development.md).");
    }

    /// <summary>
    /// Gets the local branch that main has merged since the last release (one whose tip HEAD has,
    /// and the last release's tag hasn't), or null when there's none.  Fails when there's more
    /// than one, as only --branch can then say which the release is for.
    /// </summary>
    private static string? GetMergedBranch()
    {
        var mergedBranches = GetLocalBranches("--merged", "HEAD");
        var lastRelease = Git.TryRun("describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD");

        if (lastRelease != null) mergedBranches.ExceptWith(GetLocalBranches("--merged", lastRelease));

        mergedBranches.Remove("main");

        if (mergedBranches.Count > 1)
        {
            throw new BuildException($"main has merged {string.Join(", ", mergedBranches.Order())} since " +
                $"{lastRelease ?? "the start"}.  Say which branch the release is for with --branch.");
        }

        return mergedBranches.SingleOrDefault();
    }

    private static HashSet<string> GetLocalBranches(params string[] filter)
    {
        var output = Git.Run(["branch", "--format=%(refname:short)", .. filter]);

        return output.Split('\n').Select(line => line.TrimEnd('\r')).Where(line => line.Length > 0).ToHashSet();
    }

    /// <summary>
    /// Gets the changelog's text with the version's section dated.
    /// </summary>
    private static string GetReleasedChangelog(string text, string version, string date)
    {
        var lineEnding = text.Contains("\r\n") ? "\r\n" : "\n";
        var sections = new List<Section> { new("") };

        foreach (var line in text.Split(lineEnding))
        {
            if (line.StartsWith("## ", StringComparison.Ordinal)) sections.Add(new Section(line));
            else sections[^1].Lines.Add(line);
        }

        var unreleased = sections.FirstOrDefault(section => section.Heading == "## Unreleased");
        var pending = sections.FirstOrDefault(section => section.Heading == $"## {version} (not released yet)");

        if (pending != null)
        {
            if (unreleased is { HasContent: true })
            {
                throw new BuildException($"CHANGELOG.md has changes under \"Unreleased\" as well as a section for {version}.  " +
                    $"Move them into {version}'s section (or release them as a later version) first.");
            }

            if (unreleased != null) sections.Remove(unreleased);

            pending.Heading = $"## {version} ({date})";
        }
        else
        {
            if (unreleased is not { HasContent: true }) throw new BuildException("CHANGELOG.md has nothing under \"Unreleased\" to release.");

            unreleased.Heading = $"## {version} ({date})";
        }

        var lines = new List<string>();

        foreach (var section in sections)
        {
            if (section.Heading.Length > 0) lines.Add(section.Heading);

            lines.AddRange(section.Lines);
        }

        return string.Join(lineEnding, lines);
    }
}
