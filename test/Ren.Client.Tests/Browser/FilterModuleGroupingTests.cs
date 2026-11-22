namespace Ren.Client.Tests.Browser;

// These tests cover the two actions that undo or turn around a hierarchy built with "Group by":
// "Ungroup", which leaves a flat list of the leaf column's values, and "Invert grouping", which
// reverses the chain so the outermost level becomes the leaf.
//
// Both start from Active grouped beneath Category, so the hierarchy is headed by Category.  All 22
// Castings rows are inactive, and 3 of the 32 Structures rows are.
[TestClass]
public class FilterModuleGroupingTests : BrowserTest
{
    private async Task CreateModuleWithActiveGroupedByCategoryAsync(string fixture)
    {
        await Ren.OpenAsync(fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");
    }

    // The level the item was nested within goes rather than being left as an item of its own, and
    // the options count rows again: 29 of the 54 are active.
    [TestMethod("Ungroup_TwoLevelHierarchy_RevertsTheItemToAFlatList")]
    public async Task Ungroup_TwoLevelHierarchy_RevertsTheItemToAFlatList()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync("ported/FilterModuleTest16.html");

        await FilterModule.UngroupItemAsync(Ren, "Category", "Active");

        await FilterModule.ExpectItemExistsAsync(Ren, "Category", false);
        Expect(await FilterModule.OptionTextsAsync(Ren, "Active")).ToEqual(new[] { "Yes", "No" });
        Expect(await FilterModule.OptionCountAsync(Ren, "Active", "Yes")).ToBe("29");
        Expect(await FilterModule.OptionCountAsync(Ren, "Active", "No")).ToBe("25");
    }

    // Active is the top level afterwards, with Category nested in each value: all 22 Castings rows
    // sit beneath No alongside the 3 inactive Structures ones, while Yes holds Structures alone.
    [TestMethod("InvertGrouping_TwoLevelHierarchy_SwapsTheLevelsOver")]
    public async Task InvertGrouping_TwoLevelHierarchy_SwapsTheLevelsOver()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync("ported/FilterModuleTest17.html");

        Expect(await FilterModule.NodeValueAsync(Ren, null, "Structures")).ToBe("32");

        await FilterModule.InvertGroupingAsync(Ren, "Category", "Active");

        await FilterModule.ExpectItemExistsAsync(Ren, "Category", false);
        Expect(await FilterModule.NodeValueAsync(Ren, null, "Yes")).ToBe("29");
        Expect(await FilterModule.NodeValueAsync(Ren, null, "No")).ToBe("25");
        Expect(await FilterModule.NodeValueAsync(Ren, "No", "Castings")).ToBe("22");
        Expect(await FilterModule.NodeValueAsync(Ren, "No", "Structures")).ToBe("3");
        Expect(await FilterModule.NodeValueAsync(Ren, "Yes", "Structures")).ToBe("29");
    }
}
