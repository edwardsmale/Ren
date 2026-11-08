namespace Ren.Client.Tests.Browser;

// Each report has calc functions that call Ren.DateRangeSummariser on every row, beside columns
// holding what they should give.
[TestClass]
public class DateRangeSummariserTests : BrowserTest
{
    private async Task ExpectColumnToMatchAsync(string calculatedHeading, string expectedHeading)
    {
        var expectedText = await Ren.Report.ColumnTextAsync(expectedHeading);

        Expect(expectedText.Trim().Split('\n').Length).ToBeGreaterThan(2);
        Expect(Tsv(await Ren.Report.ColumnTextAsync(calculatedHeading)))
            .ToBe(Tsv(Text.ReplaceFirst(expectedText, expectedHeading, calculatedHeading)));
    }

    [TestMethod("GetDateRangeSummary_FullYearQuarterAndMonth_MatchesExpectedColumn")]
    public async Task GetDateRangeSummary_FullYearQuarterAndMonth_MatchesExpectedColumn()
    {
        await Ren.OpenAsync("ported/DateRangeSummariserTest01.html");

        await ExpectColumnToMatchAsync("DateRangeSummary", "Expected");
    }

    [TestMethod("GetDateRangeComparisonSummary_DateRangeSummary_MatchesExpectedColumn")]
    public async Task GetDateRangeComparisonSummary_DateRangeSummary_MatchesExpectedColumn()
    {
        await Ren.OpenAsync("ported/DateRangeSummariserTest02.html");

        await ExpectColumnToMatchAsync("DateRangeSummary", "ExpectedDateRangeSummary");
    }

    [TestMethod("GetDateRangeComparisonSummary_CompareDateRangeSummary_MatchesExpectedColumn")]
    public async Task GetDateRangeComparisonSummary_CompareDateRangeSummary_MatchesExpectedColumn()
    {
        await Ren.OpenAsync("ported/DateRangeSummariserTest02.html");

        await ExpectColumnToMatchAsync("CompareDateRangeSummary", "ExpectedCompareDateRangeSummary");
    }
}
