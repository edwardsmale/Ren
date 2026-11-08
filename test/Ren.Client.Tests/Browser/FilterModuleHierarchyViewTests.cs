namespace Ren.Client.Tests.Browser;

// These tests cover the expand/collapse icons on a hierarchical filter module item's parent nodes.
// Every node is in the DOM whether or not its branch is open, since collapsing caps the container's
// height, so it's the cap and the icon reading as a plus or a minus that say what's on show.
//
// Each test starts from Active grouped beneath Category, whose top-level nodes are Castings (22
// rows) and Structures (32).  Branches start out closed.
[TestClass]
public class FilterModuleHierarchyViewTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private const string CollapsedMaxHeight = "0px";

    private async Task CreateModuleWithActiveGroupedByCategoryAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");
    }

    // The children were there all along: 29 of the 32 Structures rows are active.
    [TestMethod("ExpandIcon_Clicked_OpensTheNodesBranch")]
    public async Task ExpandIcon_Clicked_OpensTheNodesBranch()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync();

        Expect(await FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(false);
        Expect(await FilterModule.NodeChildrenMaxHeightAsync(Ren, null, "Structures")).ToBe(CollapsedMaxHeight);

        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");

        await Poll(() => FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(true);
        await Poll(() => FilterModule.NodeChildrenMaxHeightAsync(Ren, null, "Structures")).Not.ToBe(CollapsedMaxHeight);
        Expect(await FilterModule.NodeValueAsync(Ren, "Structures", "Yes")).ToBe("29");
    }

    [TestMethod("ExpandIcon_ClickedTwice_ClosesTheBranchAgain")]
    public async Task ExpandIcon_ClickedTwice_ClosesTheBranchAgain()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync();

        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");
        await Poll(() => FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(true);
        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");

        await Poll(() => FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(false);
        await Poll(() => FilterModule.NodeChildrenMaxHeightAsync(Ren, null, "Structures")).ToBe(CollapsedMaxHeight);
    }

    [TestMethod("ExpandIcon_OneBranchOpened_LeavesTheOthersClosed")]
    public async Task ExpandIcon_OneBranchOpened_LeavesTheOthersClosed()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync();

        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");
        await Poll(() => FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(true);

        Expect(await FilterModule.IsNodeExpandedAsync(Ren, null, "Castings")).ToBe(false);
    }

    // Adding a column rebuilds every item, and the open branches are restored from the module's
    // own record of them.
    [TestMethod("ExpandedBranch_ModuleReRendered_IsStillOpen")]
    public async Task ExpandedBranch_ModuleReRendered_IsStillOpen()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync();

        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");
        await Poll(() => FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(true);

        await FilterModule.AddItemForColumnAsync(Ren, "Category", "CreatedOn");

        Expect(await FilterModule.IsNodeExpandedAsync(Ren, null, "Structures")).ToBe(true);
    }

    // Opening Castings pins the item at its height with Structures open, which collapsing them both
    // must let go of, rather than leaving the item as tall as it was with both open.
    [TestMethod("ExpandedBranches_AllCollapsed_ItemShrinksBackToItsOriginalHeight")]
    public async Task ExpandedBranches_AllCollapsed_ItemShrinksBackToItsOriginalHeight()
    {
        await CreateModuleWithActiveGroupedByCategoryAsync();

        var item = Page.Locator(".qa-ren-filter-module-item").First;
        async Task<float> ItemHeightAsync() => (await item.BoundingBoxAsync())!.Height;
        var originalHeight = await ItemHeightAsync();

        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");
        await Poll(() => FilterModule.NodeChildrenMaxHeightAsync(Ren, null, "Structures")).ToBe("none");
        await FilterModule.ToggleNodeAsync(Ren, null, "Castings");
        await Poll(() => FilterModule.NodeChildrenMaxHeightAsync(Ren, null, "Castings")).ToBe("none");

        await FilterModule.ToggleNodeAsync(Ren, null, "Structures");
        await FilterModule.ToggleNodeAsync(Ren, null, "Castings");

        await Poll(ItemHeightAsync).ToBeCloseTo(originalHeight, 0);
    }
}
