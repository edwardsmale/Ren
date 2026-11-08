namespace Ren.Client.Tests.Browser;

// These tests cover what several compare filters on one column do to the rows: filters in separate
// groups are ANDed, and filters within a group are ORed.  The report's Id column holds 22 to 37.
[TestClass]
public class CompareFilterMultipleTests : BrowserTest
{
    private const string Fixture = "ported/CompareFilterTest01.html";

    private const string AllIds = "22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37";

    private Task ExpectDistinctIdsAsync(string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe(csv);

    // The "and" link gives the column a second filter, in a group of its own.
    [TestMethod("TwoFiltersJoinedByAnd_Applied_KeepOnlyTheRowsPassingBoth")]
    public async Task TwoFiltersJoinedByAnd_Applied_KeepOnlyTheRowsPassingBoth()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenColumnFilterAsync(Ren, "Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30", null, 0);
        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 0, "and");
        await Filters.ApplyCompareFilterAsync(Ren, "lessThan", "34", null, 1);

        await ExpectDistinctIdsAsync("31,32,33");
    }

    // The "or" link adds the second filter to the first's group, so the two are ORed rather than
    // ANDed, which, being contradictory, would leave no rows at all.
    [TestMethod("TwoFiltersJoinedByOr_Applied_KeepTheRowsPassingEither")]
    public async Task TwoFiltersJoinedByOr_Applied_KeepTheRowsPassingEither()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenColumnFilterAsync(Ren, "Id");

        await Filters.ApplyCompareFilterAsync(Ren, "lessThan", "24", null, 0);
        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 0, "or");
        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "35", null, 1);

        await ExpectDistinctIdsAsync("22,23,36,37");
    }

    // The "and" belongs to the bottom-most filter and starts a group of its own, so what it adds is
    // ANDed with the verdict of the OR group above.
    [TestMethod("FilterAndedWithAnOrGroup_Applied_NarrowsWhatTheGroupLeft")]
    public async Task FilterAndedWithAnOrGroup_Applied_NarrowsWhatTheGroupLeft()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenColumnFilterAsync(Ren, "Id");

        await Filters.ApplyCompareFilterAsync(Ren, "lessThan", "24", null, 0);
        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 0, "or");
        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "35", null, 1);
        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 1, "and");
        await Filters.ApplyCompareFilterAsync(Ren, "lessThan", "37", null, 2);

        await ExpectDistinctIdsAsync("22,23,36");
    }

    // The cross takes the second filter off the column outright, as the column has another.
    [TestMethod("OneOfSeveralFilters_Removed_LeavesTheOtherInEffect")]
    public async Task OneOfSeveralFilters_Removed_LeavesTheOtherInEffect()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenColumnFilterAsync(Ren, "Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30", null, 0);
        await Filters.ClickCompareFilterJoinLinkAsync(Ren, 0, "and");
        await Filters.ApplyCompareFilterAsync(Ren, "lessThan", "34", null, 1);

        await ExpectDistinctIdsAsync("31,32,33");

        await Filters.ClickCompareFilterClearAsync(Ren, 1);

        await Expect(Filters.CompareStrips(Ren)).ToHaveCountAsync(1);
        await ExpectDistinctIdsAsync("31,32,33,34,35,36,37");
    }

    // A column's only filter is emptied rather than taken away.
    [TestMethod("TheLastFilterLeft_Cleared_RestoresAllRows")]
    public async Task TheLastFilterLeft_Cleared_RestoresAllRows()
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenColumnFilterAsync(Ren, "Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30", null, 0);
        await ExpectDistinctIdsAsync("31,32,33,34,35,36,37");

        await Filters.ClickCompareFilterClearAsync(Ren, 0);

        await Expect(Filters.CompareStrips(Ren)).ToHaveCountAsync(1);
        await ExpectDistinctIdsAsync(AllIds);
    }
}
