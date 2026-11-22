namespace Ren.Client.Tests.Browser;

// These tests cover dragging a filter module's items into the order they're to be read in, by the
// invisible handle along each item's top edge. Dropping commits the previewed order and records it
// on the visualisation; abandoning the drag gives it up.
//
// An item that has never been dragged keeps its column's position in the source grid, so Active
// shows before Category however they were added, which is what makes a drag's doing tellable.
[TestClass]
public class FilterModuleReorderTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private async Task CreateModuleWithActiveAndCategoryItemsAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
        await FilterModule.AddItemForColumnAsync(Ren, "Category", "Active");

        Expect(await FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Active", "Category" });
    }

    [TestMethod("DragItem_DroppedPastTheItemBelowIt_MovesItAfterThatItem")]
    public async Task DragItem_DroppedPastTheItemBelowIt_MovesItAfterThatItem()
    {
        await CreateModuleWithActiveAndCategoryItemsAsync();

        await FilterModule.DragItemAsync(Ren, "Active", "Category", dropAfter: true);

        await Poll(() => FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Category", "Active" });
    }

    // The near half of the item below asks for the position the item already holds, so the drop has
    // nothing to commit.
    [TestMethod("DragItem_DroppedShortOfTheItemBelowIt_LeavesItWhereItWas")]
    public async Task DragItem_DroppedShortOfTheItemBelowIt_LeavesItWhereItWas()
    {
        await CreateModuleWithActiveAndCategoryItemsAsync();

        await FilterModule.DragItemAsync(Ren, "Active", "Category", dropAfter: false);

        Expect(await FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Active", "Category" });
    }

    // The items are reordered as the drag is previewed, so a drag ending without a drop has an order
    // to give up.
    [TestMethod("DragItem_AbandonedWithoutDropping_RestoresTheOrderItStartedIn")]
    public async Task DragItem_AbandonedWithoutDropping_RestoresTheOrderItStartedIn()
    {
        await CreateModuleWithActiveAndCategoryItemsAsync();

        await FilterModule.DragItemAsync(Ren, "Active", "Category", dropAfter: true, drop: false);

        Expect(await FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Active", "Category" });
    }

    // The order is held on the visualisation rather than in the DOM, so the render following a tick
    // applies it again.
    [TestMethod("DraggedOrder_ItemFilteredAfterwards_SurvivesTheReRender")]
    public async Task DraggedOrder_ItemFilteredAfterwards_SurvivesTheReRender()
    {
        await CreateModuleWithActiveAndCategoryItemsAsync();
        await FilterModule.DragItemAsync(Ren, "Active", "Category", dropAfter: true);
        await Poll(() => FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Category", "Active" });

        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Structures");
        Expect(await FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Category", "Active" });
    }

    // The order names each item by its leaf column, and inverting a hierarchy makes its leaf what was
    // its top level, so the item is asked for under a new name unless that name is carried over.
    [TestMethod("DraggedOrder_ItemReKeyedByInvertGrouping_KeepsItsPlace")]
    public async Task DraggedOrder_ItemReKeyedByInvertGrouping_KeepsItsPlace()
    {
        await CreateModuleWithActiveAndCategoryItemsAsync();
        await FilterModule.DragItemAsync(Ren, "Active", "Category", dropAfter: true);
        await Poll(() => FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Category", "Active" });

        await FilterModule.GroupItemByAsync(Ren, "Category", "CreatedOn");
        await FilterModule.InvertGroupingAsync(Ren, "CreatedOn", "Category");

        await Poll(() => FilterModule.ItemHeadingsAsync(Ren)).ToEqual(new[] { "Category", "Active" });
    }
}
