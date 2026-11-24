using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover a tile group, which lays out link tiles under a heading, and the link tiles in
// it: their links and images, editing and adding them from their menus, and dragging them about.
[TestClass]
public class TileGroupsTests : BrowserTest
{
    // Gets the titles of the tiles in the group, in order.
    private async Task<string[]> GetTitlesAsync() =>
        (await Page.Locator(".ren-tile-group__tiles .ren-link-tile__title").AllTextContentsAsync()).ToArray();

    // Gets each saved link tile as its title, order and, when set, URL.
    private Task<string[]> GetSavedTilesAsync() => Page.EvaluateAsync<string[]>("""
        () => window.Ren.ReportSerializer
            .getReportSettingsObject(false)
            .visualisations
            .filter(visualisation => visualisation.visualisationTypeName === "LinkTile")
            .map(visualisation => [visualisation.title, visualisation.containerOrder, visualisation.url]
                .filter(value => value !== undefined)
                .join(" "))
            .sort()
        """);

    private ILocator GetTile(string title) => Page.Locator(".ren-link-tile", new() { HasText = title });

    [TestMethod("a tile group shows its heading and its link tiles in order")]
    public async Task ATileGroupShowsItsHeadingAndItsLinkTilesInOrder()
    {
        await Ren.OpenAsync("tile-groups.html");

        await Expect(Page.Locator(".ren-tile-group__title")).ToHaveTextAsync("Merchandising");
        await Expect(Page.Locator(".ren-tile-group__subheading")).ToHaveTextAsync("reports");
        await Poll(GetTitlesAsync).ToEqual(new[] { "Category Sales", "Brand Sales" });

        var first = (await GetTile("Category Sales").BoundingBoxAsync())!;
        var second = (await GetTile("Brand Sales").BoundingBoxAsync())!;

        Expect((int)Math.Round(second.Width, MidpointRounding.AwayFromZero)).ToBe(12 * 16);
        Expect(second.Y).ToBe(first.Y);
        Expect(second.X).ToBeGreaterThan(first.X + first.Width);
    }

    [TestMethod("a link tile's link and image go through the host's URLs")]
    public async Task ALinkTilesLinkAndImageGoThroughTheHostsUrls()
    {
        await Ren.OpenAsync("tile-groups.html");

        var tile = GetTile("Category Sales");

        await Expect(tile.Locator(".ren-link-tile__link"))
            .ToHaveAttributeAsync("href", "https://reports.example/CategorySales");
        await Expect(tile.Locator(".ren-link-tile__image"))
            .ToHaveAttributeAsync("src", "https://images.example/category-sales.png");
        await Expect(tile.Locator(".ren-link-tile__image"))
            .ToHaveCSSAsync("filter", "hue-rotate(90deg)");

        await Expect(GetTile("Brand Sales").Locator(".ren-link-tile__image")).ToBeHiddenAsync();
    }

    [TestMethod("a link tile's parts are edited from its menu and saved")]
    public async Task ALinkTilesPartsAreEditedFromItsMenuAndSaved()
    {
        await Ren.OpenAsync("tile-groups.html");

        await GetTile("Brand Sales").ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#link-tile-edit-url").ClickAsync();

        var input = Page.Locator(".qa-ren-text-editor-input");

        await input.FillAsync("/BrandSalesByMonth");
        await input.PressAsync("Enter");

        await Expect(GetTile("Brand Sales").Locator(".ren-link-tile__link"))
            .ToHaveAttributeAsync("href", "https://reports.example/BrandSalesByMonth");
        await Poll(GetSavedTilesAsync).ToContain("Brand Sales 2 /BrandSalesByMonth");
    }

    [TestMethod("a tile group adds link tiles from its menu")]
    public async Task ATileGroupAddsLinkTilesFromItsMenu()
    {
        await Ren.OpenAsync("tile-groups.html");
        await Poll(GetTitlesAsync).ToEqual(new[] { "Category Sales", "Brand Sales" });

        await Page.Locator(".ren-tile-group__tiles").ClickAsync(new() { Button = MouseButton.Right, Position = new() { X = 5, Y = 5 } });
        await Page.Locator("#container-add-link-tile").ClickAsync();

        await Poll(GetTitlesAsync).ToEqual(new[] { "Category Sales", "Brand Sales", "New link" });
        Expect(await GetSavedTilesAsync()).ToContain("New link 3");
    }

    // Gets the titles of the group's archived tiles, in order.
    private async Task<string[]> GetArchivedTitlesAsync() =>
        (await Page.Locator(".ren-tile-group__archived-tiles .ren-link-tile__title").AllTextContentsAsync()).ToArray();

