namespace Ren.Build;

/// <summary>
/// Runs Ren's tests: the client tests in test/Ren.Client.Tests (the Jest-style unit tests and the
/// browser tests, all in Chrome), and, for CI, the .NET package's build and tests.
/// </summary>
internal static class Testing
{
    private static string ClientTestsProject => Path.Combine(Repo.Root, "test", "Ren.Client.Tests");

    private static string DotnetSolution => Path.Combine(Repo.Root, "dotnet", "Ren.sln");

    /// <summary>
    /// Runs the client tests against what's in dist/, or against the minified build, which
    /// REN_TEST_MINIFIED has the tests load in place of ren.js, ren.esm.js and ren.css.  Any
    /// arguments given (a --filter, say) are passed on to dotnet test.
    /// </summary>
    public static Task RunClientTestsAsync(bool minified, IEnumerable<string> dotnetTestArgs)
    {
        var environment = new Dictionary<string, string>();

        if (minified) environment["REN_TEST_MINIFIED"] = "1";

        return Step.RunAsync(
            minified ? "Running the client tests on the minified build" : "Running the client tests",
            "dotnet",
            new[] { "test", ClientTestsProject }.Concat(dotnetTestArgs),
            environment: environment);
    }

    /// <summary>
    /// Runs everything CI runs, stopping at the first failure: the build, the client tests, the
    /// client tests again on the minified build, then the .NET package's build and tests.
    /// </summary>
    public static async Task RunCiAsync(Publisher publisher)
    {
        await Builder.BuildAsync(publisher);
        await RunClientTestsAsync(minified: false, []);
        await RunClientTestsAsync(minified: true, ["--no-build"]);
        await Step.RunAsync("Building the .NET package", "dotnet", ["build", DotnetSolution, "-c", "Release"]);
        await Step.RunAsync("Running the .NET package's tests", "dotnet", ["test", DotnetSolution, "-c", "Release", "--no-build"]);

        Log.Info("CI passed");
    }
}
