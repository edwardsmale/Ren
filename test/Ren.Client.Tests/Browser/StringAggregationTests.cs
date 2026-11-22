using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover the aggregations of a string column's group rows, and how nulls and blanks
// count towards them.
[TestClass]
public class StringAggregationTests : BrowserTest
{
    [TestMethod("DistinctValues_GroupedCategoryNameColumn_ShowsExpandIcons")]
    public async Task DistinctValues_GroupedCategoryNameColumn_ShowsExpandIcons()
    {
        await Ren.OpenAsync("ported/StringAggregationTest01.html");

        for (var rowHeading = 2; rowHeading <= 4; rowHeading++)
        {
            Expect(await Ren.Report.CellHtmlAsync("CategoryName", rowHeading))
                .ToContain("ren-data-grid__group-expand-collapse-button");
        }
    }

    [TestMethod("DistinctValues_SeveralProductNames_ShowsMultipleValuesPlaceholder")]
    public async Task DistinctValues_SeveralProductNames_ShowsMultipleValuesPlaceholder()
    {
        await Ren.OpenAsync("ported/StringAggregationTest01.html");

        Expect(await Ren.Report.CellHtmlAsync("ProductName", 2))
            .ToMatch(new Regex("^<span[^>]*>multiple values</span>$"));
    }

    [TestMethod("DistinctValues_CollapsedGroups_ShowNoExternalCodeValues")]
    public async Task DistinctValues_CollapsedGroups_ShowNoExternalCodeValues()
    {
        await Ren.OpenAsync("ported/StringAggregationTest01.html");

        Expect(await Ren.Report.CellTextAsync("ExternalCode", 2)).ToBe("");
        Expect(await Ren.Report.CellTextAsync("ExternalCode", 3)).ToBe("");
        Expect(await Ren.Report.CellTextAsync("ExternalCode", 4)).ToBe("");

        // Expanding a group reveals the underlying values.
        await Ren.Report.ExpandCollapseGroupAsync(3);

        Expect(await Ren.Report.CellTextAsync("ExternalCode", 5)).ToBe("XC-106");
    }

    [TestMethod("CountDistinct_SeveralColumns_CountsAreCorrect")]
    public async Task CountDistinct_SeveralColumns_CountsAreCorrect()
    {
        await Ren.OpenAsync("ported/StringAggregationTest02.html");

        Expect(await Ren.Report.CellTextAsync("ParentCategoryName", 14)).ToBe("3");
        Expect(await Ren.Report.CellTextAsync("CategoryName", 14)).ToBe("6");
        Expect(await Ren.Report.CellTextAsync("ExternalCode", 14)).ToBe("7");
    }

    // 12 rows across 3 groups; 6 rows have a non-null ExternalCode and 6 rows have NULL.  CountDistinct
    // counts null as a distinct value, so the result is 7 (6 non-null plus 1 null).
    [TestMethod("CountDistinct_ColumnContainsNulls_IncludesNullAsDistinctValue")]
    public async Task CountDistinct_ColumnContainsNulls_IncludesNullAsDistinctValue()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest01.html");

