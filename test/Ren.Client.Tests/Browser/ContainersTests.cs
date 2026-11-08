using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover visualisation containers: their children rendered in order to any depth,
// saved with their container and order, added, moved, removed and dragged between containers.
[TestClass]
public class ContainersTests : BrowserTest
{
    private const string Fixture = "containers.html";

    private const string InitialLayout = "Outer[O1, Inner[I1, I2], O3]";

    // Gets the page's containers and their children as text, such as "Outer[O1, Inner[I1], O3]".
    private Task<string> LayoutAsync() => Page.EvaluateAsync<string>("""
        () => {

            const describe = (element) => {

                const tileId = element.querySelector(":scope > .ren-task-tile .js-ren-task-tile-id");

                if (tileId) return tileId.textContent;

                const container = element.querySelector(":scope > .test-container");

                if (!container) return "(unrendered)";

                const heading = container.querySelector(":scope > .test-container__heading").textContent;
                const children = container.querySelector(":scope > .test-container__children").children;

                return heading + "[" + Array.from(children).map(describe).join(", ") + "]";
            };

            const pageElement = document.querySelector(".ren-web-report-page");

            return Array.from(pageElement.children)
                .map(describe)
                .join(", ");
        }
        """);

    // Gets each saved visualisation as its task ID or visualisationId, container and order.
    private Task<string[]> SavedAsync() => Page.EvaluateAsync<string[]>("""
        () => window.Ren.ReportSerializer
            .getReportSettingsObject(false)
            .visualisations
            .map(visualisation => [
                visualisation.taskId || visualisation.visualisationId,
                visualisation.containerVisualisationId || null,
                visualisation.containerOrder ?? null
            ].join(" "))
            .sort()
        """);

    private async Task ExpectSavedToIncludeAsync(params string[] expected)
    {
        var saved = await SavedAsync();

        foreach (var item in expected)
        {
            Expect(saved).ToContain(item);
        }
    }

    // Right-clicks the given locator and gets the IDs of the menu's items.
    private async Task<string[]> OpenMenuAsync(ILocator locator, float? timeout = null)
    {
        await locator.ClickAsync(new() { Button = MouseButton.Right });

        var items = Page.Locator(".ren-context-menu__item--clickable");

        await Expect(items.First).ToBeVisibleAsync(new() { Timeout = timeout });

        return await items.EvaluateAllAsync<string[]>("elements => elements.map(element => element.id)");
    }

    private ILocator Tile(string taskId) => Page.Locator(".ren-task-tile",
        new() { Has = Page.Locator(".js-ren-task-tile-id", new() { HasText = taskId }) });

    private ILocator Heading(string heading) =>
        Page.Locator(".test-container__heading", new() { HasText = heading });

