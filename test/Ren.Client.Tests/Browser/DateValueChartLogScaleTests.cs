namespace Ren.Client.Tests.Browser;

// These tests cover a value axis' Logarithmic scale item, offered where the axis draws only lines
// or dots, all above zero.  Turned on, each power of ten takes the same height, the axis starting
// near the lowest value rather than at zero, and turned off it is linear again.
[TestClass]
public class DateValueChartLogScaleTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";

    private sealed record Tick(double Value, double Y);

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Days Active");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task CreateLineChartAsync()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Lines");
    }

    private async Task ToggleLogScaleAsync()
    {
        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#log-scale-left");
        await Ren.WaitUntilLoadedAsync();
    }

    // The left axis' ticks, as their values and the heights they are drawn at.
    private Task<Tick[]> AxisTicksAsync() => Ren.Root.Locator($"{LeftAxis} .tick").EvaluateAllAsAsync<Tick[]>("""
        ticks => ticks.map(tick => ({
            value: Number(tick.textContent.trim().replace(/,/g, "").replace(/k$/, "e3")),
            y: Number(/,\s*([-\d.]+)\)/.exec(tick.getAttribute("transform"))[1])
        }))
        """);

    [TestMethod("gives each power of ten the same height")]
    public async Task GivesEachPowerOfTenTheSameHeight()
    {
        await CreateLineChartAsync();
        await ToggleLogScaleAsync();

        await Poll(async () => (await AxisTicksAsync())[0].Value).ToBeGreaterThan(0);

        var ticks = await AxisTicksAsync();

        Expect(ticks.Length).ToBeGreaterThanOrEqual(3);

        // The pixels per power of ten between each tick and the next are the same all the way up.
        var heights = ticks.Skip(1).Select((t, index) =>
            (ticks[index].Y - t.Y) / Math.Log10(t.Value / ticks[index].Value)).ToArray();

        for (var i = 1; i < heights.Length; i++)
        {
            Expect(heights[i]).ToBeCloseTo(heights[0], 0);
        }
    }

    [TestMethod("is linear again once turned off")]
    public async Task IsLinearAgainOnceTurnedOff()
    {
        await CreateLineChartAsync();
        await ToggleLogScaleAsync();
        await Poll(async () => (await AxisTicksAsync())[0].Value).ToBeGreaterThan(0);

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("Logarithmic scale");

        await Ren.Root.ClickAsync("#log-scale-left");
        await Ren.WaitUntilLoadedAsync();

        await Poll(async () => (await AxisTicksAsync())[0].Value).ToBe(0);

        var ticks = await AxisTicksAsync();
        var steps = ticks.Skip(1).Select((t, index) => t.Y - ticks[index].Y).ToArray();

        Expect(steps.Max() - steps.Min()).ToBeLessThan(1);
    }

    [TestMethod("is kept in the saved settings")]
    public async Task IsKeptInTheSavedSettings()
    {
        await CreateLineChartAsync();
        await ToggleLogScaleAsync();

        Expect(await SavedSettingsTextAsync()).ToContain("\"logScale\":true");
    }

    [TestMethod("isn't offered for bars")]
    public async Task IsntOfferedForBars()
    {
        await CreateChartAsync();
        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);

        await Expect(Ren.Root.Locator("#scale-behaviour-left")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#log-scale-left")).ToHaveCountAsync(0);
    }
}