    // Gets each saved link tile as its title and, when set, its slot.
    private Task<string[]> GetSavedSlotsAsync() => Page.EvaluateAsync<string[]>("""
        () => window.Ren.ReportSerializer
            .getReportSettingsObject(false)
            .visualisations
            .filter(visualisation => visualisation.visualisationTypeName === "LinkTile")
            .map(visualisation => [visualisation.title, visualisation.containerSlot]
                .filter(value => value !== undefined)
                .join(" "))
            .sort()
        """);

    private async Task ToggleArchivedAsync(string title)
    {
        await GetTile(title).ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#link-tile-archive").ClickAsync();
    }

    [TestMethod("a link tile is archived and restored from its menu")]
    public async Task ALinkTileIsArchivedAndRestoredFromItsMenu()
    {
        await Ren.OpenAsync("tile-groups.html");
        await Poll(GetTitlesAsync).ToEqual(new[] { "Category Sales", "Brand Sales" });

        var archived = Page.Locator(".ren-tile-group__archived");

        await Expect(archived).ToBeHiddenAsync();

        await ToggleArchivedAsync("Category Sales");

        await Poll(GetTitlesAsync).ToEqual(new[] { "Brand Sales" });
        await Poll(GetArchivedTitlesAsync).ToEqual(new[] { "Category Sales" });
        await Expect(archived).ToBeVisibleAsync();
        await Expect(GetTile("Category Sales")).Not.ToBeInViewportAsync();
        Expect(await GetSavedSlotsAsync()).ToEqual(new[] { "Brand Sales", "Category Sales archived" });

        await Page.Locator(".ren-tile-group__archived-title-row").ClickAsync();
        await Expect(GetTile("Category Sales")).ToBeInViewportAsync();

        await GetTile("Category Sales").ClickAsync(new() { Button = MouseButton.Right });
        await Expect(Page.Locator("#link-tile-archive")).ToHaveClassAsync(new Regex("ren-is-checked"));
        await Page.Locator("#link-tile-archive").ClickAsync();

        await Poll(GetTitlesAsync).ToEqual(new[] { "Brand Sales", "Category Sales" });
        await Expect(archived).ToBeHiddenAsync();
        Expect(await GetSavedSlotsAsync()).ToEqual(new[] { "Brand Sales", "Category Sales" });
    }

    // Takes the mouse down on the first tile and across to the far side of the second.
    private async Task<LocatorBoundingBoxResult> DragCategorySalesOverBrandSalesAsync()
    {
        var from = (await GetTile("Category Sales").BoundingBoxAsync())!;
        var to = (await GetTile("Brand Sales").BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(from.X + 10, from.Y + 10);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-container-child--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(to.X + to.Width * 0.9f, to.Y + to.Height / 2, new() { Steps = 10 });

        return from;
    }

    [TestMethod("a link tile is dragged by its link without following it")]
    public async Task ALinkTileIsDraggedByItsLinkWithoutFollowingIt()
    {
        await Ren.OpenAsync("tile-groups.html");
        await Poll(GetTitlesAsync).ToEqual(new[] { "Category Sales", "Brand Sales" });

        await DragCategorySalesOverBrandSalesAsync();
        await Page.Mouse.UpAsync();

        await Poll(GetTitlesAsync).ToEqual(new[] { "Brand Sales", "Category Sales" });
        Expect(Page.Url).ToContain("tile-groups.html");
        Expect(await GetSavedTilesAsync())
            .ToEqual(new[] { "Brand Sales 1 /BrandSales", "Category Sales 2 /CategorySales" });
    }

    [TestMethod("tiles slide to their new places as a dragged tile moves")]
    public async Task TilesSlideToTheirNewPlacesAsADraggedTileMoves()
    {
        await Ren.OpenAsync("tile-groups.html");
        await Poll(GetTitlesAsync).ToEqual(new[] { "Category Sales", "Brand Sales" });

        var brandSales = Page.Locator(".ren-visualisation--link-tile", new() { HasText = "Brand Sales" });

        // The class is only there for the length of the slide, which can be over before a check made
        // once the mouse has finished moving, so its being added is recorded as it happens.
        await brandSales.EvaluateAsync("""
            element => {
                window.renTestShifted = false;
                new MutationObserver(() => {
                    if (element.classList.contains("ren-container-child--shifting")) {
                        window.renTestShifted = true;
                    }
                }).observe(element, { attributes: true, attributeFilter: ["class"] });
            }
            """);

        var from = await DragCategorySalesOverBrandSalesAsync();

        await Poll(() => Page.EvaluateAsync<bool>("() => window.renTestShifted")).ToBe(true);
        await Expect(brandSales).Not.ToHaveClassAsync(new Regex("ren-container-child--shifting"));

        var settled = (await GetTile("Brand Sales").BoundingBoxAsync())!;

        Expect(settled.X).ToBe(from.X);

        await Page.Mouse.UpAsync();
    }
}
