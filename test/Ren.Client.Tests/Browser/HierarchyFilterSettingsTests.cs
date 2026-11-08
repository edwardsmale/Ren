namespace Ren.Client.Tests.Browser;

// These tests cover how a hierarchical filter, Active grouped beneath Category, is read from and
// written to report settings.  A combination tuple shorter than its columns matches every
// combination beneath it.
//
// Each HierarchyFilterTest fixture states one row filter by hand:
//     - 01 excludes the short tuple ["Castings"].
//     - 02 includes the short tuple ["Structures"].
//     - 03 excludes tuples of mixed length, ["Castings"] and ["Structures", "0"].
//     - 04 excludes Structures the older way, leaf by leaf.
//
// The report has 54 rows: 22 Castings, all inactive, and 32 Structures, of which 29 are active.
// Active is a bit column, so its values are stored as "1" and "0".
[TestClass]
public class HierarchyFilterSettingsTests : BrowserTest
{
    private const int CleaningRows = 22;

    private const int StationeryRows = 32;

    private const int ActiveStationeryRows = 29;

    private async Task GroupActiveByCategoryAsync()
    {
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");
    }

    private async Task OpenWithActiveGroupedByCategoryAsync(string fixture)
    {
        await Ren.OpenAsync(fixture);
        await GroupActiveByCategoryAsync();
    }

    // IDs repeat in this data, one row per product, so they're not de-duplicated.
    private async Task<int> GridRowCountAsync() =>
        (await Ren.Report.ColumnTextAsync("Id"))
            .Replace("\r", "")
            .Split("\n")
            .Skip(1)
            .Count(line => line.Length > 0);

    [TestMethod("ShortTuple_Excluded_DropsEveryCombinationBeneathIt")]
    public async Task ShortTuple_Excluded_DropsEveryCombinationBeneathIt()
    {
        await Ren.OpenAsync("ported/HierarchyFilterTest01.html");

        await Poll(GridRowCountAsync).ToBe(StationeryRows);
        Expect(await Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Structures");
    }

    [TestMethod("ShortTuple_Excluded_ShowsItsNodeAndChildrenUnticked")]
    public async Task ShortTuple_Excluded_ShowsItsNodeAndChildrenUnticked()
    {
        await OpenWithActiveGroupedByCategoryAsync("ported/HierarchyFilterTest01.html");

        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Castings")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Castings", "No")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(true);
    }

    [TestMethod("ShortTuple_Included_KeepsEveryCombinationBeneathIt")]
    public async Task ShortTuple_Included_KeepsEveryCombinationBeneathIt()
    {
        await Ren.OpenAsync("ported/HierarchyFilterTest02.html");

        await Poll(GridRowCountAsync).ToBe(StationeryRows);

        await GroupActiveByCategoryAsync();

        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Structures")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);
    }

    [TestMethod("MixedLengthTuples_Excluded_DropsEachCombinationTheyName")]
    public async Task MixedLengthTuples_Excluded_DropsEachCombinationTheyName()
    {
        await Ren.OpenAsync("ported/HierarchyFilterTest03.html");

        await Poll(GridRowCountAsync).ToBe(ActiveStationeryRows);

        await GroupActiveByCategoryAsync();

        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "Yes")).ToBe(true);
    }

    [TestMethod("LeafByLeafTuples_EveryChildExcluded_ReadsAsTheParentUnticked")]
    public async Task LeafByLeafTuples_EveryChildExcluded_ReadsAsTheParentUnticked()
    {
        await Ren.OpenAsync("ported/HierarchyFilterTest04.html");

        await Poll(GridRowCountAsync).ToBe(CleaningRows);

        await GroupActiveByCategoryAsync();

        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Structures")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(false);
    }

    // Filters are only saved once marked to be included when saving.
    [TestMethod("SaveSettings_EveryLeafOfAParentUnticked_StoresTheParentInsteadOfItsLeaves")]
    public async Task SaveSettings_EveryLeafOfAParentUnticked_StoresTheParentInsteadOfItsLeaves()
    {
        await OpenWithActiveGroupedByCategoryAsync("ported/FilterModuleTest01.html");

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");
        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "Yes");
        await FilterModule.ToggleIncludeWhenSavingAsync(Ren, "Category");

        Expect(await SavedSettingsTextAsync()).ToContain("\"tuples\":[[\"Castings\"]]");
    }
}