    // Holds the mouse button down on the given locator until its child is picked up, and moves it
    // to the given point, in steps so each one is seen.
    private async Task PickUpAndMoveAsync(ILocator locator, float toX, float toY)
    {
        var box = (await locator.BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(box.X + 4, box.Y + 4);
        await Page.Mouse.DownAsync();
        await Expect(Page.Locator(".ren-container-child--dragging")).ToHaveCountAsync(1);
        await Page.Mouse.MoveAsync(toX, toY, new() { Steps = 10 });
    }

    private async Task OpenFixtureAsync(string fixture = Fixture)
    {
        await Ren.OpenAsync(fixture);
        await Poll(LayoutAsync).ToBe(InitialLayout);
    }

    [TestMethod("children are rendered in their containers, in order, to any depth")]
    public async Task ChildrenAreRenderedInTheirContainersInOrderToAnyDepth()
    {
        await OpenFixtureAsync();
    }

    [TestMethod("children are saved with their container and order")]
    public async Task ChildrenAreSavedWithTheirContainerAndOrder()
    {
        await OpenFixtureAsync();

        Expect(await SavedAsync()).ToEqual(new[]
        {
            "I1 inner 1", "I2 inner 2", "O1 outer 1", "O3 outer 3", "inner outer 2", "outer  "
        });
    }

    [TestMethod("destroying a container destroys its children")]
    public async Task DestroyingAContainerDestroysItsChildren()
    {
        await OpenFixtureAsync();

        var remaining = await Page.EvaluateAsync<string[]>("""
            () => {

                const Ren = window.Ren;
                const inner = Ren.VisualisationContainers.getVisualisationById("inner");

                Ren.VisualisationCollection.destroyVisualisation(inner);

                return Ren.VisualisationCollection.getVisualisations()
                    .map(visualisation => visualisation.taskId || visualisation.visualisationId)
                    .sort();
            }
            """);

        Expect(remaining).ToEqual(new[] { "O1", "O3", "outer" });
        Expect(await LayoutAsync()).ToBe("Outer[O1, O3]");
    }

    [TestMethod("a container's menu adds a child at its end, offered by the innermost")]
    public async Task AContainersMenuAddsAChildAtItsEndOfferedByTheInnermost()
    {
        await OpenFixtureAsync();

        var ids = await OpenMenuAsync(Heading("Inner"));

        Expect(ids.Count(id => id == "container-add-task-tile")).ToBe(1);
        Expect(ids).ToContain("container-add-test-container");

        await Page.Locator("#container-add-task-tile").ClickAsync();

        await Poll(LayoutAsync).ToBe("Outer[O1, Inner[I1, I2, New], O3]");
        Expect(await SavedAsync()).ToContain("New inner 3");
    }

    [TestMethod("a child's menu moves it, offering only the ways it can go")]
    public async Task AChildsMenuMovesItOfferingOnlyTheWaysItCanGo()
    {
        await OpenFixtureAsync();

        var ids = await OpenMenuAsync(Tile("I2"));

        Expect(ids).ToContain("container-child-move-back");
        Expect(ids).Not.ToContain("container-child-move-forward");
        await Expect(Page.Locator("#container-child-move-back")).ToHaveTextAsync("Move up");

        await Page.Locator("#container-child-move-back").ClickAsync();

        await Poll(LayoutAsync).ToBe("Outer[O1, Inner[I2, I1], O3]");
        await ExpectSavedToIncludeAsync("I1 inner 2", "I2 inner 1");
    }

    [TestMethod("a child's menu removes it, renumbering the rest")]
    public async Task AChildsMenuRemovesItRenumberingTheRest()
    {
        await OpenFixtureAsync();

        var ids = await OpenMenuAsync(Tile("O1"));

        Expect(ids).Not.ToContain("task-tile-remove");
        await Expect(Page.Locator("#container-child-remove")).ToHaveTextAsync("Remove task...");

        await Page.Locator("#container-child-remove").ClickAsync();
        await Page.Locator(".js-ren-popup-confirm-yes").ClickAsync();

        await Poll(LayoutAsync).ToBe("Outer[Inner[I1, I2], O3]");
        await ExpectSavedToIncludeAsync("inner outer 1", "O3 outer 2");
    }

    [TestMethod("a child is dragged into another container")]
    public async Task AChildIsDraggedIntoAnotherContainer()
    {
        await OpenFixtureAsync();

        var target = (await Tile("O3").BoundingBoxAsync())!;

        await PickUpAndMoveAsync(Tile("I1"), target.X + target.Width / 2, target.Y + target.Height * 0.9f);

        await Page.Mouse.UpAsync();

        await Poll(LayoutAsync).ToBe("Outer[O1, Inner[I2], O3, I1]");
        await Expect(Page.Locator(".ren-container-child--dragging")).ToHaveCountAsync(0);
        await ExpectSavedToIncludeAsync("I1 outer 4", "I2 inner 1", "O3 outer 3");
    }

    [TestMethod("Escape puts a dragged child back")]
    public async Task EscapePutsADraggedChildBack()
    {
        await OpenFixtureAsync();

        var target = (await Tile("O1").BoundingBoxAsync())!;

        await PickUpAndMoveAsync(Tile("I2"), target.X + 10, target.Y + 2);
        await Poll(LayoutAsync).ToBe("Outer[I2, O1, Inner[I1], O3]");

        await Page.Keyboard.PressAsync("Escape");
        await Page.Mouse.UpAsync();

        await Poll(LayoutAsync).ToBe(InitialLayout);
        await ExpectSavedToIncludeAsync("I2 inner 2", "O1 outer 1");
    }

    [TestMethod("a downloaded report offers no editing of children")]
    public async Task ADownloadedReportOffersNoEditingOfChildren()
    {
        await OpenFixtureAsync(Fixture + "#downloaded");

        string[] ids;

        try
        {
            ids = await OpenMenuAsync(Tile("I1"));
        }
        catch (Exception)
        {
            ids = Array.Empty<string>();
        }

        Expect(ids.Where(id => id.StartsWith("container-")).ToArray()).ToEqual(Array.Empty<string>());
    }

    [TestMethod("children keep their containers and order once saved and reloaded")]
    public async Task ChildrenKeepTheirContainersAndOrderOnceSavedAndReloaded()
    {
        await OpenFixtureAsync();

        await Tile("I2").ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#container-child-move-back").ClickAsync();
        await Heading("Outer").ClickAsync(new() { Button = MouseButton.Right });
        await Page.Locator("#container-add-task-tile").ClickAsync();
        await Poll(LayoutAsync).ToBe("Outer[O1, Inner[I2, I1], O3, New]");

        await Ren.OpenWithSettingsAsync(Fixture, await Ren.SavedSettingsAsync());

        await Poll(LayoutAsync).ToBe("Outer[O1, Inner[I2, I1], O3, New]");
    }
}
