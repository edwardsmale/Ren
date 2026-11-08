using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the Axes menu's Gridlines item, which draws faint lines across the plot at the
// value axis' ticks, behind the series, and takes them away again.
[TestClass]
public class DateValueChartGridlinesTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";
    private const string Gridline = ".ren-gridline";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task ToggleGridlinesAsync()
    {
        await DateValueChart.ClickMenuPathAsync(Ren, "Axes", "Gridlines");
        await Ren.WaitUntilLoadedAsync();
    }

    private static double Middle(LocatorBoundingBoxResult box) => box.Y + box.Height / 2;

    [TestMethod("draws no gridlines by default")]
    public async Task DrawsNoGridlinesByDefault()
    {
        await CreateChartAsync();

        await Expect(Ren.Root.Locator(Gridline)).ToHaveCountAsync(0);
    }

    [TestMethod("draws a gridline at each tick above the bottom, behind the series")]
    public async Task DrawsAGridlineAtEachTickAboveTheBottomBehindTheSeries()
    {
        await CreateChartAsync();
        await ToggleGridlinesAsync();

        var tickCount = await Ren.Root.Locator($"{LeftAxis} .tick").CountAsync();

        await Expect(Ren.Root.Locator(Gridline)).ToHaveCountAsync(tickCount - 1);

        var isBehindSeries = await Ren.Root.Locator(".ren-gridlines").EvaluateAsync<bool>("""
            group => (group.compareDocumentPosition(group.parentNode.querySelector(".ren-data-series"))
                & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
            """);

        Expect(isBehindSeries).ToBe(true);
    }

    // The chart is drawn at one size and scaled to fit its container, so the lines must be scaled
    // with it to meet their ticks.
    [TestMethod("meets its ticks and spans the plot, at the size the chart is shown")]
    public async Task MeetsItsTicksAndSpansThePlotAtTheSizeTheChartIsShown()
    {
        await CreateChartAsync();
        await ToggleGridlinesAsync();

        var topTick = (await Ren.Root.Locator($"{LeftAxis} .tick").Last.Locator("path").BoundingBoxAsync())!;
        var topLine = (await Ren.Root.Locator(Gridline).Last.BoundingBoxAsync())!;
        var dateAxis = (await Ren.Root.Locator(".ren-date-axis .domain").First.BoundingBoxAsync())!;

        Expect(Math.Abs(Middle(topLine) - Middle(topTick))).ToBeLessThan(2);
        Expect(Math.Abs(topLine.X - dateAxis.X)).ToBeLessThan(2);
        Expect(Math.Abs(topLine.Width - dateAxis.Width)).ToBeLessThan(2);
    }

    [TestMethod("takes the gridlines away when turned off")]
    public async Task TakesTheGridlinesAwayWhenTurnedOff()
    {
        await CreateChartAsync();
        await ToggleGridlinesAsync();
        await Expect(Ren.Root.Locator(Gridline).First).ToBeAttachedAsync();

        await ToggleGridlinesAsync();

        await Expect(Ren.Root.Locator(Gridline)).ToHaveCountAsync(0);
    }

    [TestMethod("keeps the gridlines when the chart is drawn again")]
    public async Task KeepsTheGridlinesWhenTheChartIsDrawnAgain()
    {
        await CreateChartAsync();
        await ToggleGridlinesAsync();

        var count = await Ren.Root.Locator(Gridline).CountAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "Linear");
        await Ren.WaitUntilLoadedAsync();

        await Expect(Ren.Root.Locator(".ren-trend-line")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator(Gridline)).ToHaveCountAsync(count);
    }
}
