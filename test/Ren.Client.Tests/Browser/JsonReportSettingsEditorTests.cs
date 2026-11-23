namespace Ren.Client.Tests.Browser;

[TestClass]
public class JsonReportSettingsEditorTests : BrowserTest
{
    private const string Fixture = "ported/MultiSelectContextMenuTest01.html";

    private const string TextareaSelector = ".js-ren-json-report-settings-editor-textarea";

    private const string OrderCountSummed =
        "\"OrderCount\": {\n                                \"aggregationType\": \"Sum\"";

    private async Task OpenJsonSettingsAsync()
    {
        await Ren.Report.RightClickCellAsync("OrderRevenue", 2, shiftKey: true);
        await Ren.Root.MouseOverAsync("#windows-menu");
        await Ren.Root.ClickAsync("#json-report-settings");
    }

    // The page's own report, as the window is a report context too.
    private RenContext PageReport => Ren.Within(".qa-ren-report-context--on-page");

    private Task<string> CurrentSettingsAsync() =>
        Page.EvaluateAsync<string>("() => window.Ren.ReportSerializer.serializeReportSettings()");

    // The page's own report shows the settings it has now, which Ctrl+S would save, rather than
    // those saved: the fixture has no settings endpoints, so there are none to load.
    [TestMethod("JsonSettings_OpenedForThePageReport_ShowsItsCurrentSettings")]
    public async Task JsonSettings_OpenedForThePageReport_ShowsItsCurrentSettings()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SelectAggregationTypeAsync("OrderCount", 2, "sum");

        await OpenJsonSettingsAsync();

        var expected = await CurrentSettingsAsync();

        Expect(expected).ToContain(OrderCountSummed);

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(expected);
    }

    [TestMethod("JsonSettings_SettingsChangedWhileOpen_ShowsTheChange")]
    public async Task JsonSettings_SettingsChangedWhileOpen_ShowsTheChange()
    {
        await Ren.OpenAsync(Fixture);

        await OpenJsonSettingsAsync();

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(await CurrentSettingsAsync());

        await PageReport.SelectAggregationTypeAsync("OrderCount", 2, "sum");

        var expected = await CurrentSettingsAsync();

        Expect(expected).ToContain(OrderCountSummed);

        // Sooner than the window's first check, so it's the change's message that shows it.
        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(
            expected,
            new() { Timeout = 1000 });
    }

    // A change that sends no message is shown when the window next checks.
    [TestMethod("JsonSettings_SettingsChangedWithoutAMessage_ShowsTheChange")]
    public async Task JsonSettings_SettingsChangedWithoutAMessage_ShowsTheChange()
    {
        await Ren.OpenAsync(Fixture);

        await OpenJsonSettingsAsync();

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(await CurrentSettingsAsync());

        await Page.EvaluateAsync(
            "() => { window.Ren.GridStateCollection.entries[0].showRowAndColumnHeadings = false; }");

        var expected = await CurrentSettingsAsync();

        Expect(expected).Not.ToContain("\"showRowAndColumnHeadings\": true");

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(expected);
    }

    [TestMethod("JsonSettings_EditedThenSettingsChanged_KeepsTheEdits")]
    public async Task JsonSettings_EditedThenSettingsChanged_KeepsTheEdits()
    {
        await Ren.OpenAsync(Fixture);

        await OpenJsonSettingsAsync();

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(await CurrentSettingsAsync());

        await Page.Locator(TextareaSelector).FillAsync("{ \"edited\": true }");

        await PageReport.SelectAggregationTypeAsync("OrderCount", 2, "sum");

        // Long enough for the window to have checked for changes several times.
        await Page.WaitForTimeoutAsync(1500);

        Expect(await CurrentSettingsAsync()).ToContain(OrderCountSummed);

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync("{ \"edited\": true }");
    }

    [TestMethod("JsonSettings_CopyAllClicked_PutsTheJsonOnTheClipboard")]
    public async Task JsonSettings_CopyAllClicked_PutsTheJsonOnTheClipboard()
    {
        await Ren.OpenAsync(Fixture);

        await OpenJsonSettingsAsync();

        var expected = await CurrentSettingsAsync();

        await Expect(Page.Locator(TextareaSelector)).ToHaveValueAsync(expected);

        // The clipboard is caught rather than read, as reading it needs a permission.
        await Page.EvaluateAsync("""
            () => {

                window.caughtClipboardText = null;

                navigator.clipboard.writeText = (text) => {

                    window.caughtClipboardText = text;

                    return Promise.resolve();
                };
            }
            """);

        var copyButton = Page.Locator(".js-ren-json-report-settings-editor-copy");

        await Expect(copyButton).ToHaveAttributeAsync(
            "title",
            "Copy all of the JSON settings to the clipboard");

        await copyButton.ClickAsync();

        await Poll(() => Page.EvaluateAsync<string>("() => window.caughtClipboardText")).ToBe(expected);

        await Expect(copyButton).ToHaveTextAsync("Copied");
        await Expect(copyButton).ToHaveTextAsync("Copy all");
    }

    [TestMethod("JsonSettings_CloseClicked_ClosesTheWindow")]
    public async Task JsonSettings_CloseClicked_ClosesTheWindow()
    {
        await Ren.OpenAsync(Fixture);

        await OpenJsonSettingsAsync();

        await Expect(Page.Locator(TextareaSelector)).ToBeVisibleAsync();

        await Page.Locator(".js-ren-json-report-settings-editor-close").ClickAsync();

        await Expect(Page.Locator(TextareaSelector)).ToHaveCountAsync(0);
    }
}
