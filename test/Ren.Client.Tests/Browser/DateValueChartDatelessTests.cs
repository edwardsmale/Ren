namespace Ren.Client.Tests.Browser;

// These tests cover date/value charts with no date column.  A chart made from columns holding no
// dates is drawn as an all-time chart, any column of text splitting its data, and its "Date column"
// item sets the column its data are grouped by the dates of, or sets none.
[TestClass]
public class DateValueChartDatelessTests : BrowserTest
{
    // Eight order lines, half Nuts and half Screws, over four quarters of 2024.
    private const string Fixture = "ported/DateValueChartTest06.html";
    private const string TotalOrderLines = "960";

    private async Task CreateChartAsync(params string[] columnHeadings)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync(columnHeadings);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, columnHeadings[0]);
    }

    private async Task<string[]> TickedDateColumnAsync()
    {
        await DateValueChart.HoverMenuPathAsync(Ren, "Date column");

        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        await Page.Keyboard.PressAsync("Escape");

        return ticked;
    }

    private async Task<string[]> ValuesAsync() => (await DateValueChart.DateValuesAsync(Ren)).Values.ToArray();

    [TestMethod("a text column selected offers no periods to create a chart by")]
    public async Task ATextColumnSelectedOffersNoPeriodsToCreateAChartBy()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("Category", "Order Lines");

        await Ren.Report.RightClickAsync(".ren-data-grid__column-heading[title='Category']");
        await Ren.Root.MouseOverAsync("#create-visualisation");
        await Ren.Root.MouseOverAsync("#create-visualisation-date-value-chart");

        await Expect(Ren.Root.Locator("#create-visualisation-date-value-chart-day")).ToHaveCountAsync(0);
    }

    [TestMethod("a chart of a text column is split by it")]
    public async Task AChartOfATextColumnIsSplitByIt()
    {
        await CreateChartAsync("Category", "Order Lines");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
        Expect(await TickedDateColumnAsync()).ToContain("None");
    }

    [TestMethod("a chart of a value column alone totals it")]
    public async Task AChartOfAValueColumnAloneTotalsIt()
    {
        await CreateChartAsync("Order Lines");

        await Poll(ValuesAsync).ToEqual(new[] { TotalOrderLines });
    }

    [TestMethod("setting a date column groups the chart by its dates")]
    public async Task SettingADateColumnGroupsTheChartByItsDates()
    {
        await CreateChartAsync("Category", "Order Lines");

        await DateValueChart.ClickMenuPathAsync(Ren, "Date column", "Quarter");

        await Poll(async () => (await DateValueChart.DatesWithValuesAsync(Ren)).Length).ToBe(4);
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
        Expect(await TickedDateColumnAsync()).ToContain("Quarter");
    }

    [TestMethod("setting the date column to none totals the chart")]
    public async Task SettingTheDateColumnToNoneTotalsTheChart()
    {
        await CreateChartAsync("Order Date", "Order Lines");

        await Poll(async () => (await DateValueChart.DatesWithValuesAsync(Ren)).Length).ToBe(8);

        await DateValueChart.ClickMenuPathAsync(Ren, "Date column", "None");

        await Poll(ValuesAsync).ToEqual(new[] { TotalOrderLines });
    }

    [TestMethod("setting the date column to none and back keeps how its dates were grouped")]
    public async Task SettingTheDateColumnToNoneAndBackKeepsHowItsDatesWereGrouped()
    {
        await CreateChartAsync("Order Date", "Order Lines");

        await DateValueChart.ClickMenuPathAsync(Ren, "Group by", "Quarter");
        await Poll(async () => (await DateValueChart.DatesWithValuesAsync(Ren)).Length).ToBe(4);

        await DateValueChart.ClickMenuPathAsync(Ren, "Date column", "None");
        await Poll(ValuesAsync).ToEqual(new[] { TotalOrderLines });

        await DateValueChart.ClickMenuPathAsync(Ren, "Date column", "Order Date");
        await Poll(async () => (await DateValueChart.DatesWithValuesAsync(Ren)).Length).ToBe(4);
    }

    [TestMethod("changing the date column groups the chart by the new column's dates")]
    public async Task ChangingTheDateColumnGroupsTheChartByTheNewColumnsDates()
    {
        await CreateChartAsync("Order Date", "Order Lines");

        await DateValueChart.ClickMenuPathAsync(Ren, "Date column", "Quarter");

        await Poll(async () => (await DateValueChart.DatesWithValuesAsync(Ren)).Length).ToBe(4);
    }

    [TestMethod("a chart with no date column offers none of the date items")]
    public async Task AChartWithNoDateColumnOffersNoneOfTheDateItems()
    {
        await CreateChartAsync("Category", "Order Lines");

        await DateValueChart.HoverMenuPathAsync(Ren, "Date column");

        await Expect(Ren.Root.Locator("#date-column")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#chart-date-range")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#date-value-chart-date-markers")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#chart-date-grouping")).ToHaveCountAsync(0);
    }
}
