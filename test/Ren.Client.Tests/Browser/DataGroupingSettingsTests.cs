namespace Ren.Client.Tests.Browser;

// These tests cover a data grid's data grouping settings: the groupings, sort order, aggregations,
// totals row and column visibility a report's settings give it, how they survive ungrouping and
// regrouping, and how grids in the same settings group stay in step.
//
// Most fixtures group the same rows by ID, giving 16 groups (IDs 22-37) and, below them, the totals
// row at row 18.
[TestClass]
public class DataGroupingSettingsTests : BrowserTest
{
    private const string GroupExpandCollapseButton = "ren-data-grid__group-expand-collapse-button";

    private const string SelvaleMount = "Selvale Slimline Mount Type B, Grey, Pack of 12";

    private const int TotalsRow = 18;

    private static async Task UngroupAsync(RenContext context, string columnHeading)
    {
        await context.ChooseFromCellMenuAsync(columnHeading, 2, "#grouping-menu", "#remove-all-groupings");
        await context.WaitUntilLoadedAsync();
    }

    private static async Task GroupByColumnAsync(RenContext context, string columnHeading)
    {
        await context.ChooseFromCellMenuAsync(columnHeading, 2, "#grouping-menu", "#group-by-column");
        await context.WaitUntilLoadedAsync();
    }

    // Gets the headings of the data grid's visible columns, in order.
    private Task<string[]> VisibleHeadingsAsync() => EvaluateAsync<string[]>("""
        (scope) => {
            const headerCells = document.querySelectorAll((scope + " .ren-data-grid__cell.ren-r-0").trim());

            return Array.from(headerCells)
                .filter((cell) => cell.offsetWidth > 0)
                .map((cell) => cell.querySelector(".ren-data-grid__header-cell-value"))
                .filter((value) => value)
                .map((value) => value.innerText);
        }
        """, Ren.Report.ScopeSelector);

    private async Task ClickShowHideColumnsListItemAsync(string columnHeading)
    {
        var selector = ".qa-ren-show-hide-columns-list-item--" + columnHeading.Replace(" ", "");

        await Ren.Root.Locator(selector).First.DispatchEventAsync("mousedown", new { bubbles = true });
        await Ren.WaitUntilLoadedAsync();
    }

    private Task ExpectCellTextAsync(RenContext context, string columnHeading, int rowHeading, string expected) =>
        Poll(() => context.CellTextAsync(columnHeading, rowHeading)).ToBe(expected);

    private Task ExpectColumnTextAsync(RenContext context, string columnHeading, string expected) =>
        Poll(async () => Tsv(await context.ColumnTextAsync(columnHeading))).ToBe(Tsv(expected));

    [TestMethod("sorting and grouping: rows sorted by ID ascending come in ascending order")]
    public async Task SortingAndGrouping_RowsSortedByIdAscending()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest01.html");

