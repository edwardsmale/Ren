using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a data grid cell's "Filter" submenu: filtering to or excluding the clicked or
// selected values, clearing the column's or every column's filters, and editing the filters at the
// clicked level or at every level.  Each item acts on the level of the row clicked: a data row (or
// the totals row) filters the data rows, while a group row filters its own grouping.
//
// Both fixtures show CreatedOn holding 12 rows of 12/01/2024, 9 of 15/01/2024 and 7 of 18/01/2024.
// The data rows fixture is ungrouped, so rows 2-13 are 12/01, rows 14-22 are 15/01 and rows 23-29
// are 18/01.  The grouped fixture groups by CreatedOn then ID, so rows 2-4 are the CreatedOn groups
// in date order and row 5 the totals row.
[TestClass]
public class CellFilterMenuTests : BrowserTest
{
    private const string DataRowsFixture = "ported/ColumnFilteringTest03.html";

    private const string GroupedFixture = "ported/DataGroupingSettingsTest04.html";

    private const string AllDates = "12/01/2024,15/01/2024,18/01/2024";

    private const string FilterMenuItem = "#filter-menu-option";

    private const string EditorTile = ".ren-data-grouping-settings-editor-grouping";

    private Task<string> DatesAsync() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn");

    private Task ExpectDatesAsync(string dates) => Poll(DatesAsync).ToBe(dates);

