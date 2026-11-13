namespace Ren.Build;

/// <summary>
/// What a build is: a release when HEAD is the commit tagged v(the version in VERSION) and the
/// working tree is clean, and a development build otherwise.  A development build's version says
/// which commit it was built from, and whether the tree had changes on top of it, as semver build
/// metadata: 1.1.0+dev.4f2a9c1.dirty.
///
/// Its branch is, for a development build, the branch checked out, and for a release, the branch
/// whose work it released, which the release commit's Ren-Branch trailer records (see
/// Releaser.cs).  It lets a site keep things of its own that go with a branch of Ren under the
/// branch's name, and carry them over to the version that releases it.
/// </summary>
internal sealed record BuildIdentity(string Version, string? Commit, bool IsRelease, string? Branch)
{
    public const string BranchTrailer = "Ren-Branch";

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

        var branch = isRelease
            ? Git.TryRun("log", "-1", $"--format=%(trailers:key={BranchTrailer},valueonly)", "HEAD")
            : GitBranch.Read(Repo.Root).Branch;

        return new BuildIdentity(fullVersion, commit, isRelease, string.IsNullOrEmpty(branch) ? null : branch);
    }
}
