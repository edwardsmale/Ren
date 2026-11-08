using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a chart whose filterGroup has no grid behind it.  The chart registers settings
// for the group, so that a filter module, declared in the report or opened from the chart's menu,
// has something to filter.
[TestClass]
public class ChartFilterGroupTests : BrowserTest
{
    private const string Fixture = "chart-filter-group.html";

    private const string FilterGroup = "Shared filters";

    private async Task<double> ChartTotalAsync()
    {
        var total = (await DateValueChart.DateValuesAsync(Ren)).Values
            .Select(value => double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ? number : 0)
            .Sum();

        return Math.Round(total * 100, MidpointRounding.AwayFromZero) / 100;
    }

    // Whether the group's registered settings are for a filter group only, or null where it has none.
    private Task<bool?> RegisteredAsFilterGroupOnlyAsync(string group) => Page.EvaluateAsync<bool?>("""
        settingsGroup => {

            const settings =
                window.Ren.DataGroupingSettingsCollection.getDataGroupingSettings(settingsGroup);

            return settings ? !!settings.isFilterGroupOnly : null;
        }
        """, group);

    [TestMethod("Chart_FilterGroupHasNoGrid_RegistersSettingsForTheGroup")]
    public async Task Chart_FilterGroupHasNoGrid_RegistersSettingsForTheGroup()
    {
        await Ren.OpenAsync(Fixture);

        Expect(await RegisteredAsFilterGroupOnlyAsync(FilterGroup)).ToBe(true);
    }

    [TestMethod("DeclaredModule_FilterGroupHasNoGrid_ShowsTheHierarchyFromTheData")]
    public async Task DeclaredModule_FilterGroupHasNoGrid_ShowsTheHierarchyFromTheData()
    {
        await Ren.OpenAsync(Fixture);

        await Poll(() => FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Structures")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "Yes")).ToBe(true);
    }

    [TestMethod("DeclaredModule_NodeUnticked_RedrawsTheChartWithoutItsRows")]
    public async Task DeclaredModule_NodeUnticked_RedrawsTheChartWithoutItsRows()
    {
        await Ren.OpenAsync(Fixture);

        var totalBefore = await ChartTotalAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Structures");
        await Ren.WaitUntilLoadedAsync();

        await Poll(ChartTotalAsync).ToBeLessThan(totalBefore);
        Expect(await ChartTotalAsync()).ToBeGreaterThan(0);

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Structures");
        await Ren.WaitUntilLoadedAsync();

        await Poll(ChartTotalAsync).ToBe(totalBefore);
    }

    [TestMethod("ChartMenu_FilterGroupHasNoGrid_OffersFilterBy")]
    public async Task ChartMenu_FilterGroupHasNoGrid_OffersFilterBy()
    {
        await Ren.OpenAsync(Fixture);

        var modules = Ren.Root.Locator(".ren-filter-module");

        await Expect(modules).ToHaveCountAsync(1);

        await DateValueChart.ClickMenuPathAsync(Ren, "Filter by", "Category");

        await Expect(modules).ToHaveCountAsync(2);
    }

    [TestMethod("FilterByPopup_Closed_KeepsTheGroupsSettingsAndFilter")]
    public async Task FilterByPopup_Closed_KeepsTheGroupsSettingsAndFilter()
    {
        await Ren.OpenAsync(Fixture);

        var totalBefore = await ChartTotalAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Structures");
        await Ren.WaitUntilLoadedAsync();
        await Poll(ChartTotalAsync).ToBeLessThan(totalBefore);

        var filteredTotal = await ChartTotalAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Filter by", "Product Code");
        await Ren.Root.Locator(".ren-report-popup-window:has(.ren-filter-module)")
            .Last
            .Locator(".qa-ren-popup-window-close-button")
            .ClickAsync();
        await Expect(Ren.Root.Locator(".ren-filter-module")).ToHaveCountAsync(1);
        await Ren.WaitUntilLoadedAsync();

        Expect(await RegisteredAsFilterGroupOnlyAsync(FilterGroup)).Not.ToBeNull();
        Expect(await ChartTotalAsync()).ToBe(filteredTotal);
    }

    [TestMethod("SavedSettings_FilterGroupHasNoGrid_LeavesOutTheGroup")]
    public async Task SavedSettings_FilterGroupHasNoGrid_LeavesOutTheGroup()
    {
        await Ren.OpenAsync(Fixture);

        var saved = await Ren.SavedSettingsAsync();

        Expect(saved?["dataGroupingSettings"]?.ToJsonString() ?? "{}").Not.ToContain(FilterGroup);
    }
}
