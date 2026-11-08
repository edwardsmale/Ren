namespace Ren.Client.Tests.Browser;

// These tests cover a filter module item's heading row: the heading itself, which "Edit heading..."
// rewrites, and the two buttons at the row's right-hand end, the ring marking the item's filter as
// one the report states and the cross taking its column off the module.  Both buttons are acts of
// authoring, so they need edit mode, which their helpers turn on.  Renaming the heading doesn't.
[TestClass]
public class FilterModuleItemHeadingTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private async Task OpenWithCategoryItemAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    // The heading is the item's own, so the grid column it filters still reads as it always did.
    [TestMethod("EditHeading_TextEntered_RenamesTheItemInPlace")]
    public async Task EditHeading_TextEntered_RenamesTheItemInPlace()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.EditItemHeadingAsync(Ren, "Category", "Product group");

        await FilterModule.ExpectItemExistsAsync(Ren, "Product group");
        Expect(await FilterModule.ItemExistsAsync(Ren, "Category")).ToBe(false);
        Expect(await Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Castings,Structures");
    }

    // Clearing the text drops the override rather than leaving the item unheaded.
    [TestMethod("EditHeading_OverriddenThenCleared_RevertsToTheColumnsOwnHeading")]
    public async Task EditHeading_OverriddenThenCleared_RevertsToTheColumnsOwnHeading()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.EditItemHeadingAsync(Ren, "Category", "Product group");
        await FilterModule.ExpectItemExistsAsync(Ren, "Product group");
        await FilterModule.EditItemHeadingAsync(Ren, "Product group", "");

        await FilterModule.ExpectItemExistsAsync(Ren, "Category");
    }

    // The heading is written back to the item's column overrides as well as into the element, so the
    // render a tick brings about resolves it again.
    [TestMethod("EditHeading_ItemFilteredAfterwards_KeepsTheHeadingAcrossTheReRender")]
    public async Task EditHeading_ItemFilteredAfterwards_KeepsTheHeadingAcrossTheReRender()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.EditItemHeadingAsync(Ren, "Category", "Product group");
        await FilterModule.ExpectItemExistsAsync(Ren, "Product group");
        await FilterModule.ClickOptionAsync(Ren, "Product group", "Castings");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Structures");
        Expect(await FilterModule.ItemExistsAsync(Ren, "Product group")).ToBe(true);
    }

    [TestMethod("ItemCross_Clicked_TakesThatColumnOffTheModule")]
    public async Task ItemCross_Clicked_TakesThatColumnOffTheModule()
    {
        await OpenWithCategoryItemAsync();
        await FilterModule.AddItemForColumnAsync(Ren, "Category", "Active");

        await FilterModule.RemoveItemViaCrossAsync(Ren, "Category");

        Expect(await FilterModule.ItemExistsAsync(Ren, "Active")).ToBe(true);
    }

    // The negative state names the values a filter leaves out, so the item is given a filter to be
    // read that way round.
    [TestMethod("IncludeWhenSavingRing_ClickedThreeTimes_MarksTheFilterThenNegatesItThenUnmarksIt")]
    public async Task IncludeWhenSavingRing_ClickedThreeTimes_MarksTheFilterThenNegatesItThenUnmarksIt()
    {
        await OpenWithCategoryItemAsync();
        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");

        Expect(await FilterModule.IsIncludedWhenSavingAsync(Ren, "Category")).ToBe(false);
        Expect(await FilterModule.IsBorderedAsIncludedWhenSavingAsync(Ren, "Category")).ToBe(false);

        await FilterModule.CycleIncludeWhenSavingAsync(Ren, "Category");

        await Poll(() => FilterModule.IsIncludedWhenSavingAsync(Ren, "Category")).ToBe(true);
        Expect(await FilterModule.IsIncludedWhenSavingAsNegativeAsync(Ren, "Category")).ToBe(false);
        await Poll(() => FilterModule.IsBorderedAsIncludedWhenSavingAsync(Ren, "Category")).ToBe(true);

        await FilterModule.CycleIncludeWhenSavingAsync(Ren, "Category");

        await Poll(() => FilterModule.IsIncludedWhenSavingAsNegativeAsync(Ren, "Category")).ToBe(true);
        await Poll(() => FilterModule.IsBorderedAsIncludedWhenSavingNegativeAsync(Ren, "Category")).ToBe(true);

        await FilterModule.CycleIncludeWhenSavingAsync(Ren, "Category");

        await Poll(() => FilterModule.IsIncludedWhenSavingAsync(Ren, "Category")).ToBe(false);
        await Poll(() => FilterModule.IsBorderedAsIncludedWhenSavingNegativeAsync(Ren, "Category")).ToBe(false);
    }

    // An item showing every value has no ticks to state the other way round yet, but the mark
    // outlives the filter it describes, standing ready to make an exclusion of the first value
    // ticked.  So all three states are offered here too.
    [TestMethod("IncludeWhenSavingRing_ItemNotFilteringByValue_StillOffersTheNegativeState")]
    public async Task IncludeWhenSavingRing_ItemNotFilteringByValue_StillOffersTheNegativeState()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.CycleIncludeWhenSavingAsync(Ren, "Category");

        await Poll(() => FilterModule.IsIncludedWhenSavingAsync(Ren, "Category")).ToBe(true);

        await FilterModule.CycleIncludeWhenSavingAsync(Ren, "Category");

        await Poll(() => FilterModule.IsIncludedWhenSavingAsNegativeAsync(Ren, "Category")).ToBe(true);

        await FilterModule.CycleIncludeWhenSavingAsync(Ren, "Category");

        await Poll(() => FilterModule.IsIncludedWhenSavingAsync(Ren, "Category")).ToBe(false);
    }
}
