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
}
