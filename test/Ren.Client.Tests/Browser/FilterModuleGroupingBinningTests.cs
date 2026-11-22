using System.Globalization;

namespace Ren.Client.Tests.Browser;

// These tests cover a binned filter module item on a grouping level, opened from "Edit filters at
// this level".  A tick there is stored with each bin expanded to every group value it covers, so
// unticking one bin removes many groups.
//
// The report is grouped by Unique Searches Per Day: one group of zero and 20 positive groups, with
// a grand totals row beneath that a grouping's filter leaves alone.
[TestClass]
public class FilterModuleGroupingBinningTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest20.html";

    private const string Column = "Unique Searches Per Day";

    private const string PositiveZeroNegativeBinning = "#group-by-column-binning-pos-zero-neg-filter-module";

    private const string PositiveGroups =
        "0.21,0.39,0.52,0.67,0.86,0.95,1.04,1.22,1.3,1.52,1.68,1.8,1.92,1.99,2.05,2.21,"
        + "2.4,2.57,2.74,2.81";

    private const string AllGroups = "0," + PositiveGroups;

    // Opens the filter editor at the grouping level and bins its item by sign, leaving it with a
    // Positive and a Zero checkbox.
    private async Task BinTheGroupingsItemAsync()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Root.RightClickAsync(await Ren.Report.CellSelectorAsync(Column, 2));
        await Ren.Root.MouseOverAsync("#filter-menu-option");
        await Ren.Root.ClickAsync("#edit-filters-at-this-level");
        await Ren.WaitUntilLoadedAsync();
        await FilterModule.ExpectItemExistsAsync(Ren, Column);

        await FilterModule.SetBinningFunctionAsync(Ren, Column, PositiveZeroNegativeBinning);
    }

    // The group rows' values in ascending order, leaving out the heading and the grand totals row.
    private async Task<string> GroupValuesCsvAsync()
    {
        var lines = (await Ren.Report.ColumnTextAsync(Column)).Replace("\r", "").Split("\n");

        return string.Join(",", lines[1..^1]
            .Select(line => double.Parse(line, CultureInfo.InvariantCulture))
            .Order()
            .Select(value => value.ToString(CultureInfo.InvariantCulture)));
    }

    private Task ExpectGroupValuesAsync(string csv) => Poll(GroupValuesCsvAsync).ToBe(csv);

    [TestMethod("BinnedGroupingItem_BinUnticked_FiltersOutEveryGroupInTheBin")]
    public async Task BinnedGroupingItem_BinUnticked_FiltersOutEveryGroupInTheBin()
    {
        await BinTheGroupingsItemAsync();

        await FilterModule.ClickOptionAsync(Ren, Column, "Positive");

        await ExpectGroupValuesAsync("0");
    }

    [TestMethod("BinnedGroupingItem_BinUntickedThenReticked_RestoresEveryGroup")]
    public async Task BinnedGroupingItem_BinUntickedThenReticked_RestoresEveryGroup()
    {
        await BinTheGroupingsItemAsync();

        await FilterModule.ClickOptionAsync(Ren, Column, "Positive");
        await ExpectGroupValuesAsync("0");

        await FilterModule.ClickOptionAsync(Ren, Column, "Positive");

        await ExpectGroupValuesAsync(AllGroups);
    }

    [TestMethod("BinnedGroupingItem_SingleValueBinUnticked_LeavesTheOtherBinsGroups")]
    public async Task BinnedGroupingItem_SingleValueBinUnticked_LeavesTheOtherBinsGroups()
    {
        await BinTheGroupingsItemAsync();

        await FilterModule.ClickOptionAsync(Ren, Column, "Zero");

        await ExpectGroupValuesAsync(PositiveGroups);
    }

    [TestMethod("BinnedGroupingItem_Inverted_ShowsOnlyTheUntickedBinsGroups")]
    public async Task BinnedGroupingItem_Inverted_ShowsOnlyTheUntickedBinsGroups()
    {
        await BinTheGroupingsItemAsync();

        await FilterModule.ClickOptionAsync(Ren, Column, "Zero");
        await ExpectGroupValuesAsync(PositiveGroups);

        await FilterModule.ClickInvertAsync(Ren, Column);

        await ExpectGroupValuesAsync("0");
    }

    [TestMethod("BinnedGroupingItem_InvertedTwice_RestoresTheFilter")]
    public async Task BinnedGroupingItem_InvertedTwice_RestoresTheFilter()
    {
        await BinTheGroupingsItemAsync();

        await FilterModule.ClickOptionAsync(Ren, Column, "Positive");
        await FilterModule.ClickInvertAsync(Ren, Column);
        await ExpectGroupValuesAsync(PositiveGroups);

        await FilterModule.ClickInvertAsync(Ren, Column);

        await ExpectGroupValuesAsync("0");
    }
}
