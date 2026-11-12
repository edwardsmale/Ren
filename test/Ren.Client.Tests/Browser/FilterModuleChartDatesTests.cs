using System.Text.Json.Nodes;

namespace Ren.Client.Tests.Browser;

// These tests cover a filter module following the dates its source group's date/value charts are
// drawn over (followChartDates).  In the fixture Core sells every year from 2021 to 2025, Legacy
// only in 2021 and Launch only in 2025.  The chart is drawn as yearly pies, four at a time, so it
// shows 2022 to 2025 until its slider is taken back to 2021.
[TestClass]
public class FilterModuleChartDatesTests : BrowserTest
{
    private const string Fixture = "filter-module-chart-dates/category-sales.html";

    private const string SliderTrack = ".ren-date-value-chart-period-slider [role=slider]";

    // Opens yearly pies of sales by category, with a filter module of their categories, the module
    // following the pies' dates or not.
    private async Task OpenAsync(bool followChartDates)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync("OrderDate", "Sales");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "OrderDate");
        await DateValueChart.SplitDataAsync(Ren, "Category");
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-year-start");
        await DateValueChart.ClickMenuPathAsync(Ren, "Chart type", "Pies");
        await DateValueChart.ClickMenuPathAsync(Ren, "Multi-chart", "By year");
        await Ren.WaitUntilLoadedAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Filter by", "Category");
        await Ren.WaitUntilLoadedAsync();

        var settings = await Ren.SavedSettingsAsync();
        var visualisations = settings!["visualisations"]!.AsArray();
        var modules = visualisations
            .Where(visualisation => (string?)visualisation!["visualisationTypeName"] == "FilterModule")
            .ToList();

        Expect(modules.Count).ToBe(1);

        // As in a report, a slider beneath the pies steps back through the earlier years.
        foreach (var chart in visualisations
            .Where(visualisation => (string?)visualisation!["visualisationTypeName"] == "DateValueChart"))
            chart!["multiChartSlider"] = true;

        if (followChartDates) modules[0]!["followChartDates"] = true;

        await Ren.OpenWithSettingsAsync(Fixture, settings);
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task<string[]> SortedOptionTextsAsync() =>
        (await FilterModule.OptionTextsAsync(Ren, "Category")).Order(StringComparer.Ordinal).ToArray();

    [TestMethod("FollowChartDates_Off_ShowsEveryCategory")]
    public async Task FollowChartDates_Off_ShowsEveryCategory()
    {
        await OpenAsync(followChartDates: false);

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "Core", "Launch", "Legacy" });
    }

    [TestMethod("FollowChartDates_LatestYearsShown_LeavesOutCategoriesSoldOnlyBefore")]
    public async Task FollowChartDates_LatestYearsShown_LeavesOutCategoriesSoldOnlyBefore()
    {
        await OpenAsync(followChartDates: true);

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "Core", "Launch" });
    }

    [TestMethod("FollowChartDates_SliderMovedBack_FollowsTheYearsShown")]
    public async Task FollowChartDates_SliderMovedBack_FollowsTheYearsShown()
    {
        await OpenAsync(followChartDates: true);

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "Core", "Launch" });

        await Ren.Root.Locator(SliderTrack).FocusAsync();
        await Page.Keyboard.PressAsync("Home");
        await Ren.WaitUntilLoadedAsync();

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "Core", "Legacy" });

        await Page.Keyboard.PressAsync("End");
        await Ren.WaitUntilLoadedAsync();

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "Core", "Launch" });
    }

    [TestMethod("FollowChartDates_On_IsSavedWithTheModule")]
    public async Task FollowChartDates_On_IsSavedWithTheModule()
    {
        await OpenAsync(followChartDates: true);

        var settings = await Ren.SavedSettingsAsync();
        var module = settings!["visualisations"]!.AsArray()
            .First(visualisation => (string?)visualisation!["visualisationTypeName"] == "FilterModule");

        Expect((bool?)module!["followChartDates"]).ToBe(true);
    }
}
