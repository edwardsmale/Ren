namespace Ren.Client.Tests.Browser;

// These tests cover grouping a grid: copying group rows, sorting groups and the rows within them,
// adding a grouping or changing an aggregation while groups are expanded, the single-value
// aggregations, and binning a grouped column's values.
[TestClass]
public class GroupingTests : BrowserTest
{
    // Margin terms by account, with nine accounts over twenty-odd rows.
    private const string GroupTestsFixture = "ported/GroupTests.html";

    private const string AllHeadings =
        "CustomerRef|ProductCodes|LastEditedBy|PricingMethod|MarginPercentage|" +
        "DiscountPercentage|CreatedOn|UpdatedOn|FindCustomerLink|ViewCustomerReportLink";

    private const string TotalsRow = "|||Markup|30.20%|||||";

    private static readonly Dictionary<string, string> AccountRows = new()
    {
        ["A10001"] = "A10001||Jess|Markup|33.50%||||A10001|A10001",
        ["A10002"] = "A10002|PRD9505|Alexis|Markup|53.00%||01/02/2024 13:15:42|01/02/2024 13:15:42|A10002|A10002",
        ["B20001"] = "B20001|PRD7333|Jess|Markup|47.00%||31/01/2024 11:56:00|31/01/2024 11:56:08|B20001|B20001",
        ["B20002"] = "B20002||Jess|Markup|5.13%||29/01/2024 17:16:27||B20002|B20002",
        ["B20003"] = "B20003||Jess|Markup|35.50%||||B20003|B20003",
        ["C30001"] = "C30001|PRD7019|Jess|Markup|28.50%|||24/01/2024 10:55:00|C30001|C30001",
        ["C30002"] = "C30002|PRD4564|Jess|Markup|40.50%||22/01/2024 12:04:35|22/01/2024 12:04:35|C30002|C30002",
        ["C30003"] = "C30003||Sami|Markup|31.00%||||C30003|C30003",
        ["C30004"] = "C30004|PRD6059|Jess|Markup|26.00%||12/02/2024 14:53:07|12/02/2024 14:53:07|C30004|C30004"
    };

    private static string[] AllRowsFor(params string[] accountRefs) =>
        [AllHeadings, .. accountRefs.Select(accountRef => AccountRows[accountRef]), TotalsRow];

