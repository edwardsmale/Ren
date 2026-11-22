namespace Ren.Client.Tests.Browser;

// These tests cover compare filters on the "Filter groups..." popup, the filter module pointed at a
// grouping level rather than at the data rows.  A compare filter there is matched against that
// level's group rows, so "greater than" states a group's total rather than any one row's value.
//
// The grid groups DataGroupingSettingsTests by Product Code with Days Active totalled.  Its
// 28 rows cover 25 product codes, and every row reads 118 days active, so a group totals 118 unless
// its code appears twice, and the three that do total 236.  No data row exceeds 118, so a filter
// of "greater than 118" read against the rows would leave the grid empty.
[TestClass]
public class FilterGroupCompareFilterTests : BrowserTest
{
    private const string Fixture = "ported/ColumnFilteringTest08.html";

    private static readonly string[] DoubledProductCodes = ["SE53624", "TC32640", "XQ61272"];

    private async Task OpenFilterGroupsForDaysActiveAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenFilterGroupsAsync(Ren, "Days Active");
    }

    // The data rows beneath the groups are formatted blank, so their empty value is dropped.
    private async Task<string[]> ShownProductCodesAsync() =>
        Text.Sorted((await Filters.ColumnDistinctValuesAsync(Ren, "Product Code")).Where(value => value != "")).ToArray();

    // The popup's compare strip starts out shown, at a grouping level as much as on the data rows.
    [TestMethod("FilterGroupsPopup_OpenedForAGrouping_ShowsItsCompareFilter")]
    public async Task FilterGroupsPopup_OpenedForAGrouping_ShowsItsCompareFilter()
    {
        await OpenFilterGroupsForDaysActiveAsync();

        await Expect(Ren.Root.Locator(".qa-ren-filter-module-compare-strip .qa-ren-compare-filter")).Not.ToHaveCountAsync(0);
    }

    [TestMethod("GroupCompareFilter_GreaterThanEveryRowsValue_KeepsTheGroupsThatTotalMore")]
    public async Task GroupCompareFilter_GreaterThanEveryRowsValue_KeepsTheGroupsThatTotalMore()
    {
        await OpenFilterGroupsForDaysActiveAsync();

        Expect(await ShownProductCodesAsync()).ToHaveLength(25);

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "118");

        await Poll(ShownProductCodesAsync).ToEqual(DoubledProductCodes);
    }

    // Every group totals either 118 or 236, so this is the complement of the filter above.
    [TestMethod("GroupCompareFilter_LessThanTheDoubledGroupsTotal_KeepsTheRest")]
    public async Task GroupCompareFilter_LessThanTheDoubledGroupsTotal_KeepsTheRest()
    {
        await OpenFilterGroupsForDaysActiveAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "lessThan", "236");

        await Poll(async () => (await ShownProductCodesAsync()).Length).ToBe(22);

        var codes = await ShownProductCodesAsync();

        foreach (var code in DoubledProductCodes)
        {
            Expect(codes).Not.ToContain(code);
        }
    }

    // No row's 118 falls in this range, and neither would a group of one row.
    [TestMethod("GroupCompareFilter_BetweenTwoTotals_KeepsTheGroupsInBetween")]
    public async Task GroupCompareFilter_BetweenTwoTotals_KeepsTheGroupsInBetween()
    {
        await OpenFilterGroupsForDaysActiveAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "between", "200", "300");

        await Poll(ShownProductCodesAsync).ToEqual(DoubledProductCodes);
    }

    // Top N ranks what it's filtering, so at a grouping level it's the group totals that are ranked.
    [TestMethod("GroupCompareFilter_TopThree_RanksTheGroupsByTheirTotals")]
    public async Task GroupCompareFilter_TopThree_RanksTheGroupsByTheirTotals()
    {
        await OpenFilterGroupsForDaysActiveAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "topN", "3");

        await Poll(ShownProductCodesAsync).ToEqual(DoubledProductCodes);
    }

    [TestMethod("GroupCompareFilter_Cleared_ShowsEveryGroupAgain")]
    public async Task GroupCompareFilter_Cleared_ShowsEveryGroupAgain()
    {
        await OpenFilterGroupsForDaysActiveAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "118");
        await Poll(ShownProductCodesAsync).ToEqual(DoubledProductCodes);

        await Filters.ClickCompareFilterClearAsync(Ren);

        await Poll(async () => (await ShownProductCodesAsync()).Length).ToBe(25);
        Expect(await ShownProductCodesAsync()).ToContain("UC61416");
    }
}
