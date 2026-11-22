using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a value axis' Add value band... and Remove value bands items.  A band shades
// the plot between the two values typed in, behind the series, labelled with any label typed in,
// and holds its axis open to both ends, so that a target range above every value still shows.
[TestClass]
public class DateValueChartValueBandsTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task<double> HighestPlottedValueAsync() =>
        (await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)"))
            .Where(value => value.HasValue)
            .Max(value => value!.Value);

    private static string Text(double value) => value.ToString("R", CultureInfo.InvariantCulture);

    private static double Number(string? text) => double.Parse(text!, CultureInfo.InvariantCulture);

    // Answers the prompts for the band's ends then its label, in turn.
    private async Task AddValueBandAsync(string from, string to, string label)
    {
        var remaining = new Queue<string>(new[] { from, to, label });

        Page.Dialog += async (_, dialog) => await dialog.AcceptAsync(remaining.TryDequeue(out var answer) ? answer : "");

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#value-band-add-left");
        await Ren.WaitUntilLoadedAsync();
    }

    // The pixel height a value is drawn at on the left axis, read from the tick drawn for it.
    private Task<double> TickYAsync(int tickIndex) => Ren.Root.Locator($"{LeftAxis} .tick").Nth(tickIndex)
        .EvaluateAsync<double>("""tick => Number(/,\s*([-\d.]+)\)/.exec(tick.getAttribute("transform"))[1])""");

    private async Task<double> TickValueAsync(int tickIndex)
    {
        var text = (await Ren.Root.Locator($"{LeftAxis} .tick").Nth(tickIndex).TextContentAsync())!.Trim().Replace(",", "");

        return text.EndsWith('k') ? Number(text[..^1]) * 1000 : Number(text);
    }

    [TestMethod("shades between the two values typed in, with its label")]
    public async Task ShadesBetweenTheTwoValuesTypedInWithItsLabel()
    {
        await CreateChartAsync();

        var from = await TickValueAsync(1);
        var to = await TickValueAsync(2);

        await AddValueBandAsync(Text(from), Text(to), "Target range");

        var band = Ren.Root.Locator(".ren-value-band");

        await Expect(band).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator(".ren-value-band-label")).ToHaveTextAsync("Target range");

        var y = Number(await band.GetAttributeAsync("y"));
        var height = Number(await band.GetAttributeAsync("height"));

        Expect(Math.Abs(y - await TickYAsync(2))).ToBeLessThan(1);
        Expect(Math.Abs(y + height - await TickYAsync(1))).ToBeLessThan(1);
    }

    [TestMethod("is drawn behind the series")]
    public async Task IsDrawnBehindTheSeries()
    {
        await CreateChartAsync();
        await AddValueBandAsync("0", "10", "");

        var isFirst = await Ren.Root.Locator(".ren-value-bands").EvaluateAsync<bool>(
            "group => group.parentNode.firstElementChild === group");

        Expect(isFirst).ToBe(true);
        await Expect(Ren.Root.Locator(".ren-value-band-label")).ToHaveCountAsync(0);
    }

    [TestMethod("holds the axis open to a band above every value plotted")]
    public async Task HoldsTheAxisOpenToABandAboveEveryValuePlotted()
    {
        await CreateChartAsync();

        var highest = await HighestPlottedValueAsync();

        await AddValueBandAsync(Text(highest * 2), Text(highest * 3), "");

        var band = Ren.Root.Locator(".ren-value-band");

        await Expect(band).ToHaveCountAsync(1);

        // A band cut off at the axis' top would be shorter than its values' span, at the axis' scale.
        var pixelsPerValue = (await TickYAsync(0) - await TickYAsync(1)) /
            (await TickValueAsync(1) - await TickValueAsync(0));

        Expect(Number(await band.GetAttributeAsync("y"))).ToBeGreaterThanOrEqual(0);
        Expect(Number(await band.GetAttributeAsync("height"))).ToBeCloseTo(highest * pixelsPerValue, 0);
    }

    [TestMethod("is kept in the saved settings, and removed by Remove value bands")]
    public async Task IsKeptInTheSavedSettingsAndRemovedByRemoveValueBands()
    {
        await CreateChartAsync();
        await AddValueBandAsync("20", "5", "");

        Expect(await SavedSettingsTextAsync()).ToContain("\"valueBands\":[{\"from\":5,\"to\":20}]");

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#value-bands-remove-left");
        await Ren.WaitUntilLoadedAsync();

        await Expect(Ren.Root.Locator(".ren-value-band")).ToHaveCountAsync(0);
    }

    [TestMethod("draws nothing where an end typed in isn't a number")]
    public async Task DrawsNothingWhereAnEndTypedInIsntANumber()
    {
        await CreateChartAsync();
        await AddValueBandAsync("5", "lots", "");

        await Expect(Ren.Root.Locator(".ren-value-band")).ToHaveCountAsync(0);
        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Expect(Ren.Root.Locator("#value-bands-remove-left")).ToHaveCountAsync(0);
    }
}
