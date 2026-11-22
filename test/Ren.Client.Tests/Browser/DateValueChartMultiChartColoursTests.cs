using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the series Colour menu on a multi-chart of pies, whose charts share one legend
// and each number only the series their own period holds.  In the fixture 2024 has Affiliate and
// Direct, and 2025 has Affiliate, Other and Direct, so Direct is numbered differently in each.
[TestClass]
public class DateValueChartMultiChartColoursTests : BrowserTest
{
    private const string Fixture = "multi-chart-colours/channel-sales.html";

    private const string AffiliateBlue = "rgb(48, 70, 184)";
    private const string Gold = "rgb(199, 145, 0)";
    private const string Teal = "rgb(0, 121, 107)";

    private async Task CreateMultiChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SplitDataAsync(Ren, "Channel");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-year-start");
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await DateValueChart.ClickMenuPathAsync(Ren, "Multi-chart", "By year");
        await Ren.WaitUntilLoadedAsync();
    }

    // Opens the chart as a report does, its menus being built after its charts and legend are drawn.
    private async Task OpenMultiChartFromSettingsAsync()
    {
        await CreateMultiChartAsync();
        await Ren.OpenWithSettingsAsync(Fixture, await Ren.SavedSettingsAsync());
        await Ren.WaitUntilLoadedAsync();
    }

    // Opens the chart with its slices subdivided into labelled bands around a hole.
    private async Task OpenSubdividedMultiChartAsync()
    {
        await CreateMultiChartAsync();

        // Put ahead of the chart's series, as charts no longer save a setting of their own for
        // being drawn as pies.
        var saved = await SavedSettingsTextAsync();
        var seriesAt = saved.IndexOf("\"series\":[", StringComparison.Ordinal);

        Assert.IsTrue(seriesAt >= 0, "The chart's series weren't saved.");

        var settings = saved.Insert(
            seriesAt,
            "\"pieHoleRadius\":0.45,\"subdivideColumn\":\"Brand\","
                + "\"subdivisionLabels\":\"names\",\"pieLabelValues\":true,");

        await Ren.OpenWithSettingsAsync(Fixture, JsonNode.Parse(settings));
        await Ren.WaitUntilLoadedAsync();
    }

    // Gets each slice's colour by year and series name, and each legend entry's as "legend" ones.
    private Task<Dictionary<string, string>> ReadColoursAsync() => EvaluateAsync<Dictionary<string, string>>("""
        () => {
            const colours = {};
            const slices = document.querySelectorAll(".ren-data-series__pie-slice");

            for (let i = 0; i < slices.length; i++) {
                const lines = slices[i].parentNode.querySelector("title").textContent.split("\n");

                colours[lines[0] + " " + lines[1].split(":")[0]] = getComputedStyle(slices[i]).fill;
            }

            const legendItems = document.querySelectorAll(".ren-legend-item");

            for (let i = 0; i < legendItems.length; i++) {
                const rect = legendItems[i].querySelector(".ren-legend-colour-rect");

                colours["legend " + legendItems[i].textContent.trim()] = getComputedStyle(rect).backgroundColor;
            }

            return colours;
        }
        """);

    private record Point(double X, double Y);

    // Finds a point well inside the mark, as its box's middle may be off it and its edge misses it
    // once the pointer arrives.
    private async Task RightClickMarkAsync(string selector, string titleStart, string titleEnd)
    {
        var point = await EvaluateAsync<Point>("""
            ({ selector, titleStart, titleEnd }) => {
                const marks = document.querySelectorAll(selector);
                const points = [];

                for (let i = 0; i < marks.length; i++) {
                    const title = marks[i].querySelector("title") || marks[i].parentNode.querySelector("title");

                    if (title.textContent.indexOf(titleStart) !== 0) continue;
                    if (title.textContent.indexOf(titleEnd) === -1) continue;

                    const box = marks[i].getBoundingClientRect();

                    for (let x = box.left + 1; x < box.right; x += 2) {
                        for (let y = box.top + 1; y < box.bottom; y += 2) {
                            if (document.elementFromPoint(x, y) === marks[i]) points.push({ x, y });
                        }
                    }
                }

                return points[Math.floor(points.length / 2)];
            }
            """, new { selector, titleStart, titleEnd });

        await Page.Mouse.ClickAsync((float)point.X, (float)point.Y, new() { Button = MouseButton.Right });
    }

    private Task RightClickSliceAsync(int year, string name) =>
        RightClickMarkAsync(".ren-data-series__pie-slice", year + "\n" + name + ":", "");

    private Task RightClickBandAsync(int year, string name, string band) =>
        RightClickMarkAsync(".ren-pie-subdivision", year + "\n" + name + "\n", band + ":");

    private Task HoverColourMenuAsync() => Page.Locator("#series-colour").First.HoverAsync();

    private ILocator MenuItem(string text) => Page
        .Locator(".ren-context-menu .ren-context-menu__item--clickable")
        .Filter(new() { HasTextRegex = new Regex("^\\s*" + text + "\\s*$") })
        .First;

    private async Task<Dictionary<string, string>> SavedSeriesColoursAsync()
    {
        var saved = await SavedSettingsTextAsync();
        var colours = new Dictionary<string, string>();

        foreach (Match match in Regex.Matches(saved, "\"column\":\"[^\"]+\"[^{}]*?\"colour\":\"[^\"]+\""))
        {
            var parts = Regex.Match(match.Value, "\"column\":\"([^\"]+)\".*\"colour\":\"([^\"]+)\"");

            colours[parts.Groups[1].Value] = parts.Groups[2].Value.ToLowerInvariant();
        }

        return colours;
    }

    private async Task PickColourOnSliceAsync(int year, string name, string colour)
    {
        await RightClickSliceAsync(year, name);
        await HoverColourMenuAsync();
        await MenuItem(colour).ClickAsync();
    }

    [TestMethod("Picking a colour_recolours the series in every chart and the legend")]
    public async Task PickingAColour_RecoloursTheSeriesInEveryChartAndTheLegend()
    {
        await CreateMultiChartAsync();

        var before = await ReadColoursAsync();

        Expect(before["2024 Affiliate"]).ToBe(AffiliateBlue);

        await PickColourOnSliceAsync(2024, "Affiliate", "Gold");

        var after = await ReadColoursAsync();

        Expect(after["2024 Affiliate"]).ToBe(Gold);
        Expect(after["2025 Affiliate"]).ToBe(Gold);
        Expect(after["legend Affiliate"]).ToBe(Gold);
        Expect(after["2024 Direct"]).ToBe(before["2024 Direct"]);
        Expect(after["2025 Other"]).ToBe(before["2025 Other"]);
        Expect(after["legend Direct"]).ToBe(before["legend Direct"]);
    }

    [TestMethod("Picking a colour_finds the series each chart numbers differently")]
    public async Task PickingAColour_FindsTheSeriesEachChartNumbersDifferently()
    {
        await CreateMultiChartAsync();

        var before = await ReadColoursAsync();

        // Direct is the 2024 chart's second series, and Other is the 2025 chart's.
        await PickColourOnSliceAsync(2024, "Direct", "Gold");

        var after = await ReadColoursAsync();

        Expect(after["2024 Direct"]).ToBe(Gold);
        Expect(after["2025 Direct"]).ToBe(Gold);
        Expect(after["legend Direct"]).ToBe(Gold);
        Expect(after["2025 Other"]).ToBe(before["2025 Other"]);
        Expect(after["legend Other"]).ToBe(before["legend Other"]);

        var saved = await SavedSeriesColoursAsync();

        Expect(saved.GetValueOrDefault("Direct")).ToBe("#c79100");
        Expect(saved.GetValueOrDefault("Other")).Not.ToBe("#c79100");
    }

    [TestMethod("Picking a colour_is ticked for the series on the other charts")]
    public async Task PickingAColour_IsTickedForTheSeriesOnTheOtherCharts()
    {
        await CreateMultiChartAsync();

        await PickColourOnSliceAsync(2024, "Affiliate", "Gold");

        await RightClickSliceAsync(2025, "Affiliate");
        await HoverColourMenuAsync();

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("Gold");
    }

    [TestMethod("Hovering a colour_previews the series in every chart and restores them")]
    public async Task HoveringAColour_PreviewsTheSeriesInEveryChartAndRestoresThem()
    {
        await CreateMultiChartAsync();

        var before = await ReadColoursAsync();

        await RightClickSliceAsync(2024, "Affiliate");
        await HoverColourMenuAsync();
        await MenuItem("Teal").HoverAsync();

        var previewed = await ReadColoursAsync();

        Expect(previewed["2024 Affiliate"]).ToBe(Teal);
        Expect(previewed["2025 Affiliate"]).ToBe(Teal);
        Expect(previewed["legend Affiliate"]).ToBe(Teal);
        Expect(previewed["2024 Direct"]).ToBe(before["2024 Direct"]);
        Expect(previewed["2025 Other"]).ToBe(before["2025 Other"]);
        Expect(previewed["legend Other"]).ToBe(before["legend Other"]);

        await Page.Mouse.MoveAsync(0, 0);

        Expect(await ReadColoursAsync()).ToEqual(before);
    }

    [TestMethod("Hovering a colour_stays on the clicked series after a redraw")]
    public async Task HoveringAColour_StaysOnTheClickedSeriesAfterARedraw()
    {
        await CreateMultiChartAsync();

        var before = await ReadColoursAsync();

        await RightClickSliceAsync(2024, "Affiliate");
        await HoverColourMenuAsync();
        await Page.Locator("#series-colour-variants").First.HoverAsync();

        // Right-clicking applies the variant and keeps the menu open over the redrawn charts.
        await MenuItem("Dark").ClickAsync(new() { Button = MouseButton.Right });
        await Ren.WaitUntilLoadedAsync();
        await Page.EvaluateAsync("() => new Promise(resolve => requestAnimationFrame(resolve))");

        await MenuItem("Teal").HoverAsync();

        var previewed = await ReadColoursAsync();

        Expect(previewed["2024 Affiliate"]).ToBe(Teal);
        Expect(previewed["2025 Affiliate"]).ToBe(Teal);
        Expect(previewed["2024 Direct"]).ToBe(before["2024 Direct"]);
        Expect(previewed["2025 Other"]).ToBe(before["2025 Other"]);

        await MenuItem("Gold").ClickAsync();

        var after = await ReadColoursAsync();

        Expect(after["2024 Affiliate"]).ToBe(Gold);
        Expect(after["2025 Affiliate"]).ToBe(Gold);
        Expect(after["legend Affiliate"]).ToBe(Gold);
        Expect(after["2024 Direct"]).ToBe(before["2024 Direct"]);
        Expect(after["2025 Other"]).ToBe(before["2025 Other"]);
    }

    [TestMethod("Colour_previewed then redrawn clears once the pointer leaves")]
    public async Task Colour_PreviewedThenRedrawnClearsOnceThePointerLeaves()
    {
        await CreateMultiChartAsync();

        await RightClickSliceAsync(2024, "Affiliate");
        await HoverColourMenuAsync();

        // Applied and so redrawn while still previewed.
        await MenuItem("Teal").HoverAsync();
        await Page.Locator("#series-colour-variants").First.HoverAsync();
        await MenuItem("Vibrant").ClickAsync(new() { Button = MouseButton.Right });
        await Ren.WaitUntilLoadedAsync();
        await Page.Mouse.MoveAsync(0, 0);

        var colours = await ReadColoursAsync();

        Expect(colours["2024 Affiliate"]).ToBe(AffiliateBlue);
        Expect(colours["2025 Affiliate"]).ToBe(AffiliateBlue);
        Expect(colours["legend Affiliate"]).ToBe(AffiliateBlue);
    }

    [TestMethod("Opened from settings_hovering previews only the clicked series")]
    public async Task OpenedFromSettings_HoveringPreviewsOnlyTheClickedSeries()
    {
        await OpenMultiChartFromSettingsAsync();

        var before = await ReadColoursAsync();

        await RightClickSliceAsync(2025, "Direct");
        await HoverColourMenuAsync();
        await MenuItem("Teal").HoverAsync();

        var previewed = await ReadColoursAsync();

        Expect(previewed["2024 Direct"]).ToBe(Teal);
        Expect(previewed["2025 Direct"]).ToBe(Teal);
        Expect(previewed["legend Direct"]).ToBe(Teal);
        Expect(previewed["2024 Affiliate"]).ToBe(before["2024 Affiliate"]);
        Expect(previewed["2025 Affiliate"]).ToBe(before["2025 Affiliate"]);
        Expect(previewed["2025 Other"]).ToBe(before["2025 Other"]);

        await Page.Mouse.MoveAsync(0, 0);

        Expect(await ReadColoursAsync()).ToEqual(before);
    }

    [TestMethod("Opened from settings_picking recolours only the clicked series")]
    public async Task OpenedFromSettings_PickingRecoloursOnlyTheClickedSeries()
    {
        await OpenMultiChartFromSettingsAsync();

        var before = await ReadColoursAsync();

        await PickColourOnSliceAsync(2025, "Direct", "Gold");

        var after = await ReadColoursAsync();

        Expect(after["2024 Direct"]).ToBe(Gold);
        Expect(after["2025 Direct"]).ToBe(Gold);
        Expect(after["legend Direct"]).ToBe(Gold);
        Expect(after["2024 Affiliate"]).ToBe(before["2024 Affiliate"]);
        Expect(after["2025 Other"]).ToBe(before["2025 Other"]);
    }

    [TestMethod("Subdivided_hovering a band previews its series and no other")]
    public async Task Subdivided_HoveringABandPreviewsItsSeriesAndNoOther()
    {
        await OpenSubdividedMultiChartAsync();

        var before = await ReadColoursAsync();

        await RightClickBandAsync(2025, "Affiliate", "Acme");
        await HoverColourMenuAsync();
        await MenuItem("Teal").HoverAsync();

        var previewed = await ReadColoursAsync();

        Expect(previewed["2024 Affiliate"]).ToBe(Teal);
        Expect(previewed["2025 Affiliate"]).ToBe(Teal);
        Expect(previewed["legend Affiliate"]).ToBe(Teal);
        Expect(previewed["2024 Direct"]).ToBe(before["2024 Direct"]);
        Expect(previewed["2025 Direct"]).ToBe(before["2025 Direct"]);
        Expect(previewed["2025 Other"]).ToBe(before["2025 Other"]);

        await Page.Mouse.MoveAsync(0, 0);

        Expect(await ReadColoursAsync()).ToEqual(before);
    }

    [TestMethod("Subdivided_picking a colour on a band recolours its series")]
    public async Task Subdivided_PickingAColourOnABandRecoloursItsSeries()
    {
        await OpenSubdividedMultiChartAsync();

        var before = await ReadColoursAsync();

        await RightClickBandAsync(2025, "Affiliate", "Zenith");
        await HoverColourMenuAsync();
        await MenuItem("Gold").ClickAsync();

        var after = await ReadColoursAsync();

        Expect(after["2024 Affiliate"]).ToBe(Gold);
        Expect(after["2025 Affiliate"]).ToBe(Gold);
        Expect(after["legend Affiliate"]).ToBe(Gold);
        Expect(after["2025 Direct"]).ToBe(before["2025 Direct"]);
        Expect(after["2025 Other"]).ToBe(before["2025 Other"]);
    }
}
