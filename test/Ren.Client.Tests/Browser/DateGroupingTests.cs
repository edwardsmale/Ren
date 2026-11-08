namespace Ren.Client.Tests.Browser;

// These tests cover grouping a date column by date, week, month, quarter or year, changing one
// period for another, and a date/value chart made from the grouped grid keeping its own grouping
// and aggregation.
[TestClass]
public class DateGroupingTests : BrowserTest
{
    // Margin terms by account, updated over January and February 2024.  CreatedOn has NULLs and
    // UpdatedOn none.
    private const string Fixture = "ported/GroupTests.html";

    private const string AllHeadings =
        "CustomerRef|ProductCodes|LastEditedBy|PricingMethod|MarginPercentage|" +
        "DiscountPercentage|CreatedOn|UpdatedOn|FindCustomerLink|ViewCustomerReportLink";

    private static readonly string[] UpdatedOnWeeks =
        { "UpdatedOn", "15/01/2024", "22/01/2024", "29/01/2024", "05/02/2024", "12/02/2024" };

    private static readonly string[] UpdatedOnMonths = { "UpdatedOn", "01/01/2024", "01/02/2024" };

    private static readonly string[] UpdatedOnStartOfYear = { "UpdatedOn", "01/01/2024" };

    private async Task ChooseFromColumnMenuAsync(string columnHeading, params string[] itemSelectors)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, 2, itemSelectors);
        await Ren.WaitUntilLoadedAsync();
    }

    // The period is "date", "week", "month", "quarter" or "year".
    private Task GroupByPeriodAsync(string columnHeading, string period) =>
        ChooseFromColumnMenuAsync(columnHeading, "#grouping-menu", "#group-by-column", "#group-by-column-" + period);

    private Task ChangeGroupingToAsync(string columnHeading, string period) =>
        ChooseFromColumnMenuAsync(columnHeading, "#grouping-menu", "#group-by-" + period + "-instead");

    private async Task<string> ColumnTextAsync(string columnHeading) => Tsv(await Ren.Report.ColumnTextAsync(columnHeading));

    private Task ExpectColumnTextAsync(string columnHeading, params string[] expected) =>
        Poll(() => ColumnTextAsync(columnHeading)).ToBe(string.Join("\n", expected));

    private Task ExpectAllTextAsync(params string[] expected) =>
        Poll(async () =>
        {
            await Ren.Report.SelectAllAsync();

            return Tsv(await Ren.Report.SelectedTextAsync());

        }).ToBe(Tsv(string.Join("\n", expected)));

    [TestMethod("grouping by a period: grouping by date leaves out the time")]
    public async Task GroupingByDateLeavesOutTheTime()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "date");

        await ExpectAllTextAsync(
            AllHeadings,
            "C30003|UD79126|Sami|Markup|35.00%||19/01/2024 15:09:44|19/01/2024|C30003|C30003",
            "C30002|VV34902|Jess|Markup|33.50%||22/01/2024 12:04:35|22/01/2024|C30002|C30002",
            "C30003||Sami|Markup|20.25%||18/01/2024 14:55:48|23/01/2024|C30003|C30003",
            "C30001|YG45075|Jess|Markup|27.50%|||24/01/2024|C30001|C30001",
            "B20002||Jess|Markup|4.25%||29/01/2024 17:16:27|29/01/2024|B20002|B20002",
            "B20001|YG46552|Jess|Markup|35.00%||31/01/2024 11:56:00|31/01/2024|B20001|B20001",
            "A10002|ZZ24425|Alexis|Markup|55.00%||01/02/2024 13:15:42|01/02/2024|A10002|A10002",
            "||Jess|Markup|30.00%|||08/02/2024||",
            "C30004|XS23446|Jess|Markup|22.00%||12/02/2024 14:53:07|12/02/2024|C30004|C30004",
            "|||Markup|25.44%|||||");
    }

    [TestMethod("grouping by a period: grouping by week shows each week's start")]
    public async Task GroupingByWeekShowsEachWeeksStart()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "week");

        await ExpectColumnTextAsync("UpdatedOn", UpdatedOnWeeks);
    }

    [TestMethod("grouping by a period: grouping by month shows each month's start")]
    public async Task GroupingByMonthShowsEachMonthsStart()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "month");

        await ExpectColumnTextAsync("UpdatedOn", UpdatedOnMonths);
    }

    [TestMethod("grouping by a period: grouping by quarter shows the quarter's start")]
    public async Task GroupingByQuarterShowsTheQuartersStart()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "quarter");

        await ExpectColumnTextAsync("UpdatedOn", UpdatedOnStartOfYear);
    }

    [TestMethod("grouping by a period: grouping by year shows the year's start")]
    public async Task GroupingByYearShowsTheYearsStart()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "year");

        await ExpectColumnTextAsync("UpdatedOn", UpdatedOnStartOfYear);
    }

    [TestMethod("grouping by a period: a column's NULLs group first, ahead of its months")]
    public async Task AColumnsNullsGroupFirstAheadOfItsMonths()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("CreatedOn", "month");
        await Ren.Report.ExpandCollapseGroupAsync(2);

        await ExpectAllTextAsync(
            AllHeadings,
            "||Jess|Markup|29.79%|||||",
            "A10001|XS23446|Jess|Markup|21.00%|||08/02/2024 07:41:40|A10001|A10001",
            "A10001|XS74471|Jess|Markup|50.00%|||08/02/2024 07:42:03|A10001|A10001",
            "A10001|ZX53979|Jess|Markup|20.00%|||08/02/2024 07:43:01|A10001|A10001",
            "B20003|ZX53979|Jess|Markup|20.00%|||08/02/2024 07:39:48|B20003|B20003",
            "B20003|XK95574|Jess|Markup|35.00%|||08/02/2024 07:38:47|B20003|B20003",
            "B20003|XN62725|Jess|Markup|20.00%|||08/02/2024 07:29:42|B20003|B20003",
            "B20003|ZZ12354|Jess|Markup|35.00%|||08/02/2024 07:38:27|B20003|B20003",
            "B20003|XS74471|Jess|Markup|50.00%|||08/02/2024 07:39:12|B20003|B20003",
            "B20003|XH84100|Jess|Markup|22.50%|||08/02/2024 07:39:33|B20003|B20003",
            "B20003|ZZ51667|Jess|Markup|26.50%|||08/02/2024 07:37:06|B20003|B20003",
            "B20003|ZV55859|Jess|Markup|30.00%|||08/02/2024 07:37:34|B20003|B20003",
            "C30001|YG45075|Jess|Markup|27.50%|||24/01/2024 10:55:00|C30001|C30001",
            "|||Markup|18.32%||01/01/2024|||",
            "|||Markup|38.50%||01/02/2024|||",
            "|||Markup|25.44%|||||");
    }

    [TestMethod("grouping by a period: an expanded week shows its rows' own dates")]
    public async Task AnExpandedWeekShowsItsRowsOwnDates()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("CreatedOn", "week");
        await Ren.Report.ExpandCollapseGroupAsync(3);

        await ExpectColumnTextAsync(
            "CreatedOn",
            "CreatedOn",
            "",
            "15/01/2024",
            "18/01/2024 14:55:48",
            "18/01/2024 14:55:48",
            "18/01/2024 14:55:48",
            "18/01/2024 14:55:48",
            "19/01/2024 15:09:44",
            "22/01/2024",
            "29/01/2024",
            "12/02/2024");
    }

    [TestMethod("grouping by a period: a month can be grouped again by account")]
    public async Task AMonthCanBeGroupedAgainByAccount()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "month");
        await ChooseFromColumnMenuAsync("CustomerRef", "#grouping-menu", "#add-grouping-submenu", "#group-by-column");
        await Ren.Report.ExpandCollapseGroupAsync(3);

        await ExpectColumnTextAsync("CustomerRef", "CustomerRef", "", "", "A10001", "A10002", "B20003", "C30004");
    }

    [TestMethod]
    [DataRow("month", "week", new[] { "UpdatedOn", "15/01/2024", "22/01/2024", "29/01/2024", "05/02/2024", "12/02/2024" }, DisplayName = "changing the period: month to week")]
    [DataRow("week", "month", new[] { "UpdatedOn", "01/01/2024", "01/02/2024" }, DisplayName = "changing the period: week to month")]
    [DataRow("date", "quarter", new[] { "UpdatedOn", "01/01/2024" }, DisplayName = "changing the period: date to quarter")]
    [DataRow("quarter", "year", new[] { "UpdatedOn", "01/01/2024" }, DisplayName = "changing the period: quarter to year")]
    public async Task ChangingThePeriod(string from, string to, string[] expected)
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", from);
        await ChangeGroupingToAsync("UpdatedOn", to);

        await ExpectColumnTextAsync("UpdatedOn", expected);
    }

    [TestMethod("changing the period: the aggregated values are worked out again")]
    public async Task TheAggregatedValuesAreWorkedOutAgain()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "month");
        await ExpectColumnTextAsync("UpdatedOn", UpdatedOnMonths);
        var monthlyMargins = await ColumnTextAsync("MarginPercentage");

        await ChangeGroupingToAsync("UpdatedOn", "week");

        await Poll(() => ColumnTextAsync("MarginPercentage")).Not.ToBe(monthlyMargins);
    }

    // Monthly distinct accounts, charted.
    private async Task OpenMonthlyChartAsync()
    {
        await Ren.OpenAsync(Fixture);

        await GroupByPeriodAsync("UpdatedOn", "month");
        await Ren.Report.SelectAggregationTypeAsync("CustomerRef", 2, "count-distinct");
        await Ren.WaitUntilLoadedAsync();

        await Ren.Report.SelectColumnsAsync("UpdatedOn", "CustomerRef");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "UpdatedOn");
    }

    [TestMethod("a chart of the grouped grid: changing the chart's own grouping to weeks redraws it")]
    public async Task ChangingTheChartsOwnGroupingToWeeksRedrawsIt()
    {
        await OpenMonthlyChartAsync();

        await Poll(() => DateValueChart.DatesWithValuesAsync(Ren)).ToEqual(new[] { "2024-01-01", "2024-02-01" });

        await DateValueChart.SelectDateGroupingAsync(Ren, "date-week-start");

        await Poll(() => DateValueChart.DatesWithValuesAsync(Ren)).ToEqual(
            new[] { "2024-01-15", "2024-01-22", "2024-01-29", "2024-02-05", "2024-02-12" });
    }

    // The year is shown once, until it changes.
    [TestMethod("a chart of the grouped grid: the x-axis labels follow the chart's grouping")]
    public async Task TheXAxisLabelsFollowTheChartsGrouping()
    {
        await OpenMonthlyChartAsync();

        await Poll(() => DateValueChart.XAxisLabelsAsync(Ren)).ToEqual(new[] { "Jan 2024", "Feb" });

        await DateValueChart.SelectDateGroupingAsync(Ren, "date-week-start");

        await Poll(() => DateValueChart.XAxisLabelsAsync(Ren)).ToEqual(
            new[] { "15 Jan 2024", "22 Jan", "29 Jan", "05 Feb", "12 Feb" });
    }

    [TestMethod("a chart of the grouped grid: changing a series' aggregation redraws it")]
    public async Task ChangingASeriesAggregationRedrawsIt()
    {
        await OpenMonthlyChartAsync();

        async Task<string> ValuesOfAsync() => string.Join(",", (await DateValueChart.DateValuesAsync(Ren)).Values);

        await Poll(() => DateValueChart.DatesWithValuesAsync(Ren)).ToEqual(new[] { "2024-01-01", "2024-02-01" });
        var distinctCounts = await ValuesOfAsync();

        await DateValueChart.SelectAggregationTypeAsync(Ren, "count");

        await Poll(ValuesOfAsync).Not.ToBe(distinctCounts);
    }
}
