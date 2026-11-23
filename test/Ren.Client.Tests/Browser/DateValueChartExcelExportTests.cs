using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Download data > Excel item, which saves the data the chart plots as
// an Excel sheet with Ren.XlsxWriter, the writer the data grids save with.  The file is caught as
// it's saved, and read back (see Xlsx).
public abstract class DateValueChartExcelExportTestBase : BrowserTest
{
    protected async Task<Xlsx.Workbook> DownloadExcelAsync()
    {
        await Xlsx.CatchDownloadsAsync(Page);
        await DateValueChart.ClickMenuPathAsync(Ren, "Download data", "Excel");

        return await Xlsx.CaughtWorkbookAsync(Page);
    }

    // A column's values below its heading, null for an empty cell.
    protected static double?[] Column(Xlsx.Sheet sheet, string letters) => sheet.Rows
        .Skip(1)
        .Select(row => row.TryGetValue(letters, out var cell) ? cell.Number : (double?)null)
        .ToArray();
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

        var dateCount = await Page.EvaluateAsync<int>("() => Ren.QA.DateValueChart.getDates().length");
        var first = await Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

        var workbook = await DownloadExcelAsync();
        var sheet = workbook.Sheets.Single();

        Expect(sheet.Headings.Length).ToBe(3);
        Expect(sheet.Headings[0]).ToBe("CreatedOn");
        Expect(sheet.Rows.Length - 1).ToBe(dateCount);
        Expect(Column(sheet, "A").All(date => date.HasValue)).ToBe(true);
        Expect(sheet["A2"]!.NumberFormat).ToMatch("y");
        Expect(Column(sheet, "B"))
            .ToEqual(first.Select(value => value is { } number ? Rounded(number) : (double?)null).ToArray());
        Expect(workbook.FileName).ToMatch(new Regex(@"\.xlsx$"));
        Expect(sheet.Name.Length).ToBeLessThanOrEqual(31);
    }

    [TestMethod("leaves out a hidden series")]
    public async Task LeavesOutAHiddenSeries()
    {
        await CreateChartAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 1, "Hide all other data series");
        await Ren.WaitUntilLoadedAsync();

        Expect((await DownloadExcelAsync()).Sheets.Single().Headings.Length).ToBe(2);
    }
}

// Ren.XlsxWriter reads a date in UTC, so a quarter starting at midnight in summer time was
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

        var sheet = (await DownloadExcelAsync()).Sheets.Single();

        var days = sheet.Rows.Skip(1).Select(row =>
        {
            var date = row["A"].Date;

            return $"{date.Day}/{date.Month} {date.Hour}:00";
        }).ToArray();

        Expect(days.Length).ToBeGreaterThan(4);
        Expect(Text.Sorted(days.Distinct())).ToEqual(Text.Sorted(new[] { "1/1 0:00", "1/4 0:00", "1/7 0:00", "1/10 0:00" }));
    }
}
