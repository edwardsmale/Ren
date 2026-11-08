namespace Ren.Client.Tests.Browser;

// These tests cover the context menu itself rather than what the menu item providers put in it:
// the Ctrl bypass to the browser's menu, closing on a click outside, section headings and
// separators, dragging by the title bar, and ticked toggles.
[TestClass]
public class ContextMenuMechanicsTests : BrowserTest
{
    private const string Fixture = "ported/MultiSelectContextMenuTest01.html";

    private sealed record MenuPosition(double Left, double Top);

    private Task<MenuPosition> GetMenuPositionAsync() => EvaluateAsync<MenuPosition>("""
        () => {

            const menu = document.querySelector(".ren-context-menu");

            return { left: parseFloat(menu.style.left), top: parseFloat(menu.style.top) };
        }
        """);

    // Drags the menu by its title bar with dispatched mouse events.
    private Task DragMenuByTitleBarAsync(int deltaX, int deltaY) => Page.EvaluateAsync("""
        ([x, y]) => {

            const titleBar = document.querySelector(".ren-context-menu .ren-context-menu__title-bar");
            const rect = titleBar.getBoundingClientRect();
            const startX = rect.left + 10;
            const startY = rect.top + 5;

            titleBar.dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true, clientX: startX, clientY: startY })
            );
            document.dispatchEvent(
                new MouseEvent("mousemove", { bubbles: true, clientX: startX + x, clientY: startY + y })
            );
            document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        }
        """, new[] { deltaX, deltaY });

    // Holding Ctrl while right-clicking falls through to the browser's own menu.
    [TestMethod("ContextMenu_CtrlRightClickOnDataGridCell_IsNotShown")]
    public async Task ContextMenu_CtrlRightClickOnDataGridCell_IsNotShown()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2, ctrlKey: true);

        await Expect(Ren.Root.Locator(".ren-context-menu")).ToHaveCountAsync(0);
    }

    [TestMethod("ContextMenu_ClickedOutside_IsHidden")]
    public async Task ContextMenu_ClickedOutside_IsHidden()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2);

        await Expect(Ren.Root.Locator(".ren-context-menu")).Not.ToHaveCountAsync(0);

        // Anything whose class doesn't start with "ren-context-menu" closes it.
        await Ren.Report.ClickCellAsync("OrderCount", 2);

        await Expect(Ren.Root.Locator(".ren-context-menu")).ToHaveCountAsync(0);
    }

    // The cell menu has items from several providers, so it has headings and separators between them.
    [TestMethod("ContextMenu_HasMultipleSections_RendersSectionHeadingsAndSeparators")]
    public async Task ContextMenu_HasMultipleSections_RendersSectionHeadingsAndSeparators()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2);

        await Expect(Ren.Root.Locator(".ren-context-menu__section-heading")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(".ren-context-menu__item--separator")).Not.ToHaveCountAsync(0);
    }

    [TestMethod("ContextMenu_DraggedByTitleBar_MovesWithThePointer")]
    public async Task ContextMenu_DraggedByTitleBar_MovesWithThePointer()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2);

        await Expect(Ren.Root.Locator(".ren-context-menu")).Not.ToHaveCountAsync(0);

        // It's positioned once it's been measured.
        await Poll(() => Page.EvaluateAsync<bool>("""
            () => !Number.isNaN(parseFloat(document.querySelector(".ren-context-menu").style.left))
            """)).ToBe(true);

        var before = await GetMenuPositionAsync();

        await DragMenuByTitleBarAsync(120, 80);

        var after = await GetMenuPositionAsync();

        Expect(after.Left).ToBeGreaterThan(before.Left + 60);
        Expect(after.Top).ToBeGreaterThan(before.Top + 40);
    }

    // OrderCount doesn't sum by default, so once Sum is applied it shows as a ticked toggle.
    [TestMethod("ContextMenu_AggregationOptionApplied_IsRenderedAsCheckedToggle")]
    public async Task ContextMenu_AggregationOptionApplied_IsRenderedAsCheckedToggle()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SelectAggregationTypeAsync("OrderCount", 2, "sum");

        await Ren.Report.RightClickCellAsync("OrderCount", 2);
        await Ren.Root.MouseOverAsync(".qa-ren-aggregation-menu-item");

        await Expect(Ren.Root.Locator(
            ".qa-ren-aggregation-menu-item-sum.ren-context-menu__item--toggle-boolean.ren-is-checked"))
            .Not.ToHaveCountAsync(0);
    }

    [TestMethod("ContextMenu_RightClickedWithoutShift_HidesTechOnlyItems")]
    public async Task ContextMenu_RightClickedWithoutShift_HidesTechOnlyItems()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2);

        await Expect(Ren.Root.Locator(".ren-context-menu")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#windows-menu")).ToHaveCountAsync(0);
    }

    [TestMethod("ContextMenu_RightClickedWithShift_ShowsTechOnlyItemsAndTheirSubmenus")]
    public async Task ContextMenu_RightClickedWithShift_ShowsTechOnlyItemsAndTheirSubmenus()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2, shiftKey: true);

        await Expect(Ren.Root.Locator("#windows-menu")).Not.ToHaveCountAsync(0);

        await Ren.Root.MouseOverAsync("#windows-menu");

        await Expect(Ren.Root.Locator("#json-report-settings")).Not.ToHaveCountAsync(0);
    }
}
