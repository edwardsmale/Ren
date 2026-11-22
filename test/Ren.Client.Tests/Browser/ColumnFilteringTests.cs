namespace Ren.Client.Tests.Browser;

// These tests cover a column's data row filter: the filter module its down arrow opens, and the
// cell menu's "Filter" items that narrow the same filter.  Most of them run over
// ColumnFilteringTest03, whose CreatedOn holds 12 rows of 12/01/2024, 9 of 15/01/2024 and 7 of
// 18/01/2024.
//
// The later tests cover columns holding NULLs, which the filter offers under the null sentinel and
// captions "NULL", apart from any empty strings, captioned "(blank)".
[TestClass]
public class ColumnFilteringTests : BrowserTest
{
    private const string DataRowsFixture = "ported/ColumnFilteringTest03.html";

    private const string NullFixture = "ported/ColumnFilteringTest13.html";

    private const string NullAndBlankFixture = "ported/ColumnFilteringTest18.html";

    private const string AllDates = "12/01/2024,15/01/2024,18/01/2024";

    private const string NullSentinel = "\x01";

    private const string FilterActiveColour = "rgb(255, 192, 203)";

    private const string FilterInactiveColour = "rgb(252, 252, 253)";

    private const string FilterOption = ".ren-filter-module__option[data-value]";

    private Task<string> DatesAsync() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn");

    private static async Task<string> ColumnTextAsync(RenContext context, string columnHeading) =>
        (await context.ColumnTextAsync(columnHeading)).Replace("\r", "");

    private Task ClosePopupAsync() => Ren.Root.ClickAsync(".ren-report-popup-window__close-button");

