namespace Ren.Client.Tests.Browser;

// These tests cover the "Filter groups..." popup, a filter module pointed at the
// second-to-outermost grouping.  The grid is grouped by Product Code alone, so that's the
// level filtered, the totals row being the outermost.
[TestClass]
public class ColumnFilteringGroupRowsTests : BrowserTest
{
    private const string Fixture = "ported/ColumnFilteringTest08.html";

    private const string FilterActiveColour = "rgb(255, 192, 203)";

    private const string FilterInactiveColour = "rgb(252, 252, 253)";

    private Task OpenFilterGroupsAsync() => Filters.OpenFilterGroupsAsync(Ren, "Product Code");

    private Task<string[]> ProductCodesAsync() => Filters.ColumnDistinctValuesAsync(Ren, "Product Code");

    private Task ClosePopupAsync() => Ren.Root.ClickAsync(".ren-report-popup-window__close-button");

    [TestMethod("GroupRowsFilter_CheckboxUntickedThenReticked_FiltersAndRestoresGroup")]
    public async Task GroupRowsFilter_CheckboxUntickedThenReticked_FiltersAndRestoresGroup()
    {
        await Ren.OpenAsync(Fixture);
        await OpenFilterGroupsAsync();

        await Filters.ClickFilterCheckboxAsync(Ren, "UC61416");

        await Poll(ProductCodesAsync).Not.ToContain("UC61416");

        await OpenFilterGroupsAsync();
        await Filters.ClickFilterCheckboxAsync(Ren, "UC61416");

        await Poll(ProductCodesAsync).ToContain("UC61416");
    }

    [TestMethod("GroupRowsFilter_SelectAllCheckboxClickedTwice_HidesAndRestoresAllGroups")]
    public async Task GroupRowsFilter_SelectAllCheckboxClickedTwice_HidesAndRestoresAllGroups()
    {
        await Ren.OpenAsync(Fixture);
        await OpenFilterGroupsAsync();

        await Filters.ClickFilterAllCheckboxAsync(Ren);

        await Poll(ProductCodesAsync).ToEqual(Array.Empty<string>());

        await OpenFilterGroupsAsync();
        await Filters.ClickFilterAllCheckboxAsync(Ren);

        await Poll(ProductCodesAsync).ToContain("UC61416");
    }

    [TestMethod("GroupRowsFilter_ClearColumnFilterMenuItemClicked_RemovesFilter")]
    public async Task GroupRowsFilter_ClearColumnFilterMenuItemClicked_RemovesFilter()
    {
        await Ren.OpenAsync(Fixture);
        await OpenFilterGroupsAsync();
        await Filters.ClickFilterCheckboxAsync(Ren, "UC61416");
        await ClosePopupAsync();

        await Poll(ProductCodesAsync).Not.ToContain("UC61416");

        await Filters.ClearColumnFilterAsync(Ren, "Product Code");

        await Poll(ProductCodesAsync).ToContain("UC61416");
    }

    [TestMethod("GroupRowsFilter_FilterAppliedThenCleared_DownArrowTurnsPinkAndReverts")]
    public async Task GroupRowsFilter_FilterAppliedThenCleared_DownArrowTurnsPinkAndReverts()
    {
        Task<string> DownArrowColourAsync() => Filters.DownArrowBackgroundColourAsync(Ren, "Product Code");

        await Ren.OpenAsync(Fixture);

        await Poll(DownArrowColourAsync).ToBe(FilterInactiveColour);

        await OpenFilterGroupsAsync();
        await Filters.ClickFilterCheckboxAsync(Ren, "UC61416");
        await ClosePopupAsync();

        await Poll(DownArrowColourAsync).ToBe(FilterActiveColour);

        await Filters.ClearColumnFilterAsync(Ren, "Product Code");

        await Poll(DownArrowColourAsync).ToBe(FilterInactiveColour);
    }
}
