namespace Ren.Client.Tests.Browser;

// These tests cover the settings groups a grid set gives its tabs: tabs with the same columns share
// a grid state group, and so column widths, while each tab has a data grouping settings group of
// its own.
[TestClass]
public class GridSetSettingsGroupsTests : BrowserTest
{
    // Three tabs: the first and third have the same columns, and the second has other columns.
    private const string Fixture = "ported/GridSetSettingsGroupsTest01.html";

    // Finds the page's grid set and runs a function of it in the page.  The function is given the
    // grid set and named(group, familyGroup), which writes a group with its family group as G.
    private Task<string> EvaluateOnGridSetAsync(string pageFunction) => Page.EvaluateAsync<string>(
        "() => {\n" +
        "    const gridSet = window.Ren.VisualisationCollection.getVisualisations(\"GridSet\")[0];\n" +
        "    const named = (group, familyGroup) => group.replace(familyGroup, \"G\");\n" +
        "    return (" + pageFunction + ")(gridSet, named);\n" +
        "}");

    private Task<string> GridStateGroupsAsync() => EvaluateOnGridSetAsync("""
        (gridSet, named) => gridSet.instance.gridState
            .map(gridState => named(gridState.gridStateGroup, gridSet.gridStateGroup))
            .join(",")
        """);

    private async Task ClickTabAsync(int tabIndex)
    {
        await Ren.Root.Locator(".qa-ren-grid-set-tab-" + tabIndex).First.ClickAsync();
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task<int> ColumnWidthAsync(int gridIndex, string columnHeading)
    {
        var grid = Ren.Grid(gridIndex);
        var indexes = await grid.CellIndexesAsync(columnHeading, 2);

        return await grid.Locator(".ren-data-grid__column-heading.ren-c-" + indexes.ColumnIndex).First
            .EvaluateAsync<int>("element => element.clientWidth");
    }

    // Resizes a column of the visible grid, waiting for the resize, and gets the width it's shown at.
    private async Task<int> SetColumnWidthAsync(int gridIndex, string columnHeading, int width)
    {
        var indexes = await Ren.Grid(gridIndex).CellIndexesAsync(columnHeading, 2);

        await Page.EvaluateAsync(
            "([index, newWidth]) => window.Ren.Messages.Requests.qaColumnWidthChange.notify(index, newWidth)",
            new[] { indexes.ColumnIndex, width });

        // Less the border.
        await Poll(async () => Math.Abs(await ColumnWidthAsync(gridIndex, columnHeading) - width)).ToBeLessThan(3);

        return await ColumnWidthAsync(gridIndex, columnHeading);
    }

    [TestMethod("creating the grid set: tabs with the same columns share a grid state group")]
    public async Task TabsWithTheSameColumnsShareAGridStateGroup()
    {
        await Ren.OpenAsync(Fixture);

        Expect(await GridStateGroupsAsync()).ToBe("G,G[1],G");
    }

    [TestMethod("creating the grid set: a data tab group's tabs with the same columns share the set's group")]
    public async Task ADataTabGroupsTabsWithTheSameColumnsShareTheSetsGroup()
    {
        await Ren.OpenAsync("ported/DataTabGroupTest01.html");

        Expect(await GridStateGroupsAsync()).ToBe("G,G,G");
    }

    [TestMethod("creating the grid set: each tab has its own data grouping settings group")]
    public async Task EachTabHasItsOwnDataGroupingSettingsGroup()
    {
        await Ren.OpenAsync(Fixture);

        var groups = await EvaluateOnGridSetAsync("""
            (gridSet, named) => gridSet.instance.dataGroupingSettings
                .map(settings => named(settings.dataGroupingSettingsGroup, gridSet.dataGroupingSettingsGroup))
                .join(",")
            """);

        Expect(groups).ToBe("G,G[1],G[2]");
    }

    [TestMethod("resizing a column: tabs with the same columns take the width")]
    public async Task TabsWithTheSameColumnsTakeTheWidth()
    {
        await Ren.OpenAsync(Fixture);

        await ClickTabAsync(0);
        var resizedWidth = await SetColumnWidthAsync(0, "Id", 230);

        await ClickTabAsync(2);

        await Poll(() => ColumnWidthAsync(2, "Id")).ToBe(resizedWidth);
    }

    [TestMethod("resizing a column: tabs with other columns keep their widths")]
    public async Task TabsWithOtherColumnsKeepTheirWidths()
    {
        await Ren.OpenAsync(Fixture);

        await ClickTabAsync(1);
        var originalWidth = await ColumnWidthAsync(1, "Id");

        await ClickTabAsync(0);
        await SetColumnWidthAsync(0, "Id", originalWidth + 120);

        await ClickTabAsync(1);

        Expect(await ColumnWidthAsync(1, "Id")).ToBe(originalWidth);
    }

    [TestMethod("the saved settings: tabs with the same columns have their grid state written once")]
    public async Task TabsWithTheSameColumnsHaveTheirGridStateWrittenOnce()
    {
        await Ren.OpenAsync(Fixture);

        await ClickTabAsync(0);
        await SetColumnWidthAsync(0, "Id", 230);

        await ClickTabAsync(1);
        await SetColumnWidthAsync(1, "Id", 240);

        var groups = await EvaluateOnGridSetAsync("""
            (gridSet, named) => Object.keys(window.Ren.ReportSerializer.getReportSettingsObject(false).gridState)
                .filter(group => group.indexOf(gridSet.gridStateGroup) === 0)
                .map(group => named(group, gridSet.gridStateGroup))
                .join(",")
            """);

        Expect(groups).ToBe("G,G[1]");
    }

    [TestMethod("the saved settings: a later tab's grouping has its query fingerprint written first")]
    public async Task ALaterTabsGroupingHasItsQueryFingerprintWrittenFirst()
    {
        await Ren.OpenAsync(Fixture);

        await ClickTabAsync(1);
        await Ren.Grid(1).ChooseFromCellMenuAsync("Days Active", 2, "#grouping-menu", "#group-by-column");
        await Ren.WaitUntilLoadedAsync();

        var settings = await EvaluateOnGridSetAsync("""
            (gridSet) => {

                const tabSettings = window.Ren.ReportSerializer.getReportSettingsObject(false)
                    .dataGroupingSettings[gridSet.dataGroupingSettingsGroup + "[1]"];

                return Object.keys(tabSettings).slice(0, 2).join(",") + " " +
                    tabSettings.queryColumns.join(",");
            }
            """);

        Expect(settings).ToBe("queryEmbedding,queryColumns __Count,Id,Days Active,Search Terms,__Zero");
    }
}
