using System.Globalization;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a date/value chart's value axis set to Ratchet, which only ever grows, holding
// its scale while a filter on the grid redraws the chart from less data.  A filter change detects
// the chart's columns again, rebuilding its axes from the saved settings, which hold no ratcheted
// maximum, so it has to be carried over.  The chart plots Unique Searches Per Day, whose TB44445
// rows reach far less high than the rest, so filtering the grid to them would rescale an axis
// that kept up with the data.
[TestClass]
public class DateValueChartYAxisRatchetTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";
    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";
    private const string LowValue = "TB44445";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await Ren.Root.Locator(LeftAxis).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    private Task SetRatchetAsync() => DateValueChart.ClickMenuPathOnAsync(Ren, LeftAxis, "Scale behaviour", "Ratchet");

    // The left value axis' tick labels, bottom to top.
    private Task<string> AxisTickLabelsAsync() => Page.EvaluateAsync<string>("""
        selector => Array.from(document.querySelectorAll(selector + " .tick text"))
            .map(text => text.textContent.trim())
            .join(",")
        """, LeftAxis);

    // The highest of the tick labels, ignoring any that aren't plain numbers.
    private static double MaxOf(string ticks) => ticks.Split(',')
        .Select(label => double.TryParse(label, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : double.NaN)
        .Where(value => !double.IsNaN(value))
        .Max();

    private Task<string> BarHeightsAsync() => Page.EvaluateAsync<string>("""
        () => Array.from(document.querySelectorAll(".ren-bar.ren-vertical[data-series]"))
            .map(bar => bar.getBBox().height.toFixed(1))
            .join(",")
        """);

    // Filters the grid to the rows whose Discontinued value is LowValue, and waits for the chart's
    // bars to be redrawn from them.
    private async Task FilterGridToLowValuesAsync()
    {
        var barsBefore = await BarHeightsAsync();
        var row = 2;

        while (await Ren.Report.CellTextAsync("Discontinued", row) != LowValue)
        {
            row++;
        }

        await Ren.Report.ChooseFromCellMenuAsync("Discontinued", row, "#filter-menu-option", "#filter-this-value-only");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Discontinued")).ToBe(LowValue);
        await Poll(BarHeightsAsync).Not.ToBe(barsBefore);
    }

    private async Task ClearGridFiltersAsync()
    {
        var barsBefore = await BarHeightsAsync();

        await Ren.Report.ChooseFromCellMenuAsync("Discontinued", 2, "#filter-menu-option", "#clear-all-column-filters-menu-item");

        await Poll(BarHeightsAsync).Not.ToBe(barsBefore);
    }

    [TestMethod("a ratchet axis keeps its scale when the grid's filtered to lower values")]
    public async Task ARatchetAxisKeepsItsScaleWhenTheGridsFilteredToLowerValues()
    {
        await CreateChartAsync();
        await SetRatchetAsync();
        var ticksBefore = await AxisTickLabelsAsync();

        await FilterGridToLowValuesAsync();

        Expect(await AxisTickLabelsAsync()).ToBe(ticksBefore);
    }

    [TestMethod("a ratchet axis keeps its scale when the grid's filtered twice")]
    public async Task ARatchetAxisKeepsItsScaleWhenTheGridsFilteredTwice()
    {
        await CreateChartAsync();
        await SetRatchetAsync();
        var ticksBefore = await AxisTickLabelsAsync();

        await FilterGridToLowValuesAsync();
        await ClearGridFiltersAsync();
        await FilterGridToLowValuesAsync();

        Expect(await AxisTickLabelsAsync()).ToBe(ticksBefore);
    }

    [TestMethod("a ratchet axis grows when a filter's cleared to higher values")]
    public async Task ARatchetAxisGrowsWhenAFiltersClearedToHigherValues()
    {
        await CreateChartAsync();
        await FilterGridToLowValuesAsync();
        await SetRatchetAsync();
        var ticksFiltered = await AxisTickLabelsAsync();

        await ClearGridFiltersAsync();

        await Poll(async () => MaxOf(await AxisTickLabelsAsync())).ToBeGreaterThan(MaxOf(ticksFiltered));
    }

    [TestMethod("an always updated axis rescales to the grid filtered to lower values")]
    public async Task AnAlwaysUpdatedAxisRescalesToTheGridFilteredToLowerValues()
    {
        await CreateChartAsync();
        var ticksBefore = await AxisTickLabelsAsync();

        await FilterGridToLowValuesAsync();

        await Poll(async () => MaxOf(await AxisTickLabelsAsync())).ToBeLessThan(MaxOf(ticksBefore));
    }
}
