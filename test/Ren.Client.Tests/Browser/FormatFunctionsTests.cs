namespace Ren.Client.Tests.Browser;

// These tests cover the built-in format functions, and the "Show as" calculations that show a
// value relative to its group or the whole grid.
[TestClass]
public class FormatFunctionsTests : BrowserTest
{
    [TestMethod("ShowAsPercentageOfGroupSum_GroupExpanded_ShowsCorrectValues")]
    public async Task ShowAsPercentageOfGroupSum_GroupExpanded_ShowsCorrectValues()
    {
        await Ren.OpenAsync("ported/FormatFunctionTest04.html");

        await Ren.Report.ExpandCollapseGroupAsync(2);

        Expect(await Ren.Report.CellTextAsync("Count", 2)).ToBe("5.95%");
        Expect(await Ren.Report.CellTextAsync("Count", 3)).ToBe("6.25%");
    }

    [TestMethod("ShowAsPercentageOfOverallSum_GroupExpanded_ShowsCorrectValues")]
    public async Task ShowAsPercentageOfOverallSum_GroupExpanded_ShowsCorrectValues()
    {
        await Ren.OpenAsync("ported/FormatFunctionTest05.html");

        await Ren.Report.ExpandCollapseGroupAsync(2);

        Expect(await Ren.Report.CellTextAsync("Count", 2)).ToBe("5.95%");
        Expect(await Ren.Report.CellTextAsync("Count", 3)).ToBe("0.37%");
    }

    // The stats span data rows rather than group rows, and every data row's __Count is 1, so row
    // 3's group of 11 is 1100% of the maximum and 10 above the average, as is either stat taken
    // over the group or overall, and its data row in row 4 is 100% of it and 0 above.
    [TestMethod]
    [DataRow("ported/FormatFunctionTest06.html", "1100.00%", "100.00%", DisplayName = "ShowAsPercentageOfGroupMaximum_GroupExpanded_ShowsCorrectValues")]
    [DataRow("ported/FormatFunctionTest07.html", "1100.00%", "100.00%", DisplayName = "ShowAsPercentageOfOverallMaximum_GroupExpanded_ShowsCorrectValues")]
    [DataRow("ported/FormatFunctionTest08.html", "+10.00", "0.00", DisplayName = "ShowAsDifferenceFromGroupAverage_GroupExpanded_ShowsCorrectValues")]
    [DataRow("ported/FormatFunctionTest09.html", "+10.00", "0.00", DisplayName = "ShowAsDifferenceFromOverallAverage_GroupExpanded_ShowsCorrectValues")]
    public async Task ShowAsStat_GroupExpanded_ShowsCorrectValues(string fixture, string groupText, string dataRowText)
    {
        await Ren.OpenAsync(fixture);

        await Ren.Report.ExpandCollapseGroupAsync(3);

        Expect(await Ren.Report.CellTextAsync("Count", 3)).ToBe(groupText);
        Expect(await Ren.Report.CellTextAsync("Count", 4)).ToBe(dataRowText);
    }

    [TestMethod("ShowAsPercentageOfGroupSum_CellsCopied_CopiesFormattedValues")]
    public async Task ShowAsPercentageOfGroupSum_CellsCopied_CopiesFormattedValues()
    {
        await Ren.OpenAsync("ported/FormatFunctionTest10.html");

        await Ren.Report.ExpandCollapseGroupAsync(3);
        await Ren.Report.SelectCellsAsync("Count", 3, "Count", 4);

        Expect(await Ren.Report.SelectedTextAsync()).ToBe("4.09%\n9.09%");
    }

    // Data row format functions reading summary stats directly (FormatFunctionTest11).
    //
    // Grouped by AccountId, so expanding row 2 shows AccountId 111's data rows, IDs 1 and 2, in
    // rows 3 and 4.  Their OrderLineCounts are 4 and 3, and their Discount %s 0 and 12.50.
    //
    // Format functions applied via dataRows.columns:
    //   OrderCount:     other columns' stats, one read by ID and one by heading.
    //   OrderLineCount: its own stats, taken whole rather than read by aggregation type.
    private const string StatsFixture = "ported/FormatFunctionTest11.html";

