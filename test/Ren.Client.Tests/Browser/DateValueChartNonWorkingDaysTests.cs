namespace Ren.Client.Tests.Browser;

// These tests cover the Date markers > Shade non-working days item, which shades the weekends and
// holidays behind the series of a chart by the day, and isn't offered by the month.
[TestClass]
public class DateValueChartNonWorkingDaysTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private async Task CreateDailyChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-day-start");
    }

    [TestMethod("shades the weekends behind the series, and is kept in the settings")]
    public async Task ShadesTheWeekendsBehindTheSeries()
    {
        await CreateDailyChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Date markers", "Shade non-working days");

        await Expect(Ren.Root.Locator(".ren-non-working-day").First).ToBeAttachedAsync();

        var isFirst = await Ren.Root.Locator(".ren-non-working-days")
            .EvaluateAsync<bool>("group => group.parentNode.firstElementChild === group");

        Expect(isFirst).ToBe(true);
        Expect(await SavedSettingsTextAsync()).ToContain("\"shadeNonWorkingDays\":true");
    }

    [TestMethod("isn't offered by the month")]
    public async Task IsNotOfferedByTheMonth()
    {
        await CreateDailyChartAsync();
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-month-start");
        await DateValueChart.HoverMenuPathAsync(Ren, "Date markers");

        await Expect(Ren.Root.Locator("#date-value-chart-calendar-markers")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#date-value-chart-shade-non-working-days")).ToHaveCountAsync(0);
    }
}
