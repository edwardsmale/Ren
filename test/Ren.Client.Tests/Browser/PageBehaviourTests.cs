using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover what Ren does to the page as a whole, which a third party's page may want to
// keep for itself: catching its errors, and Ctrl+S.  Its errors are only caught where renLogInsert
// is configured, each can be turned off with a feature flag, and the page's own error handlers
// and console.error are left in place either way.
[TestClass]
public class PageBehaviourTests : BrowserTest
{
    private const string Indicator = "#ren-global-error-indicator";

    // Throws from a timer, so the error is uncaught, which the test allows.
    private Task ThrowUncaughtAsync(string message)
    {
        AllowPageErrors();

        return Page.EvaluateAsync("errorMessage => setTimeout(() => { throw new Error(errorMessage); })", message);
    }

    private async Task OpenAndWaitForGridAsync(string fixtureName)
    {
        await Page.GotoAsync("/test/browser/fixtures/" + fixtureName);
        await Expect(Page.Locator(".ren-data-grid__column-heading").First).ToBeAttachedAsync();
    }

    // Gives a timer's error the chance to reach the handlers.
    private Task SettleAsync() => Page.EvaluateAsync("() => new Promise(resolve => setTimeout(resolve, 100))");

    private const string HostOnError = """
        () => {
            window.hostErrors = [];
            window.onerror = (message) => { window.hostErrors.push(String(message)); };
        }
        """;

    [TestMethod("without renLogInsert, the page's errors are left alone")]
    public async Task WithoutRenLogInsertThePagesErrorsAreLeftAlone()
    {
        await OpenAndWaitForGridAsync("grid.html");

        await ThrowUncaughtAsync("Uncaught error");
        await Page.EvaluateAsync("() => console.error('Logged error')");
        await SettleAsync();

        await Expect(Page.Locator(Indicator)).ToHaveCountAsync(0);
    }

    [TestMethod("with renLogInsert, an uncaught error shows the indicator")]
    public async Task WithRenLogInsertAnUncaughtErrorShowsTheIndicator()
    {
        await OpenAndWaitForGridAsync("error-logging.html");

        await ThrowUncaughtAsync("Host error");

        await Expect(Page.Locator(Indicator)).ToHaveAttributeAsync("data-error-message", new Regex("Host error"));
    }

    [TestMethod("the page's own console.error isn't caught")]
    public async Task ThePagesOwnConsoleErrorIsntCaught()
    {
        await OpenAndWaitForGridAsync("error-logging.html");

        await Page.EvaluateAsync("() => console.error('Logged error')");

        await Expect(Page.Locator(Indicator)).ToHaveCountAsync(0);
    }

    [TestMethod("the page's own onerror still sees an uncaught error")]
    public async Task ThePagesOwnOnErrorStillSeesAnUncaughtError()
    {
        await OpenAndWaitForGridAsync("error-logging.html");
        await Page.EvaluateAsync(HostOnError);

        await ThrowUncaughtAsync("Host error");

        await Expect(Page.Locator(Indicator)).ToHaveAttributeAsync("data-error-message", new Regex("Host error"));

        var hostErrors = await Page.EvaluateAsync<string[]>("() => window.hostErrors");

        Expect(hostErrors).ToHaveLength(1);
        Expect(hostErrors[0]).ToContain("Host error");
    }

    [TestMethod("an onerror set before ren.js loaded isn't replaced")]
    public async Task AnOnErrorSetBeforeRenJsLoadedIsntReplaced()
    {
        await Page.AddInitScriptAsync($"({HostOnError})()");
        await OpenAndWaitForGridAsync("error-logging.html");

        await ThrowUncaughtAsync("Early host error");

        await Poll(async () =>
        {
            var hostErrors = await Page.EvaluateAsync<string[]>("() => window.hostErrors");

            return hostErrors.Length == 1 && hostErrors[0].Contains("Early host error");

        }).ToBe(true);
    }

    [TestMethod("globalErrorHandler off leaves uncaught errors alone")]
    public async Task GlobalErrorHandlerOffLeavesUncaughtErrorsAlone()
    {
        await OpenAndWaitForGridAsync("page-behaviour-off.html");

        await ThrowUncaughtAsync("Uncaught error");
        await SettleAsync();

        await Expect(Page.Locator(Indicator)).ToHaveCountAsync(0);
    }

    private Task CountSaveRequestsAsync() => Page.EvaluateAsync("""
        () => {
            window.saveRequests = 0;
            window.Ren.Messages.Requests.saveCurrentReportSettings.handle(() => window.saveRequests++);
        }
        """);

    [TestMethod("Ctrl+S saves the report's settings")]
    public async Task CtrlSSavesTheReportsSettings()
    {
        await Ren.OpenAsync("grid.html");
        await CountSaveRequestsAsync();

        await Page.Keyboard.PressAsync("Control+s");

        await Poll(() => Page.EvaluateAsync<int>("() => window.saveRequests")).ToBe(1);
    }

    [TestMethod("saveShortcut off leaves Ctrl+S to the browser")]
    public async Task SaveShortcutOffLeavesCtrlSToTheBrowser()
    {
        await Ren.OpenAsync("page-behaviour-off.html");
        await CountSaveRequestsAsync();
        await Page.EvaluateAsync("""
            () => window.addEventListener("keydown", (e) => {

                window.saveDefaultPrevented = e.defaultPrevented;
            })
            """);

        await Page.Keyboard.PressAsync("Control+s");
        await SettleAsync();

        Expect(await Page.EvaluateAsync<int>("() => window.saveRequests")).ToBe(0);
        Expect(await Page.EvaluateAsync<bool>("() => window.saveDefaultPrevented")).ToBe(false);
    }
}
