namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Values > Per day item, which plots each period's total as its average
// per day, so that a month of 28 days and one of 31 compare fairly.  It is offered for weeks or
// longer, and leaves a series of averages, which are already as they would be for a day, alone.
[TestClass]
public class DateValueChartPerDayTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private async Task CreateMonthlyChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-month-start");
    }

    private Task<double?[]> PlottedValuesAsync() =>
        Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

    // The number of days in each plotted month, from the dates the chart plots.
    private Task<int[]> DaysInMonthsAsync() => Page.EvaluateAsync<int[]>("""
        () => Ren.QA.DateValueChart.getDates().map(key => {

            const date = new Date(key);

            return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        })
        """);

    private static bool IsNumber(double? value) => value is { } number && double.IsFinite(number);

    [TestMethod("divides each month's total by its days")]
    public async Task DividesEachMonthsTotalByItsDays()
    {
        await CreateMonthlyChartAsync();

        var before = await PlottedValuesAsync();
        var days = await DaysInMonthsAsync();

        Expect(before.Count(IsNumber)).ToBeGreaterThan(0);

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Per day");

        await Poll(async () =>
        {
            var after = await PlottedValuesAsync();

            return after.Length == before.Length && after.Select((value, index) =>
                !IsNumber(before[index]) || (value is { } number && Math.Abs(number - before[index]!.Value / days[index]) < 1e-9)).All(ok => ok);

        }).ToBe(true);
    }

    [TestMethod("ticks Per day once set, and plots the totals again once taken off")]
    public async Task TicksPerDayOnceSetAndPlotsTheTotalsAgainOnceTakenOff()
    {
        await CreateMonthlyChartAsync();

        var before = await PlottedValuesAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Per day");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("Per day");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Per day");

        await Poll(PlottedValuesAsync).ToEqual(before);
    }

    [TestMethod("is kept in the saved settings")]
    public async Task IsKeptInTheSavedSettings()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Per day");

        Expect(await SavedSettingsTextAsync()).ToContain("\"showPerDay\":true");
    }

    [TestMethod("isn't offered by the day")]
    public async Task IsntOfferedByTheDay()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-day-start");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        await Expect(Ren.Root.Locator("#chart-running-total")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-per-day")).ToHaveCountAsync(0);
    }
}
