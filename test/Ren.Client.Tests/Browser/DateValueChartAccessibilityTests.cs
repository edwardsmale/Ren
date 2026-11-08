using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's accessibility: its SVG is an image named after the series shown,
// and its legend's entries are buttons that Tab reaches, Enter or Space showing or hiding their
// series and the arrow keys moving between them.
[TestClass]
public class DateValueChartAccessibilityTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day", "Days Active");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
    }

    private ILocator Entry(int seriesNumber) =>
        Ren.Root.Locator($".ren-legend-item[data-series='{seriesNumber}'] .ren-legend-entry");

    private async Task<string> LegendNameAsync(int seriesNumber) => (await Entry(seriesNumber).TextContentAsync())!.Trim();

    private ILocator ChartSvg => Ren.Root.Locator("svg[role='img']").First;

    [TestMethod("names the chart after its series")]
    public async Task NamesTheChartAfterItsSeries()
    {
        await CreateChartAsync();

        var label = await ChartSvg.GetAttributeAsync("aria-label");

        Expect(label).ToContain(await LegendNameAsync(1));
        Expect(label).ToContain(await LegendNameAsync(2));
    }

    [TestMethod("makes each legend entry a pressed button")]
    public async Task MakesEachLegendEntryAPressedButton()
    {
        await CreateChartAsync();

        await Expect(Entry(1)).ToHaveAttributeAsync("role", "button");
        await Expect(Entry(1)).ToHaveAttributeAsync("tabindex", "0");
        await Expect(Entry(2)).ToHaveAttributeAsync("aria-pressed", "true");
    }

    [TestMethod("hides and shows a series with Enter, keeping the focus")]
    public async Task HidesAndShowsASeriesWithEnterKeepingTheFocus()
    {
        await CreateChartAsync();

        var secondName = await LegendNameAsync(2);

        await Entry(2).FocusAsync();
        await Page.Keyboard.PressAsync("Enter");
        await Ren.WaitUntilLoadedAsync();

        await Expect(Entry(2)).ToHaveAttributeAsync("aria-pressed", "false");
        await Expect(Entry(2)).ToBeFocusedAsync();
        await Poll(() => ChartSvg.GetAttributeAsync("aria-label")).Not.ToContain(secondName);

        await Page.Keyboard.PressAsync(" ");
        await Ren.WaitUntilLoadedAsync();

        await Expect(Entry(2)).ToHaveAttributeAsync("aria-pressed", "true");
    }

    [TestMethod("leaves the last series shown")]
    public async Task LeavesTheLastSeriesShown()
    {
        await CreateChartAsync();

        await Entry(2).FocusAsync();
        await Page.Keyboard.PressAsync("Enter");
        await Ren.WaitUntilLoadedAsync();

        await Entry(1).FocusAsync();
        await Page.Keyboard.PressAsync("Enter");
        await Ren.WaitUntilLoadedAsync();

        await Expect(Entry(1)).ToHaveAttributeAsync("aria-pressed", "true");
    }

    [TestMethod("moves between the entries with the arrow keys")]
    public async Task MovesBetweenTheEntriesWithTheArrowKeys()
    {
        await CreateChartAsync();

        // The entries are in legend order, which needn't be the series' order.
        var entries = Ren.Root.Locator(".ren-legend-entry");

        await entries.First.FocusAsync();
        await Page.Keyboard.PressAsync("ArrowRight");

        await Expect(entries.Nth(1)).ToBeFocusedAsync();

        await Page.Keyboard.PressAsync("Home");

        await Expect(entries.First).ToBeFocusedAsync();
    }
}
