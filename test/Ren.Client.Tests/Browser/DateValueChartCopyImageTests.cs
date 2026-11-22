using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Copy image item, which puts the chart on the clipboard as a PNG,
// with its legend drawn beneath it, for pasting elsewhere.  The clipboard is caught rather than
// written to, so that what is put on it can be read back whatever the machine running the tests
// allows.
[TestClass]
public class DateValueChartCopyImageTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string ImageArea = ".ren-date-value-chart-image-area";
    private const string ChartSvg = "svg:has(.ren-data-series)";

    private sealed record CaughtImage(int ItemCount, string[] Types, int[] Signature, int Width, int Height);

    private sealed record PageBox(double Left, double Top, double Width, double Height);

    private sealed record SeriesPixels(double Count, double Left, double Right);

    private sealed record Span(double Left, double Right);

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task CatchClipboardAsync() => Page.EvaluateAsync("""
        () => {

            window.caughtClipboardItems = null;

            navigator.clipboard.write = (items) => {

                window.caughtClipboardItems = items;

                return Promise.resolve();
            };
        }
        """);

    private Task ExpectClipboardCaughtAsync() =>
        Poll(() => Page.EvaluateAsync<bool>("() => !!window.caughtClipboardItems")).ToBe(true);

    private Task<CaughtImage> CaughtImageAsync() => EvaluateAsync<CaughtImage>("""
        async () => {

            const items = window.caughtClipboardItems;
            const blob = await items[0].getType("image/png");
            const bitmap = await createImageBitmap(blob);
            const bytes = new Uint8Array(await blob.arrayBuffer());

            return {
                itemCount: items.length,
                types: items[0].types,
                signature: Array.from(bytes.slice(1, 4)),
                width: bitmap.width,
                height: bitmap.height
            };
        }
        """);

    // A real pointer move, as the shading follows the pointer entering and leaving an item.
    private Task HoverItemAsync(string selector) => Ren.Root.Locator(selector).HoverAsync();

    // Gets the copied image's most common strong colour, which is the series', with how many
    // pixels it takes and how far across the image they reach, in the chart's own pixels.
    private Task<SeriesPixels> CaughtSeriesPixelsAsync() => EvaluateAsync<SeriesPixels>("""
        async () => {

            const blob = await window.caughtClipboardItems[0].getType("image/png");
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");

            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const context = canvas.getContext("2d");

            context.drawImage(bitmap, 0, 0);

            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const counts = {};

            for (let i = 0; i < data.length; i += 4) {

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Greys are the background, the axes and the text.
                if (Math.max(r, g, b) - Math.min(r, g, b) < 40) continue;

                const key = `${r},${g},${b}`;

                counts[key] = (counts[key] || 0) + 1;
            }

            const colour = Object.keys(counts).reduce((best, key) =>
                (!best || counts[key] > counts[best] ? key : best), null);

            let left = Infinity;
            let right = -Infinity;

            for (let i = 0; i < data.length; i += 4) {

                if (`${data[i]},${data[i + 1]},${data[i + 2]}` !== colour) continue;

                const x = (i / 4) % canvas.width;

                left = Math.min(left, x);
                right = Math.max(right, x);
            }

            // The image is drawn at twice the chart's size.
            return { count: counts[colour] / 4, left: left / 2, right: right / 2 };
        }
        """);

    private async Task CopyImageAsync()
    {
        await CatchClipboardAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Copy image");
        await ExpectClipboardCaughtAsync();
    }

    [TestMethod("puts the chart on the clipboard as a PNG")]
    public async Task PutsTheChartOnTheClipboardAsAPng()
    {
        await CreateChartAsync();
        await CopyImageAsync();

        var image = await CaughtImageAsync();

        Expect(image.ItemCount).ToBe(1);
        Expect(image.Types).ToEqual(new[] { "image/png" });

        // "PNG", after the signature's first byte.
        Expect(image.Signature).ToEqual(new[] { 0x50, 0x4E, 0x47 });

        // A picture of the chart, not an empty one.
        Expect(image.Width).ToBeGreaterThan(200);
        Expect(image.Height).ToBeGreaterThan(100);
    }

    [TestMethod("offers no Copy image where the browser can't copy images")]
    public async Task OffersNoCopyImageWhereTheBrowserCantCopyImages()
    {
        await Page.AddInitScriptAsync("delete window.ClipboardItem;");

        await CreateChartAsync();
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        await Expect(Ren.Root.Locator("#chart-download-image")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-copy-image")).ToHaveCountAsync(0);
    }

    [TestMethod("shades the chart without moving it while Copy image is hovered")]
    public async Task ShadesTheChartWithoutMovingItWhileCopyImageIsHovered()
    {
        await CreateChartAsync();
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        var svg = Ren.Root.Locator(ChartSvg).First;

        // Relative to the page, as hovering an item can scroll it into view.
        Task<PageBox> PageBoxAsync() => svg.EvaluateAsAsync<PageBox>("""
            element => {

                const box = element.getBoundingClientRect();

                return {
                    left: box.left + window.scrollX,
                    top: box.top + window.scrollY,
                    width: box.width,
                    height: box.height
                };
            }
            """);

        var boxBefore = await PageBoxAsync();

        await HoverItemAsync("#chart-copy-image");

        await Expect(svg).ToHaveClassAsync(new Regex("ren-date-value-chart-image-area"));
        await Expect(svg).Not.ToHaveCSSAsync("background-color", "rgba(0, 0, 0, 0)");
        Expect(await PageBoxAsync()).ToEqual(boxBefore);

        await HoverItemAsync("#chart-download-data");

        await Expect(Ren.Root.Locator(ImageArea)).ToHaveCountAsync(0);
    }

    [TestMethod("keeps the shading from Download image into its formats")]
    public async Task KeepsTheShadingFromDownloadImageIntoItsFormats()
    {
        await CreateChartAsync();
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        await HoverItemAsync("#chart-download-image");
        await Expect(Ren.Root.Locator(ChartSvg + ImageArea)).ToHaveCountAsync(1);

        await HoverItemAsync("#chart-download-image-png");
        await Expect(Ren.Root.Locator(ChartSvg + ImageArea)).ToHaveCountAsync(1);

        await HoverItemAsync("#chart-copy-data");
        await Expect(Ren.Root.Locator(ImageArea)).ToHaveCountAsync(0);
    }

    [TestMethod("removes the shading once Copy image is clicked")]
    public async Task RemovesTheShadingOnceCopyImageIsClicked()
    {
        await CreateChartAsync();
        await CatchClipboardAsync();
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        await HoverItemAsync("#chart-copy-image");
        await Expect(Ren.Root.Locator(ChartSvg + ImageArea)).ToHaveCountAsync(1);

        await Ren.Root.ClickAsync("#chart-copy-image");

        await Expect(Ren.Root.Locator(ImageArea)).ToHaveCountAsync(0);
        await ExpectClipboardCaughtAsync();
    }

    // The chart is drawn in plot coordinates and scaled to its size by its stylesheet, so a copy
    // without the scale had a bar fill the image.
    [TestMethod("draws the bars where they are on the page")]
    public async Task DrawsTheBarsWhereTheyAreOnThePage()
    {
        await CreateChartAsync();
        await CopyImageAsync();

        var bars = await Ren.Root.Locator(ChartSvg).First.EvaluateAsAsync<Span>("""
            svg => {

                const svgBox = svg.getBoundingClientRect();
                const boxes = Array.from(svg.querySelectorAll(".ren-data-series__bar"))
                    .map(bar => bar.getBoundingClientRect())
                    .filter(box => box.width > 0);

                return {
                    left: Math.min(...boxes.map(box => box.left)) - svgBox.left,
                    right: Math.max(...boxes.map(box => box.right)) - svgBox.left
                };
            }
            """);
        var pixels = await CaughtSeriesPixelsAsync();

        Expect(Math.Abs(pixels.Left - bars.Left)).ToBeLessThan(3);
        Expect(Math.Abs(pixels.Right - bars.Right)).ToBeLessThan(3);
    }

    // A slice is drawn with a radius of 1 and scaled up to the pie's size by the stylesheet.
    [TestMethod("draws pies at their size on the page")]
    public async Task DrawsPiesAtTheirSizeOnThePage()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await Ren.WaitUntilLoadedAsync();
        await CopyImageAsync();

        var slices = await Ren.Root.Locator(ChartSvg).First.EvaluateAsync<double>("""
            svg => Array.from(svg.querySelectorAll("path"))
                .filter(path => /slice/.test(path.getAttribute("class") || ""))
                .reduce((area, path) => {

                    const box = path.getBoundingClientRect();

                    return area + box.width * box.height;
                }, 0)
            """);
        var pixels = await CaughtSeriesPixelsAsync();

        Expect(slices).ToBeGreaterThan(0);
        Expect(pixels.Count).ToBeGreaterThan(slices * 0.3);
    }
}
