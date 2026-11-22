using Microsoft.Playwright;

// 16 workers rather than one per core: with 32, the machine is busy enough that some tests time out.
[assembly: Parallelize(Workers = 16, Scope = ExecutionScope.MethodLevel)]

namespace Ren.Client.Tests;

/// <summary>
/// The one browser every test shares, each test in its own context (a fresh profile), with the
/// repo served by RepoServer.
///
/// REN_CHROME_PATH names a Chrome to drive, such as a Chrome for Testing.  Without it, Playwright's
/// own Chromium is used, which "pwsh test/Ren.Client.Tests/bin/Debug/net8.0/playwright.ps1 install
/// chromium" downloads.
/// </summary>
[TestClass]
public static class TestBrowser
{
    /// <summary>
    /// The origin the repo is served at.
    /// </summary>
    public static string Origin { get; private set; } = "";

    private static IPlaywright? playwright;
    private static IBrowser? browser;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        Origin = RepoServer.Start();

        playwright = await Microsoft.Playwright.Playwright.CreateAsync();

        var executablePath = Environment.GetEnvironmentVariable("REN_CHROME_PATH");

        browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            ExecutablePath = string.IsNullOrEmpty(executablePath) ? null : executablePath
        });
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        if (browser != null) await browser.CloseAsync();

        playwright?.Dispose();

        RepoServer.Stop();
    }

    /// <summary>
    /// Gets the Playwright driver, for its selectors and devices.
    /// </summary>
    public static IPlaywright Playwright => playwright ?? throw new InvalidOperationException("The browser hasn't started.");

    /// <summary>
    /// Creates a context, with the repo served at the origin, which a relative URL is taken from.
    /// </summary>
    public static async Task<IBrowserContext> NewContextAsync(BrowserNewContextOptions options)
    {
        if (browser == null) throw new InvalidOperationException("The browser hasn't started.");

        options.BaseURL ??= Origin;

        return await browser.NewContextAsync(options);
    }

    /// <summary>
    /// Opens a new page, in a context of its own sized as a desktop browser at 1024x768, at the
    /// origin's empty page, with the specified scripts added before any of the page's own.
    /// </summary>
    public static async Task<IPage> OpenPageAsync(params string[] initScriptRepoPaths)
    {
        var context = await NewContextAsync(new BrowserNewContextOptions
        {
            ViewportSize = new ViewportSize { Width = 1024, Height = 768 },
            Locale = "en-US"
        });

        foreach (var repoPath in initScriptRepoPaths)
        {
            await context.AddInitScriptAsync(scriptPath: RepoFiles.GetFullPath(repoPath));
        }

        var page = await context.NewPageAsync();

        await page.GotoAsync("/");

        return page;
    }
}