        Expect(await Ren.Report.CellTextAsync("ExternalCode", 5)).ToBe("7");
    }

    // The Tools & Accessories group has CategoryName ['Tools & Accessories' ×3, NULL ×1].  MostCommon
    // must ignore the null and return 'Tools & Accessories'.
    [TestMethod("MostCommon_GroupContainsNulls_IgnoresNullWhenCountingFrequency")]
    public async Task MostCommon_GroupContainsNulls_IgnoresNullWhenCountingFrequency()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest02.html");

        Expect(await Ren.Report.CellTextAsync("CategoryName", 3)).ToBe("Tools & Accessories");
    }

    // Across all 12 rows 'Tools & Accessories' appears 3 times, the most frequent non-null value.
    [TestMethod("MostCommon_OverallTotalsRow_IgnoresNulls")]
    public async Task MostCommon_OverallTotalsRow_IgnoresNulls()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest02.html");

        Expect(await Ren.Report.CellTextAsync("CategoryName", 5)).ToBe("Tools & Accessories");
    }

    // DistinctValuesIncludingEmpty renders the values joined by a fullwidth comma "，", not as an
    // expand/collapse button like DistinctValues does.  Each group has 2 non-null external codes and 2 null
    // external codes; the joined text includes the nulls as empty strings between separators.
    [TestMethod("DistinctValuesIncludingEmpty_GroupContainsNulls_JoinsTheValues")]
    public async Task DistinctValuesIncludingEmpty_GroupContainsNulls_JoinsTheValues()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest03.html");

        var html = await Ren.Report.CellHtmlAsync("ExternalCode", 3);

        Expect(html).ToContain("XC-105");
        Expect(html).ToContain("XC-106");
    }

    // SingleValuesOnly counts null rows as "", a distinct value from 'Tools & Accessories'.  Even
    // though all non-null CategoryName values in the Tools & Accessories group are identical, the
    // presence of a null row means the group is not "single-valued", so the result is "".
    [TestMethod("SingleValuesOnly_GroupContainsANull_ShowsEmpty")]
    public async Task SingleValuesOnly_GroupContainsANull_ShowsEmpty()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest03.html");

        Expect(await Ren.Report.CellTextAsync("CategoryName", 3)).ToBe("");
    }

    // The Nuts group's CategoryName has two distinct non-null values, so SingleValuesOnly shows "".
    [TestMethod("SingleValuesOnly_MultipleDistinctNonNullValues_ShowsEmpty")]
    public async Task SingleValuesOnly_MultipleDistinctNonNullValues_ShowsEmpty()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest03.html");

        Expect(await Ren.Report.CellTextAsync("CategoryName", 2)).ToBe("");
    }

    // Tools & Accessories (row 3) has two NULL external codes.  DistinctValuesIncludingEmpty keeps the
    // compressed-null slot (dictionary index 0 → sentinel "\x01"), which must be converted to the
    // display label "NULL" by the render layer.
    [TestMethod("DistinctValuesIncludingEmpty_GroupContainsNulls_NullRendersAsNullLabel")]
    public async Task DistinctValuesIncludingEmpty_GroupContainsNulls_NullRendersAsNullLabel()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest03.html");

        Expect((await Ren.Report.CellHtmlAsync("ExternalCode", 3)).ToLowerInvariant()).ToContain("null");
    }

    // Across all 12 rows, 6 have a NULL ExternalCode.  The totals (row 5) use
    // DistinctValuesIncludingEmptyWithCounts; the null entry must show as "NULL ᵡ 6".
    [TestMethod("DistinctValuesIncludingEmptyWithCounts_TotalsRow_ShowsNullCount")]
    public async Task DistinctValuesIncludingEmptyWithCounts_TotalsRow_ShowsNullCount()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest03.html");

        Expect(await Ren.Report.CellHtmlAsync("ExternalCode", 5)).ToContain("NULL ᵡ 6");
    }

    // The Nuts group has 2 null and 2 non-null external codes.  DistinctValues must omit the null entry, which
    // decompresses to the null sentinel ("\x01").
    [TestMethod("DistinctValues_NutsGroupContainsNulls_ExcludesTheNull")]
    public async Task DistinctValues_NutsGroupContainsNulls_ExcludesTheNull()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest04.html");

        Expect(await Ren.Report.CellTextAsync("ExternalCode", 2)).ToBe("XC-101，XC-104");
    }

    // The Tools & Accessories group has 2 null and 2 non-null external codes.
    [TestMethod("DistinctValues_ToolsGroupContainsNulls_ExcludesTheNull")]
    public async Task DistinctValues_ToolsGroupContainsNulls_ExcludesTheNull()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest04.html");

        Expect(await Ren.Report.CellTextAsync("ExternalCode", 3)).ToBe("XC-105，XC-106");
    }

    // 6 of the 12 rows have a null external code; the 6 distinct non-null external codes each appear once.  The null
    // entry must be excluded.  Values are sorted by compressed-dictionary index descending, all
    // counts being equal at 1.
    [TestMethod("DistinctValuesWithCounts_TotalsRowContainsNulls_ExcludesTheNull")]
    public async Task DistinctValuesWithCounts_TotalsRowContainsNulls_ExcludesTheNull()
    {
        await Ren.OpenAsync("ported/StringAggregationNullsTest04.html");

        Expect(await Ren.Report.CellTextAsync("ExternalCode", 5)).ToBe(
            "XC-106 ᵡ 1，XC-105 ᵡ 1，XC-104 ᵡ 1，" +
            "XC-103 ᵡ 1，XC-102 ᵡ 1，XC-101 ᵡ 1");
    }
}
