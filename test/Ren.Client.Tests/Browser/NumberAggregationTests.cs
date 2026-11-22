namespace Ren.Client.Tests.Browser;

// These tests cover the aggregations of a number column's group rows, and how nulls and blanks
// count towards them.  Each fixture is listed with what it holds:
//
//  NullAggregateValueTest01-04: Num=1 holds three NULL Vals and Num=2 holds 5, 6 and 7.  Row 2 is
//  Num=1's group, row 3 Num=2's and row 4 the overall totals.  01 sums with an Average total, 02
//  takes the Min with a Max total, 03 concatenates including empty values with a distinct values
//  including empty total, and 04 gives distinct values including empty with counts, with a most
//  common total.
//
//  NumberAggregationWithNullsTest03: AccountId=111 has DiscountAmount values [NULL, 1.50], and
//  AccountId=222 has OrderRevenue values [NULL, 0.79].
//
//  NegativeAggregateValueTest01: Num=1 is 0, 0, 0 and Num=2 is -5, -6, -7.  Max was once seeded
//  with Number.MIN_VALUE, the smallest positive denormal, which no zero or negative beats, so the
//  seed leaked out as "5e-324".
//
//  NullStringAggregateValueTest01: Num=1 is all NULL, with the grouping carrying
//  show-null-as-dash, and Num=2 is "bbb", NULL, "aaa".
[TestClass]
public class NumberAggregationTests : BrowserTest
{
    [TestMethod]
    [DataRow("NullAggregateValueTest01", "Val", 2, "", DisplayName = "Sum_AllNullGroup_IsBlank")]
    [DataRow("NullAggregateValueTest01", "Val", 3, "18", DisplayName = "Sum_NonNullGroup_IsCorrect")]
    [DataRow("NullAggregateValueTest01", "Val", 4, "6", DisplayName = "Average_OverallTotalsRow_IgnoresNulls")]
    [DataRow("NullAggregateValueTest02", "Val", 2, "", DisplayName = "Min_AllNullGroup_IsBlank")]
    [DataRow("NullAggregateValueTest02", "Val", 3, "5", DisplayName = "Min_NonNullGroup_IsCorrect")]
    [DataRow("NullAggregateValueTest02", "Val", 4, "7", DisplayName = "Max_OverallTotalsRow_IgnoresNulls")]
    [DataRow("NullAggregateValueTest03", "Val", 2, "NULL，NULL，NULL", DisplayName = "ConcatenateIncludingEmpty_AllNullGroup_ShowsNullLabels")]
    [DataRow("NullAggregateValueTest03", "Val", 3, "5，6，7", DisplayName = "ConcatenateIncludingEmpty_NonNullGroup_ShowsValues")]
    [DataRow("NullAggregateValueTest03", "Val", 4, "NULL，5，6，7", DisplayName = "DistinctValuesIncludingEmpty_TotalsRow_IncludesNullLabel")]
    [DataRow("NullAggregateValueTest04", "Val", 2, "NULL ᵡ 3", DisplayName = "DistinctValuesIncludingEmptyWithCounts_AllNullGroup_ShowsNullWithCount")]
    // Sorted by count descending then value descending.
    [DataRow("NullAggregateValueTest04", "Val", 3, "7 ᵡ 1，6 ᵡ 1，5 ᵡ 1", DisplayName = "DistinctValuesIncludingEmptyWithCounts_NonNullGroup_ShowsCounts")]
    // NULL is the most common Val, and the sole most-common value maps to the complete null
    // sentinel, which renders as a blank cell.
    [DataRow("NullAggregateValueTest04", "Val", 4, "", DisplayName = "MostCommon_NullIsTheMajority_TotalsRowRendersBlank")]
    [DataRow("NumberAggregationWithNullsTest03", "DiscountAmount", 2, "£1.50", DisplayName = "Max_GroupContainsANull_IgnoresTheNull")]
    [DataRow("NumberAggregationWithNullsTest03", "OrderRevenue", 3, "£0.79", DisplayName = "Min_GroupContainsANull_IgnoresTheNull")]
    [DataRow("NegativeAggregateValueTest01", "Val", 2, "0", DisplayName = "Max_AllZeroGroup_IsZero")]
    [DataRow("NegativeAggregateValueTest01", "Val", 3, "-5", DisplayName = "Max_AllNegativeGroup_IsTheLargestNegative")]
    [DataRow("NegativeAggregateValueTest01", "Val", 4, "-7", DisplayName = "Min_OverallTotalsRowOfZeroesAndNegatives_IsTheSmallest")]
    [DataRow("NullStringAggregateValueTest01", "Txt", 2, "-", DisplayName = "ShowNullAs_AllNullGroupRowOfATextColumn_UsesTheFormatFunction")]
    [DataRow("NullStringAggregateValueTest01", "Txt", 3, "bbb", DisplayName = "Max_TextGroupContainingANull_IsTheLargestValue")]
    [DataRow("NullStringAggregateValueTest01", "Txt", 4, "aaa", DisplayName = "Min_TextColumnContainingNulls_IgnoresTheNulls")]
    public async Task AggregatedCell_ShowsExpectedText(string fixture, string columnHeading, int rowHeading, string expected)
    {
        await Ren.OpenAsync("ported/" + fixture + ".html");

        Expect(await Ren.Report.CellTextAsync(columnHeading, rowHeading)).ToBe(expected);
    }

    // Exercises the clipboard path.  Embedded null sentinels in the group rows must become "NULL";
    // the complete-sentinel totals cell must copy as empty and be trimmed from the end of the TSV.
    [TestMethod("CopyCells_NullSentinelInGroupRows_RendersAsNullLabel")]
    public async Task CopyCells_NullSentinelInGroupRows_RendersAsNullLabel()
    {
        await Ren.OpenAsync("ported/NullAggregateValueTest04.html");

        Expect(Tsv(await Ren.Report.ColumnTextAsync("Val"))).ToBe(Tsv("""
            Val
            NULL ᵡ 3
            7 ᵡ 1, 6 ᵡ 1, 5 ᵡ 1
            """));
    }
}