        await ExpectCellTextAsync(Ren.Report, "Id", 2, "22");
        await ExpectCellTextAsync(Ren.Report, "Id", 4, "23");
    }

    [TestMethod("sorting and grouping: rows sorted by ID descending come in descending order")]
    public async Task SortingAndGrouping_RowsSortedByIdDescending()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest02.html");

        await ExpectCellTextAsync(Ren.Report, "Id", 2, "37");
        await ExpectCellTextAsync(Ren.Report, "Id", 4, "36");
    }

    [TestMethod("sorting and grouping: removing the inner grouping keeps the outermost one's order")]
    public async Task SortingAndGrouping_RemovingInnerGroupingKeepsOuterOrder()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest02.html");

        await UngroupAsync(Ren.Report, "Id");

        await ExpectCellTextAsync(Ren.Report, "Id", 2, "37");
        await ExpectCellTextAsync(Ren.Report, "Id", 4, "36");
    }

    [TestMethod]
    [DataRow("ported/DataGroupingSettingsTest03.html", DisplayName = "sorting and grouping: rows grouped and sorted by ID come in ID order")]
    [DataRow("ported/DataGroupingSettingsTest05.html", DisplayName = "sorting and grouping: a ---GroupBy directive on the ID column groups the grid by ID")]
    public async Task SortingAndGrouping_GroupedById(string fixture)
    {
        await Ren.OpenAsync(fixture);

        await ExpectCellTextAsync(Ren.Report, "Id", 2, "22");
        await ExpectCellTextAsync(Ren.Report, "Id", 3, "23");
        await ExpectCellTextAsync(Ren.Report, "Id", 4, "24");
        await ExpectCellTextAsync(Ren.Report, "Id", 5, "26");
    }

    [TestMethod("sorting and grouping: a grouping with no outermost grouping still groups the grid")]
    public async Task SortingAndGrouping_NoOutermostGroupingStillGroups()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest07.html");

        await Ren.Report.SelectCellsAsync("Id", 2, "Id", 4);

        Expect(Tsv(await Ren.Report.SelectedTextAsync())).ToBe("22\n23\n24");
    }

    [TestMethod("sorting and grouping: groups sorted descending by a date column come newest first")]
    public async Task SortingAndGrouping_DateDescendingNewestFirst()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest19.html");

        string[] expected =
        [
            "CreatedOn",
            .. Enumerable.Repeat("18/01/2024", 4),
            .. Enumerable.Repeat("15/01/2024", 5),
            .. Enumerable.Repeat("12/01/2024", 7)
        ];

        await ExpectColumnTextAsync(Ren.Report, "CreatedOn", string.Join("\n", expected));
    }

    [TestMethod("sorting and grouping: a numeric column's null average sorts lowest")]
    public async Task SortingAndGrouping_NullAverageSortsLowest()
    {
        // Alphabetically "10" would sort before "9".
        await Ren.OpenAsync("ported/DataGroupingSettingsTest30.html");

        await ExpectCellTextAsync(Ren.Report, "Num", 2, "1");
        await ExpectCellTextAsync(Ren.Report, "Num", 3, "9");
        await ExpectCellTextAsync(Ren.Report, "Num", 4, "10");
    }

    [TestMethod("aggregation: group rows show the aggregations the settings give")]
    public async Task Aggregation_GroupRowsShowSettingsAggregations()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");

        await ExpectCellTextAsync(Ren.Report, "CreatedOn", 2, "12/01/2024");
        await ExpectCellTextAsync(Ren.Report, "CreatedOn", 3, "12/01/2024");
        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", 2, "2.4");
        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", 3, "2.57");

        Expect(await Ren.Report.CellHtmlAsync("Product Code", 2)).ToContain(GroupExpandCollapseButton);

        await ExpectCellTextAsync(Ren.Report, "Product Name", 2, "");
        await ExpectCellTextAsync(Ren.Report, "Product Name", 7, "Dunford Precision Clamp Type A, Large");
    }

    [TestMethod("aggregation: an aggregation chosen after ungrouping and regrouping applies")]
    public async Task Aggregation_ChosenAfterRegroupingApplies()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");

        await UngroupAsync(Ren.Report, "Id");
        await GroupByColumnAsync(Ren.Report, "Id");
        await Ren.Report.SelectAggregationTypeAsync("Days Active", 2, "sum");

        await ExpectCellTextAsync(Ren.Report, "Days Active", 2, "236");
        await ExpectCellTextAsync(Ren.Report, "Days Active", 8, "118");
    }

    [TestMethod("aggregation: nested groupings are formatted and aggregated at every level")]
    public async Task Aggregation_NestedGroupingsAtEveryLevel()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest04.html");

        await ExpectCellTextAsync(Ren.Report, "CreatedOn", 2, "12/01/2024");
        await ExpectCellTextAsync(Ren.Report, "CreatedOn", 3, "15/01/2024");
        await ExpectCellTextAsync(
            Ren.Report,
            "Product Code",
            2,
            "XQ61272 ᵡ 2，YE34146 ᵡ 1，XN31916 ᵡ 1，XH45800 ᵡ 1，UC61416 ᵡ 1，" +
                "TC32640 ᵡ 1，TA48851 ᵡ 1，SY45259 ᵡ 1，SY44450 ᵡ 1，SX01725 ᵡ 1，SV29180 ᵡ 1");

        Expect(await Ren.Report.CellHtmlAsync("Search Terms", 2)).ToContain(GroupExpandCollapseButton);
        Expect(await Ren.Report.CellHtmlAsync("Product Name", 2)).ToContain(GroupExpandCollapseButton);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await ExpectCellTextAsync(Ren.Report, "Product Code", 4, "SX01725，XN31916");

        // The second group inside the first.
        await Ren.Report.ExpandCollapseGroupAsync(4);
        await ExpectCellTextAsync(Ren.Report, "Product Code", 5, "SX01725");
        await ExpectCellTextAsync(Ren.Report, "Product Code", 6, "XN31916");
    }

    [TestMethod]
    [DataRow("Active", "Sort low to high", DisplayName = "aggregation: a string column counted is formatted as a number")]
    [DataRow("Days Active", "Sort ascending", DisplayName = "aggregation: a number column concatenated is formatted as a string")]
    public async Task Aggregation_AggregatedColumnFormat(string columnHeading, string sortText)
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest08.html");

        await Ren.Report.RightClickCellAsync(columnHeading, 2);

        await Expect(Ren.Root.Locator("#sort-ascending")).ToHaveTextAsync(sortText);
    }

    [TestMethod("aggregation: a null group-by value doesn't stop data rows being formatted")]
    public async Task Aggregation_NullGroupByValueDoesNotStopFormatting()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest23.html");

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.SetCellFormatAsync("Val", 3, "#format-null-values", "#format-null-values-as-zero");
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("aggregation: a count with respect to ID counts each ID once")]
    public async Task Aggregation_CountWithRespectToId()
    {
        // Every row in a group shares its ID, so each group counts 1 and the totals row 16.
        await Ren.OpenAsync("ported/DataGroupingSettingsTest28.html");

        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", 2, "1");
        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", 3, "1");
        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", TotalsRow, "16");
    }

    [TestMethod("aggregation: a sum with respect to ID sums each ID once")]
    public async Task Aggregation_SumWithRespectToId()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest29.html");

        await ExpectCellTextAsync(Ren.Report, "Days Active", 2, "118");
        await ExpectCellTextAsync(Ren.Report, "Days Active", 3, "118");
        await ExpectCellTextAsync(Ren.Report, "Days Active", 17, "118");
    }

    [TestMethod("totals row: an aggregation chosen on the totals row applies to it")]
    public async Task TotalsRow_AggregationChosenApplies()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");

        await Ren.Report.SelectAggregationTypeAsync("Days Active", TotalsRow, "sum");

        await ExpectCellTextAsync(Ren.Report, "Days Active", TotalsRow, "3304");
    }

    [TestMethod("totals row: the totals row shows the settings' and the default totals")]
    public async Task TotalsRow_ShowsSettingsAndDefaultTotals()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");

        // An integer column sums by default.
        await ExpectCellTextAsync(Ren.Report, "Days Active", TotalsRow, "3304");
        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", TotalsRow, "37.42");

        // A date column's group rows get an expand button, but the totals row mustn't.
        Expect(await Ren.Report.CellHtmlAsync("CreatedOn", TotalsRow)).ToBe("");
    }

    [TestMethod("totals row: a column with no total leaves its totals cell empty")]
    public async Task TotalsRow_NoTotalLeavesCellEmpty()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");

        await Ren.Report.SelectAggregationTypeAsync("Days Active", TotalsRow, "no-total");

        await ExpectCellTextAsync(Ren.Report, "Days Active", TotalsRow, "");
        await ExpectCellTextAsync(Ren.Report, "Unique Searches Per Day", TotalsRow, "37.42");
    }

    [TestMethod("totals row: a totals row positioned None isn't shown")]
    public async Task TotalsRow_PositionedNoneIsNotShown()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest26.html");

        // The heading and the 16 groups.
        await Poll(async () => Tsv(await Ren.Report.ColumnTextAsync("Id")).Split('\n').Length).ToBe(17);
    }

    [TestMethod("totals row: a totals row positioned Top comes before the groups")]
    public async Task TotalsRow_PositionedTopComesFirst()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest27.html");

        await ExpectCellTextAsync(Ren.Report, "Days Active", 2, "3304");
        await ExpectCellTextAsync(Ren.Report, "Id", 3, "22");
    }

    [TestMethod("group expansion: groups expand and collapse, showing the right rows")]
    public async Task GroupExpansion_ExpandAndCollapse()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(9);

        await ExpectCellTextAsync(Ren.Report, "Product Name", 4, SelvaleMount);
        await ExpectCellTextAsync(Ren.Report, "Product Code", 4, "TA48851");
        await ExpectCellTextAsync(Ren.Report, "Product Code", 10, "UC61416");

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await ExpectCellTextAsync(Ren.Report, "Id", 3, "23");

        // This group holds a discontinued product.
        await Ren.Report.ExpandCollapseGroupAsync(13);
        await ExpectCellTextAsync(Ren.Report, "Discontinued", 15, "TB44445");

        // The expand/collapse buttons inside the Product Code column work too.
        async Task<string> ButtonAsync() =>
            await Ren.Report.CellSelectorAsync("Product Code", 2) + " ." + GroupExpandCollapseButton;

        await Ren.Root.ClickAsync(await ButtonAsync());
        await Ren.WaitUntilLoadedAsync();
        await ExpectCellTextAsync(Ren.Report, "Product Name", 4, SelvaleMount);
        await ExpectCellTextAsync(Ren.Report, "Product Code", 4, "TA48851");

        await Ren.Root.ClickAsync(await ButtonAsync());
        await Ren.WaitUntilLoadedAsync();
        await ExpectCellTextAsync(Ren.Report, "Id", 3, "23");
    }

    [TestMethod("group expansion: a group collapses again with a date/value chart on the page")]
    public async Task GroupExpansion_CollapsesWithDateValueChartOnPage()
    {
        // Each part of the code once held its own expanded groups, so the group expanded but
        // its button never turned into a collapse button.
        await Ren.OpenAsync("ported/DataGroupingSettingsTest22.html");

        await Ren.Report.ExpandCollapseGroupAsync(2);

        string[] expanded = ["CreatedOn", .. Enumerable.Repeat("12/01/2024", 13), "15/01/2024", "18/01/2024"];

        await ExpectColumnTextAsync(Ren.Report, "CreatedOn", string.Join("\n", expanded));

        await Ren.Report.ExpandCollapseGroupAsync(2);

        await ExpectColumnTextAsync(Ren.Report, "CreatedOn", "CreatedOn\n12/01/2024\n15/01/2024\n18/01/2024");
    }

    [TestMethod("column visibility: a ---Hide directive hides its column")]
    public async Task ColumnVisibility_HideDirectiveHidesColumn()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest04.html");

        var headings = await VisibleHeadingsAsync();

        Expect(headings).ToContain("Id");
        Expect(headings).ToContain("Active");
        Expect(headings).ToContain("Unique Searches Per Day");
        Expect(headings).Not.ToContain("Total Searches");
    }

    [TestMethod("column visibility: the settings' visible columns are the only ones shown")]
    public async Task ColumnVisibility_OnlySettingsColumnsShown()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest05.html");

        Expect((await VisibleHeadingsAsync()).Order(StringComparer.Ordinal).ToArray()).ToEqual(new[]
        {
            "CreatedOn",
            "Id",
            "Product Code",
            "Product Name",
            "Search Terms",
            "Unique Searches Per Day"
        });
    }

    [TestMethod("column visibility: the show/hide columns window shows and hides columns")]
    public async Task ColumnVisibility_ShowHideColumnsWindow()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest04.html");

        await Ren.Report.ClickAsync(".qa-ren-show-hide-columns-link");

        await ClickShowHideColumnsListItemAsync("CreatedOn");
        await Poll(async () => (await VisibleHeadingsAsync()).Contains("CreatedOn")).ToBe(false);

        await ClickShowHideColumnsListItemAsync("CreatedOn");
        await Poll(async () => (await VisibleHeadingsAsync()).Contains("CreatedOn")).ToBe(true);

        // Hidden to start with by its ---Hide directive.
        await ClickShowHideColumnsListItemAsync("Total Searches");
        await Poll(async () => (await VisibleHeadingsAsync()).Contains("Total Searches")).ToBe(true);
    }

    private async Task ExpectGroupedByCreatedOnAsync(RenContext grid)
    {
        await ExpectCellTextAsync(grid, "CreatedOn", 2, "12/01/2024");
        await ExpectCellTextAsync(grid, "CreatedOn", 3, "15/01/2024");
        await ExpectCellTextAsync(grid, "CreatedOn", 4, "18/01/2024");
    }

    [TestMethod("settings groups: regrouping a grid regroups only those in its settings group")]
    public async Task SettingsGroups_RegroupingOnlyAffectsItsGroup()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest11.html");

        await UngroupAsync(Ren.Report.Grid(0), "CreatedOn");
        await GroupByColumnAsync(Ren.Report.Grid(0), "CreatedOn");

        await ExpectGroupedByCreatedOnAsync(Ren.Report.Grid(0));
        await ExpectGroupedByCreatedOnAsync(Ren.Report.Grid(1));

        // The third grid is in another settings group, so it's still ungrouped.
        await ExpectCellTextAsync(Ren.Report.Grid(2), "CreatedOn", 2, "12/01/2024");
        await ExpectCellTextAsync(Ren.Report.Grid(2), "CreatedOn", 3, "12/01/2024");
        await ExpectCellTextAsync(Ren.Report.Grid(2), "CreatedOn", 4, "12/01/2024");
    }

    [TestMethod("settings groups: regrouping a grid regroups all three in its settings group")]
    public async Task SettingsGroups_RegroupingAffectsAllThree()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest12.html");

        await UngroupAsync(Ren.Report.Grid(0), "CreatedOn");
        await GroupByColumnAsync(Ren.Report.Grid(0), "CreatedOn");

        await ExpectGroupedByCreatedOnAsync(Ren.Report.Grid(0));
        await ExpectGroupedByCreatedOnAsync(Ren.Report.Grid(1));
        await ExpectGroupedByCreatedOnAsync(Ren.Report.Grid(2));
    }

    [TestMethod("settings groups: grid sets in different settings groups load their own groupings")]
    public async Task SettingsGroups_GridSetsLoadOwnGroupings()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest14.html");

        var firstGrid = Ren.Report.Grid(0);
        var secondGrid = Ren.Report.Grid(1);

        await firstGrid.SelectCellsAsync("Id", 2, "Id", 4);
        Expect(Tsv(await firstGrid.SelectedTextAsync())).ToBe("22\n23\n24");

        await secondGrid.SelectCellsAsync("CreatedOn", 2, "CreatedOn", 4);
        Expect(Tsv(await secondGrid.SelectedTextAsync())).ToBe("12/01/2024\n15/01/2024\n18/01/2024");
    }
}
