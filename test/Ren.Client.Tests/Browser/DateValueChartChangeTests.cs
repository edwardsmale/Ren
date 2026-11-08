namespace Ren.Client.Tests.Browser;

// These tests cover a chart's Values > Change on period before item, which plots each period's
// value as its change on the period before, in a percentage format.  It is an alternative to
// shares and an index, so setting it takes them off, and the hovered values give no change of it.
[TestClass]
public class DateValueChartChangeTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private async Task CreateChartAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task<double?[]> PlottedValuesAsync() =>
        Page.EvaluateAsync<double?[]>("() => Ren.QA.DateValueChart.getPlottedValues(0)");

    private static bool IsNumber(double? value) => value is { } number && double.IsFinite(number);

    [TestMethod("plots each period's change on the period before")]
    public async Task PlotsEachPeriodsChangeOnThePeriodBefore()
    {
        await CreateChartAsync();

        var before = await PlottedValuesAsync();

        Expect(before.Count(IsNumber)).ToBeGreaterThan(1);

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");

        await Poll(async () =>
        {
            var after = await PlottedValuesAsync();

            return after.Length == before.Length && after.Select((value, index) =>
            {
                var previous = index > 0 ? before[index - 1] : null;

                if (!IsNumber(before[index]) || !IsNumber(previous) || previous == 0)
                {
                    return !IsNumber(value);
                }

                var expected = (before[index]!.Value - previous!.Value) / Math.Abs(previous.Value);

                return value is { } number && Math.Abs(number - expected) < 1e-9;
            }).All(ok => ok);

        }).ToBe(true);
    }

    [TestMethod("labels the value axis in percentages")]
    public async Task LabelsTheValueAxisInPercentages()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");

        await Expect(Ren.Root.Locator(".ren-y-axis text, .ren-left-axis text").Filter(new() { HasText = "%" }).First).ToBeAttachedAsync();
    }

    [TestMethod("takes an index off when set, and is taken off by one")]
    public async Task TakesAnIndexOffWhenSetAndIsTakenOffByOne()
    {
        await CreateChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Index to first period");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        var ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Change on period before");
        Expect(ticked).Not.ToContain("Index to first period");

        await Page.Keyboard.PressAsync("Escape");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Index to first period");
        await DateValueChart.HoverMenuPathAsync(Ren, "Values");

        ticked = await DateValueChart.TickedMenuItemsAsync(Ren);

        Expect(ticked).ToContain("Index to first period");
        Expect(ticked).Not.ToContain("Change on period before");
    }

    [TestMethod("is kept in the saved settings")]
    public async Task IsKeptInTheSavedSettings()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");

        Expect(await SavedSettingsTextAsync()).ToContain("\"showAsChange\":true");
    }

    [TestMethod("leaves the hovered values without a change of a change")]
    public async Task LeavesTheHoveredValuesWithoutAChangeOfAChange()
    {
        await CreateChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Hover", "Show hovered values");
        await DateValueChart.ClickMenuPathAsync(Ren, "Values", "Change on period before");
        await DateValueChart.HoverMenuPathAsync(Ren, "Hover");

        await Expect(Ren.Root.Locator("#show-hover-values")).ToBeVisibleAsync();
        await Expect(Ren.Root.Locator("#show-hover-change")).ToHaveCountAsync(0);
    }
}
