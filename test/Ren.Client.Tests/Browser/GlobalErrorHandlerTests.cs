namespace Ren.Client.Tests.Browser;

// These tests cover the indicator the global error handler puts on the page when it catches an
// error, and what clicking it does: the error's details are shown in a popup, and the indicator,
// having nothing left to say, is taken off the page.  With no error held there's no popup, and the
// indicator stays.
[TestClass]
public class GlobalErrorHandlerTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";
    private const string ErrorMessage = "Integration test error";
    private const string Indicator = "#ren-global-error-indicator";
    private const string PopupMessageContent = ".qa-ren-popup-message-content";

    private Task RaiseErrorAsync(string message) => Page.EvaluateAsync(
        "(errorMessage) => window.Ren.GlobalErrorHandler.reportError(new Error(errorMessage))",
        message);

    [TestMethod("an error raised shows the indicator carrying its message")]
    public async Task ErrorRaisedShowsTheIndicatorCarryingItsMessage()
    {
        await Ren.OpenAsync(Fixture);
        await RaiseErrorAsync(ErrorMessage);

        // The message is on a data attribute, so a failing test can name the error without the popup.
        await Expect(Page.Locator(Indicator)).ToHaveAttributeAsync("data-error-message", ErrorMessage);
    }

    [TestMethod("the indicator clicked shows the error's popup and leaves the page")]
    public async Task IndicatorClickedShowsTheErrorsPopupAndLeavesThePage()
    {
        await Ren.OpenAsync(Fixture);
        await RaiseErrorAsync(ErrorMessage);

        await Page.ClickAsync(Indicator);

        await Expect(Page.Locator(PopupMessageContent)).ToContainTextAsync(ErrorMessage);
        await Expect(Page.Locator(Indicator)).ToHaveCountAsync(0);
    }

    // An indicator shown by a caller of its own has no error behind it, so there's nothing to say.
    [TestMethod("the indicator clicked with no error held stays on the page")]
    public async Task IndicatorClickedWithNoErrorHeldStaysOnThePage()
    {
        await Ren.OpenAsync(Fixture);
        await Page.EvaluateAsync("() => window.Ren.GlobalErrorHandler.addErrorIndicator()");

        await Page.ClickAsync(Indicator);

        await Expect(Page.Locator(Indicator)).ToHaveCountAsync(1);
        await Expect(Page.Locator(PopupMessageContent)).ToHaveCountAsync(0);
    }

    [TestMethod("an error raised after the indicator was dismissed shows it again")]
    public async Task ErrorRaisedAfterTheIndicatorWasDismissedShowsItAgain()
    {
        await Ren.OpenAsync(Fixture);
        await RaiseErrorAsync(ErrorMessage);
        await Page.ClickAsync(Indicator);
        await Expect(Page.Locator(Indicator)).ToHaveCountAsync(0);

        await RaiseErrorAsync("A second " + ErrorMessage);

        await Expect(Page.Locator(Indicator)).ToHaveAttributeAsync("data-error-message", "A second " + ErrorMessage);
    }
}
