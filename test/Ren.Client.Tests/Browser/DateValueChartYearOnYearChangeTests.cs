namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Values > Change on year before item, which plots each period's value
// as its change on the same period a year before, in a percentage format.  It is an alternative to
// shares, an index and changes on the period before, so setting it takes them off, and it isn't
// offered over all time, where there is no year before to bin.
[TestClass]
public class DateValueChartYearOnYearChangeTests : BrowserTest
{
    // Monthly sales from January 2024 to December 2026.
    private const string Fixture = "previous-year/monthly-sales.html";

    private const string AllTime = "date-all-time";

    private async Task CreateMonthlyChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-month-start");
    }

    private Task<double?[]> PlottedValuesAsync() =>
        Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

    private Task<int[]> PlottedMonthsAsync() => Page.EvaluateAsync<int[]>("""
        () => Ren.QA.DateValueChart.getDates().map(key => {
            const date = new Date(key);
            return date.getFullYear() * 12 + date.getMonth();
        })
        """);

    private static bool IsNumber(double? value) => value.HasValue && double.IsFinite(value.Value);

    [TestMethod("plots each month's change on the same month a year before")]
    public async Task PlotsEachMonthsChangeOnTheSameMonthAYearBefore()
    {
        await CreateMonthlyChartAsync();

        var before = await PlottedValuesAsync();
        var months = await PlottedMonthsAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on year before");

        await Poll(async () => (await PlottedValuesAsync()).Any(IsNumber)).ToBe(true);

        var after = await PlottedValuesAsync();
        var compared = 0;

        for (var i = 0; i < months.Length; i++)
        {
            var earlierIndex = Array.IndexOf(months, months[i] - 12);

            if (earlierIndex < 0 || !IsNumber(before[i]) || !IsNumber(before[earlierIndex])) continue;

            var earlier = before[earlierIndex]!.Value;

            Expect(after[i]!.Value).ToBeCloseTo((before[i]!.Value - earlier) / Math.Abs(earlier), 9);
            compared++;
        }

        Expect(compared).ToBeGreaterThan(0);
    }

    [TestMethod("labels the value axis in percentages")]
    public async Task LabelsTheValueAxisInPercentages()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on year before");

        await Expect(Ren.Root.Locator(".ren-y-axis text").Filter(new() { HasText = "%" }).First).ToBeAttachedAsync();
    }

    [TestMethod("takes a change on the period before off, and is taken off by one")]
    public async Task TakesAChangeOnThePeriodBeforeOffAndIsTakenOffByOne()
    {
        await CreateMonthlyChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on year before");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Change on year before");
        Expect(ticked).Not.ToContain("Change on period before");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Change on period before");
        Expect(ticked).Not.ToContain("Change on year before");
    }

    [TestMethod("is kept in the saved settings")]
    public async Task IsKeptInTheSavedSettings()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on year before");

        Expect((await Ren.SavedSettingsAsync())!.ToJsonString()).ToContain("\"showAsYearOnYearChange\":true");
    }

    [TestMethod("isn't offered over all time")]
    public async Task IsntOfferedOverAllTime()
    {
        await CreateMonthlyChartAsync();
        await DateValueChart.SelectDateGroupingAsync(Ren, AllTime);
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        await Expect(Ren.Root.Locator("#chart-change")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#chart-change-year-before")).ToHaveCountAsync(0);
    }
}
