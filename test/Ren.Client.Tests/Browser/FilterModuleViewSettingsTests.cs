namespace Ren.Client.Tests.Browser;

// These tests cover the parts of a filter module item that its menu shows and hides (the "View
// settings" toggles and the module-wide right-click hint) and the two ways a column is taken back
// off the module.
//
// The report has 54 rows, 22 Castings and 32 Structures, so an untouched Category item reads
// Structures (32) then Castings (22) over a totals row of 54.
[TestClass]
public class FilterModuleViewSettingsTests : BrowserTest
{
    private async Task OpenWithCategoryItemAsync(string fixture)
    {
        await Ren.OpenAsync("ported/" + fixture + ".html");
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    [TestMethod("RemoveFilterModule_OnlyItem_LeavesTheModuleEmpty")]
    public async Task RemoveFilterModule_OnlyItem_LeavesTheModuleEmpty()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest03");

        await FilterModule.RemoveItemAsync(Ren, "Category");

        Expect(await FilterModule.ItemExistsAsync(Ren, "Category")).ToBe(false);
        await Expect(Ren.Root.Locator(".ren-filter-module__empty")).Not.ToHaveCountAsync(0);
    }

    // Each "Add filter" entry toggles its column, so clicking the ticked Active takes it back off.
    [TestMethod("AddFilterSubmenu_TickedColumnClickedAgain_RemovesThatColumnsItem")]
    public async Task AddFilterSubmenu_TickedColumnClickedAgain_RemovesThatColumnsItem()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest04");
        await FilterModule.AddItemForColumnAsync(Ren, "Category", "Active");

        await FilterModule.RemoveItemViaAddFilterMenuAsync(Ren, "Category", "Active");

        Expect(await FilterModule.ItemExistsAsync(Ren, "Active")).ToBe(false);
        Expect(await FilterModule.ItemExistsAsync(Ren, "Category")).ToBe(true);
    }

    // The "All" checkbox goes with the value checkboxes, but the heading and totals row stay.
    [TestMethod("ShowValueCheckboxes_ToggledOff_LeavesTheHeadingAndTotalsRow")]
    public async Task ShowValueCheckboxes_ToggledOff_LeavesTheHeadingAndTotalsRow()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest05");

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-value-checkboxes");

        Expect(await FilterModule.ItemElementCountAsync(Ren, "Category", ".ren-filter-module__option")).ToBe(0);
        Expect(await FilterModule.ItemExistsAsync(Ren, "Category")).ToBe(true);
        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBe("54");
    }

    [TestMethod("ShowAllCheckbox_ToggledOff_HidesOnlyTheAllCheckbox")]
    public async Task ShowAllCheckbox_ToggledOff_HidesOnlyTheAllCheckbox()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest06");

        Expect(await FilterModule.ItemElementCountAsync(Ren, "Category", ".ren-filter-module__all-option")).ToBe(1);

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-all-checkbox");

        Expect(await FilterModule.ItemElementCountAsync(Ren, "Category", ".ren-filter-module__all-option")).ToBe(0);
        Expect(await FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Structures", "Castings" });
    }

    [TestMethod("ShowOptionTotals_ToggledOff_HidesThePerOptionValuesOnly")]
    public async Task ShowOptionTotals_ToggledOff_HidesThePerOptionValuesOnly()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest07");

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-option-totals");

        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBeNull();
        Expect(Text.Sorted(await FilterModule.OptionTextsAsync(Ren, "Category"))).ToEqual(new[] { "Castings", "Structures" });
        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBe("54");
    }

    [TestMethod("ShowTotal_ToggledOff_HidesTheTotalsRowOnly")]
    public async Task ShowTotal_ToggledOff_HidesTheTotalsRowOnly()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest08");

        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBe("54");

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-total");

        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBeNull();
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("22");
    }

    [TestMethod("SortToggle_NotShown_IsHiddenByDefault")]
    public async Task SortToggle_NotShown_IsHiddenByDefault()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest09");

        Expect(await FilterModule.ItemElementCountAsync(Ren, "Category", ".ren-filter-module__item-strip")).ToBe(0);
    }

    // The toggle starts on, sorting by the row count behind each value, largest first.  Off is the
    // default sort by the values themselves, which for text is alphabetical.
    [TestMethod("SortToggle_Clicked_SwitchesToTheDefaultValueSort")]
    public async Task SortToggle_Clicked_SwitchesToTheDefaultValueSort()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest09");

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-sort-toggle");

        Expect(await FilterModule.ItemElementCountAsync(Ren, "Category", ".ren-filter-module__item-strip")).ToBe(1);
        Expect(await FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Structures", "Castings" });

        await FilterModule.ClickStripToggleAsync(Ren, "Category", "Sort");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Castings", "Structures" });
    }

    // Ascending by row count, the order matches the alphabetical value sort.
    [TestMethod("SortToggle_BothSortsGiveTheSameOrder_IsHidden")]
    public async Task SortToggle_BothSortsGiveTheSameOrder_IsHidden()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest09");

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-sort-toggle");
        await FilterModule.FlipSortOrderAsync(Ren, "Category");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Castings", "Structures" });
        Expect(await FilterModule.ItemElementCountAsync(Ren, "Category", ".ren-filter-module__item-strip")).ToBe(0);
    }

    // Selecting a value in single-select mode clears every other, rather than adding to the selection.
    [TestMethod("SingleSelectToggle_ShownThenClicked_MakesTheCheckboxesSelectOneValue")]
    public async Task SingleSelectToggle_ShownThenClicked_MakesTheCheckboxesSelectOneValue()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest10");

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-single-select-toggle");

        Expect(await FilterModule.IsOptionRadioAsync(Ren, "Category", "Castings")).ToBe(false);

        await FilterModule.ClickStripToggleAsync(Ren, "Category", "Single");

        Expect(await FilterModule.IsOptionRadioAsync(Ren, "Category", "Castings")).ToBe(true);

        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Castings");
    }

    // The hint shows on every module, not just an empty one, so adding further filters stays
    // discoverable.
    [TestMethod("ShowRightClickHint_ToggledOff_HidesTheHintBeneathTheItems")]
    public async Task ShowRightClickHint_ToggledOff_HidesTheHintBeneathTheItems()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest11");

        await Expect(Ren.Root.Locator(".ren-filter-module__empty")).Not.ToHaveCountAsync(0);

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-right-click-hint");

        await Expect(Ren.Root.Locator(".ren-filter-module__empty")).ToHaveCountAsync(0);
        Expect(await FilterModule.ItemExistsAsync(Ren, "Category")).ToBe(true);
    }

    [TestMethod("FilterHeadingTooltip_SetThenCleared_ShowsThenRemovesTheHeadingsTooltip")]
    public async Task FilterHeadingTooltip_SetThenCleared_ShowsThenRemovesTheHeadingsTooltip()
    {
        await OpenWithCategoryItemAsync("FilterModuleTest11");

        Expect(await FilterModule.FilterHeadingTooltipAsync(Ren, "Category")).ToBe(null);

        await FilterModule.SetFilterHeadingTooltipAsync(Ren, "Category", "Product category");

        Expect(await FilterModule.FilterHeadingTooltipAsync(Ren, "Category")).ToBe("Product category");

        await FilterModule.SetFilterHeadingTooltipAsync(Ren, "Category", "");

        Expect(await FilterModule.FilterHeadingTooltipAsync(Ren, "Category")).ToBe(null);
    }
}
