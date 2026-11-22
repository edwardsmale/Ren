using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// Helpers for Ren's confirm popup, the Yes/No question Ren.Popup.confirm asks.
/// </summary>
public static class Popups
{
    private const string ConfirmContent = ".qa-ren-popup-confirm-content";

    /// <summary>
    /// Gets a value indicating whether a confirm popup is showing.
    /// </summary>
    public static async Task<bool> IsConfirmShownAsync(RenContext ren) =>
        await ren.Root.Locator(ConfirmContent).CountAsync() > 0;

    /// <summary>
    /// Answers Yes to the confirm popup, once it shows, and waits for the report to load.
    /// </summary>
    public static Task ClickConfirmYesAsync(RenContext ren) => AnswerConfirmAsync(ren, ".qa-ren-popup-confirm-yes");

    /// <summary>
    /// Answers No to the confirm popup, once it shows, and waits for the report to load.
    /// </summary>
    public static Task ClickConfirmNoAsync(RenContext ren) => AnswerConfirmAsync(ren, ".qa-ren-popup-confirm-no");

    private static async Task AnswerConfirmAsync(RenContext ren, string buttonSelector)
    {
        var content = ren.Root.Locator(ConfirmContent).First;

        await content.WaitForAsync();
        await ren.Root.ClickAsync(ConfirmContent + " " + buttonSelector);
        await content.WaitForAsync(new() { State = WaitForSelectorState.Detached });
        await ren.WaitUntilLoadedAsync();
    }
}
