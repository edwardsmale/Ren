using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Download image submenu, which saves the chart as an SVG or a PNG
// file with its legend drawn beneath it.  Downloads don't happen in headless Chrome, so the
// file's blob and name are caught as the link to it is clicked.
[TestClass]
public class DateValueChartImageExportTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private sealed record Download(string Name, string Type, long Size, string? Text);

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day", "Days Active");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
    }

    private async Task<string> LegendNameAsync(int seriesNumber) => (await Ren.Root
        .Locator($".ren-legend-item.ren-series-{seriesNumber} .ren-legend-entry")
        .TextContentAsync())!.Trim();

    private async Task<string> ExpectedFileNameAsync(string extension) =>
        $"{await LegendNameAsync(1)}, {await LegendNameAsync(2)}.{extension}";

    private Task CatchDownloadsAsync() => Page.EvaluateAsync("""
        () => {

            window.caughtDownloads = [];

            const blobsByUrl = {};
            const createObjectURL = URL.createObjectURL;

            URL.createObjectURL = (blob) => {

                const url = createObjectURL(blob);

                blobsByUrl[url] = blob;

                return url;
            };

            HTMLAnchorElement.prototype.click = function () {

                window.caughtDownloads.push({ name: this.download, blob: blobsByUrl[this.href] });
            };
        }
        """);

    // Waits for the download to be caught, then reads it.
    private async Task<Download> CaughtDownloadAsync()
    {
        await Poll(() => Page.EvaluateAsync<bool>("() => window.caughtDownloads.length > 0")).ToBe(true);

        return await EvaluateAsync<Download>("""
            async () => {

                const download = window.caughtDownloads[0];

                return {
                    name: download.name,
                    type: download.blob.type,
                    size: download.blob.size,
                    text: download.blob.type.indexOf("svg") !== -1 ? await download.blob.text() : null
                };
            }
            """);
    }

    [TestMethod("downloads the chart as an SVG with its legend")]
    public async Task DownloadsTheChartAsAnSvgWithItsLegend()
    {
        await CreateChartAsync();
        await CatchDownloadsAsync();

        var fileName = await ExpectedFileNameAsync("svg");
        var secondName = await LegendNameAsync(2);

        await DateValueChart.ClickMenuPathAsync(Ren, "Download image", "SVG");

        var download = await CaughtDownloadAsync();

        Expect(download.Name).ToBe(fileName);
        Expect(download.Type).ToContain("image/svg+xml");
        Expect(download.Text).ToContain("ren-image-background");
        Expect(download.Text).ToContain($">{secondName}</text>");

        // The bars' styles are written onto them, as the file has no stylesheet.
        Expect(download.Text).ToMatch(new Regex("""class="[^"]*ren-bar[^"]*"[^>]*style="[^"]*fill:"""));
    }

    [TestMethod("leaves a hidden series out of the image's legend")]
    public async Task LeavesAHiddenSeriesOutOfTheImagesLegend()
    {
        await CreateChartAsync();

        var secondName = await LegendNameAsync(2);

        // Hiding the other series than the first hides the second.
        await DateValueChart.OpenMenuAsync(Ren, ".ren-bar.ren-vertical[data-series='1']");
        await Ren.Root.ClickAsync("#hide-other-series");
        await Ren.WaitUntilLoadedAsync();
        await Expect(Ren.Root.Locator(".ren-legend-item[data-series='2']"))
            .ToHaveAttributeAsync("data-series-enabled", "false");
        await CatchDownloadsAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Download image", "SVG");

        var text = (await CaughtDownloadAsync()).Text;

        Expect(text).ToContain($">{await LegendNameAsync(1)}</text>");
        Expect(text).Not.ToContain($">{secondName}</text>");
    }

    [TestMethod("downloads the chart as a PNG")]
    public async Task DownloadsTheChartAsAPng()
    {
        await CreateChartAsync();
        await CatchDownloadsAsync();

        var fileName = await ExpectedFileNameAsync("png");

        await DateValueChart.ClickMenuPathAsync(Ren, "Download image", "PNG");

        var download = await CaughtDownloadAsync();

        Expect(download.Name).ToBe(fileName);
        Expect(download.Type).ToBe("image/png");
        Expect(download.Size).ToBeGreaterThan(1000);
    }

    [TestMethod("leaves a zoomed chart's buttons out of the image")]
    public async Task LeavesAZoomedChartsButtonsOutOfTheImage()
    {
        await CreateChartAsync();
        await DateValueChart.DragFromBarAsync(Ren, 2);
        await Expect(Ren.Root.Locator(".ren-date-range-reset")).ToHaveCountAsync(1);

        await CatchDownloadsAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Download image", "SVG");

        var text = (await CaughtDownloadAsync()).Text;

        Expect(text).ToContain("ren-bar");
        Expect(text).Not.ToContain("ren-date-range-reset");
    }
}
