using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover the Excel-style compare filter (contains, greater than, between, top N, ...) in
// the column filter popup, which compiles "compare" row-filter predicates through
// Ren.FilterCompareOperators.
[TestClass]
public class CompareFilterTests : BrowserTest
{
    private const string Fixture = "ported/CompareFilterTest01.html";
    private const string AllIds = "22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37";

    private Task ExpectDistinctIdsAsync(string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe(csv);

    private async Task OpenFilterAsync(string columnHeading)
    {
        await Ren.OpenAsync(Fixture);
        await Filters.OpenColumnFilterAsync(Ren, columnHeading);
    }

    [TestMethod("CompareFilter_NumberColumnGreaterThan_ShowsOnlyRowsAboveValue")]
    public async Task CompareFilter_NumberColumnGreaterThan_ShowsOnlyRowsAboveValue()
    {
        await OpenFilterAsync("Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30");

        await ExpectDistinctIdsAsync("31,32,33,34,35,36,37");
    }

    // The bounds are entered high to low, and the filter should order them itself.
    [TestMethod("CompareFilter_BetweenWithReversedBounds_ShowsRowsInsideRangeInclusive")]
    public async Task CompareFilter_BetweenWithReversedBounds_ShowsRowsInsideRangeInclusive()
    {
        await OpenFilterAsync("Id");

        await Filters.ApplyCompareFilterAsync(Ren, "between", "26", "24");

        await ExpectDistinctIdsAsync("24,25,26");
    }

    // The data holds "Selvale", and matching is case-insensitive, as in Excel.
    [TestMethod("CompareFilter_TextColumnContainsDifferentCase_ShowsMatchingRows")]
    public async Task CompareFilter_TextColumnContainsDifferentCase_ShowsMatchingRows()
    {
        await OpenFilterAsync("Product Name");

        await Filters.ApplyCompareFilterAsync(Ren, "contains", "selvale");

        await ExpectDistinctIdsAsync("22,23");
    }

    [TestMethod("CompareFilter_IsNotBlankOnNullableColumn_ShowsOnlyRowsWithValues")]
    public async Task CompareFilter_IsNotBlankOnNullableColumn_ShowsOnlyRowsWithValues()
    {
        await OpenFilterAsync("Discontinued");

        await Filters.ApplyCompareFilterAsync(Ren, "isNotBlank");

        await ExpectDistinctIdsAsync("33,36");
    }

    // The top three values are 2.81, 2.81 (both Id 36) and 2.74 (Id 35).
    [TestMethod("CompareFilter_TopNWithTiedValues_KeepsEveryRowAtOrAboveCutOff")]
    public async Task CompareFilter_TopNWithTiedValues_KeepsEveryRowAtOrAboveCutOff()
    {
        await OpenFilterAsync("Unique Searches Per Day");

        await Filters.ApplyCompareFilterAsync(Ren, "topN", "3");

        await ExpectDistinctIdsAsync("35,36");
    }

    [TestMethod("CompareFilter_Cleared_RestoresAllRows")]
    public async Task CompareFilter_Cleared_RestoresAllRows()
    {
        await OpenFilterAsync("Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30");
        await ExpectDistinctIdsAsync("31,32,33,34,35,36,37");

        await Filters.ClickCompareFilterClearAsync(Ren);

        await ExpectDistinctIdsAsync(AllIds);
    }

    [TestMethod("CompareFilter_WindowReopened_ControlFilledFromCurrentPredicate")]
    public async Task CompareFilter_WindowReopened_ControlFilledFromCurrentPredicate()
    {
        await OpenFilterAsync("Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30");

        await Ren.Root.ClickAsync(".ren-report-popup-window__close-button");
        await Expect(Ren.Root.Locator(".ren-filter-module")).ToHaveCountAsync(0);

        await Filters.OpenColumnFilterAsync(Ren, "Id");

        Expect(await Filters.CompareFilterOperatorAsync(Ren)).ToBe("greaterThan");
        Expect(await Filters.CompareFilterInputValueAsync(Ren, 1)).ToBe("30");
        await ExpectDistinctIdsAsync("31,32,33,34,35,36,37");
    }

    // The checkbox filter should AND with the compare predicate rather than replace it.
    [TestMethod("CompareFilter_CombinedWithCheckboxFilter_BothFiltersApply")]
    public async Task CompareFilter_CombinedWithCheckboxFilter_BothFiltersApply()
    {
        await OpenFilterAsync("Id");

        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "30");

        await Filters.ClickFilterCheckboxAsync(Ren, "31");

        await ExpectDistinctIdsAsync("32,33,34,35,36,37");
    }

    // A pattern matches anywhere in the value unless it anchors itself, and "matches" is
    // case-sensitive, so the capitalised spelling in the data is the one that hits.
    [TestMethod("CompareFilter_TextColumnMatchesRegex_ShowsRowsMatchingThePattern")]
    public async Task CompareFilter_TextColumnMatchesRegex_ShowsRowsMatchingThePattern()
    {
        await OpenFilterAsync("Product Name");

        await Filters.ApplyCompareFilterAsync(Ren, "matches", "Selvale (Slimline|Flexi)");

        await ExpectDistinctIdsAsync("22,23");
    }

    [TestMethod("CompareFilter_TextColumnMatchesRegexIgnoringCase_ShowsRowsWhateverTheCase")]
    public async Task CompareFilter_TextColumnMatchesRegexIgnoringCase_ShowsRowsWhateverTheCase()
    {
        await OpenFilterAsync("Product Name");

        await Filters.ApplyCompareFilterAsync(Ren, "matchesIgnoreCase", "selvale (slimline|flexi)");

        await ExpectDistinctIdsAsync("22,23");
    }

    // Checked through the product names rather than the IDs, as each ID holds several products.
    [TestMethod("CompareFilter_TextColumnDoesNotMatchRegex_ShowsOnlyNonMatchingRows")]
    public async Task CompareFilter_TextColumnDoesNotMatchRegex_ShowsOnlyNonMatchingRows()
    {
        const string pattern = "Selvale (Slimline|Flexi)";

        await Ren.OpenAsync(Fixture);

        var allNames = await Filters.ColumnDistinctValuesAsync(Ren, "Product Name");
        var expectedNames = allNames.Where(name => !Regex.IsMatch(name, pattern)).ToArray();

        Expect(expectedNames.Length).ToBeLessThan(allNames.Length);

        await Filters.OpenColumnFilterAsync(Ren, "Product Name");

        await Filters.ApplyCompareFilterAsync(Ren, "notMatches", pattern);

        await Poll(() => Filters.ColumnDistinctValuesAsync(Ren, "Product Name")).ToEqual(expectedNames);
    }
}