    private async Task ChooseFromFilterMenuAsync(int rowHeading, string itemSelector, string columnHeading = "CreatedOn")
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, rowHeading, FilterMenuItem, itemSelector);
        await Ren.WaitUntilLoadedAsync();
    }

    private Task ExcludeThisValueAsync(int rowHeading) => ChooseFromFilterMenuAsync(rowHeading, "#filter-exclude-this-value");

    private Task ClearColumnFilterAsync(int rowHeading) => ChooseFromFilterMenuAsync(rowHeading, ".qa-ren-clear-column-filter-menu-item");

    private async Task OpenEditorAsync(int rowHeading, string itemSelector, string columnHeading = "CreatedOn")
    {
        await ChooseFromFilterMenuAsync(rowHeading, itemSelector, columnHeading);
        await Ren.Root.Locator(EditorTile).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    private Task EditFiltersAtThisLevelAsync(int rowHeading, string columnHeading = "CreatedOn") =>
        OpenEditorAsync(rowHeading, "#edit-filters-at-this-level", columnHeading);

    // Gets "expanded", "collapsed" or "missing" for the editor's tile with the given title.
    private Task<string> TileStateAsync(string tileTitle) => Page.EvaluateAsync<string>("""
        ([tileClass, title]) => {

            const tiles = Array.from(document.querySelectorAll("." + tileClass));
            const tile = tiles.find((t) => {

                const titleElement = t.querySelector("." + tileClass + "__group-by-columns");
                return titleElement && titleElement.textContent.replace(/\s+/g, " ").trim() === title;
            });

            if (!tile) {
                return "missing";
            }

            return tile.classList.contains(tileClass + "--collapsed") ? "collapsed" : "expanded";
        }
        """, new[] { EditorTile[1..], tileTitle });

    // Rows 2-3 are then the 12/01 and 18/01 groups, and the 12/01 data rows are excluded too.
    private async Task ExcludeAtTwoLevelsAsync()
    {
        await ExcludeThisValueAsync(3);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(4);

        await Poll(() => Ren.Report.CellTextAsync("CreatedOn", 5)).ToBe("12/01/2024");

        await ExcludeThisValueAsync(5);

        await ExpectDatesAsync("18/01/2024");
    }

    [TestMethod("ExcludeThisValue_DataRow_HidesThatValue")]
    public async Task ExcludeThisValue_DataRow_HidesThatValue()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await ExcludeThisValueAsync(2);

        await ExpectDatesAsync("15/01/2024,18/01/2024");
    }

    [TestMethod("ExcludeThisValue_AlreadyExcludingAValue_ExcludesBoth")]
    public async Task ExcludeThisValue_AlreadyExcludingAValue_ExcludesBoth()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await ExcludeThisValueAsync(2);

        await Poll(() => Ren.Report.CellTextAsync("CreatedOn", 2)).ToBe("15/01/2024");

        await ExcludeThisValueAsync(2);

        await ExpectDatesAsync("18/01/2024");
    }

    [TestMethod("ExcludeThisValue_PositiveFilter_RemovesTheValueFromIt")]
    public async Task ExcludeThisValue_PositiveFilter_RemovesTheValueFromIt()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await Ren.Report.SelectCellsAsync("CreatedOn", 13, "CreatedOn", 14);
        await ChooseFromFilterMenuAsync(13, "#filter-selected-values-only");

        await ExpectDatesAsync("12/01/2024,15/01/2024");

        // Replacing the positive filter with an exclusion would bring 18/01 back.
        await ExcludeThisValueAsync(2);

        await ExpectDatesAsync("15/01/2024");
    }

    [TestMethod("ExcludeSelectedValues_DataRows_HidesThoseValues")]
    public async Task ExcludeSelectedValues_DataRows_HidesThoseValues()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await Ren.Report.SelectCellsAsync("CreatedOn", 13, "CreatedOn", 14);
        await ChooseFromFilterMenuAsync(13, "#filter-exclude-selected-values");

        await ExpectDatesAsync("18/01/2024");
    }

    [TestMethod("ExcludeSelectedValues_PositiveFilterFromPopup_RemovesThemFromIt")]
    public async Task ExcludeSelectedValues_PositiveFilterFromPopup_RemovesThemFromIt()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-18");
        await Ren.Root.ClickAsync(".ren-report-popup-window__close-button");

        await Ren.Report.SelectCellsAsync("CreatedOn", 2, "CreatedOn", 3);
        await ChooseFromFilterMenuAsync(2, "#filter-exclude-selected-values");

        await ExpectDatesAsync("15/01/2024");
    }

    [TestMethod("FilterToThisValueOnly_ExclusionFilter_ReplacesItWithAPositiveFilter")]
    public async Task FilterToThisValueOnly_ExclusionFilter_ReplacesItWithAPositiveFilter()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await ExcludeThisValueAsync(2);
        await ChooseFromFilterMenuAsync(2, "#filter-this-value-only");

        await ExpectDatesAsync("15/01/2024");
    }

    [TestMethod("FilterToSelectedValuesOnly_ExclusionFilter_ReplacesItWithAPositiveFilter")]
    public async Task FilterToSelectedValuesOnly_ExclusionFilter_ReplacesItWithAPositiveFilter()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await ExcludeThisValueAsync(2);

        await Ren.Report.SelectCellsAsync("CreatedOn", 2, "CreatedOn", 3);
        await ChooseFromFilterMenuAsync(2, "#filter-selected-values-only");

        await ExpectDatesAsync("15/01/2024");
    }

    [TestMethod("ClearColumnFilter_ExclusionFilter_ShowsEveryValue")]
    public async Task ClearColumnFilter_ExclusionFilter_ShowsEveryValue()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await ExcludeThisValueAsync(2);
        await ClearColumnFilterAsync(2);

        await ExpectDatesAsync(AllDates);
    }

    // The exclusion has to be on the CreatedOn grouping for it to show in the tile the editor opens
    // expanded.
    [TestMethod("ExcludeThisValue_GroupRow_EditorOpensAtThatGrouping")]
    public async Task ExcludeThisValue_GroupRow_EditorOpensAtThatGrouping()
    {
        await Ren.OpenAsync(GroupedFixture);

        Expect(await Ren.Report.CellTextAsync("CreatedOn", 3)).ToBe("15/01/2024");

        await ExcludeThisValueAsync(3);

        await ExpectDatesAsync("12/01/2024,18/01/2024");

        await EditFiltersAtThisLevelAsync(2);

        Expect(await TileStateAsync("CreatedOn grouping")).ToBe("expanded");
        Expect(await TileStateAsync("Data rows")).ToBe("collapsed");
    }

    [TestMethod("EditFiltersAtThisLevel_DataRow_ExpandsTheDataRowsTile")]
    public async Task EditFiltersAtThisLevel_DataRow_ExpandsTheDataRowsTile()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(4);

        await Poll(() => Ren.Report.CellTextAsync("CreatedOn", 5)).ToBe("12/01/2024");

        await EditFiltersAtThisLevelAsync(5);

        Expect(await TileStateAsync("Data rows")).ToBe("expanded");
        Expect(await TileStateAsync("CreatedOn grouping")).ToBe("collapsed");
    }

    [TestMethod("EditFiltersAtThisLevel_InnerGroupRow_ExpandsThatGroupingsTile")]
    public async Task EditFiltersAtThisLevel_InnerGroupRow_ExpandsThatGroupingsTile()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.ExpandCollapseGroupAsync(2);
        await EditFiltersAtThisLevelAsync(3, "Id");

        Expect(await TileStateAsync("Id grouping")).ToBe("expanded");
        Expect(await TileStateAsync("CreatedOn grouping")).ToBe("collapsed");
    }

    [TestMethod("EditFiltersAtThisLevel_ColumnUnfilteredAtThatLevel_ShowsAnItemForIt")]
    public async Task EditFiltersAtThisLevel_ColumnUnfilteredAtThatLevel_ShowsAnItemForIt()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.ExpandCollapseGroupAsync(2);
        await EditFiltersAtThisLevelAsync(3, "Id");

        await Poll(() => FilterModule.ItemExistsAsync(Ren, "Id")).ToBe(true);
    }

    [TestMethod("EditFiltersAtThisLevel_TotalsRow_IsNotOffered")]
    public async Task EditFiltersAtThisLevel_TotalsRow_IsNotOffered()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.RightClickCellAsync("CreatedOn", 5);
        await Ren.Root.MouseOverAsync(FilterMenuItem);

        await Expect(Ren.Root.Locator("#filter-exclude-this-value")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#edit-filters-at-this-level")).ToHaveCountAsync(0);
    }

    // 15/01 returns, while the data rows' exclusion of 12/01 stays.
    [TestMethod("ClearColumnFilter_GroupRow_ClearsOnlyThatGroupingsFilter")]
    public async Task ClearColumnFilter_GroupRow_ClearsOnlyThatGroupingsFilter()
    {
        await Ren.OpenAsync(GroupedFixture);
        await ExcludeAtTwoLevelsAsync();
        await ClearColumnFilterAsync(2);

        await ExpectDatesAsync("15/01/2024,18/01/2024");
    }

    [TestMethod("EditAllFilters_GroupRow_ExpandsEveryTile")]
    public async Task EditAllFilters_GroupRow_ExpandsEveryTile()
    {
        await Ren.OpenAsync(GroupedFixture);
        await OpenEditorAsync(3, "#edit-all-filters-menu-item");

        Expect(await TileStateAsync("Data rows")).ToBe("expanded");
        Expect(await TileStateAsync("CreatedOn grouping")).ToBe("expanded");
        Expect(await TileStateAsync("Id grouping")).ToBe("expanded");
    }

    [TestMethod("ClearAllColumnFilters_FiltersAtSeveralLevels_ShowsEveryValue")]
    public async Task ClearAllColumnFilters_FiltersAtSeveralLevels_ShowsEveryValue()
    {
        await Ren.OpenAsync(GroupedFixture);
        await ExcludeAtTwoLevelsAsync();
        await ChooseFromFilterMenuAsync(2, "#clear-all-column-filters-menu-item");

        await ExpectDatesAsync(AllDates);
    }

    [TestMethod("ClearColumnFilter_GroupRowWithNoFilterAtItsLevel_IsNotOffered")]
    public async Task ClearColumnFilter_GroupRowWithNoFilterAtItsLevel_IsNotOffered()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.ExpandCollapseGroupAsync(2);
        await Ren.Report.ExpandCollapseGroupAsync(4);
        await ExcludeThisValueAsync(5);

        await Ren.Report.RightClickCellAsync("CreatedOn", 2);
        await Ren.Root.MouseOverAsync(FilterMenuItem);

        await Expect(Ren.Root.Locator("#filter-exclude-this-value")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(".qa-ren-clear-column-filter-menu-item")).ToHaveCountAsync(0);
    }

    [TestMethod("FilterToThisValueOnly_GroupRow_FiltersThatGrouping")]
    public async Task FilterToThisValueOnly_GroupRow_FiltersThatGrouping()
    {
        await Ren.OpenAsync(GroupedFixture);
        await ChooseFromFilterMenuAsync(3, "#filter-this-value-only");

        await ExpectDatesAsync("15/01/2024");

        await ClearColumnFilterAsync(2);

        await ExpectDatesAsync(AllDates);
    }

    [TestMethod("ExcludeThisValue_GroupRowPositiveFilter_RemovesTheValueFromIt")]
    public async Task ExcludeThisValue_GroupRowPositiveFilter_RemovesTheValueFromIt()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.SelectCellsAsync("CreatedOn", 2, "CreatedOn", 3);
        await ChooseFromFilterMenuAsync(2, "#filter-selected-values-only");

        await ExpectDatesAsync("12/01/2024,15/01/2024");

        await ExcludeThisValueAsync(2);

        await ExpectDatesAsync("15/01/2024");

        await ClearColumnFilterAsync(2);

        await ExpectDatesAsync(AllDates);
    }

    [TestMethod("ExcludeSelectedValues_GroupRows_FiltersThatGrouping")]
    public async Task ExcludeSelectedValues_GroupRows_FiltersThatGrouping()
    {
        await Ren.OpenAsync(GroupedFixture);
        await Ren.Report.SelectCellsAsync("CreatedOn", 2, "CreatedOn", 3);
        await ChooseFromFilterMenuAsync(2, "#filter-exclude-selected-values");

        await ExpectDatesAsync("18/01/2024");

        await EditFiltersAtThisLevelAsync(2);

        Expect(await TileStateAsync("CreatedOn grouping")).ToBe("expanded");
    }
}
