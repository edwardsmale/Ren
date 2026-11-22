using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover stepping through a chart's periods from the keyboard.  The chart takes the
// focus, the arrows, Home and End move a highlight from period to period, and each period's date
// and values are put in a live region for a screen reader to announce.  Escape clears it.
[TestClass]
public class DateValueChartPeriodFocusTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string ChartSvg = "svg:has(.ren-x-axis)";
    private const string Highlight = ".ren-focused-period";
    private const string Announcer = ".ren-chart-announcer";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task<double?[]> PlottedValuesAsync() =>
        Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

    private async Task<string> LegendNameAsync() =>
        (await Ren.Root.Locator(".ren-legend-item.ren-series-1 .ren-legend-entry").TextContentAsync())!.Trim();

    private Task PressAsync(string key) => Ren.Root.Locator(ChartSvg).PressAsync(key);

    private async Task<int> HighlightedIndexAsync() =>
        int.Parse((await Ren.Root.Locator(Highlight).GetAttributeAsync("data-period-index"))!, CultureInfo.InvariantCulture);

    [TestMethod("makes the chart focusable")]
    public async Task MakesTheChartFocusable()
    {
        await CreateChartAsync();

        await Expect(Ren.Root.Locator(ChartSvg)).ToHaveAttributeAsync("tabindex", "0");
    }

    [TestMethod("highlights and announces the first period on the right arrow")]
    public async Task HighlightsAndAnnouncesTheFirstPeriodOnTheRightArrow()
    {
        await CreateChartAsync();
        await Ren.Root.Locator(ChartSvg).FocusAsync();

        await PressAsync("ArrowRight");

        await Expect(Ren.Root.Locator(Highlight)).ToHaveCountAsync(1);
        Expect(await HighlightedIndexAsync()).ToBe(0);

        var first = (await PlottedValuesAsync())[0];
        var announced = (await Ren.Root.Locator(Announcer).TextContentAsync())!;

        var name = await LegendNameAsync();

        Expect(announced).ToContain($"{name} ");

        // The value is announced in the series' format, so is compared as a number.
        var value = double.Parse(announced[(announced.IndexOf($"{name} ", StringComparison.Ordinal) + name.Length + 1)..].Trim(),
            NumberStyles.Float, CultureInfo.InvariantCulture);

        Expect(value).ToBeCloseTo(first!.Value, 1);
        await Expect(Ren.Root.Locator(Announcer)).ToHaveAttributeAsync("aria-live", "polite");
    }

    [TestMethod("steps along with the arrows, and jumps to the ends with Home and End")]
    public async Task StepsAlongWithTheArrowsAndJumpsToTheEndsWithHomeAndEnd()
    {
        await CreateChartAsync();

        var count = (await PlottedValuesAsync()).Length;

        await Ren.Root.Locator(ChartSvg).FocusAsync();
        await PressAsync("ArrowRight");
        await PressAsync("ArrowRight");
        Expect(await HighlightedIndexAsync()).ToBe(1);

        await PressAsync("End");
        Expect(await HighlightedIndexAsync()).ToBe(count - 1);

        // The arrows stop at the ends.
        await PressAsync("ArrowRight");
        Expect(await HighlightedIndexAsync()).ToBe(count - 1);

        await PressAsync("ArrowLeft");
        Expect(await HighlightedIndexAsync()).ToBe(count - 2);

        await PressAsync("Home");
        Expect(await HighlightedIndexAsync()).ToBe(0);
    }

    [TestMethod("clears the highlight on Escape and when the chart loses the focus")]
    public async Task ClearsTheHighlightOnEscapeAndWhenTheChartLosesTheFocus()
    {
        await CreateChartAsync();
        await Ren.Root.Locator(ChartSvg).FocusAsync();

        await PressAsync("ArrowRight");
        await PressAsync("Escape");
        await Expect(Ren.Root.Locator(Highlight)).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(Announcer)).ToHaveTextAsync("");

        await PressAsync("ArrowRight");
        await Ren.Root.Locator(ChartSvg).EvaluateAsync("svg => svg.blur()");
        await Expect(Ren.Root.Locator(Highlight)).ToHaveCountAsync(0);
    }

    // The chart is drawn at one size and scaled to fit its container, so the highlight must be scaled
    // with it to stand over its period's bar.
    [TestMethod("stands over its period's bar, at the size the chart is shown")]
    public async Task StandsOverItsPeriodsBarAtTheSizeTheChartIsShown()
    {
        await CreateChartAsync();
        await Ren.Root.Locator(ChartSvg).FocusAsync();
        await PressAsync("End");

        var highlight = (await Ren.Root.Locator(Highlight).BoundingBoxAsync())!;
        var bar = (await Ren.Root.Locator(".ren-data-series__bar").Last.BoundingBoxAsync())!;
        var barCentre = bar.X + bar.Width / 2;

        Expect(barCentre).ToBeGreaterThan(highlight.X);
        Expect(barCentre).ToBeLessThan(highlight.X + highlight.Width);
        Expect(highlight.Width).ToBeLessThan(bar.Width * 4);
    }
}
