namespace Ren.Client.Tests.Browser;

// A right-click on a filter module checkbox reads the opposite way round from a left-click, so both
// gestures are there whichever mode the column is in: on a multi-select column it narrows to the
// value clicked, and on a single-select column it ticks or unticks that value on its own.  Only the
// checkbox reads that way; the label beside it still opens the item's menu.  Ctrl+right-click is
// left to the browser.
//
// The report has 54 rows, 22 of them Castings and 32 Structures.
[TestClass]
public class FilterModuleRightClickTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private async Task OpenWithCategoryItemAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    private async Task OpenWithActiveGroupedByCategoryAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");
    }

    private Task ExpectCategoriesAsync(string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe(csv);

    private Microsoft.Playwright.ILocator ContextMenus => Ren.Root.Locator(".ren-context-menu");

    [TestMethod("RightClickCheckbox_MultiSelectItem_NarrowsTheSelectionToThatValue")]
    public async Task RightClickCheckbox_MultiSelectItem_NarrowsTheSelectionToThatValue()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures");

        await ExpectCategoriesAsync("Structures");
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Structures")).ToBe(true);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(false);
    }

    // Repeating the gesture on the sole selection isn't a toggle taking it away again.
    [TestMethod("RightClickCheckbox_ValueAlreadyTheOnlyOneTicked_LeavesItTicked")]
    public async Task RightClickCheckbox_ValueAlreadyTheOnlyOneTicked_LeavesItTicked()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures");
        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures");

        await ExpectCategoriesAsync("Structures");
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Structures")).ToBe(true);
    }

    [TestMethod("RightClickCheckbox_SingleSelectItem_AddsThatValueToTheSelection")]
    public async Task RightClickCheckbox_SingleSelectItem_AddsThatValueToTheSelection()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-single-select-toggle");
        await FilterModule.ClickStripToggleAsync(Ren, "Category", "Single");

        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");

        await ExpectCategoriesAsync("Castings");

        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures");

        await ExpectCategoriesAsync("Castings,Structures");
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(true);

        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures");

        await ExpectCategoriesAsync("Castings");
    }

    [TestMethod("RightClickCheckbox_AnyItem_ShowsNoContextMenu")]
    public async Task RightClickCheckbox_AnyItem_ShowsNoContextMenu()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures");

        await Expect(ContextMenus).ToHaveCountAsync(0);
    }

    // The label text's menu is the one with the "Labels" actions, and opening it isn't a selection.
    [TestMethod("RightClickLabelText_AnyItem_StillShowsTheItemsContextMenu")]
    public async Task RightClickLabelText_AnyItem_StillShowsTheItemsContextMenu()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.RightClickOptionTextAsync(Ren, "Category", "Structures");

        await Expect(ContextMenus).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#filter-module-edit-label")).Not.ToHaveCountAsync(0);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(true);
    }

    [TestMethod("CtrlRightClickCheckbox_AnyItem_LeavesTheSelectionAndTheMenuAlone")]
    public async Task CtrlRightClickCheckbox_AnyItem_LeavesTheSelectionAndTheMenuAlone()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.RightClickOptionAsync(Ren, "Category", "Structures", ctrlKey: true);

        await Expect(ContextMenus).ToHaveCountAsync(0);
        await ExpectCategoriesAsync("Castings,Structures");
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(true);
    }

    // A parent node stands for the combinations beneath it, so narrowing to it keeps its own branch.
    [TestMethod("RightClickNodeCheckbox_MultiSelectTree_NarrowsTheSelectionToThatNode")]
    public async Task RightClickNodeCheckbox_MultiSelectTree_NarrowsTheSelectionToThatNode()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.RightClickNodeCheckboxAsync(Ren, null, "Structures");

        await ExpectCategoriesAsync("Structures");
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "Yes")).ToBe(true);
    }

    [TestMethod("RightClickNodeCheckbox_LeafOfAMultiSelectTree_KeepsThatLeafAlone")]
    public async Task RightClickNodeCheckbox_LeafOfAMultiSelectTree_KeepsThatLeafAlone()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.RightClickNodeCheckboxAsync(Ren, "Structures", "Yes");

        await ExpectCategoriesAsync("Structures");
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "Yes")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);
    }

    [TestMethod("RightClickNodeCheckbox_AnyTree_ShowsNoContextMenu")]
    public async Task RightClickNodeCheckbox_AnyTree_ShowsNoContextMenu()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.RightClickNodeCheckboxAsync(Ren, null, "Structures");

        await Expect(ContextMenus).ToHaveCountAsync(0);
    }

    [TestMethod("CtrlRightClickNodeCheckbox_AnyTree_LeavesTheSelectionAlone")]
    public async Task CtrlRightClickNodeCheckbox_AnyTree_LeavesTheSelectionAlone()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.RightClickNodeCheckboxAsync(Ren, null, "Structures", ctrlKey: true);

        await Expect(ContextMenus).ToHaveCountAsync(0);
        await ExpectCategoriesAsync("Castings,Structures");
    }
}
