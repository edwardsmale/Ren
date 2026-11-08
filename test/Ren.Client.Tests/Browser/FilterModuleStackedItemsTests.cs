namespace Ren.Client.Tests.Browser;

// These tests cover a scrolling item (Brand, 60 values) stacked beneath a hierarchical one
// (Category) in a module whose items flow in columns.  The module's popup is fitted to its content
// on load, as far as the window's height allows, so the window's height sets the room Brand has.
[TestClass]
public class FilterModuleStackedItemsTests : BrowserTest
{
    private const string Fixture = "filter-module-stacked.html";

    private const int FullScrollBoxHeight = 600;
    private const int FloorScrollBoxHeight = 100;

    private sealed record Layout(double CategoryLeft, double BrandLeft, double ScrollBoxHeight, bool OverflowsDown, bool OverflowsAcross);

    private async Task OpenAtWindowHeightAsync(int height)
    {
        await Page.SetViewportSizeAsync(1920, height);
        await Ren.OpenAsync(Fixture);
    }

    private Task<Layout> MeasureLayoutAsync() => EvaluateAsync<Layout>("""
        () => {

            const panel = document.querySelector(".ren-filter-module");
            const items = panel.querySelectorAll(":scope > .ren-filter-module__item");
            const scrollBox = panel.querySelector(".ren-filter-module__options-scroll");

            return {
                categoryLeft: items[0].getBoundingClientRect().left,
                brandLeft: items[1].getBoundingClientRect().left,
                scrollBoxHeight: scrollBox.offsetHeight,
                overflowsDown: panel.scrollHeight > panel.clientHeight,
                overflowsAcross: panel.scrollWidth > panel.clientWidth
            };
        }
        """);

    [TestMethod("ScrollingItem_RoomForAllItsRows_ShowsThemAllBeneathTheItemAbove")]
    public async Task ScrollingItem_RoomForAllItsRows_ShowsThemAllBeneathTheItemAbove()
    {
        await OpenAtWindowHeightAsync(1080);

        var layout = await MeasureLayoutAsync();

        Expect(layout.BrandLeft).ToBe(layout.CategoryLeft);
        Expect(layout.ScrollBoxHeight).ToBe(FullScrollBoxHeight);
        Expect(layout.OverflowsDown).ToBe(false);
    }

    // Rather than taking a column of its own, out to the side of the popup, or overflowing the panel.
    [TestMethod("ScrollingItem_LessRoomThanItsRows_ShrinksToFitBeneathTheItemAbove")]
    public async Task ScrollingItem_LessRoomThanItsRows_ShrinksToFitBeneathTheItemAbove()
    {
        await OpenAtWindowHeightAsync(800);

        var layout = await MeasureLayoutAsync();

        Expect(layout.BrandLeft).ToBe(layout.CategoryLeft);
        Expect(layout.ScrollBoxHeight).ToBeLessThan(FullScrollBoxHeight);
        Expect(layout.ScrollBoxHeight).ToBeGreaterThan(FloorScrollBoxHeight);
        Expect(layout.OverflowsDown).ToBe(false);
        Expect(layout.OverflowsAcross).ToBe(false);
    }

    [TestMethod("ScrollingItem_NoRoomForItsFloor_TakesAColumnOfItsOwn")]
    public async Task ScrollingItem_NoRoomForItsFloor_TakesAColumnOfItsOwn()
    {
        await OpenAtWindowHeightAsync(420);

        var layout = await MeasureLayoutAsync();

        Expect(layout.BrandLeft).ToBeGreaterThan(layout.CategoryLeft);
        Expect(layout.ScrollBoxHeight).ToBeGreaterThanOrEqual(FloorScrollBoxHeight);
    }
}
