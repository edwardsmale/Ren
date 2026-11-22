namespace Ren.Client.Tests;

internal static partial class RepoFiles
{
    private static readonly Lazy<string?> BuildProblem = new(() =>
    {
        try
        {
            CheckBuild();
            return null;
        }
        catch (InvalidOperationException e)
        {
            return e.Message;
        }
    });

    /// <summary>
    /// Fails the test when the built file is missing or older than its sources (see CheckBuild),
    /// which is checked once for every test.
    /// </summary>
    public static void AssertBuilt()
    {
        if (BuildProblem.Value != null) Assert.Fail(BuildProblem.Value);
    }
}
