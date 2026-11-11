using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// A test of Ren in a page of its own, in a context of its own, with the repo served at
/// TestBrowser.Origin (so a page opens at a path such as "/test/browser/fixtures/grid.html").
/// Ren is the RenContext for the page.  A test fails if the page throws an error that nothing
/// caught, unless it allows them.
/// </summary>
public abstract partial class BrowserTest
{
    private readonly List<string> pageErrors = [];
    private bool pageErrorsAllowed;

    public TestContext TestContext { get; set; } = null!;

    protected IBrowserContext Context { get; private set; } = null!;

    protected IPage Page { get; private set; } = null!;

    protected RenContext Ren { get; private set; } = null!;

    /// <summary>
    /// Gets the options the test's context is created with, which a class of tests can add to.
    /// </summary>
    protected virtual BrowserNewContextOptions ContextOptions => new();

    [TestInitialize]
    public async Task OpenPageAsync()
    {
        RepoFiles.AssertBuilt();

        Context = await TestBrowser.NewContextAsync(ContextOptions);
        await Context.Tracing.StartAsync(new() { Screenshots = true, Snapshots = true });
        Page = await Context.NewPageAsync();
        Page.PageError += (_, error) => pageErrors.Add(error);
        Ren = new RenContext(Page);
    }

    [TestCleanup]
    public async Task ClosePageAsync()
    {
        try
        {
            if (!pageErrorsAllowed && TestContext.CurrentTestOutcome == UnitTestOutcome.Passed)
            {
                Expect(pageErrors, "uncaught errors on the page").ToEqual(Array.Empty<string>());
            }
        }
        finally
        {
            if (Context != null)
            {
                await SaveTraceIfFailedAsync();
                await Context.CloseAsync();
            }
        }
    }

    /// <summary>
    /// The folder a failed test's trace is saved to, which CI keeps when a run fails.  Open a trace
    /// with "pwsh test/Ren.Client.Tests/bin/Debug/net8.0/playwright.ps1 show-trace &lt;file&gt;", or at
    /// trace.playwright.dev.
    /// </summary>
    public static string TracesFolder => Path.Combine(RepoFiles.Root, "TestResults", "traces");

    // Every test is traced, and the trace kept only if it failed.
    private async Task SaveTraceIfFailedAsync()
    {
        try
        {
            if (TestContext.CurrentTestOutcome == UnitTestOutcome.Passed)
            {
                await Context.Tracing.StopAsync();
                return;
            }

            var name = $"{GetType().Name}.{TestContext.TestName}{(RepoFiles.TestMinified ? ".minified" : "")}.zip";
            var path = Path.Combine(TracesFolder, name);

            await Context.Tracing.StopAsync(new() { Path = path });
            TestContext.AddResultFile(path);
            TestContext.WriteLine($"Trace saved to {path}");
        }
        catch (PlaywrightException)
        {
            // A trace is only a help, so a failure saving one mustn't hide the test's own result.
        }
    }

    /// <summary>
    /// Lets the page throw errors that nothing catches, for a test of what happens then.
    /// </summary>
    protected void AllowPageErrors() => pageErrorsAllowed = true;

    protected static ValueExpectation<T> Expect<T>(T actual, string? message = null) => new(actual, message);

    protected static ILocatorAssertions Expect(ILocator locator) => Assertions.Expect(locator);

    protected static IPageAssertions Expect(IPage page) => Assertions.Expect(page);

    protected static PollExpectation<T> Poll<T>(Func<Task<T>> read, string? message = null, int timeout = Expectations.DefaultTimeout) =>
        new(read, message, timeout);

    protected static PollExpectation<T> Poll<T>(Func<T> read, string? message = null, int timeout = Expectations.DefaultTimeout) =>
        new(() => Task.FromResult(read()), message, timeout);

    protected static Task ToPassAsync(Func<Task> block, int timeout = 30000) => Expectations.ToPassAsync(block, timeout);

    /// <summary>
    /// Gets tab-separated text written with pipes for tabs, trimmed of the blank lines and spaces
    /// around it.  Actual text goes through it too, to be trimmed the same.
    /// </summary>
    protected static string Tsv(string text) => SpacesAndLinesAround().Replace(text.Replace('|', '\t').Replace("\r", ""), "");

    /// <summary>
    /// Evaluates a script on the page, giving its result as JSON.
    /// </summary>
    protected Task<JsonNode?> EvaluateJsonAsync(string expression, object? arg = null) => Page.EvaluateJsonAsync(expression, arg);

    /// <summary>
    /// Evaluates a script on the page, giving its result as the type, read from JSON with web
    /// naming (camelCase), so a record can take a script's object.
    /// </summary>
    protected Task<T> EvaluateAsync<T>(string expression, object? arg = null) => Page.EvaluateAsAsync<T>(expression, arg);

    /// <summary>
    /// Gets the report's saved settings as JSON.stringify writes them.
    /// </summary>
    protected async Task<string> SavedSettingsTextAsync() => Stringify(await Ren.SavedSettingsAsync());

    /// <summary>
    /// Gets a value as JSON.stringify writes it, unindented and with no characters escaped that
    /// needn't be.
    /// </summary>
    protected static string Stringify(object? value) =>
        Matchers.ToNode(value)?.ToJsonString(StringifyOptions) ?? "null";

    private static readonly JsonSerializerOptions StringifyOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    [GeneratedRegex(@"^[ \n]+|[ \n]+$")]
    private static partial Regex SpacesAndLinesAround();
}

/// <summary>
/// Reading a script's result as JSON, or as a record read from it.
/// </summary>
public static class EvaluateExtensions
{
    private static readonly JsonSerializerOptions WebNaming = new(JsonSerializerDefaults.Web);

    public static async Task<JsonNode?> EvaluateJsonAsync(this IPage page, string expression, object? arg = null) =>
        Matchers.ToNode(await page.EvaluateAsync<JsonElement>(expression, arg));

    public static async Task<T> EvaluateAsAsync<T>(this IPage page, string expression, object? arg = null) =>
        (await page.EvaluateAsync<JsonElement>(expression, arg)).Deserialize<T>(WebNaming)!;

    public static async Task<T> EvaluateAsAsync<T>(this ILocator locator, string expression, object? arg = null) =>
        (await locator.EvaluateAsync<JsonElement>(expression, arg)).Deserialize<T>(WebNaming)!;

    public static async Task<T> EvaluateAllAsAsync<T>(this ILocator locator, string expression, object? arg = null) =>
        (await locator.EvaluateAllAsync<JsonElement>(expression, arg)).Deserialize<T>(WebNaming)!;
}
