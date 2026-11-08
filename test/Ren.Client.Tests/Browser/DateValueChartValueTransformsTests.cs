namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Values > Running total, Share of total and Index to first period
// items.  A running total is a series' own, plotting its totals to date, while shares are the
// chart's, plotting each series as its share of the period's total over the series shown, in a
// percentage format.  An index is the chart's too, plotting each series against its first value
// as 100, and is an alternative to shares, so setting either takes the other off.
[TestClass]
public class DateValueChartValueTransformsTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";
    private const string ValueAxisText = ".ren-y-axis text, .ren-left-axis text";

    private async Task CreateChartAsync(params string[] columnHeadings)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync(columnHeadings);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private async Task CreateTwoSeriesChartAsync()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day", "Days Active");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
    }

    private Task<double?[]> PlottedValuesAsync(int seriesIndex) => Page.EvaluateAsync<double?[]>(
        "index => Ren.QA.DateValueChart.getPlottedValues(index)", seriesIndex);

    private static bool IsNumber(double? value) => value.HasValue && double.IsFinite(value.Value);

    [TestMethod("plots a series' running total")]
    public async Task PlotsASeriesRunningTotal()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day");

        var before = await PlottedValuesAsync(0);

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Running total");

        await Poll(async () =>
        {
            var after = await PlottedValuesAsync(0);

            if (after.Length != before.Length || before.Length <= 1) return false;

            var total = 0.0;

            for (var index = 0; index < after.Length; index++)
            {
                if (!IsNumber(before[index])) continue;

                total += before[index]!.Value;

                if (after[index] != total) return false;
            }

            return true;

        }).ToBe(true);
    }

    [TestMethod("ticks the running total once set")]
    public async Task TicksTheRunningTotalOnceSet()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day");

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Running total");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        Expect(await DateValueChart.TickedMenuItemsAsync(Ren)).ToContain("Running total");
    }

    [TestMethod("plots each series as its share of the period's total")]
    public async Task PlotsEachSeriesAsItsShareOfThePeriodsTotal()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Share of total");

        await Poll(async () =>
        {
            var first = await PlottedValuesAsync(0);
            var second = await PlottedValuesAsync(1);

            return first.Length > 0 && first.Select((value, index) => !IsNumber(value)
                || Math.Abs(value!.Value + (second[index] ?? double.NaN) - 1) < 1e-9).All(ok => ok);

        }).ToBe(true);
    }

    [TestMethod("labels the value axis in percentages when sharing")]
    public async Task LabelsTheValueAxisInPercentagesWhenSharing()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Share of total");

        await Expect(Ren.Root.Locator(ValueAxisText).Filter(new() { HasText = "%" }).First).ToBeAttachedAsync();
    }

    [TestMethod("offers no share of total with one series")]
    public async Task OffersNoShareOfTotalWithOneSeries()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day");

        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        await Expect(Ren.Root.Locator("#chart-share-of-total")).ToHaveCountAsync(0);
    }

    [TestMethod("plots each series as an index of its first value")]
    public async Task PlotsEachSeriesAsAnIndexOfItsFirstValue()
    {
        await CreateTwoSeriesChartAsync();

        var before = await PlottedValuesAsync(1);

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Index to first period");

        await Poll(async () =>
        {
            var after = await PlottedValuesAsync(1);
            var baseValue = before.First(value => IsNumber(value) && value != 0)!.Value;

            return after.Length == before.Length && after.Length > 1
                && after.Select((value, index) => !IsNumber(before[index])
                    || Math.Abs((value ?? double.NaN) - before[index]!.Value / baseValue * 100) < 1e-9).All(ok => ok);

        }).ToBe(true);
    }

    [TestMethod("takes shares off when indexing, and the index off when sharing")]
    public async Task TakesSharesOffWhenIndexingAndTheIndexOffWhenSharing()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Share of total");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Index to first period");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Index to first period");
        Expect(ticked).Not.ToContain("Share of total");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Share of total");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Share of total");
        Expect(ticked).Not.ToContain("Index to first period");
    }

    [TestMethod("labels the value axis without the column's units when indexed")]
    public async Task LabelsTheValueAxisWithoutTheColumnsUnitsWhenIndexed()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day");

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Index to first period");

        await Expect(Ren.Root.Locator(ValueAxisText).Filter(new() { HasText = "100" }).First).ToBeAttachedAsync();
        await Expect(Ren.Root.Locator(ValueAxisText).Filter(new() { HasText = "%" })).ToHaveCountAsync(0);
    }
}
