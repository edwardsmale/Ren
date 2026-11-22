using System.Globalization;
using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Trend line submenu, which draws a dashed line over each series it
// is set for: a straight line fitted to the series' values or a moving average of them.  It is
// drawn in a shade of its series' colour over a white casing, so that it stands apart from them.
[TestClass]
public class DateValueChartTrendLinesTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";
    private const string LongFixture = "ported/DateValueChartTest05.html";

    private const string TrendLine = ".ren-trend-line";

    private sealed record Colours(string Line, string Series, string? CasingClass, string? Casing);

    private async Task CreateChartAsync(params string[] columnHeadings)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync(columnHeadings);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task CreateSingleSeriesChartAsync() => CreateChartAsync("CreatedOn", "Unique Searches Per Day");

    private Task<int> PointCountAsync() => Ren.Root.Locator(TrendLine).First
        .EvaluateAsync<int>("path => (path.getAttribute('d').match(/[ML]/g) || []).length");

    [TestMethod("draws no trend line by default")]
    public async Task DrawsNoTrendLineByDefault()
    {
        await CreateSingleSeriesChartAsync();

        await Expect(Ren.Root.Locator(TrendLine)).ToHaveCountAsync(0);
    }

    [TestMethod("draws a straight trend line from end to end")]
    public async Task DrawsAStraightTrendLineFromEndToEnd()
    {
        await CreateSingleSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "Linear");

        await Expect(Ren.Root.Locator($"{TrendLine}[data-trend='linear']")).ToHaveCountAsync(1);
        Expect(await PointCountAsync()).ToBe(2);
    }

    // A chart with ten periods, enough for a moving average's windows to fill.
    [TestMethod("draws a moving average through the periods after the first few")]
    public async Task DrawsAMovingAverageThroughThePeriodsAfterTheFirstFew()
    {
        await Ren.OpenAsync(LongFixture);
        await Ren.WaitUntilLoadedAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "3-period moving average");

        await Expect(Ren.Root.Locator($"{TrendLine}[data-trend='movingAverage']")).ToHaveCountAsync(1);

        // A point for each period whose window holds a value.
        var expectedPoints = await Page.EvaluateAsync<int>("""
            () => Ren.DateValueChart_TrendLines
                .getMovingAverages(Ren.QA.DateValueChart.getPlottedValues(0), 3)
                .filter(average => average !== null).length
            """);

        Expect(expectedPoints).ToBeGreaterThan(2);
        Expect(await PointCountAsync()).ToBe(expectedPoints);
    }

    [TestMethod("ticks the trend line chosen")]
    public async Task TicksTheTrendLineChosen()
    {
        await CreateSingleSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "6-period moving average");
        await DateValueChart.HoverMenuPathAsync(Ren, "Trend line");

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("6-period moving average");
    }

    [TestMethod("removes the trend line when set to none")]
    public async Task RemovesTheTrendLineWhenSetToNone()
    {
        await CreateSingleSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "Linear");
        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "None");

        await Expect(Ren.Root.Locator(TrendLine)).ToHaveCountAsync(0);
    }

    [TestMethod("draws a trend line for the series whose menu sets it")]
    public async Task DrawsATrendLineForTheSeriesWhoseMenuSetsIt()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day", "Days Active");
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, "Trend line", "Linear");

        await Expect(Ren.Root.Locator(TrendLine)).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator($"{TrendLine}[data-trend-series='2']")).ToHaveCountAsync(1);
    }

    // The chart is drawn at one size and scaled to fit its container, so a line must be scaled with it.
    [TestMethod("draws its line within the plot, at the size the chart is shown")]
    public async Task DrawsItsLineWithinThePlotAtTheSizeTheChartIsShown()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "Linear");

        var line = (await Ren.Root.Locator(TrendLine).BoundingBoxAsync())!;
        var dateAxis = (await Ren.Root.Locator(".ren-date-axis .domain").First.BoundingBoxAsync())!;

        Expect(line.X).ToBeGreaterThanOrEqual(dateAxis.X - 2);
        Expect(line.X + line.Width).ToBeLessThanOrEqual(dateAxis.X + dateAxis.Width + 2);
        Expect(line.Width).ToBeGreaterThan(dateAxis.Width / 2);
    }

    [TestMethod("draws a level average line labelled with the series' average")]
    public async Task DrawsALevelAverageLineLabelledWithTheSeriesAverage()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "Average");

        var values = (await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)"))
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .ToArray();
        var average = values.Sum() / values.Length;

        await Expect(Ren.Root.Locator($"{TrendLine}[data-trend='average']")).ToHaveCountAsync(1);
        Expect(await PointCountAsync()).ToBe(2);

        var label = Ren.Root.Locator(".ren-trend-line-label");

        await Expect(label).ToHaveTextAsync(new Regex("^Average "));

        var labelled = double.Parse(
            Regex.Replace((await label.TextContentAsync())!, @"[^\d.]", ""),
            CultureInfo.InvariantCulture);

        // The label is in the axis' format, which may round.
        Expect(Math.Abs(labelled - average)).ToBeLessThanOrEqual(Math.Max(0.5, average * 0.05));

        // Level, so as tall as its stroke alone, and labelled just above its end.
        var line = (await Ren.Root.Locator(TrendLine).BoundingBoxAsync())!;
        var labelBox = (await label.BoundingBoxAsync())!;

        Expect(line.Height).ToBeLessThan(4);
        // The label's white halo adds a little to its box.
        Expect(labelBox.Y + labelBox.Height).ToBeLessThanOrEqual(line.Y + 3);
        Expect(Math.Abs((labelBox.X + labelBox.Width) - (line.X + line.Width))).ToBeLessThan(8);
    }

    [TestMethod("draws the line in a shade of its series' colour, over a white casing")]
    public async Task DrawsTheLineInAShadeOfItsSeriesColourOverAWhiteCasing()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Trend line", "Linear");

        var colours = await Ren.Root.Locator(TrendLine).EvaluateAsAsync<Colours>("""
            line => {

                const bar = line.ownerSVGElement.querySelector(".ren-data-series__bar");
                const casing = line.previousElementSibling;

                return {
                    line: getComputedStyle(line).stroke,
                    series: getComputedStyle(bar).fill,
                    casingClass: casing && casing.getAttribute("class"),
                    casing: casing && getComputedStyle(casing).stroke
                };
            }
            """);

        Expect(colours.Line).Not.ToBe(colours.Series);
        Expect(colours.CasingClass).ToBe("ren-trend-line-casing");
        Expect(colours.Casing).ToBe("rgb(255, 255, 255)");
    }

    [TestMethod("lightens rather than darkens a dark series' colour")]
    public async Task LightensRatherThanDarkensADarkSeriesColour()
    {
        await Ren.OpenAsync(Fixture);

        var lightness = await Page.EvaluateAsync<double[]>("""
            () => [
                Ren.Colours.lightnessOfColour(Ren.DateValueChart_TrendLines.getTrendColour("#1A1A1A")),
                Ren.Colours.lightnessOfColour(Ren.DateValueChart_TrendLines.getTrendColour("#C0392B"))
            ]
            """);

        Expect(lightness[0]).ToBeGreaterThan(0.1);
        Expect(lightness[1]).ToBeLessThan(0.45);
    }
}
