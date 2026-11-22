namespace Ren.Client.Tests.Browser;

// These tests cover creating a filter module from a source grid's column menu, adding items for
// Boolean and text columns, and driving the source grid's filter through the checkboxes and the
// compare strip.
//
// The report has 54 rows, 22 Castings and 32 Structures.  Every Castings row is inactive.
[TestClass]
public class FilterModuleTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private const string AllDates = "01/10/2023,12/01/2024,14/06/2023,15/01/2024,18/01/2024,18/06/2023";

    private const string InactiveDates = "01/10/2023,14/06/2023,18/06/2023";

    private async Task OpenWithItemAsync(string columnHeading)
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, columnHeading);
    }

    private async Task OpenWithCategoryCompareStripAsync()
    {
        await OpenWithItemAsync("Category");
        await FilterModule.ShowCompareStripAsync(Ren, "Category");
    }

    private Task ExpectDistinctValuesAsync(string columnHeading, string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, columnHeading)).ToBe(csv);

    private async Task<string[]> SortedOptionTextsAsync(string itemHeading) =>
        (await FilterModule.OptionTextsAsync(Ren, itemHeading)).Order(StringComparer.Ordinal).ToArray();

    [TestMethod("CreateFilterModule_FromColumnHeaderContextMenu_StartsWithNoItems")]
    public async Task CreateFilterModule_FromColumnHeaderContextMenu_StartsWithNoItems()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");

        Expect(await FilterModule.ItemExistsAsync(Ren, "Active")).ToBe(false);
        await Expect(Ren.Root.Locator(".ren-filter-module__empty")).Not.ToHaveCountAsync(0);
    }

    // With no filter applied, every value counts as selected.
    [TestMethod("AddFilterModuleItem_BooleanColumn_ShowsYesNoCheckboxes")]
    public async Task AddFilterModuleItem_BooleanColumn_ShowsYesNoCheckboxes()
    {
        await OpenWithItemAsync("Active");

        Expect(await FilterModule.OptionTextsAsync(Ren, "Active")).ToEqual(new[] { "Yes", "No" });
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Active", "Yes")).ToBe(true);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Active", "No")).ToBe(true);
    }

    [TestMethod("BooleanOption_YesUntickedThenReticked_FiltersAndRestoresSourceGrid")]
    public async Task BooleanOption_YesUntickedThenReticked_FiltersAndRestoresSourceGrid()
    {
        await OpenWithItemAsync("Active");

        await FilterModule.ClickOptionAsync(Ren, "Active", "Yes");

        await ExpectDistinctValuesAsync("CreatedOn", InactiveDates);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Active", "Yes")).ToBe(false);

        await FilterModule.ClickOptionAsync(Ren, "Active", "Yes");

        await ExpectDistinctValuesAsync("CreatedOn", AllDates);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Active", "Yes")).ToBe(true);
    }

    [TestMethod("AddFilterModuleItem_TextColumn_ShowsDistinctValuesWithRowCounts")]
    public async Task AddFilterModuleItem_TextColumn_ShowsDistinctValuesWithRowCounts()
    {
        await OpenWithItemAsync("Category");

        Expect(await SortedOptionTextsAsync("Category")).ToEqual(new[] { "Castings", "Structures" });
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("22");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Structures")).ToBe("32");
    }

    [TestMethod("Option_UntickedThenReticked_FiltersAndRestoresSourceGrid")]
    public async Task Option_UntickedThenReticked_FiltersAndRestoresSourceGrid()
    {
        await OpenWithItemAsync("Category");

        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");
        await ExpectDistinctValuesAsync("Category", "Structures");

        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");
        await ExpectDistinctValuesAsync("Category", "Castings,Structures");
    }

    // All values start selected, so clicking "All" deselects everything, which filters every row out.
    [TestMethod("AllCheckbox_ClickedTwice_HidesEveryRowThenRestoresThem")]
    public async Task AllCheckbox_ClickedTwice_HidesEveryRowThenRestoresThem()
    {
        await OpenWithItemAsync("Category");

        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await Expect(Ren.Report.Locator(".ren-data-grid__cell.ren-r-1.ren-c-0")).ToHaveCountAsync(0);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(false);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Structures")).ToBe(false);

        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await ExpectDistinctValuesAsync("Category", "Castings,Structures");
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(true);
    }

    [TestMethod("CompareStrip_EnabledViaViewSettings_AppliesCompareFilterToSourceGrid")]
    public async Task CompareStrip_EnabledViaViewSettings_AppliesCompareFilterToSourceGrid()
    {
        await OpenWithCategoryCompareStripAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "beginsWith", "Cast");

        await ExpectDistinctValuesAsync("Category", "Castings");
    }

    // Unlike the checkboxes' own value filter, a compare filter isn't the item's selection, so it
    // cross-filters the item it sits in.
    [TestMethod("CompareStrip_FilterApplied_NarrowsItsOwnItemsValues")]
    public async Task CompareStrip_FilterApplied_NarrowsItsOwnItemsValues()
    {
        await OpenWithCategoryCompareStripAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "beginsWith", "Cast");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Castings" });

        await Filters.ClickCompareFilterClearAsync(Ren);

        await Poll(() => SortedOptionTextsAsync("Category")).ToEqual(new[] { "Castings", "Structures" });
    }

    // Changing the operator withdraws the filter applied under the previous one, but unlike Clear
    // it keeps the typed value, so it can be applied under the new operator without being retyped.
    [TestMethod("CompareStrip_OperatorChangedAfterApplying_WithdrawsFilterAndKeepsTypedValue")]
    public async Task CompareStrip_OperatorChangedAfterApplying_WithdrawsFilterAndKeepsTypedValue()
    {
        await OpenWithCategoryCompareStripAsync();

        await Filters.ApplyCompareFilterAsync(Ren, "beginsWith", "Cast");

        await ExpectDistinctValuesAsync("Category", "Castings");
        Expect(await Filters.IsCompareFilterInEffectAsync(Ren)).ToBe(true);

        await Filters.SetCompareFilterOperatorAsync(Ren, "contains");

        await ExpectDistinctValuesAsync("Category", "Castings,Structures");
        await Poll(() => Filters.IsCompareFilterInEffectAsync(Ren)).ToBe(false);
        Expect(await Filters.CompareFilterOperatorAsync(Ren)).ToBe("contains");
        Expect(await Filters.CompareFilterInputValueAsync(Ren, 1)).ToBe("Cast");

        await Filters.ClickCompareFilterApplyAsync(Ren);

        await ExpectDistinctValuesAsync("Category", "Castings");
    }

    // Every Castings row is inactive, so "Yes" no longer has any rows behind it.
    [TestMethod("CompareStrip_FilterApplied_CrossFiltersTheOtherItemsValues")]
    public async Task CompareStrip_FilterApplied_CrossFiltersTheOtherItemsValues()
    {
        await OpenWithItemAsync("Category");
        await FilterModule.AddItemForColumnAsync(Ren, "Category", "Active");
        await FilterModule.ShowCompareStripAsync(Ren, "Category");

        await Filters.ApplyCompareFilterAsync(Ren, "beginsWith", "Cast");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Active")).ToEqual(new[] { "No" });
    }

    // Marking a filter as one the report itself states is an act of authoring the report.
    [TestMethod("IncludeWhenSavingMenuItem_OutsideEditMode_IsNotOffered")]
    public async Task IncludeWhenSavingMenuItem_OutsideEditMode_IsNotOffered()
    {
        await OpenWithItemAsync("Category");

        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Category");
        await Expect(Ren.Root.Locator("#filter-module-include-when-saving")).ToHaveCountAsync(0);

        await Page.Keyboard.PressAsync("Escape");
        await FilterModule.EnableEditModeAsync(Ren);
        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Category");

        await Expect(Ren.Root.Locator("#filter-module-include-when-saving")).Not.ToHaveCountAsync(0);
    }

    // The window replaces its data source with one holding the new variation, so the module's
    // next refresh mustn't read the rows it was created over.  A filter on one item is what has the
    // other item's options cross-filtered.
    [TestMethod("FilterModule_OverVariationsWindowWhenVariationAdded_FollowsTheNewRows")]
    public async Task FilterModule_OverVariationsWindowWhenVariationAdded_FollowsTheNewRows()
    {
        async Task CreateVariationAsync(string name)
        {
            await Ren.Root.Locator(".qa-ren-data-grid-variations-window-create-input").FillAsync(name);
            await Ren.Root.ClickAsync(".qa-ren-data-grid-variations-window-create-button");
            await Ren.WaitUntilLoadedAsync();
        }

        await Ren.OpenAsync("ported/FilterModuleTest18.html");
        await Ren.Root.ClickAsync(".qa-ren-data-grid-variations-menu-button");
        await Ren.Root.Locator(".qa-ren-data-grid-variations-window-create-input").WaitForAsync();
        await Ren.WaitUntilLoadedAsync();
        await CreateVariationAsync("One");
        await CreateVariationAsync("Two");

        var variationsWindow = Ren.Root.Within(".ren-data-grid-variations-window");

        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Apply", variationsWindow);
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Apply");
        await FilterModule.AddItemForColumnAsync(Ren, "Apply", "Variation Name");
        await FilterModule.ClickOptionAsync(Ren, "Variation Name", "One");

        await CreateVariationAsync("Three");
        await FilterModule.ClickOptionAsync(Ren, "Variation Name", "Two");

        await Poll(async () => (await FilterModule.OptionTextsAsync(Ren, "Variation Name")).Contains("Three")).ToBe(true);
    }
}
