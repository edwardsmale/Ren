namespace Ren.Client.Tests.Browser;

// These tests cover a series' Compare with previous year item, which draws the series' values for
// the year before over it as a dotted line in its colour.  The values are binned from the chart's
// own rows, so each month is compared with the same month a year before, and a month with no
// data a year before has nothing drawn.
[TestClass]
public class DateValueChartPreviousYearTests : BrowserTest
{
    // Monthly sales from January 2024 to December 2026, 100 in the first month and one more each
    // month after.
    private const string Fixture = "previous-year/monthly-sales.html";

    private const string Line = ".ren-previous-year-line";

    private sealed record Lines(double[][] PreviousYear, double?[] Values);

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-month-start");
    }

    private Task CompareAsync() => DateValueChart.ClickMenuPathAsync(Ren, "Compare with previous year");

    // Gets the points of the series' previous-year line, in pixels, and the series' own values.
    private Task<Lines> GetLinesAsync() => EvaluateAsync<Lines>("""
        () => {

            const readPath = (d) => d.split(/[ML]/)
                .filter(Boolean)
                .map(pair => pair.split(",").map(Number));
            const line = document.querySelector(".ren-previous-year-line");

            return {
                previousYear: line ? readPath(line.getAttribute("d")) : [],
                values: Ren.QA.DateValueChart.getPlottedValues(0)
            };
        }
        """);

    [TestMethod("draws nothing for the previous year by default")]
    public async Task DrawsNothingForThePreviousYearByDefault()
    {
        await CreateChartAsync();

        await Expect(Ren.Root.Locator(Line)).ToHaveCountAsync(0);
    }

    [TestMethod("draws the series' previous year in its colour once compared")]
    public async Task DrawsTheSeriesPreviousYearInItsColourOnceCompared()
    {
        await CreateChartAsync();
        await CompareAsync();

        var line = Ren.Root.Locator($"{Line}[data-previous-year-series='1']");

        await Expect(line).ToHaveCountAsync(1);

        var colour = await Page.EvaluateAsync<string?>("""
            () => Ren.QA.DateValueChart.getSeriesColour ? Ren.QA.DateValueChart.getSeriesColour(0) : null
            """);

        if (!string.IsNullOrEmpty(colour)) await Expect(line).ToHaveAttributeAsync("stroke", colour);

        await DateValueChart.HoverMenuPathAsync(Ren);

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("Compare with previous year");
    }

    [TestMethod("draws each month's value from a year before, from the second year")]
    public async Task DrawsEachMonthsValueFromAYearBeforeFromTheSecondYear()
    {
        await CreateChartAsync();
        await CompareAsync();
        await Expect(Ren.Root.Locator(Line)).ToHaveCountAsync(1);

        var (previousYear, values) = await GetLinesAsync();

        // Two years of 36 months have a year before them.
        Expect(values.Length).ToBe(36);
        Expect(previousYear.Length).ToBe(24);

        // Each month's previous-year value is 12 less than its own, so the line stands 12 units below
        // the series all the way along: evenly spaced and rising as the series does.
        for (var i = 1; i < previousYear.Length; i++)
        {
            Expect(previousYear[i][0]).ToBeGreaterThan(previousYear[i - 1][0]);
            Expect(previousYear[i][1]).ToBeLessThan(previousYear[i - 1][1]);
        }
    }

    [TestMethod("takes the previous year away when compared again")]
    public async Task TakesThePreviousYearAwayWhenComparedAgain()
    {
        await CreateChartAsync();
        await CompareAsync();
        await Expect(Ren.Root.Locator(Line)).ToHaveCountAsync(1);

        await CompareAsync();

        await Expect(Ren.Root.Locator(Line)).ToHaveCountAsync(0);
    }
}