    private async Task ChooseFromColumnMenuAsync(string columnHeading, params string[] itemSelectors)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, 2, itemSelectors);
        await Ren.WaitUntilLoadedAsync();
    }

    private Task GroupByColumnAsync(string columnHeading) =>
        ChooseFromColumnMenuAsync(columnHeading, "#grouping-menu", "#group-by-column");

    private Task GroupByColumnWithBinningAsync(string columnHeading, string parentMenuId, string binningMenuId) =>
        ChooseFromColumnMenuAsync(columnHeading, "#grouping-menu", "#" + parentMenuId, "#" + binningMenuId);

    private async Task SortFromCellAsync(string columnHeading, int rowHeading, string direction)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, rowHeading, "#sort-" + direction);
        await Ren.WaitUntilLoadedAsync();
    }

    private Task ExpectAllTextAsync(params string[] expected) =>
        Poll(async () =>
        {
            await Ren.Report.SelectAllAsync();
            return Tsv(await Ren.Report.SelectedTextAsync());
        }).ToBe(Tsv(string.Join("\n", expected)));

    private Task ExpectColumnTextAsync(string columnHeading, params string[] expected) =>
        Poll(async () => Tsv(await Ren.Report.ColumnTextAsync(columnHeading))).ToBe(string.Join("\n", expected));

    [TestMethod("copying grouped rows: selecting the whole grid copies the group rows")]
    public async Task CopyingGroupedRows_WholeGrid()
    {
        await Ren.OpenAsync(GroupTestsFixture);

        await GroupByColumnAsync("CustomerRef");

        await ExpectAllTextAsync(AllRowsFor(
            "A10001", "A10002", "B20001", "B20002", "B20003", "C30001", "C30002", "C30003", "C30004"));
    }

    [TestMethod("copying grouped rows: selecting columns copies just those columns")]
    public async Task CopyingGroupedRows_Columns()
    {
        await Ren.OpenAsync(GroupTestsFixture);

        await GroupByColumnAsync("CustomerRef");
        await Ren.Report.SelectColumnsAsync("CustomerRef", "ProductCodes");

        await Poll(async () => Tsv(await Ren.Report.SelectedTextAsync())).ToBe(Tsv("""
            CustomerRef|ProductCodes
            A10001|
            A10002|PRD9505
            B20001|PRD7333
            B20002|
            B20003|
            C30001|PRD7019
            C30002|PRD4564
            C30003|
            C30004|PRD6059
            |
            """));
    }

    [TestMethod("copying grouped rows: selecting rows copies just those rows")]
    public async Task CopyingGroupedRows_Rows()
    {
        await Ren.OpenAsync(GroupTestsFixture);

        await GroupByColumnAsync("CustomerRef");
        await Ren.Report.SelectRowsAsync(2, 3);

        await Poll(async () => Tsv(await Ren.Report.SelectedTextAsync()))
            .ToBe(Tsv(AccountRows["A10001"] + "\n" + AccountRows["A10002"]));
    }

    [TestMethod]
    [DataRow("ascending", new[] { "B20002", "C30004", "C30001", "C30003", "A10001", "B20003", "C30002", "B20001", "A10002" },
        DisplayName = "sorting groups: groups sorted ascending are copied in order")]
    [DataRow("descending", new[] { "A10002", "B20001", "C30002", "B20003", "A10001", "C30003", "C30001", "C30004", "B20002" },
        DisplayName = "sorting groups: groups sorted descending are copied in order")]
    public async Task SortingGroups_CopiedInOrder(string direction, string[] accountRefs)
    {
        await Ren.OpenAsync(GroupTestsFixture);

        await GroupByColumnAsync("CustomerRef");
        await SortFromCellAsync("MarginPercentage", 2, direction);

        await ExpectAllTextAsync(AllRowsFor(accountRefs));
    }

    [TestMethod("sorting groups: sorting from a data row sorts the rows within every group")]
    public async Task SortingGroups_FromDataRowSortsWithinEveryGroup()
    {
        await Ren.OpenAsync(GroupTestsFixture);

        await GroupByColumnAsync("CustomerRef");
        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(8);
        await SortFromCellAsync("MarginPercentage", 3, "ascending");

        await ExpectAllTextAsync(
            AllHeadings,
            AccountRows["A10001"],
            "A10001|PRD8265|Jess|Markup|23.00%|||08/02/2024 07:43:01|A10001|A10001",
            "A10001|PRD6059|Jess|Markup|25.00%|||08/02/2024 07:41:40|A10001|A10001",
            "A10001|PRD6417|Jess|Markup|52.50%|||08/02/2024 07:42:03|A10001|A10001",
            AccountRows["A10002"],
            AccountRows["B20001"],
            AccountRows["B20002"],
            "B20002|PRD3194|Jess|Markup|3.50%||29/01/2024 17:16:27|29/01/2024 17:17:10|B20002|B20002",
            "B20002|PRD3278|Jess|Markup|3.50%||29/01/2024 17:16:27|29/01/2024 17:17:20|B20002|B20002",
            "B20002|PRD3567|Jess|Markup|3.50%||29/01/2024 17:16:27|29/01/2024 17:17:29|B20002|B20002",
            "B20002|PRD4488|Jess|Markup|10.00%||29/01/2024 17:16:27|29/01/2024 17:17:55|B20002|B20002",
            AccountRows["B20003"],
            AccountRows["C30001"],
            AccountRows["C30002"],
            AccountRows["C30003"],
            AccountRows["C30004"],
            TotalsRow);
    }

    // Grouped by CreatedOn.
    private const string ExpandedGroupsFixture = "ported/GroupByColumnsTest01.html";

    [TestMethod("expanded groups: adding a grouping keeps expanded groups expanded")]
    public async Task ExpandedGroups_AddingAGroupingKeepsThemExpanded()
    {
        await Ren.OpenAsync(ExpandedGroupsFixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(10);
        await ChooseFromColumnMenuAsync("UserGuid", "#grouping-menu", "#add-grouping-submenu", "#group-by-column");

        await ExpectAllTextAsync(
            "CreatedOn|UserGuid",
            "27/07/2024|",
            "27/07/2024|2c11e494-cb07-4f11-9cb4-717682c4bd02",
            "27/07/2024|9af9ed02-5601-4c56-9fbb-5522e53a50ae",
            "28/07/2024|",
            "29/07/2024|",
            "29/07/2024|00fb8673-8b42-4c83-9484-f3e32248c1e8",
            "29/07/2024|0fda099b-f4fa-4c9d-8f89-263ddbaf9bf7",
            "29/07/2024|19bd1950-e424-45cd-bcbd-abb46a5379a6",
            "29/07/2024|39cd3878-2477-4202-81ef-0267b55cbc8c",
            "29/07/2024|6948c14d-dc65-4e45-9d6f-86584e9fd76b",
            "29/07/2024|994d72b7-88ef-4214-a6ed-8e47eac5efd0",
            "29/07/2024|be4da511-fb48-4186-b2b2-33e00fe79b28");
    }

    [TestMethod("expanded groups: changing an aggregation keeps expanded groups expanded")]
    public async Task ExpandedGroups_ChangingAnAggregationKeepsThemExpanded()
    {
        await Ren.OpenAsync(ExpandedGroupsFixture);

        await Ren.Report.ExpandCollapseGroupAsync(3);
        await Ren.Report.SelectAggregationTypeAsync("UserGuid", 2, "single-values-only");
        await Ren.WaitUntilLoadedAsync();

        await ExpectAllTextAsync(
            "CreatedOn|UserGuid",
            "27/07/2024|",
            "28/07/2024|",
            "28/07/2024|8dae18ae-fd9f-4f8d-885b-8cf8d6ab8430",
            "28/07/2024|8dae18ae-fd9f-4f8d-885b-8cf8d6ab8430",
            "28/07/2024|e8a2b69d-641a-4bf5-91be-cdf3f486bc9b",
            "28/07/2024|8dae18ae-fd9f-4f8d-885b-8cf8d6ab8430",
            "28/07/2024|8dae18ae-fd9f-4f8d-885b-8cf8d6ab8430",
            "29/07/2024|");
    }

    [TestMethod("aggregations: the totals row counts distinct values")]
    public async Task Aggregations_TotalsRowCountsDistinctValues()
    {
        // It once showed 23.
        await Ren.OpenAsync("ported/CountsAndTotalsTest01.html");

        await Poll(() => Ren.Report.CellTextAsync("CustomerRef", 27)).ToBe("24");
    }

    [TestMethod]
    [DataRow("ported/CountAggregationTest01.html", "multiple values",
        DisplayName = "aggregations: single value or placeholder shows a placeholder for several values")]
    [DataRow("ported/CountAggregationTest02.html", "",
        DisplayName = "aggregations: single values only shows nothing for several values")]
    public async Task Aggregations_SingleValues(string fixture, string severalValuesText)
    {
        await Ren.OpenAsync(fixture);

        await Poll(() => Ren.Report.CellTextAsync("Val", 2)).ToBe("");
        await Poll(() => Ren.Report.CellTextAsync("Val", 3)).ToBe(severalValuesText);
        await Poll(() => Ren.Report.CellTextAsync("Val", 4)).ToBe("foo");
        await Poll(() => Ren.Report.CellTextAsync("Val", 5)).ToBe(severalValuesText);
    }

    [TestMethod("aggregations: a cell's menu sets a newly grouped column's aggregation")]
    public async Task Aggregations_CellMenuSetsNewlyGroupedColumnsAggregation()
    {
        // New entries of grouping.columns once defaulted to [] rather than {}, which broke this.
        await Ren.OpenAsync(GroupTestsFixture);

        await GroupByColumnAsync("CustomerRef");
        await Ren.Report.SelectAggregationTypeAsync("ProductCodes", 2, "distinct-values");
        await Ren.WaitUntilLoadedAsync();

        await ExpectColumnTextAsync(
            "ProductCodes",
            "ProductCodes",
            "PRD6059, PRD6417, PRD8265",
            "PRD9505",
            "PRD7333",
            "PRD4488, PRD3194, PRD3278, PRD3567",
            "PRD8265, PRD5896, PRD5899, PRD8651, PRD6417, PRD5811, PRD9962, PRD7953",
            "PRD7019",
            "PRD4564",
            "PRD7840, PRD2446, PRD1876, PRD3068, PRD2738",
            "PRD6059");
    }

    private const string NumOrdersFixture = "ported/GroupTestsWithNumOrders.html";

    private async Task BinNumOrdersAsync()
    {
        await GroupByColumnWithBinningAsync("NumOrders", "group-by-column-data-binning", "group-by-column-binning-0-1-10-100");
        await ChooseFromColumnMenuAsync("NumOrders", "#sort-ascending");
    }

    [TestMethod("binning: numbers are grouped into bins")]
    public async Task Binning_NumbersAreGroupedIntoBins()
    {
        await Ren.OpenAsync(NumOrdersFixture);

        await BinNumOrdersAsync();

        await ExpectColumnTextAsync("NumOrders", "NumOrders", "0", "1", "2-10", "100+", "271");
    }

    [TestMethod("binning: a bin's rows show their own values")]
    public async Task Binning_ABinsRowsShowTheirOwnValues()
    {
        await Ren.OpenAsync(NumOrdersFixture);

        await BinNumOrdersAsync();
        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(4);

        await ExpectColumnTextAsync("CustomerRef", "CustomerRef", "C30001", "C30001", "", "A10002", "B20001", "", "C30004");
        await ExpectColumnTextAsync("NumOrders", "NumOrders", "0", "0", "1", "1", "1", "2-10", "100+", "271");
    }

    [TestMethod("binning: changing the binning function rebins the values")]
    public async Task Binning_ChangingTheBinningFunctionRebins()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest24.html");

        await GroupByColumnWithBinningAsync("Search Terms", "group-by-column-string-binning", "group-by-column-binning-first-2-letters");
        await ChooseFromColumnMenuAsync("Search Terms", "#sort-ascending");

        await ExpectColumnTextAsync("Search Terms", "Search Terms", "ba", "co", "de", "fl", "fo", "in", "ma", "mi", "mo", "sm");

        await GroupByColumnWithBinningAsync("Search Terms", "modify-group-by-column-string-binning", "group-by-column-binning-none-modify");

        // The bins are joined with pipes, which Tsv would make tabs, so this text is taken as is.
        string[] expected =
        [
            "Search Terms",
            "basic gasket | basic gaskets | gasket basic | gaskets basic | basicgasket | " +
                "basicgaskets | gasket | gaskets | basic gasket set | basic gasket kit",
            "basic valve | basic valves | valve basic | valves basic | basicvalve | " +
                "basicvalves | valve | valves | basic valve set | basic valve kit",
            "compact mount | compact mounts | mount compact | mounts compact | compactmount",
            "compact rotor | compact rotors | rotor compact",
            "deluxe coupling | deluxe couplings | coupling deluxe | couplings deluxe | deluxecoupling",
            "flexi valve | flexi valves",
            "folding adapter",
            "indoor module | indoor modules | module indoor | modules indoor",
            "indoor toggle",
            "magnetic dial | magnetic dials",
            "magnetic grommet | magnetic grommets",
            "mini fitting | mini fittings",
            "modular bracket | modular brackets | bracket modular | brackets modular",
            "modular connector | modular connectors | connector modular | " +
                "connectors modular | modularconnector | modularconnectors | connector | connectors",
            "modular flange | modular flanges",
            "smart fitting | smart fittings"
        ];

        await Poll(async () => (await Ren.Report.ColumnTextAsync("Search Terms")).Replace("\r", ""))
            .ToBe(string.Join("\n", expected));
    }

    [TestMethod("binning: an interior grouping's binning can be changed twice")]
    public async Task Binning_InteriorGroupingsBinningCanBeChangedTwice()
    {
        async Task<string> FirstSearchTermsAsync() =>
            string.Join("\n", Tsv(await Ren.Report.ColumnTextAsync("Search Term")).Split('\n').Take(10));

        await Ren.OpenAsync("ported/DataGroupingSettingsTest25.html");

        await GroupByColumnWithBinningAsync("Search Term", "modify-group-by-column-string-binning", "group-by-column-binning-first-2-letters-modify");
        await ChooseFromColumnMenuAsync("Search Term", "#sort-ascending");

        await Poll(FirstSearchTermsAsync).ToBe(
            string.Join("\n", "Search Term", "ad", "ba", "cl", "co", "de", "ec", "fl", "fo", "he"));

        await GroupByColumnWithBinningAsync("Search Term", "modify-group-by-column-string-binning", "group-by-column-binning-none-modify");

        await Poll(FirstSearchTermsAsync).ToBe(string.Join("\n",
            "Search Term",
            "adjustable bearing",
            "adjustable bracket",
            "adjustable clamp",
            "adjustable coupling",
            "adjustable plate",
            "adjustable washer",
            "adjustable widget",
            "basic adapter",
            "basic bearing"));
    }
}
