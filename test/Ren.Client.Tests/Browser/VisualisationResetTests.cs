namespace Ren.Client.Tests.Browser;

// These tests cover the Reset menu item, which puts a visualisation declared in the report settings
// back the way the settings declare it.
[TestClass]
public class VisualisationResetTests : BrowserTest
{
    // A date/value chart with a single bar series, one bar a day from 2024-01-01 to 2024-01-10.
    private const string DeclaredChartFixture = "ported/DateValueChartTest05.html";

    private const string Bars = ".ren-bar.ren-vertical[data-series='1']";
    private const string Line = "g.ren-series-1 .ren-data-series__line-path";

    [TestMethod("a series type changed is restored by Reset")]
    public async Task SeriesTypeChangedIsRestoredByReset()
    {
        await Ren.OpenAsync(DeclaredChartFixture);

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, "Chart type", "Lines");
        await Expect(Ren.Root.Locator(Line)).Not.ToHaveCountAsync(0);

        await DateValueChart.ClickMenuPathAsync(Ren, "Reset");

        await Expect(Ren.Root.Locator(Bars)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(Line)).ToHaveCountAsync(0);
    }

    [TestMethod("a date range selected is restored to every date by Reset")]
    public async Task DateRangeSelectedIsRestoredToEveryDateByReset()
    {
        await Ren.OpenAsync(DeclaredChartFixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-03", "2024-01-05");
        await Expect(Ren.Root.Locator(Bars)).ToHaveCountAsync(3);

        await DateValueChart.ClickMenuPathAsync(Ren, "Reset");

        await Expect(Ren.Root.Locator(Bars)).ToHaveCountAsync(10);
    }

    // A chart made from the grid has no declared settings to go back to.
    [TestMethod("a chart created from the grid isn't offered Reset")]
    public async Task ChartCreatedFromTheGridIsNotOfferedReset()
    {
        await Ren.OpenAsync("ported/DateValueChartTest01.html");
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");

        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        await Expect(Ren.Root.Locator("#visualisation-reset")).ToHaveCountAsync(0);
    }
}
