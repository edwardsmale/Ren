using System.Globalization;
using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a value axis' Start at zero item, offered where the axis draws only lines.
// Turned off, the axis starts at about the lowest value drawn against it, a value line's included,
// and turned back on it starts at zero again.  Bars are measured from zero, so aren't offered it.
[TestClass]
public class DateValueChartAxisStartAtZeroTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string LeftAxis = ".ren-y-axis.ren-value-axis:not(.ren-y-axis-2)";

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

    private async Task<double> LowestPlottedValueAsync() =>
        (await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)"))
            .Where(value => value.HasValue)
            .Min(value => value!.Value);

    private async Task<double> BottomTickValueAsync()
    {
        var text = (await Ren.Root.Locator($"{LeftAxis} .tick text").First.TextContentAsync())!.Trim().Replace(",", "");

        return text.EndsWith('k')
            ? double.Parse(text[..^1], CultureInfo.InvariantCulture) * 1000
            : double.Parse(text, CultureInfo.InvariantCulture);
    }

    private async Task<double> ValueLineYAsync() =>
        double.Parse((await Ren.Root.Locator(".ren-value-line").GetAttributeAsync("y1"))!, CultureInfo.InvariantCulture);

    // The plot's foot, where the date axis is drawn.
    private async Task<double> PlotBottomYAsync() =>
        double.Parse(Regex.Match((await Ren.Root.Locator(".ren-x-axis").GetAttributeAsync("transform"))!, @",\s*([\d.]+)\)").Groups[1].Value,
            CultureInfo.InvariantCulture);

    private async Task ToggleStartAtZeroAsync()
    {
        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#start-at-zero-left");
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("starts the axis near the lowest value once turned off")]
    public async Task StartsTheAxisNearTheLowestValueOnceTurnedOff()
    {
        await CreateLineChartAsync();

        Expect(await BottomTickValueAsync()).ToBe(0d);

        var lowest = await LowestPlottedValueAsync();

        await ToggleStartAtZeroAsync();

        await Poll(BottomTickValueAsync).ToBeGreaterThan(0);
        Expect(await BottomTickValueAsync()).ToBeLessThanOrEqual(lowest);
    }

    [TestMethod("starts the axis at zero again once turned back on")]
    public async Task StartsTheAxisAtZeroAgainOnceTurnedBackOn()
    {
        await CreateLineChartAsync();

        await ToggleStartAtZeroAsync();
        await Poll(BottomTickValueAsync).ToBeGreaterThan(0);

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).Not.ToContain("Start at zero");

        await Ren.Root.ClickAsync("#start-at-zero-left");
        await Ren.WaitUntilLoadedAsync();

        await Poll(BottomTickValueAsync).ToBe(0d);
    }

    [TestMethod("keeps a value line below the values on the axis")]
    public async Task KeepsAValueLineBelowTheValuesOnTheAxis()
    {
        await CreateLineChartAsync();

        var lowest = await LowestPlottedValueAsync();
        var lineValue = Math.Round(lowest / 2, MidpointRounding.AwayFromZero);

        Page.Dialog += async (_, dialog) =>
            await dialog.AcceptAsync(dialog.Message.Contains("abel") ? "" : lineValue.ToString(CultureInfo.InvariantCulture));

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);
        await Ren.Root.ClickAsync("#value-line-add-left");
        await Ren.WaitUntilLoadedAsync();

        var before = await ValueLineYAsync();

        await ToggleStartAtZeroAsync();

        // Lower down the plot, as the axis starts nearer it, but still on it.
        await Poll(ValueLineYAsync).ToBeGreaterThan(before);
        Expect(await ValueLineYAsync()).ToBeLessThanOrEqual(await PlotBottomYAsync());
    }

    [TestMethod("isn't offered where the axis draws bars")]
    public async Task IsntOfferedWhereTheAxisDrawsBars()
    {
        await CreateChartAsync();

        await DateValueChart.OpenMenuAsync(Ren, LeftAxis);

        await Expect(Ren.Root.Locator("#set-max-left")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#start-at-zero-left")).ToHaveCountAsync(0);
    }
}
