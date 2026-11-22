using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the grip on a filter module item's right edge, dragged to hold the item at a
// fixed width, which is kept in the item's column settings.  Double-clicking the grip gives the
// width back to the item's content.
[TestClass]
public class FilterModuleItemWidthTests : BrowserTest
{
    private const string Fixture = "filter-module-stacked.html";
    private const string BrandItemSelector = ".ren-filter-module > .ren-filter-module__item[data-reorder-key='Brand']";

    private ILocator BrandItem => Page.Locator(BrandItemSelector);

    private async Task<double> ItemWidthAsync() => (await BrandItem.BoundingBoxAsync())!.Width;

    private async Task DragGripByAsync(float distance)
    {
        var grip = (await BrandItem.Locator(".qa-ren-filter-module-item-resize").BoundingBoxAsync())!;

        var x = grip.X + grip.Width / 2;
        var y = grip.Y + grip.Height / 2;

        await Page.Mouse.MoveAsync(x, y);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(x + distance / 2, y);
        await Page.Mouse.MoveAsync(x + distance, y);
        await Page.Mouse.UpAsync();
    }

    private async Task<double?> SavedItemWidthAsync(string column)
    {
        var saved = await Ren.SavedSettingsAsync();

        return saved?["visualisations"]?[0]?["columnOverrides"]?[column]?["itemWidth"]?.GetValue<double>();
    }

    private async Task OpenAtFullHeightAsync()
    {
        await Page.SetViewportSizeAsync(1920, 1080);
        await Ren.OpenAsync(Fixture);
    }

    [TestMethod("DragGrip_Rightwards_WidensTheItemAndKeepsItsWidth")]
    public async Task DragGrip_Rightwards_WidensTheItemAndKeepsItsWidth()
    {
        await OpenAtFullHeightAsync();

        var startWidth = await ItemWidthAsync();

        await DragGripByAsync(80);

        await Poll(ItemWidthAsync).ToBeCloseTo(startWidth + 80, 0);
        Expect(await SavedItemWidthAsync("Brand")).ToBeCloseTo(startWidth + 80, 0);
    }

    // The rows give way to the narrower width rather than holding the item out at their own.
    [TestMethod("DragGrip_Leftwards_NarrowsTheItemBelowItsContent")]
    public async Task DragGrip_Leftwards_NarrowsTheItemBelowItsContent()
    {
        await OpenAtFullHeightAsync();

        var startWidth = await ItemWidthAsync();

        await DragGripByAsync(-40);

        await Poll(ItemWidthAsync).ToBeCloseTo(startWidth - 40, 0);
    }

    [TestMethod("KeptWidth_ReportReloaded_SizesTheItemToIt")]
    public async Task KeptWidth_ReportReloaded_SizesTheItemToIt()
    {
        await OpenAtFullHeightAsync();

        await DragGripByAsync(80);

        var draggedWidth = await ItemWidthAsync();
        var saved = await Ren.SavedSettingsAsync();

        await Ren.OpenWithSettingsAsync(Fixture, saved);

        await Poll(ItemWidthAsync).ToBeCloseTo(draggedWidth, 0);
    }

    [TestMethod("DoubleClickGrip_WidthKept_GivesTheWidthBackToTheContent")]
    public async Task DoubleClickGrip_WidthKept_GivesTheWidthBackToTheContent()
    {
        await OpenAtFullHeightAsync();

        var startWidth = await ItemWidthAsync();

        await DragGripByAsync(80);
        await BrandItem.Locator(".qa-ren-filter-module-item-resize").DblClickAsync();

        await Poll(ItemWidthAsync).ToBeCloseTo(startWidth, 0);
        Expect(await SavedItemWidthAsync("Brand")).ToBeNull();
    }

    // The popup is widened to follow, rather than the panel scrolling sideways.
    [TestMethod("DragGrip_PastThePopupsEdge_WidensThePopupToFit")]
    public async Task DragGrip_PastThePopupsEdge_WidensThePopupToFit()
    {
        await OpenAtFullHeightAsync();

        var startWidth = await ItemWidthAsync();

        await DragGripByAsync(250);

        await Poll(ItemWidthAsync).ToBeCloseTo(startWidth + 250, 0);

        var overflowsAcross = await Page.EvaluateAsync<bool>("""
            () => {

                const panel = document.querySelector(".ren-filter-module");

                return panel.scrollWidth > panel.clientWidth;
            }
            """);

        Expect(overflowsAcross).ToBe(false);
    }

    // A hierarchy's width is kept on its leaf column, as its other column-level settings are.
    [TestMethod("DragGrip_HierarchicalItem_KeepsTheWidthOnItsLeafColumn")]
    public async Task DragGrip_HierarchicalItem_KeepsTheWidthOnItsLeafColumn()
    {
        await OpenAtFullHeightAsync();

        var hierarchyItem = Page.Locator(".ren-filter-module > .ren-filter-module__item[data-reorder-key='Subcategory']");

        var startWidth = (await hierarchyItem.BoundingBoxAsync())!.Width;
        var grip = (await hierarchyItem.Locator(".qa-ren-filter-module-item-resize").BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(grip.X + grip.Width / 2, grip.Y + 20);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(grip.X + grip.Width / 2 - 60, grip.Y + 20);
        await Page.Mouse.UpAsync();

        await Poll(async () => (await hierarchyItem.BoundingBoxAsync())!.Width).ToBeCloseTo(startWidth - 60, 0);

        Expect(await SavedItemWidthAsync("Subcategory")).ToBeCloseTo(startWidth - 60, 0);
    }
}
