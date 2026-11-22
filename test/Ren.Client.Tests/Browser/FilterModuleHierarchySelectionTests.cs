namespace Ren.Client.Tests.Browser;

// These tests cover the ticks of a hierarchical filter module item, Active grouped beneath
// Category, and the rows they keep.  A node stands for every combination beneath it, so ticking or
// unticking a parent is stored as the parent alone, and a parent whose children are all stated
// reads as the parent itself.
//
// The report has 54 rows: 22 Castings, all inactive, and 32 Structures, of which 29 are active and
// 3 aren't.
[TestClass]
public class FilterModuleHierarchySelectionTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private const int AllRows = 54;
    private const int CastingsRows = 22;
    private const int StructuresRows = 32;
    private const int InactiveStructuresRows = 3;
    private const int ActiveStructuresRows = 29;

    private async Task OpenWithActiveGroupedByCategoryAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");
    }

    private Task ExpectRowCountAsync(int count) => Poll(() => FilterModule.GridRowCountAsync(Ren)).ToBe(count);

    private Task ExpectNoRowsAsync() => Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("");

    private async Task CloseMenuAsync()
    {
        await Page.Keyboard.PressAsync("Escape");
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("ClickNodeCheckbox_ParentUnticked_DropsItsBranchAndUnticksItsChildren")]
    public async Task ClickNodeCheckbox_ParentUnticked_DropsItsBranchAndUnticksItsChildren()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Structures");

        await ExpectRowCountAsync(CastingsRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "Yes")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(false);
        Expect(await FilterModule.IsAllOptionIndeterminateAsync(Ren, "Category")).ToBe(true);
    }

    [TestMethod("ClickNodeCheckbox_LeafUnticked_LeavesItsParentPartlyTicked")]
    public async Task ClickNodeCheckbox_LeafUnticked_LeavesItsParentPartlyTicked()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");

        await ExpectRowCountAsync(AllRows - InactiveStructuresRows);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "Yes")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(true);
    }

    [TestMethod("ClickNodeCheckbox_EveryLeafOfAParentUnticked_ReadsAsTheParentUnticked")]
    public async Task ClickNodeCheckbox_EveryLeafOfAParentUnticked_ReadsAsTheParentUnticked()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");
        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "Yes");

        await ExpectRowCountAsync(CastingsRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Structures")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(false);
    }

    [TestMethod("ClickNodeCheckbox_ParentPartlyTicked_TicksItFully")]
    public async Task ClickNodeCheckbox_ParentPartlyTicked_TicksItFully()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");
        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Structures");

        await ExpectRowCountAsync(AllRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Structures")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(true);
        Expect(await FilterModule.IsAllOptionCheckedAsync(Ren, "Category")).ToBe(true);
    }

    [TestMethod("ClickNodeCheckbox_LeafTickedBeneathAnUntickedParent_KeepsItsSiblingsUnticked")]
    public async Task ClickNodeCheckbox_LeafTickedBeneathAnUntickedParent_KeepsItsSiblingsUnticked()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Structures");
        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "Yes");

        await ExpectRowCountAsync(AllRows - InactiveStructuresRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(true);
    }

    [TestMethod("ClickAllOption_EverythingTicked_ShowsNothingThenEverything")]
    public async Task ClickAllOption_EverythingTicked_ShowsNothingThenEverything()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await ExpectNoRowsAsync();
        Expect(await FilterModule.IsAllOptionCheckedAsync(Ren, "Category")).ToBe(false);
        Expect(await FilterModule.IsAllOptionIndeterminateAsync(Ren, "Category")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);

        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await ExpectRowCountAsync(AllRows);
        Expect(await FilterModule.IsAllOptionCheckedAsync(Ren, "Category")).ToBe(true);
    }

    [TestMethod("ClickAllOption_SomeNodesUnticked_TicksEverything")]
    public async Task ClickAllOption_SomeNodesUnticked_TicksEverything()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");
        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await ExpectRowCountAsync(AllRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(true);
    }

    [TestMethod("ClickInvert_ParentUnticked_TicksOnlyThatParent")]
    public async Task ClickInvert_ParentUnticked_TicksOnlyThatParent()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Castings");

        await ExpectRowCountAsync(StructuresRows);

        await FilterModule.ClickInvertAsync(Ren, "Category");

        await ExpectRowCountAsync(CastingsRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(true);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Structures")).ToBe(false);
    }

    [TestMethod("ClickInvert_LeafUnticked_TicksOnlyThatLeaf")]
    public async Task ClickInvert_LeafUnticked_TicksOnlyThatLeaf()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");
        await FilterModule.ClickInvertAsync(Ren, "Category");

        await ExpectRowCountAsync(InactiveStructuresRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(true);
    }

    [TestMethod("ClickNodeCheckbox_SingleSelectTree_NarrowsAndCtrlClickAdds")]
    public async Task ClickNodeCheckbox_SingleSelectTree_NarrowsAndCtrlClickAdds()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ToggleViewSettingAsync(Ren, "Category", "#filter-module-show-single-select-toggle");
        await FilterModule.ClickStripToggleAsync(Ren, "Category", "Single");

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Castings");

        await ExpectRowCountAsync(CastingsRows);

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "Yes", ctrlKey: true);

        await ExpectRowCountAsync(CastingsRows + ActiveStructuresRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(true);
    }

    // The item is headed by Category, but the mark is stored against the leaf column.
    [TestMethod("ExcludeUntickedValues_TreeToggled_IsTickedAndLeavesTheReportShowingTheSame")]
    public async Task ExcludeUntickedValues_TreeToggled_IsTickedAndLeavesTheReportShowingTheSame()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");
        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");

        Expect(await FilterModule.IsExcludeUntickedValuesTickedAsync(Ren, "Category")).ToBe(true);

        await CloseMenuAsync();

        await ExpectRowCountAsync(AllRows - InactiveStructuresRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, "Structures", "No")).ToBe(false);
        Expect(await FilterModule.IsNodeIndeterminateAsync(Ren, null, "Structures")).ToBe(true);
    }

    // A flipped tree's ticks still drive it, so unticking a leaf afterwards removes just its rows.
    [TestMethod("ExcludeUntickedValues_TreeToggledTwice_LeavesTheFilterAsItStarted")]
    public async Task ExcludeUntickedValues_TreeToggledTwice_LeavesTheFilterAsItStarted()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Castings");

        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");
        await CloseMenuAsync();
        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");

        Expect(await FilterModule.IsExcludeUntickedValuesTickedAsync(Ren, "Category")).ToBe(false);

        await CloseMenuAsync();

        await ExpectRowCountAsync(StructuresRows);
        Expect(await FilterModule.IsNodeCheckedAsync(Ren, null, "Castings")).ToBe(false);

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");

        await ExpectRowCountAsync(ActiveStructuresRows);
    }

    // Stated by exclusion, ticking nothing still has to name every combination.
    [TestMethod("ClickNodeCheckbox_TreeExcludingUntickedValues_FiltersTheSameAsAPositiveTree")]
    public async Task ClickNodeCheckbox_TreeExcludingUntickedValues_FiltersTheSameAsAPositiveTree()
    {
        await OpenWithActiveGroupedByCategoryAsync();

        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");
        await CloseMenuAsync();

        await ExpectRowCountAsync(AllRows);

        await FilterModule.ClickNodeCheckboxAsync(Ren, null, "Castings");

        await ExpectRowCountAsync(StructuresRows);

        await FilterModule.ClickNodeCheckboxAsync(Ren, "Structures", "No");

        await ExpectRowCountAsync(ActiveStructuresRows);

        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await ExpectRowCountAsync(AllRows);

        await FilterModule.ClickAllOptionAsync(Ren, "Category");

        await ExpectNoRowsAsync();
    }
}
