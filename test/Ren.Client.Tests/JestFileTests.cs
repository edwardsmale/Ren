using System.Text;
using System.Text.Json;
using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// Runs each of test/'s Jest-style test files (test/*.test.js) in Chrome, after the scripts a page
/// using Ren includes, through jest-in-the-browser.js, which gives the page the parts of Jest and
/// Node they use.  Each file is one test here, which fails with the names and
/// errors of the file's tests that failed.
///
/// REN_TEST_MINIFIED=1 tests dist/ren.min.js instead.
/// </summary>
[TestClass]
public class JestFileTests
{
    private const string Shim = "/test/Ren.Client.Tests/jest-in-the-browser.js";

    public TestContext TestContext { get; set; } = null!;

    public static IEnumerable<object[]> TestFiles =>
        Directory.EnumerateFiles(Path.Combine(RepoFiles.Root, "test"), "*.test.js")
            .Select(Path.GetFileName)
            .Order(StringComparer.Ordinal)
            .Select(name => new object[] { name! });

    public static string GetDisplayName(System.Reflection.MethodInfo method, object[] data) => (string)data[0];

    [TestMethod]
    [DynamicData(nameof(TestFiles), DynamicDataDisplayName = nameof(GetDisplayName))]
    public async Task Run(string fileName)
    {
        RepoFiles.AssertBuilt();

        var page = await TestBrowser.OpenPageAsync(Shim);
        var output = new StringBuilder();

        page.Console += (_, message) => output.AppendLine($"console.{message.Type}: {message.Text}");
        page.PageError += (_, error) => output.AppendLine("Uncaught: " + error);

        try
        {
            var env = new Dictionary<string, string>();

            if (RepoFiles.TestMinified) env["REN_TEST_MINIFIED"] = "1";

            var json = await page.EvaluateAsync<JsonElement>(
                "([file, scripts, env]) => window.__renJest.run(file, scripts, env)",
                new object[] { "/test/" + fileName, new[] { RepoFiles.BuiltScript }, env });

            var run = json.Deserialize<FileRun>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

            Report(fileName, run, output.ToString());
        }
        finally
        {
            await page.Context.CloseAsync();
        }
    }

    private void Report(string fileName, FileRun run, string output)
    {
        var failed = run.Results.Where(result => result.Status == "failed").ToList();
        var passed = run.Results.Count(result => result.Status == "passed");
        var skipped = run.Results.Count - failed.Count - passed;

        var summary = new StringBuilder();

        summary.AppendLine($"{fileName}: {passed} passed, {failed.Count} failed" + (skipped > 0 ? $", {skipped} skipped" : ""));

        foreach (var result in run.Results)
        {
            var mark = result.Status switch { "passed" => "✓", "failed" => "✕", _ => "○" };

            summary.AppendLine($"  {mark} {result.Name} ({result.Duration} ms)");
        }

        if (output.Length > 0)
        {
            summary.AppendLine();
            summary.Append(output);
        }

        TestContext.WriteLine(summary.ToString());

        if (run.FileError != null)
        {
            Assert.Fail($"{fileName} couldn't run:\n{run.FileError}");
        }

        if (run.Results.Count == 0)
        {
            Assert.Fail($"{fileName} has no tests.");
        }

        if (failed.Count > 0)
        {
            Assert.Fail($"{failed.Count} of {run.Results.Count} tests in {fileName} failed:\n\n"
                + string.Join("\n\n", failed.Select(result => $"● {result.Name}\n\n{Indent(result.Error ?? "")}")));
        }
    }

    private static string Indent(string text) =>
        string.Join("\n", text.Split('\n').Select(line => "    " + line));

    private sealed record FileRun(List<TestResultRecord> Results, string? FileError);

    private sealed record TestResultRecord(string Name, string Status, string? Error, int Duration);
}
