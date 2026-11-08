using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Copy data item, which puts the values it plots on the clipboard as
// tab-separated text, a row per period, for pasting into a spreadsheet.  The clipboard is caught
// rather than written to, so that what is put on it can be read back.
[TestClass]
public class DateValueChartCopyDataTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    // The exports round away the noise a sum of fractions leaves, keeping 12 significant figures.
    private static double Rounded(double value) =>
        double.Parse(value.ToString("G12", CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day", "Days Active");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task CatchClipboardAsync() => Page.EvaluateAsync("""
        () => {

            window.caughtClipboardText = null;

            navigator.clipboard.writeText = (text) => {

                window.caughtClipboardText = text;

                return Promise.resolve();
            };
        }
        """);

    private async Task<string[][]> CaughtLinesAsync()
    {
        await Poll(() => Page.EvaluateAsync<bool>("() => window.caughtClipboardText !== null")).ToBe(true);

        var text = await Page.EvaluateAsync<string>("() => window.caughtClipboardText");

        return text.Split("\r\n").Where(line => line.Length > 0).Select(line => line.Split('\t')).ToArray();
    }

    [TestMethod("puts a row per period on the clipboard, a column per series")]
    public async Task PutsARowPerPeriodOnTheClipboardAColumnPerSeries()
    {
        await CreateChartAsync();
        await CatchClipboardAsync();

        var dates = await Page.EvaluateAsync<string[]>("() => Ren.QA.DateValueChart.getDates().map(String)");
        var first = await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

        await DateValueChart.ClickMenuPathAsync(Ren, "Copy data");

        var lines = await CaughtLinesAsync();

        Expect(lines[0].Length).ToBe(3);
        Expect(lines[0][0]).ToBe("CreatedOn");
        Expect(lines.Length).ToBe(dates.Length + 1);
        Expect(lines.Skip(1).All(line => line.Length == 3)).ToBe(true);
        Expect(lines.Skip(1).Select(line => line[1] == "" ? (double?)null : double.Parse(line[1], NumberStyles.Float, CultureInfo.InvariantCulture)).ToArray())
            .ToEqual(first.Select(value => value is { } number ? Rounded(number) : (double?)null).ToArray());
    }

    [TestMethod("copies every period and series from a chart of a multi-chart")]
    public async Task CopiesEveryPeriodAndSeriesFromAChartOfAMultiChart()
    {
        // 2024 has Amazon and Direct, and 2025 has Amazon, Other and Direct.
        await Ren.OpenAsync("multi-chart-colours/channel-sales.html");
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SplitDataAsync(Ren, "Channel");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-year-start");
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Pies");
        await DateValueChart.ClickMenuPathAsync(Ren, "Multi-chart", "By year");
        await Ren.WaitUntilLoadedAsync();

        await CatchClipboardAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Copy data");

        var lines = await CaughtLinesAsync();
        var otherColumn = Array.IndexOf(lines[0], "Other");

        Expect(Text.Sorted(lines[0])).ToEqual(Text.Sorted(new[] { "Amazon", "Direct", "Other", "OrderDate" }));
        Expect(lines.Length).ToBe(3);
        Expect(lines[1][0][..4]).ToBe("2024");
        Expect(lines[1][otherColumn]).ToBe("");
        Expect(lines[2][0][..4]).ToBe("2025");
        Expect(lines[2][otherColumn]).Not.ToBe("");
    }

    [TestMethod("leaves out a hidden series")]
    public async Task LeavesOutAHiddenSeries()
    {
        await CreateChartAsync();
        await CatchClipboardAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, "Hide all other data series");
        await Ren.WaitUntilLoadedAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Copy data");

        var lines = await CaughtLinesAsync();

        Expect(lines[0].Length).ToBe(2);
    }

    [TestMethod("offers no Copy data where the browser can't copy text")]
    public async Task OffersNoCopyDataWhereTheBrowserCantCopyText()
    {
        await Page.AddInitScriptAsync("""
            Object.defineProperty(navigator, "clipboard", { value: undefined });
            """);

        await CreateChartAsync();
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

        await Expect(Ren.Root.Locator("#chart-download-data")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-copy-data")).ToHaveCountAsync(0);
    }
}
