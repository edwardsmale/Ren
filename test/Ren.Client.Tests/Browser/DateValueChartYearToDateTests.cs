namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Values > Year to date item, which plots each period's total for the
// year to date, starting again each year.  It is an alternative to a running total, so setting
// either takes the other off, and isn't offered where a period is a year or longer.
[TestClass]
public class DateValueChartYearToDateTests : BrowserTest
{
    // Monthly sales from January 2024 to December 2026.
    private const string Fixture = "previous-year/monthly-sales.html";

    private async Task CreateMonthlyChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-month-start");
    }

    private Task<double?[]> PlottedValuesAsync() =>
        Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

    private Task<int[]> PlottedYearsAsync() =>
        Page.EvaluateAsync<int[]>("() => Ren.QA.DateValueChart.getDates().map(key => new Date(key).getFullYear())");

    private static bool IsNumber(double? value) => value is { } number && double.IsFinite(number);

    // Each period's total for the year to date, worked out from the periods' own values.
    private static double?[] YearToDate(double?[] values, int[] years)
    {
        double? total = null;

        return values.Select((value, index) =>
        {
            if (index == 0 || years[index] != years[index - 1]) total = null;

            if (IsNumber(value)) total = (total ?? 0) + value!.Value;

            return total;
        }).ToArray();
    }

    [TestMethod("totals each year's periods to date, starting again each year")]
    public async Task TotalsEachYearsPeriodsToDateStartingAgainEachYear()
    {
        await CreateMonthlyChartAsync();

        var before = await PlottedValuesAsync();
        var years = await PlottedYearsAsync();

        Expect(years.Distinct().Count()).ToBeGreaterThan(1);

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Year to date");

        var expected = YearToDate(before, years);

        await Poll(async () =>
        {
            var after = await PlottedValuesAsync();

            return after.Length == expected.Length && after.Select((value, index) =>
                expected[index] == null ? !IsNumber(value) : value is { } number && Math.Abs(number - expected[index]!.Value) < 1e-9).All(ok => ok);

        }).ToBe(true);
    }

    [TestMethod("takes a running total off when set, and is taken off by one")]
    public async Task TakesARunningTotalOffWhenSetAndIsTakenOffByOne()
    {
        await CreateMonthlyChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Running total");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Year to date");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Year to date");
        Expect(ticked).Not.ToContain("Running total");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Running total");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Running total");
        Expect(ticked).Not.ToContain("Year to date");
    }

    [TestMethod("is kept in the saved settings")]
    public async Task IsKeptInTheSavedSettings()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Year to date");

        Expect(await SavedSettingsTextAsync()).ToContain("\"yearToDate\":true");
    }

    [TestMethod("isn't offered by the year")]
    public async Task IsntOfferedByTheYear()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-year-start");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        await Expect(Ren.Root.Locator("#chart-running-total")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-year-to-date")).ToHaveCountAsync(0);
    }
}
