using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Download data > Excel item, which saves the data the chart plots as
// an Excel sheet with the page's Excel writer, the one the data grids save with.  The writer is
// stood in for once the page has loaded it, so that the sheet it is given can be read back.
public abstract class DateValueChartExcelExportTestBase : BrowserTest
{
    protected sealed record Workbook(string[] Columns, string[] Types, double?[][] Rows, string FileName, string Sheet);

    protected Task StandInForWriterAsync() => Page.EvaluateAsync("""
        () => {

            window.caughtSheet = null;

            window.writeXlsxFile = (objects, options) => {

                window.caughtSheet = {
                    columns: options.schema.map(column => column.column),
                    types: options.schema.map(column => column.type.name),
                    rows: objects.map(object => options.schema.map(column => {

                        const value = column.value(object);

                        return value instanceof Date ? value.getTime() : value;
                    })),
                    fileName: options.fileName,
                    sheet: options.sheet
                };
            };
        }
        """);

    protected async Task<Workbook> CaughtSheetAsync()
    {
        await Poll(() => Page.EvaluateAsync<bool>("() => window.caughtSheet !== null")).ToBe(true);

        return await EvaluateAsync<Workbook>("() => window.caughtSheet");
    }
}

[TestClass]
public class DateValueChartExcelExportTests : DateValueChartExcelExportTestBase
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
        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
    }

    [TestMethod("writes a row per period, a column for the date then one per series")]
    public async Task WritesARowPerPeriodAColumnForTheDateThenOnePerSeries()
    {
        await CreateChartAsync();
        await StandInForWriterAsync();

        var dateCount = await Page.EvaluateAsync<int>("() => Ren.QA.DateValueChart.getDates().length");
        var first = await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

        await DateValueChart.ClickMenuPathAsync(Ren, "Download data", "Excel");

        var sheet = await CaughtSheetAsync();

        Expect(sheet.Columns.Length).ToBe(3);
        Expect(sheet.Columns[0]).ToBe("CreatedOn");
        Expect(sheet.Types).ToEqual(new[] { "Date", "Number", "Number" });
        Expect(sheet.Rows.Length).ToBe(dateCount);
        Expect(sheet.Rows.All(row => row[0].HasValue)).ToBe(true);
        Expect(sheet.Rows.Select(row => row[1]).ToArray())
            .ToEqual(first.Select(value => value is { } number ? Rounded(number) : (double?)null).ToArray());
        Expect(sheet.FileName).ToMatch(new Regex(@"\.xlsx$"));
        Expect(sheet.Sheet.Length).ToBeLessThanOrEqual(31);
    }

    [TestMethod("leaves out a hidden series")]
    public async Task LeavesOutAHiddenSeries()
    {
        await CreateChartAsync();
        await StandInForWriterAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, "Hide all other data series");
        await Ren.WaitUntilLoadedAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Download data", "Excel");

        Expect((await CaughtSheetAsync()).Columns.Length).ToBe(2);
    }

    [TestMethod("offers no Excel where the page has no Excel writer")]
    public async Task OffersNoExcelWhereThePageHasNoExcelWriter()
    {
        await CreateChartAsync();
        await Page.EvaluateAsync("() => delete window.writeXlsxFile");
        await DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");
        await Ren.Root.MouseOverAsync("#chart-download-data");

        await Expect(Ren.Root.Locator("#chart-download-data-csv")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-download-data-xlsx")).ToHaveCountAsync(0);
    }
}

// The Excel writer reads a date in UTC, so a quarter starting at midnight in summer time was
// written as the day before, such as 31 March for April's quarter.
[TestClass]
public class DateValueChartExcelExportSummerTimeTests : DateValueChartExcelExportTestBase
{
    protected override BrowserNewContextOptions ContextOptions => new() { TimezoneId = "Europe/London" };

    [TestMethod("in a time zone with summer time, writes each quarter's first day")]
    public async Task InATimeZoneWithSummerTime_WritesEachQuartersFirstDay()
    {
        await Ren.OpenAsync("previous-year/monthly-sales.html");
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-quarter-start");
        await StandInForWriterAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Download data", "Excel");

        var days = (await CaughtSheetAsync()).Rows.Select(row =>
        {
            var date = DateTimeOffset.FromUnixTimeMilliseconds((long)row[0]!.Value).UtcDateTime;

            return $"{date.Day}/{date.Month} {date.Hour}:00";
        }).ToArray();

        Expect(days.Length).ToBeGreaterThan(4);
        Expect(Text.Sorted(days.Distinct())).ToEqual(Text.Sorted(new[] { "1/1 0:00", "1/4 0:00", "1/7 0:00", "1/10 0:00" }));
    }
}
