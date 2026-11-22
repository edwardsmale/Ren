namespace Ren.Client.Tests.Browser;

// These tests cover filtering by exclusion: a column filter whose stored list names the values left
// out rather than the ones kept, marked by the column's name in the tab's negatedColumns.
//
// A list can't say which way it reads, so two fixtures settle it by disagreeing.
// NegativeFilterTest01 excludes "Castings", showing Structures alone where a positive filter would
// show Castings alone.  NegativeFilterTest02 excludes nothing, so it's no filter at all, where an
// empty positive list would show nothing.  Category reads "Castings" before ID 22, and
// "Structures" from there on.
//
// The rest cover the menu item that flips a filter between the two forms.  The ticks are the
// values kept either way, so a flip rewrites the stored list as its complement and leaves the
// report showing exactly what it showed before.
[TestClass]
public class NegativeColumnFilterTests : BrowserTest
{
    private const string FilterModuleFixture = "ported/FilterModuleTest01.html";
    private const string FilterActiveColour = "rgb(255, 192, 203)";
    private const string FilterInactiveColour = "rgb(252, 252, 253)";
    private const string ExcludeMenuItem = "#filter-module-exclude-filter";

    private Task<string> CategoriesAsync() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category");

    // The module a column header opens holds that column alone, so Category is added to it.
    private async Task OpenWithCategoryItemAsync()
    {
        await Ren.OpenAsync(FilterModuleFixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    private Task CloseMenuAsync() => Page.Keyboard.PressAsync("Escape");

    [TestMethod("ExclusionFilter_NamingAValue_ShowsEveryOtherValue")]
    public async Task ExclusionFilter_NamingAValue_ShowsEveryOtherValue()
    {
        await Ren.OpenAsync("ported/NegativeFilterTest01.html");

        await Poll(CategoriesAsync).ToBe("Structures");
    }

    [TestMethod("ExclusionFilter_NamingNoValues_IsNoFilterAtAll")]
    public async Task ExclusionFilter_NamingNoValues_IsNoFilterAtAll()
    {
        await Ren.OpenAsync("ported/NegativeFilterTest02.html");

        await Poll(CategoriesAsync).ToBe("Castings,Structures");
    }

    [TestMethod("ExclusionFilter_NamingAValue_ShowsTheValuesItKeepsAsTicked")]
    public async Task ExclusionFilter_NamingAValue_ShowsTheValuesItKeepsAsTicked()
    {
        await Ren.OpenAsync("ported/NegativeFilterTest01.html");
        await Filters.OpenColumnFilterAsync(Ren, "Category");

        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(false);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Structures")).ToBe(true);
    }

    [TestMethod("ExclusionFilter_NamingAValue_ShowsTheColumnAsFiltered")]
    public async Task ExclusionFilter_NamingAValue_ShowsTheColumnAsFiltered()
    {
        await Ren.OpenAsync("ported/NegativeFilterTest01.html");

        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "Category")).ToBe(FilterActiveColour);
    }

    // Excluding nothing restricts nothing, as a positive filter listing every value doesn't.
    [TestMethod("ExclusionFilter_NamingNoValues_ShowsTheColumnAsUnfiltered")]
    public async Task ExclusionFilter_NamingNoValues_ShowsTheColumnAsUnfiltered()
    {
        await Ren.OpenAsync("ported/NegativeFilterTest02.html");

        await Poll(() => Filters.DownArrowBackgroundColourAsync(Ren, "Category")).ToBe(FilterInactiveColour);
    }

    // Saying which way round a filter reads is an act of authoring the report.
    [TestMethod("ExcludeUntickedValues_NotEditingTheReport_IsNotOffered")]
    public async Task ExcludeUntickedValues_NotEditingTheReport_IsNotOffered()
    {
        await OpenWithCategoryItemAsync();

        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Category");
        await Expect(Ren.Root.Locator(ExcludeMenuItem)).ToHaveCountAsync(0);

        await CloseMenuAsync();
        await FilterModule.EnableEditModeAsync(Ren);
        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Category");

        await Expect(Ren.Root.Locator(ExcludeMenuItem)).Not.ToHaveCountAsync(0);
    }

    [TestMethod("ExcludeUntickedValues_Toggled_IsTickedAndLeavesTheReportShowingTheSame")]
    public async Task ExcludeUntickedValues_Toggled_IsTickedAndLeavesTheReportShowingTheSame()
    {
        await OpenWithCategoryItemAsync();
        await FilterModule.ClickOptionAsync(Ren, "Category", "Structures");

        await Poll(CategoriesAsync).ToBe("Castings");

        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");

        Expect(await FilterModule.IsExcludeUntickedValuesTickedAsync(Ren, "Category")).ToBe(true);

        await CloseMenuAsync();

        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(true);
        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Structures")).ToBe(false);
        await Poll(CategoriesAsync).ToBe("Castings");
    }

    [TestMethod("ExcludeUntickedValues_ToggledTwice_LeavesTheFilterAsItStarted")]
    public async Task ExcludeUntickedValues_ToggledTwice_LeavesTheFilterAsItStarted()
    {
        await OpenWithCategoryItemAsync();
        await FilterModule.ClickOptionAsync(Ren, "Category", "Structures");

        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");
        await CloseMenuAsync();
        await FilterModule.ToggleExcludeUntickedValuesAsync(Ren, "Category");

        Expect(await FilterModule.IsExcludeUntickedValuesTickedAsync(Ren, "Category")).ToBe(false);

        await CloseMenuAsync();

        Expect(await FilterModule.IsOptionCheckedAsync(Ren, "Category", "Castings")).ToBe(true);
        await Poll(CategoriesAsync).ToBe("Castings");
    }

    // A grouping level's ticks are its group rows' values, so there's no set of the column's values
    // to complement.
    [TestMethod("ExcludeUntickedValues_FilteringGroups_IsNotOffered")]
    public async Task ExcludeUntickedValues_FilteringGroups_IsNotOffered()
    {
        await Ren.OpenAsync("ported/ColumnFilteringTest08.html");
        await Filters.OpenFilterGroupsAsync(Ren, "Product Code");

        await FilterModule.EnableEditModeAsync(Ren);
        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Product Code");

        await Expect(Ren.Root.Locator("#filter-module-include-when-saving")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(ExcludeMenuItem)).ToHaveCountAsync(0);
    }
}
