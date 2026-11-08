using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Download data item, which saves the data the chart plots as a CSV
// file: a row per period, a column for its date then one for each series shown.  Downloads don't
// happen in headless Chrome, so the file's blob and name are caught as the link to it is clicked.
[TestClass]
public class DateValueChartDataExportTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private sealed record Csv(string Name, string Type, int[] FirstBytes, string Text)
    {
        public string[] Lines => Text.Split("\r\n").Where(line => line != "").ToArray();
    }

    // The exports round away the noise a sum of fractions leaves, keeping 12 significant figures.
    private static double Rounded(double value) =>
        double.Parse(value.ToString("G12", CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);

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

    private Task<double?[]> PlottedValuesAsync(int seriesIndex) => Page.EvaluateAsync<double?[]>(
        "index => Ren.QA.DateValueChart.getPlottedValues(index)", seriesIndex);

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

    private async Task<Csv> DownloadDataAsync()
    {
        await CatchDownloadsAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Download data", "CSV");
        await Poll(() => Page.EvaluateAsync<bool>("() => window.caughtDownloads.length > 0")).ToBe(true);

        return await EvaluateAsync<Csv>("""
            async () => {

                const download = window.caughtDownloads[0];
                const bytes = new Uint8Array(await download.blob.arrayBuffer());

                return {
                    name: download.name,
                    type: download.blob.type,
                    firstBytes: [bytes[0], bytes[1], bytes[2]],
                    text: await download.blob.text()
                };
            }
            """);
    }

    private static double?[] Column(string[] lines, int index) => lines.Skip(1)
        .Select(line => line.Split(',')[index])
        .Select(text => text == "" ? (double?)null : double.Parse(text, NumberStyles.Float, CultureInfo.InvariantCulture))
        .ToArray();

    private static double?[] RoundedAll(double?[] values) =>
        values.Select(value => value is { } number ? Rounded(number) : (double?)null).ToArray();

    [TestMethod("downloads the plotted data as a CSV")]
    public async Task DownloadsThePlottedDataAsACsv()
    {
        await CreateChartAsync();

        var csv = await DownloadDataAsync();
        var first = await PlottedValuesAsync(0);
        var lines = csv.Lines;

        Expect(csv.Name).ToBe($"{await LegendNameAsync(1)}, {await LegendNameAsync(2)}.csv");
        Expect(csv.Type).ToContain("text/csv");

        // The UTF-8 byte order mark, which reading the blob as text drops.
        Expect(csv.FirstBytes).ToEqual(new[] { 0xEF, 0xBB, 0xBF });
        Expect(lines[0].Split(',').Skip(1).ToArray())
            .ToEqual(new[] { await LegendNameAsync(1), await LegendNameAsync(2) });
        Expect(lines.Length).ToBe(first.Length + 1);
        Expect(Column(lines, 1)).ToEqual(RoundedAll(first));
    }

    [TestMethod("saves running totals as they are plotted")]
    public async Task SavesRunningTotalsAsTheyArePlotted()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Running total");
        await Ren.WaitUntilLoadedAsync();

        var csv = await DownloadDataAsync();
        var totals = await PlottedValuesAsync(0);

        Expect(Column(csv.Lines, 1)).ToEqual(RoundedAll(totals));
    }

    [TestMethod("rounds a value to the places its format shows")]
    public async Task RoundsAValueToThePlacesItsFormatShows()
    {
        await Ren.OpenAsync(Fixture);

        var rounded = await Page.EvaluateAsync<string>("""
            () => {

                const formats = Ren.SpreadsheetColumnFormatEnum;
                const round = Ren.DateValueChart_DataExport.roundValue;

                return JSON.stringify([
                    round(1891731.4198996203, formats.Currency),
                    round(12.5000000001, formats.Integer),
                    round(0.123456789, formats.Percentage),
                    round(0.1 + 0.2, undefined),
                    round("n/a", formats.Currency)
                ]);
            }
            """);

        Expect(rounded).ToBe("""[1891731.42,13,0.1235,0.3,"n/a"]""");
    }

    [TestMethod("writes a sum's stray decimals rounded, in the CSV and copied text")]
    public async Task WritesASumsStrayDecimalsRoundedInTheCsvAndCopiedText()
    {
        await Ren.OpenAsync(Fixture);

        var texts = await Page.EvaluateAsync<string[]>("""
            () => {

                const props = {
                    seriesCount: 2,
                    series: [{}, {}],
                    dateHeading: "Date",
                    valueHeadings: ["Revenue", "Ratio"],
                    valueColumnFormats: [Ren.SpreadsheetColumnFormatEnum.Currency, undefined]
                };
                const rows = [{ Date: new Date(2024, 0, 1), Revenue: 1891731.4198996203, Ratio: 0.1 + 0.2 }];

                return [
                    Ren.DateValueChart_DataExport.buildCsv(props, rows),
                    Ren.DateValueChart_DataExport.buildTsv(props, rows)
                ];
            }
            """);

        Expect(texts[0].Split("\r\n")[1]).ToBe("2024-01-01,1891731.42,0.3");
        Expect(texts[1].Split("\r\n")[1]).ToBe("2024-01-01\t1891731.42\t0.3");
    }
}
