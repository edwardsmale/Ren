using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's title, set from its Title... menu item.  The title is shown above the
// chart, taking its room from the plot, names the chart for a screen reader, and heads its image
// and names the image's file.  A blank title takes it away.
[TestClass]
public class DateValueChartTitleTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string ChartSvg = "svg:has(.ren-x-axis)";
    private const string Title = ".ren-chart-title";
    private const string TitleText = ".ren-chart-title__text";
    private const string Pickers = ".ren-date-value-chart-column-pickers";

    private sealed record Download(string Name, string Text);

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task SetTitleAsync(string text)
    {
        await DateValueChart.ClickMenuPathAsync(Ren, "Title...");

        var editor = Page.Locator("textarea").Last;

        await Expect(editor).ToBeVisibleAsync();
        await editor.FillAsync(text);
        await Page.GetByRole(AriaRole.Button, new() { Name = "OK", Exact = true }).Last.ClickAsync();
    }

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

    private async Task<Download> CaughtDownloadAsync()
    {
        await Poll(() => Page.EvaluateAsync<bool>("() => window.caughtDownloads.length > 0")).ToBe(true);

        return await EvaluateAsync<Download>("""
            async () => {

                const download = window.caughtDownloads[0];

                return { name: download.name, text: await download.blob.text() };
            }
            """);
    }

    private async Task<LocatorBoundingBoxResult> BoxAsync(string selector) =>
        (await Ren.Root.Locator(selector).First.BoundingBoxAsync())!;

    [TestMethod("shows no title by default")]
    public async Task ShowsNoTitleByDefault()
    {
        await CreateChartAsync();

        await Expect(Ren.Root.Locator(Title)).ToHaveCountAsync(0);
    }

    [TestMethod("shows the title set above the chart, taking its room from the plot")]
    public async Task ShowsTheTitleSetAboveTheChartTakingItsRoomFromThePlot()
    {
        await CreateChartAsync();

        var before = await BoxAsync(ChartSvg);

        await SetTitleAsync("  Searches by day  ");

        var title = Ren.Root.Locator(Title);

        await Expect(title).ToHaveTextAsync("Searches by day");
        await Expect(title).ToHaveAttributeAsync("role", "heading");

        var titleBox = await BoxAsync(Title);
        var after = await BoxAsync(ChartSvg);

        Expect(titleBox.Y + titleBox.Height).ToBeLessThanOrEqual(after.Y + 1);
        Expect(after.Height).ToBeLessThan(before.Height);

        // The plot is rescaled to the room left, so its date axis stays within the chart.
        var dateAxis = await BoxAsync(".ren-date-axis .domain");

        Expect(dateAxis.Y).ToBeGreaterThan(after.Y);
        Expect(dateAxis.Y + dateAxis.Height).ToBeLessThanOrEqual(after.Y + after.Height);
    }

    [TestMethod("names the chart for a screen reader by its title")]
    public async Task NamesTheChartForAScreenReaderByItsTitle()
    {
        await CreateChartAsync();
        await SetTitleAsync("Searches by day");

        await Expect(Ren.Root.Locator(ChartSvg)).ToHaveAttributeAsync("aria-label", new Regex("^Searches by day: "));
    }

    [TestMethod("takes the title away when it is cleared")]
    public async Task TakesTheTitleAwayWhenItIsCleared()
    {
        await CreateChartAsync();
        await SetTitleAsync("Searches by day");
        await SetTitleAsync("   ");

        await Expect(Ren.Root.Locator(Title)).ToHaveCountAsync(0);
    }

    [TestMethod("keeps the title through a redraw")]
    public async Task KeepsTheTitleThroughARedraw()
    {
        await CreateChartAsync();
        await SetTitleAsync("Searches by day");

        await DateValueChart.ClickMenuPathAsync(Ren, "Show legend");

        await Expect(Ren.Root.Locator(Title)).ToHaveTextAsync("Searches by day");
    }

    [TestMethod]
    [DataRow("Daily", 1, DisplayName = "shows the pickers beneath a short title, which they don't move")]
    [DataRow("Searches by day ", 100, DisplayName = "shows the pickers beneath a long title, which they don't move")]
    public async Task ShowsThePickersBeneathATitleWhichTheyDontMove(string titlePart, int repeats)
    {
        await CreateChartAsync();
        await DateValueChart.SplitDataAsync(Ren, "Search Terms");
        await SetTitleAsync(string.Concat(Enumerable.Repeat(titlePart, repeats)));

        var pickers = Ren.Root.Locator(Pickers);

        await Page.Mouse.MoveAsync(0, 0);
        await Expect(pickers).ToHaveCSSAsync("opacity", "0");

        var before = await BoxAsync(TitleText);
        var chartBefore = await BoxAsync(ChartSvg);

        await Ren.Root.Locator(ChartSvg).HoverAsync();
        await Expect(pickers).ToHaveCSSAsync("opacity", "1");

        var pickersBox = await BoxAsync(Pickers);
        var titleBox = await BoxAsync(Title);

        Expect(pickersBox.Y).ToBeGreaterThanOrEqual(before.Y + before.Height);
        Expect(pickersBox.Y + pickersBox.Height).ToBeLessThanOrEqual(titleBox.Y + titleBox.Height);

        // Long enough for any move to have finished.
        await Page.WaitForTimeoutAsync(300);

        Expect(await BoxAsync(TitleText)).ToEqual(before);
        Expect(await BoxAsync(ChartSvg)).ToEqual(chartBefore);
    }

    [TestMethod("heads the chart's image with its title, and names the file by it")]
    public async Task HeadsTheChartsImageWithItsTitleAndNamesTheFileByIt()
    {
        await CreateChartAsync();
        await SetTitleAsync("Searches by day");
        await CatchDownloadsAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Download image", "SVG");

        var download = await CaughtDownloadAsync();

        Expect(download.Name).ToBe("Searches by day.svg");
        Expect(download.Text).ToMatch(new Regex("class=\"ren-image-title\"[^>]*>Searches by day</text>"));
    }
}
