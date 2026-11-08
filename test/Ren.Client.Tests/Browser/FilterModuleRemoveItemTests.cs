namespace Ren.Client.Tests.Browser;

// Removing a filter module item whose column is still filtered asks whether to clear that filter
// too, so taking a control away doesn't leave a filter behind that nothing on the page shows.  A
// compare filter, or an item taken away while editing groupings, is cleared without asking.
//
// Ticking Yes on Active leaves the inactive rows, created on three of the six dates.
[TestClass]
public class FilterModuleRemoveItemTests : BrowserTest
{
    private const string FilterModuleFixture = "ported/FilterModuleTest01.html";
    private const string CellFilterFixture = "ported/ColumnFilteringTest03.html";

    // Alphabetical, as ColumnDistinctValuesCsvAsync sorts text.
    private const string AllDates = "01/10/2023,12/01/2024,14/06/2023,15/01/2024,18/01/2024,18/06/2023";
    private const string InactiveDates = "01/10/2023,14/06/2023,18/06/2023";

    private Task ExpectCreatedOnAsync(string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn")).ToBe(csv);

    private async Task CreateModuleWithActiveFilteredToNoAsync()
    {
        await Ren.OpenAsync(FilterModuleFixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.ClickOptionAsync(Ren, "Active", "Yes");
        await ExpectCreatedOnAsync(InactiveDates);
    }

    private async Task ChooseFromCellFilterMenuAsync(string itemSelector)
    {
        await Ren.Root.RightClickAsync(await Ren.Report.CellSelectorAsync("CreatedOn", 2));
        await Ren.Root.MouseOverAsync("#filter-menu-option");
        await Ren.Root.ClickAsync(itemSelector);
        await Ren.WaitUntilLoadedAsync();
    }

    // Gives a confirm time to show where the test is that none does.
    private Task PauseAsync() => Page.WaitForTimeoutAsync(500);

    [TestMethod("RemoveItem_ColumnFiltered_AsksWhetherToClearTheFilter")]
    public async Task RemoveItem_ColumnFiltered_AsksWhetherToClearTheFilter()
    {
        await CreateModuleWithActiveFilteredToNoAsync();

        await FilterModule.RemoveItemViaCrossAsync(Ren, "Active");

        await Expect(Ren.Root.Locator(".qa-ren-popup-confirm-content")).Not.ToHaveCountAsync(0);
    }

    [TestMethod("RemoveItem_AnsweredYes_ClearsTheFilter")]
    public async Task RemoveItem_AnsweredYes_ClearsTheFilter()
    {
        await CreateModuleWithActiveFilteredToNoAsync();

        await FilterModule.RemoveItemViaCrossAsync(Ren, "Active");
        await Popups.ClickConfirmYesAsync(Ren);

        await ExpectCreatedOnAsync(AllDates);
    }

    [TestMethod("RemoveItem_AnsweredNo_LeavesTheFilterInEffect")]
    public async Task RemoveItem_AnsweredNo_LeavesTheFilterInEffect()
    {
        await CreateModuleWithActiveFilteredToNoAsync();

        await FilterModule.RemoveItemViaCrossAsync(Ren, "Active");
        await Popups.ClickConfirmNoAsync(Ren);

        await ExpectCreatedOnAsync(InactiveDates);
    }

    [TestMethod("RemoveItem_ViaHeadingMenuAnsweredYes_ClearsTheFilter")]
    public async Task RemoveItem_ViaHeadingMenuAnsweredYes_ClearsTheFilter()
    {
        await CreateModuleWithActiveFilteredToNoAsync();

        await FilterModule.RemoveItemAsync(Ren, "Active");
        await Popups.ClickConfirmYesAsync(Ren);

        await ExpectCreatedOnAsync(AllDates);
    }

    [TestMethod("RemoveItem_CompareFiltered_ClearsTheCompareFilterWithoutAsking")]
    public async Task RemoveItem_CompareFiltered_ClearsTheCompareFilterWithoutAsking()
    {
        await Ren.OpenAsync(FilterModuleFixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Id");
        await FilterModule.ShowCompareStripAsync(Ren, "Id");
        await Filters.ApplyCompareFilterAsync(Ren, "greaterThan", "36");
        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe("37,38,39");

        await FilterModule.RemoveItemViaCrossAsync(Ren, "Id");

        await ExpectCreatedOnAsync(AllDates);
        Expect(await Popups.IsConfirmShownAsync(Ren)).ToBe(false);
    }

    [TestMethod("RemoveItem_ColumnNotFiltered_DoesNotAsk")]
    public async Task RemoveItem_ColumnNotFiltered_DoesNotAsk()
    {
        await Ren.OpenAsync(FilterModuleFixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");

        await FilterModule.RemoveItemViaCrossAsync(Ren, "Active");
        await PauseAsync();

        Expect(await Popups.IsConfirmShownAsync(Ren)).ToBe(false);
    }

    // The editor is where filters are being reworked, so the question would only be in the way.
    // Excluding row 2's date leaves two, and taking the editor's CreatedOn item away brings the
    // excluded date back.
    [TestMethod("RemoveItem_InEditGroupings_ClearsTheFilterWithoutAsking")]
    public async Task RemoveItem_InEditGroupings_ClearsTheFilterWithoutAsking()
    {
        await Ren.OpenAsync(CellFilterFixture);

        await ChooseFromCellFilterMenuAsync("#filter-exclude-this-value");
        await ExpectCreatedOnAsync("15/01/2024,18/01/2024");

        await ChooseFromCellFilterMenuAsync("#edit-filters-at-this-level");
        await Ren.Root.Locator(".ren-data-grouping-settings-editor-grouping").First.WaitForAsync();
        await FilterModule.ExpectItemExistsAsync(Ren, "CreatedOn");

        await FilterModule.RemoveItemViaCrossAsync(Ren, "CreatedOn");

        await ExpectCreatedOnAsync("12/01/2024,15/01/2024,18/01/2024");
        Expect(await Popups.IsConfirmShownAsync(Ren)).ToBe(false);
    }
}
