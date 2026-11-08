namespace Ren.Client.Tests.Browser;

// These tests cover a series' Move earlier and Move later items, which move it one place among the
// series drawn, keeping its colour.  The first series can't move earlier, nor the last later, and
// nothing moves away from every series.
[TestClass]
public class DateValueChartSeriesOrderTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string First = "Unique Searches Per Day";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", First, "Days Active");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task<double?[]> PlottedValuesAsync(int seriesIndex) =>
        Page.EvaluateAsync<double?[]>("index => Ren.QA.DateValueChart.getPlottedValues(index)", seriesIndex);

    // Gets each legend entry's text, which names its column, and its colour, sorted by text.
    private Task<string[][]> LegendColoursAsync() => Page.EvaluateAsync<string[][]>("""
        () => Array.from(document.querySelectorAll(".ren-legend-item")).map(item => [
            item.textContent.trim(),
            getComputedStyle(item.querySelector(".ren-legend-colour-rect")).backgroundColor
        ]).sort()
        """);

    private Task<string[]> VisibleMenuTextsAsync() => Page.EvaluateAsync<string[]>("""
        () => Array.from(document.querySelectorAll(".ren-context-menu .ren-context-menu__item--clickable"))
            .filter(item => item.offsetParent !== null)
            .map(item => item.textContent.trim())
        """);

    [TestMethod("moves a series later")]
    public async Task MovesASeriesLater()
    {
        await CreateChartAsync();

        var first = await PlottedValuesAsync(0);
        var second = await PlottedValuesAsync(1);

        Expect(first).Not.ToEqual(second);

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, "Move later");

        await Poll(() => PlottedValuesAsync(0)).ToEqual(second);
        Expect(await PlottedValuesAsync(1)).ToEqual(first);
    }

    [TestMethod("moves a series earlier, keeping its colour")]
    public async Task MovesASeriesEarlierKeepingItsColour()
    {
        await CreateChartAsync();

        var second = await PlottedValuesAsync(1);
        var colours = await LegendColoursAsync();

        Expect(colours[0][1]).Not.ToBe(colours[1][1]);

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, "Move earlier");

        await Poll(() => PlottedValuesAsync(0)).ToEqual(second);
        Expect(await LegendColoursAsync()).ToEqual(colours);
    }

    [TestMethod("offers only the moves there is room for")]
    public async Task OffersOnlyTheMovesThereIsRoomFor()
    {
        await CreateChartAsync();

        await DateValueChart.OpenMenuAsync(Ren, ".ren-bar.ren-vertical[data-series='1']");

        var texts = await VisibleMenuTextsAsync();

        Expect(texts).ToContain("Move later");
        Expect(texts).Not.ToContain("Move earlier");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.OpenMenuAsync(Ren, ".ren-bar.ren-vertical[data-series='2']");

        texts = await VisibleMenuTextsAsync();

        Expect(texts).ToContain("Move earlier");
        Expect(texts).Not.ToContain("Move later");
    }

    [TestMethod("offers no move away from every series")]
    public async Task OffersNoMoveAwayFromEverySeries()
    {
        await CreateChartAsync();

        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        var texts = await VisibleMenuTextsAsync();

        Expect(texts).Not.ToContain("Move earlier");
        Expect(texts).Not.ToContain("Move later");
    }
}
