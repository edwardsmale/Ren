using System.Text.Json.Nodes;

namespace Ren.Client.Tests.Browser;

// These tests cover the labels beside the pies of a multi-chart, one narrow chart for each year,
// with a legend, a title and a subtitle above them.  In the fixture, Acme's share grows from 17%
// to 29%, which brings its label and Other brands' level with their pie, where there's least room.
[TestClass]
public class DateValueChartPieLabelsTests : BrowserTest
{
    private const string Fixture = "pie-labels/brand-sales.html";

    // Opens four charts across a popup, as a report does, their slices subdivided by brand and
    // labelled with their values.
    private async Task OpenFourChartsAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SplitDataAsync(Ren, "Partner");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-year-start");
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Pies");
        await Ren.WaitUntilLoadedAsync();

        var settings = (await SavedSettingsTextAsync())
            .Replace(
                "\"showAsPies\":true",
                "\"showAsPies\":true,\"pieHoleRadius\":0.45,\"subdivideColumn\":\"Brand\","
                    + "\"subdivisionLabels\":\"names\",\"pieLabelValues\":true,\"pieSharesInside\":false,"
                    + "\"pieValuePosition\":\"below\",\"multiChartPeriod\":\"year\","
                    + "\"multiChartKeepEmptyPeriods\":true,\"multiChartMaxCount\":4,\"multiChartSlider\":true,"
                    + "\"fillAvailableSpace\":true,\"showLegend\":true,\"legendSize\":\"small\","
                    + "\"showDateAxis\":false,\"chartTitle\":\"{value} by {split}\",\"chartSubtitle\":\"{filters}\"")
            .Replace("\"popupHeight\":240", "\"popupWidth\":1178,\"popupHeight\":503")
            .Replace("\"visualisationWidth\":608", "\"visualisationWidth\":1178")
            .Replace("\"visualisationHeight\":224", "\"visualisationHeight\":487");

        await Ren.OpenWithSettingsAsync(Fixture, JsonNode.Parse(settings));
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod]
    public async Task MultiChart_NarrowCharts_EverySeriesLabelShown()
    {
        await OpenFourChartsAsync();

        var labels = await EvaluateAsync<string[]>("""
            () => Array.from(document.querySelectorAll(".ren-pie-labels-layer > g > g"))
                .filter(group => !group.querySelector(".ren-pie-label--subdivision"))
                .map(group => (group.style.display === "none" ? "hidden: " : "")
                    + group.querySelector("text").firstElementChild.textContent)
            """);

        CollectionAssert.AreEquivalent(
            new[] { "Acme", "Other brands", "Acme", "Other brands", "Acme", "Other brands", "Acme", "Other brands" },
            labels);
    }

    [TestMethod]
    public async Task MultiChart_NarrowCharts_PiesTheSameSize()
    {
        await OpenFourChartsAsync();

        var widths = await EvaluateAsync<double[]>("""
            () => Array.from(document.querySelectorAll("svg"))
                .map(svg => Array.from(svg.querySelectorAll(".ren-data-series__pie-slice"))
                    .map(slice => slice.getBoundingClientRect()))
                .filter(boxes => boxes.length)
                .map(boxes => Math.round(Math.max(...boxes.map(box => box.right))
                    - Math.min(...boxes.map(box => box.left))))
            """);

        Assert.AreEqual(4, widths.Length);
        Assert.AreEqual(1, widths.Distinct().Count(), string.Join(", ", widths));
    }
}
