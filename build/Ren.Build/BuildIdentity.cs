namespace Ren.Build;

/// <summary>
/// What a build is: a release when HEAD is the commit tagged v(the version in VERSION) and the
/// working tree is clean, and a development build otherwise.  A development build's version says
/// which commit it was built from, and whether the tree had changes on top of it, as semver build
/// metadata: 1.1.0+dev.4f2a9c1.dirty.
/// </summary>
internal sealed record BuildIdentity(string Version, string? Commit, bool IsRelease)
{
    public static BuildIdentity Get()
    {
        var version = Repo.ReadVersion();
        var commit = Git.TryRun("rev-parse", "HEAD");
        var tags = (Git.TryRun("tag", "--points-at", "HEAD") ?? "").Split('\n').Select(tag => tag.TrimEnd('\r'));
        var isDirty = !string.IsNullOrEmpty(Git.TryRun("status", "--porcelain"));
        var isRelease = commit != null && !isDirty && tags.Contains("v" + version);

        var fullVersion = isRelease
            ? version
            : version + "+dev." + (commit != null ? commit.Substring(0, 7) : "unknown") + (isDirty ? ".dirty" : "");

        return new BuildIdentity(fullVersion, commit, isRelease);
    }
}