    private async Task ChooseFromFilterMenuAsync(string columnHeading, int rowHeading, string itemSelector)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, rowHeading, "#filter-menu-option", itemSelector);
        await Ren.WaitUntilLoadedAsync();
    }

    private Task FilterToThisValueOnlyAsync(string columnHeading, int rowHeading) =>
        ChooseFromFilterMenuAsync(columnHeading, rowHeading, "#filter-this-value-only");

    private Task FilterToSelectedValuesOnlyAsync(string columnHeading, int rowHeading) =>
        ChooseFromFilterMenuAsync(columnHeading, rowHeading, "#filter-selected-values-only");

    private Task RemoveFilterAsync(string columnHeading, int rowHeading) =>
        ChooseFromFilterMenuAsync(columnHeading, rowHeading, ".qa-ren-clear-column-filter-menu-item");

    // Leaves only the given value ticked in a column's filter, then closes it.
    private async Task FilterToOneValueAsync(string columnHeading, string value)
    {
        await Filters.OpenColumnFilterAsync(Ren, columnHeading);
        await Filters.ClickFilterAllCheckboxAsync(Ren);
        await Filters.ClickFilterCheckboxAsync(Ren, value);
        await ClosePopupAsync();
    }

    // Unticks 12/01 and 18/01 in CreatedOn's filter, leaving 15/01 alone.
    private async Task FilterTo15JanuaryAsync()
    {
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-12");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-18");
    }

    // Gets the caption the filter showing gives a raw value, or null where it offers no such option.
    private Task<string?> OptionCaptionAsync(string value) => EvaluateAsync<string?>("""
        ([optionSelector, optionValue]) => {
            const options = Array.from(document.querySelectorAll(optionSelector));
            const option = options.find(o => o.dataset.value === optionValue);
            const text = option ? option.querySelector(".ren-filter-module__option-text") : null;

            return text ? text.textContent.trim() : null;
        }
        """, new[] { FilterOption, value });

    private Task<bool> IsSingleSelectAsync() => EvaluateAsync<bool>("""
        (optionSelector) => {
            const option = document.querySelector(optionSelector);
            return !!option && option.querySelector(".ren-filter-module__checkbox").type === "radio";
        }
        """, FilterOption);

    // The menu item toggles rather than sets, so it's only clicked when the mode has to change.
    private async Task SetSingleSelectAsync(bool singleSelect)
    {
        if (await IsSingleSelectAsync() == singleSelect)
        {
            return;
        }

        await FilterModule.ChooseFromItemHeadingMenuAsync(Ren, "CreatedOn", "#filter-module-view", "#filter-module-single-select-mode");
        await Poll(IsSingleSelectAsync).ToBe(singleSelect);
    }

    private async Task ExpectSingleSelectToWorkAsync()
    {
        await SetSingleSelectAsync(true);

        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-15");
        await Poll(DatesAsync).ToBe("15/01/2024");

        // Clicking the selected option again clears the filter.
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-15");
        await Poll(DatesAsync).ToBe(AllDates);

        // Clicking a second option replaces the first.
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-15");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-12");
        await Poll(DatesAsync).ToBe("12/01/2024");

        await SetSingleSelectAsync(false);
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-15");
        await Poll(DatesAsync).ToBe("12/01/2024,15/01/2024");
    }

    // Filtering clears the selection, so a selection made while the grid redraws can be lost.
    private async Task<string> AllTextAsync()
    {
        await Ren.Report.SelectAllAsync();
        return Tsv(await Ren.Report.SelectedTextAsync());
    }

    private static IEnumerable<string> Repeat(string value, int count) => Enumerable.Repeat(value, count);

    private static string Column(string heading, IEnumerable<string> values) => string.Join("\n", values.Prepend(heading));

    [TestMethod]
    public async Task ColumnFilter_FilterChanged_GroupingSortOrderRemainsIntact()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest01.html");

        await Ren.Report.SelectCellsAsync("CreatedOn", 7, "CreatedOn", 8);
        await FilterToSelectedValuesOnlyAsync("CreatedOn", 7);

        var expected = Column("CreatedOn",
            Repeat("12/01/2024", 6).Concat(Repeat("18/01/2024", 2)).Concat(Repeat("12/01/2024", 6)).Concat(Repeat("18/01/2024", 5)));

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe(expected);
    }

    [TestMethod]
    public async Task ColumnFilter_FilterChanged_AggregationsUpdate()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest08.html");

        // The group holds two rows, whose Days Active sum to 236.
        Expect(await Ren.Report.CellTextAsync("Days Active", 7)).ToBe("236");

        await Ren.Report.ExpandCollapseGroupAsync(7);
        await FilterToThisValueOnlyAsync("CreatedOn", 8);

        await Poll(() => Ren.Report.CellTextAsync("Days Active", 7)).ToBe("118");
    }

    // The filter is on the product code grouping, so it keeps the groups whose CreatedOn is 12/01
    // alone.  TC32640, mixing 12/01 and 18/01, shows no single date and is hidden, where a data row
    // filter would have kept it for its 12/01 row.
    [TestMethod]
    public async Task FilterToThisValueOnly_ClickedOnAGroupRow_FiltersToThatValue()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest08.html");

        await FilterToThisValueOnlyAsync("CreatedOn", 8);

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe(Column("CreatedOn", Repeat("12/01/2024", 10)));
    }

    [TestMethod]
    public async Task FilterToThisValueOnly_NumericColumn_FiltersThenClearsCorrectly()
    {
        await Ren.OpenAsync(DataRowsFixture);

        await FilterToThisValueOnlyAsync("Total Searches", 4);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Total Searches")).ToBe("1118,2236");

        await RemoveFilterAsync("Total Searches", 4);

        var expected = Column("Total Searches",
        [
            "1066", "1066", "1118", "1118", "227", "227", "303", "303", "659", "659", "425", "368",
            "926", "926", "0", "0", "499", "499", "64", "64", "227", "1179", "1240", "1240", "169",
            "169", "425", "425", "15591"
        ]);

        await Poll(() => ColumnTextAsync(Ren.Report, "Total Searches")).ToBe(expected);
    }

    [TestMethod]
    public async Task ColumnFilterWindow_ValuesUntickedThenAllToggled_FiltersEachTime()
    {
        await Ren.OpenAsync(DataRowsFixture);

        await FilterTo15JanuaryAsync();

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe(Column("CreatedOn", Repeat("15/01/2024", 9)));

        await Filters.ClickFilterAllCheckboxAsync(Ren);

        await Poll(DatesAsync).ToBe(AllDates);

        await Filters.ClickFilterAllCheckboxAsync(Ren);

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe("CreatedOn");
    }

    [TestMethod]
    public async Task FilterToThisValueOnly_GroupedIdColumn_FiltersToThatValue()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest04.html");

        await FilterToThisValueOnlyAsync("Id", 2);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe("22");
    }

    [TestMethod]
    public async Task FilterToSelectedValuesOnly_GroupedIdColumn_FiltersToThoseValues()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest04.html");

        await Ren.Report.SelectCellsAsync("Id", 2, "Id", 3);
        await FilterToSelectedValuesOnlyAsync("Id", 2);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Id")).ToBe("22,23");
    }

    [TestMethod]
    public async Task RemoveAllColumnFilters_SeveralFiltersApplied_RemovesThemAll()
    {
        await Ren.OpenAsync(DataRowsFixture);

        await FilterTo15JanuaryAsync();
        await ClosePopupAsync();
        await FilterToOneValueAsync("Total Searches", "926");

        await ChooseFromFilterMenuAsync("Total Searches", 2, "#remove-all-column-filters");

        await Poll(DatesAsync).ToBe(AllDates);
    }

    [TestMethod]
    public async Task ClearColumnFilter_FilterApplied_RemovesThatColumnsFilter()
    {
        await Ren.OpenAsync(DataRowsFixture);

        await FilterTo15JanuaryAsync();
        await ClosePopupAsync();
        await Filters.ClearColumnFilterAsync(Ren, "CreatedOn");

        await Poll(DatesAsync).ToBe(AllDates);
    }

    [TestMethod]
    public async Task ColumnFilters_AppliedThenRemovedOneByOne_GridUpdatesEachTime()
    {
        await Ren.OpenAsync(DataRowsFixture);

        await FilterToOneValueAsync("CreatedOn", "2024-01-12");
        await FilterToOneValueAsync("Total Searches", "425");

        await Poll(AllTextAsync).ToBe(Tsv("""
            CreatedOn|Days Active|Total Searches|Product Code
            12/01/2024|118|425|UC61416
            |118|425|UC61416
            """));

        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");
        await Filters.ClickFilterAllCheckboxAsync(Ren);
        await ClosePopupAsync();

        await Poll(AllTextAsync).ToBe(Tsv("""
            CreatedOn|Days Active|Total Searches|Product Code
            12/01/2024|118|425|UC61416
            18/01/2024|118|425|XZ26106
            18/01/2024|118|425|TC32640
            |354|1275|
            """));

        await RemoveFilterAsync("Total Searches", 2);

        await Poll(DatesAsync).ToBe(AllDates);
    }

    [TestMethod]
    public async Task ColumnFilterSingleSelectOption_Enabled_BehavesLikeARadioButton()
    {
        await Ren.OpenAsync(DataRowsFixture);
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");

        await ExpectSingleSelectToWorkAsync();
    }

    // Some caching once broke this while a chart was on the page.  The fixture opens CreatedOn's
    // filter itself.
    [TestMethod]
    public async Task ColumnFilterSingleSelectOption_OtherVisualisationsPresent_StillBehavesLikeARadioButton()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest06.html");
        await Ren.Root.Locator(FilterOption).First.WaitForAsync(new() { State = Microsoft.Playwright.WaitForSelectorState.Attached });

        await ExpectSingleSelectToWorkAsync();
    }

    [TestMethod]
    public async Task ColumnFilter_ReportHasMultipleTabs_EachTabFiltersIndependently()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest05.html");

        var brand1AfterFirstFilter = Column("CreatedOn", Repeat("15/01/2024", 5).Concat(Repeat("18/01/2024", 4)));

        await Ren.Root.ClickAsync(".ren-grid-set-tab-brand1");
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-12");
        await ClosePopupAsync();

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe(brand1AfterFirstFilter);

        var brand2 = Ren.Grid(1);

        await Ren.Root.ClickAsync(".ren-grid-set-tab-brand2");
        await Ren.Root.ClickAsync(await brand2.CellSelectorAsync("CreatedOn", 1) + " .qa-ren-down-arrow-button");
        await Ren.Root.MouseOverAsync("#more-filter-options-menu-item");
        await Ren.Root.ClickAsync("#more-filter-options-filter-data-rows-menu-item");
        await Ren.Root.Locator(FilterOption).First.WaitForAsync(new() { State = Microsoft.Playwright.WaitForSelectorState.Attached });
        await Filters.ClickFilterCheckboxAsync(Ren, "2023-06-14");
        await ClosePopupAsync();

        await Poll(() => ColumnTextAsync(brand2, "CreatedOn")).ToBe(Column("CreatedOn", Repeat("01/10/2023", 2)));

        await Ren.Root.ClickAsync(".ren-grid-set-tab-brand1");

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe(brand1AfterFirstFilter);

        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-18");
        await ClosePopupAsync();

        await Poll(() => ColumnTextAsync(Ren.Report, "CreatedOn")).ToBe(Column("CreatedOn", Repeat("15/01/2024", 5)));
    }

    [TestMethod]
    public async Task ColumnFilter_ColumnContainsNull_NullCanBeFilteredOut()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest07.html");
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn With Null");

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn With Null")).ToBe("12/01/2024,18/01/2024");
    }

    [TestMethod]
    public async Task ColumnFilter_ColumnContainsEmpty_SelectAllCheckboxIncludesEmpty()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest07.html");
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn With Null");

        await Filters.ClickFilterAllCheckboxAsync(Ren);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn With Null")).ToBe("");

        await Filters.ClickFilterAllCheckboxAsync(Ren);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn With Null")).ToBe(",12/01/2024,18/01/2024");
    }

    [TestMethod]
    public async Task ColumnFilterWindow_ColumnContainsNull_NullHasItsOwnOption()
    {
        await Ren.OpenAsync(NullFixture);
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn With Null");

        Expect(await OptionCaptionAsync(NullSentinel)).ToBe("NULL");
    }

    [TestMethod]
    public async Task ColumnFilterWindow_NullCheckboxClicked_FiltersNullRowsInAndOut()
    {
        await Ren.OpenAsync(NullFixture);
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn With Null");

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn With Null")).ToBe("12/01/2024,18/01/2024");
        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "CreatedOn With Null")).ToBe(FilterActiveColour);

        await ClosePopupAsync();
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn With Null");
        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn With Null")).ToBe(",12/01/2024,18/01/2024");
        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "CreatedOn With Null")).ToBe(FilterInactiveColour);
    }

    [TestMethod]
    public async Task ColumnFilterWindow_EveryValueIsNull_FilteringMakesAllRowsDisappear()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest15.html");
        await Filters.OpenColumnFilterAsync(Ren, "Null Column");

        async Task<int> IdsAsync() => (await Filters.ColumnDistinctValuesAsync(Ren, "Id")).Length;
        var idsBefore = await IdsAsync();

        Expect(idsBefore).ToBeGreaterThan(0);

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(IdsAsync).ToBe(0);
        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "Null Column")).ToBe(FilterActiveColour);

        await ClosePopupAsync();
        await Filters.OpenColumnFilterAsync(Ren, "Null Column");
        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(IdsAsync).ToBe(idsBefore);
        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "Null Column")).ToBe(FilterInactiveColour);
    }

    // The report is grouped by Product Name With Null, which is NULL on two rows.
    [TestMethod]
    public async Task ColumnFilter_GroupedByNullStringColumn_FilteringOutNullActivatesFilter()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest16.html");
        await Filters.OpenColumnFilterAsync(Ren, "Product Name With Null");

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "Product Name With Null")).ToBe(FilterActiveColour);
    }

    [TestMethod]
    public async Task ColumnFilter_GroupedByNullStringColumn_RestoringNullDeactivatesFilter()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest16.html");
        await Filters.OpenColumnFilterAsync(Ren, "Product Name With Null");
        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);
        await ClosePopupAsync();

        await Filters.OpenColumnFilterAsync(Ren, "Product Name With Null");
        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "Product Name With Null")).ToBe(FilterInactiveColour);
    }

    // The report is grouped by CreatedOn With Null, which is NULL where CreatedOn is 15/01.
    [TestMethod]
    public async Task ColumnFilter_GroupedByNullDateColumn_FilteringOutNullHidesThoseGroups()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest17.html");
        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn With Null");

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "CreatedOn With Null")).ToBe("12/01/2024,18/01/2024");
    }

    // Description holds a NULL on one row and an empty string on another.  Neither shows any text in
    // the grid, so each is captioned, and they're separate options because they filter separately.
    [TestMethod]
    public async Task ColumnFilterWindow_ColumnHoldsNullAndEmptyString_EachHasItsOwnOption()
    {
        await Ren.OpenAsync(NullAndBlankFixture);
        await Filters.OpenColumnFilterAsync(Ren, "Description");

        Expect(await OptionCaptionAsync(NullSentinel)).ToBe("NULL");
        Expect(await OptionCaptionAsync("")).ToBe("(blank)");
    }

    // Unticking one value builds a filter of all the others, which is where an empty string missing
    // from the options took its own rows out with the NULL ones.
    [TestMethod]
    public async Task ColumnFilter_EmptyStringDeselected_TheNullRowIsLeftIn()
    {
        await Ren.OpenAsync(NullAndBlankFixture);
        await Filters.OpenColumnFilterAsync(Ren, "Description");

        await Filters.ClickFilterCheckboxAsync(Ren, "");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Kind")).ToBe("Null row,Value row");
    }

    // The filter this builds keeps the null sentinel, so it only works while the sentinel compresses
    // to its dictionary index, which the column's empty string puts out of the dictionary's ordinal
    // order (see Ren.CompressionDictionary).
    [TestMethod]
    public async Task ColumnFilter_NullDeselected_TheEmptyStringRowIsLeftIn()
    {
        await Ren.OpenAsync(NullAndBlankFixture);
        await Filters.OpenColumnFilterAsync(Ren, "Description");

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Kind")).ToBe("Blank row,Value row");
    }

    [TestMethod]
    public async Task ColumnFilter_NullAndEmptyStringBothDeselected_OnlyTheValueRowsAreLeft()
    {
        await Ren.OpenAsync(NullAndBlankFixture);
        await Filters.OpenColumnFilterAsync(Ren, "Description");

        await Filters.ClickFilterCheckboxAsync(Ren, NullSentinel);
        await Filters.ClickFilterCheckboxAsync(Ren, "");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Kind")).ToBe("Value row");
    }

    // The "Filter groups..." popup captions the same two values from the grouping rather than from
    // the column's cells.
    [TestMethod]
    public async Task FilterGroupsWindow_GroupsHoldNullAndEmptyString_EachHasItsOwnOption()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest19.html");
        await Filters.OpenFilterGroupsAsync(Ren, "Description");

        Expect(await OptionCaptionAsync(NullSentinel)).ToBe("NULL");
        Expect(await OptionCaptionAsync("")).ToBe("(blank)");
    }
}
