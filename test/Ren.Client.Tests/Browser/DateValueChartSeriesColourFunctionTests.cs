namespace Ren.Client.Tests.Browser;

// These tests cover colouring a date/value chart series' marks point by point with its colour
// function.  The charts plot the Searches of 2024-01-01 to 2024-01-10 - 10, 12, 14, 11, 18, 16,
// 13, 19, 15 and 17 - in a series coloured #3046B8, with a colour function giving Red to searches
// over 15.
[TestClass]
public class DateValueChartSeriesColourFunctionTests : BrowserTest
{
    // One bar a day, each plotted from a single row.
    private const string DailyFixture = "ported/DateValueChartTest15.html";

    // One bar for the month, aggregated from all ten rows.
    private const string MonthlyFixture = "ported/DateValueChartTest16.html";

    // Each bar's mark colour, left to right, with "" for a bar left in its series' colour.
    private Task<string[]> BarMarkColoursAsync() => Page.EvaluateAsync<string[]>("""
        () => {

            const resolveColour = (bar, colour) => {

                if (colour.indexOf("var(") < 0) {
                    return colour;
                }

                // A probe beside the bar inherits its series' --series-colour.
                const probe = document.createElementNS(bar.namespaceURI, "g");

                bar.parentNode.appendChild(probe);
                probe.style.color = colour;

                const computed = getComputedStyle(probe).color;

                probe.remove();

                const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?/
                    .exec(computed);

                if (!srgb) {
                    return computed;
                }

                const channel = (value) => Math.round(parseFloat(value) * 255);
                const alpha = srgb[4] === undefined ? 1 : parseFloat(srgb[4]);

                return `rgba(${channel(srgb[1])}, ${channel(srgb[2])}, ${channel(srgb[3])}, ${alpha})`;
            };

            return Array.prototype.map.call(
                document.querySelectorAll(".ren-bar.ren-vertical:not(.ren-estimate-mark) .ren-data-series__bar"),
                bar => ({
                    left: bar.getBoundingClientRect().left,
                    colour: resolveColour(bar, bar.style.getPropertyValue("--mark-colour").trim())
                })
            )
                .sort((a, b) => a.left - b.left)
                .map(bar => bar.colour);
        }
        """);

    [TestMethod("with a row a bar only the bars it matches are coloured")]
    public async Task WithARowABarOnlyTheBarsItMatchesAreColoured()
    {
        await Ren.OpenAsync(DailyFixture);

        await Poll(BarMarkColoursAsync).ToEqual(new[] { "", "", "", "", "Red", "Red", "", "Red", "", "Red" });
    }

    [TestMethod("narrowed to a date range the colours follow their bars")]
    public async Task NarrowedToADateRangeTheColoursFollowTheirBars()
    {
        await Ren.OpenAsync(DailyFixture);

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-05", "2024-01-08");

        await Poll(() => DateValueChart.DatesWithValuesAsync(Ren))
            .ToEqual(new[] { "2024-01-05", "2024-01-06", "2024-01-07", "2024-01-08" });
        await Poll(BarMarkColoursAsync).ToEqual(new[] { "Red", "Red", "", "Red" });
    }

    [TestMethod("a bar aggregated from many rows mixes the rows' colours")]
    public async Task ABarAggregatedFromManyRowsMixesTheRowsColours()
    {
        await Ren.OpenAsync(MonthlyFixture);

        // Four rows in Red (255, 0, 0) and six left in the series' #3046B8 (48, 70, 184), so red is
        // (4 * 255 + 6 * 48) / 10 = 130.8.
        await Poll(BarMarkColoursAsync).ToEqual(new[] { "rgba(131, 42, 110, 1)" });
    }
}