    [TestMethod("FormatFunction_OtherColumnsStatsReadByIdAndHeading_ShowsTheirGroupStats")]
    public async Task FormatFunction_OtherColumnsStatsReadByIdAndHeading_ShowsTheirGroupStats()
    {
        await Ren.OpenAsync(StatsFixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);

        Expect(await Ren.Report.CellTextAsync("OrderCount", 3)).ToBe("7 and 12.5");
        Expect(await Ren.Report.CellTextAsync("OrderCount", 4)).ToBe("7 and 12.5");
    }

    [TestMethod("FormatFunction_StatsReadWithoutNamingAnAggregation_ShowsGroupMinimum")]
    public async Task FormatFunction_StatsReadWithoutNamingAnAggregation_ShowsGroupMinimum()
    {
        await Ren.OpenAsync(StatsFixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);

        // The minimum across the whole report would be 2, from AccountId 222.
        Expect(await Ren.Report.CellTextAsync("OrderLineCount", 3)).ToBe("3");
        Expect(await Ren.Report.CellTextAsync("OrderLineCount", 4)).ToBe("3");
    }

    [TestMethod("FormatFunction_NumberReturnedFromStatsCopied_CopiesItAsText")]
    public async Task FormatFunction_NumberReturnedFromStatsCopied_CopiesItAsText()
    {
        await Ren.OpenAsync(StatsFixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.SelectCellsAsync("OrderLineCount", 3, "OrderLineCount", 4);

        Expect(await Ren.Report.SelectedTextAsync()).ToBe("3\n3");
    }

    // The rows of FormatFunctionNullTest01 to 03, each by ID:
    //   2 'All non-null' (1), 3 'Null currency' (2), 4 'Null integer' (3), 5 'Null decimal' (4),
    //   6 'Null ratio' (5), 7 'Null date' (6) and 8 'All null' (7).
    //
    // A format function must show a NULL as "" rather than crashing or showing an error.
    // nulls-as-zero turns "" (an aggregated empty string) into "0", but raw null data values
    // arrive as the null sentinel rather than "", so it leaves them be.  The date format function
    // shows the time too.
    [TestMethod]
    [DataRow("ported/FormatFunctionNullTest01.html", "CurrencyValue", 3, "", DisplayName = "CurrencyFormat_ValueIsNull_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest01.html", "IntegerValue", 4, "", DisplayName = "NumberNoDpFormat_ValueIsNull_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest01.html", "DecimalValue", 5, "", DisplayName = "NumberTwoDpFormat_ValueIsNull_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest01.html", "IntegerValue", 2, "42", DisplayName = "NumberNoDpFormat_ValueIsNotNull_FormatsCorrectly")]
    [DataRow("ported/FormatFunctionNullTest02.html", "DecimalValue", 5, "", DisplayName = "PercentageNoDpFormat_ValueIsNull_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest02.html", "PercentageRatio", 6, "", DisplayName = "PercentageDividedBy100Format_ValueIsNull_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest03.html", "DateValue", 7, "", DisplayName = "DateFormat_ValueIsNull_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest03.html", "DateValue", 2, "15/06/2024 00:00:00", DisplayName = "DateFormat_ValueIsNotNull_FormatsCorrectly")]
    [DataRow("ported/FormatFunctionNullTest03.html", "IntegerValue", 4, "", DisplayName = "NullsAsZeroFormat_RawNullDataValue_ShowsEmpty")]
    [DataRow("ported/FormatFunctionNullTest03.html", "IntegerValue", 8, "", DisplayName = "NullsAsZeroFormat_RowIsEntirelyNull_ShowsEmpty")]
    public async Task FormatFunction_NullAndNonNullValues(string fixture, string columnHeading, int rowHeading, string expected)
    {
        await Ren.OpenAsync(fixture);

        Expect(await Ren.Report.CellTextAsync(columnHeading, rowHeading)).ToBe(expected);
    }
}
