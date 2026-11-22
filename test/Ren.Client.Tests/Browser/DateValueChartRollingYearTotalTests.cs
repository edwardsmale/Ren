namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Values > Rolling year total item, which plots each period's total over
// the year to its end, such as a moving annual total.  The periods less than a year from the first
// have none.  It is an alternative to a running total and a total for the year to date, so setting
// any takes the others off, and isn't offered where a period is a year or longer.
[TestClass]
public class DateValueChartRollingYearTotalTests : BrowserTest
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

    private static bool IsNumber(double? value) => value is { } number && double.IsFinite(number);

    // Each month's total over the twelve months to its end, from the months' own values.
    private static double?[] RollingYearTotals(double?[] values) => values.Select((_, index) =>
    {
        if (index < 11) return (double?)null;

        var total = 0.0;

        for (var i = index - 11; i <= index; i++)
        {
            if (IsNumber(values[i])) total += values[i]!.Value;
        }

        return total;
    }).ToArray();

    [TestMethod("totals the twelve months to each month's end")]
    public async Task TotalsTheTwelveMonthsToEachMonthsEnd()
    {
        await CreateMonthlyChartAsync();

        var before = await PlottedValuesAsync();

        Expect(before.Length).ToBeGreaterThan(12);

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Rolling year total");

        var expected = RollingYearTotals(before);

        await Poll(async () =>
        {
            var after = await PlottedValuesAsync();

            return after.Length == expected.Length && after.Select((value, index) =>
                expected[index] == null ? !IsNumber(value) : value is { } number && Math.Abs(number - expected[index]!.Value) < 1e-6).All(ok => ok);

        }).ToBe(true);
    }

    [TestMethod("takes a total for the year to date off, and is taken off by one")]
    public async Task TakesATotalForTheYearToDateOffAndIsTakenOffByOne()
    {
        await CreateMonthlyChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Year to date");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Rolling year total");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Rolling year total");
        Expect(ticked).Not.ToContain("Year to date");
        Expect(ticked).Not.ToContain("Running total");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Running total");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Running total");
        Expect(ticked).Not.ToContain("Rolling year total");
    }

    [TestMethod("is kept in the saved settings")]
    public async Task IsKeptInTheSavedSettings()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Rolling year total");

        Expect(await SavedSettingsTextAsync()).ToContain("\"rollingYearTotal\":true");
    }

    [TestMethod("isn't offered by the year")]
    public async Task IsntOfferedByTheYear()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-year-start");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        await Expect(Ren.Root.Locator("#chart-running-total")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-rolling-year-total")).ToHaveCountAsync(0);
    }
}
