namespace Ren.Client.Tests.Browser;

// These tests cover double-clicking a grid row to open it in a row visualiser, and the Row
// visualiser menu.  With no doubleClick setting a row opens in a key/value grid; a group row that
// can be expanded is expanded or collapsed instead, and one that can't stands in for its rows.
//
// The grids group by Category, collapsed, so rows 2 to 5 are groups A to D, and expanding a group
// puts its two products below it: P1 and P2 in A, P3 and P4 in B.
[TestClass]
public class RowVisualiserTests : BrowserTest
{
    // No doubleClick setting.
    private const string KeyValueGridFixture = "ported/RowVisualiserTest01.html";

    // The Category groups can't be expanded.
    private const string PreventedExpansionFixture = "ported/RowVisualiserTest02.html";

    // A doubleClick setting opening another report for the row's Category.
    private const string ReportFixture = "ported/RowVisualiserTest03.html";

    private const string PopupWindow = ".ren-report-popup-window";
    private const string KeyValueGridTable = ".ren-key-value-grid__table";

    private const int GroupARow = 2;
    private const int GroupBRow = 3;

    private async Task DoubleClickCellAsync(string columnHeading, int rowHeading) =>
        await Page.Locator(await Ren.Report.CellSelectorAsync(columnHeading, rowHeading)).DblClickAsync();

    // Reaches the cell even when a popup is over it.
    private async Task DispatchDoubleClickOnCellAsync(string columnHeading, int rowHeading, bool altKey = false) =>
        await Page.Locator(await Ren.Report.CellSelectorAsync(columnHeading, rowHeading))
            .DispatchEventAsync("dblclick", new { bubbles = true, altKey });

    private async Task ShowRowVisualiserMenuAsync(int rowHeading)
    {
        await Ren.Report.RightClickCellAsync("Product", rowHeading);
        await Ren.Root.MouseOverAsync("#row-visualiser");
    }

    private Task ExpectKeyValueGridTextAsync(string[] included, string[] excluded) => Poll(async () =>
    {
        var tables = Ren.Root.Locator(KeyValueGridTable);

        if (await tables.CountAsync() == 0)
        {
            return false;
        }

        var text = await tables.First.InnerTextAsync();

        return included.All(text.Contains) && !excluded.Any(text.Contains);

    }).ToBe(true);

    [TestMethod("Double-clicking: a data row with no doubleClick setting opens a key/value grid of it")]
    public async Task ADataRowWithNoDoubleClickSettingOpensAKeyValueGridOfIt()
    {
        await Ren.OpenAsync(KeyValueGridFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        // P2's row.
        await DoubleClickCellAsync("Product", 4);

        await ExpectKeyValueGridTextAsync(new[] { "P2", "30" }, new[] { "P1" });
    }

    [TestMethod("Double-clicking: a group row that can be expanded toggles it instead of opening it")]
    public async Task AGroupRowThatCanBeExpandedTogglesItInsteadOfOpeningIt()
    {
        await Ren.OpenAsync(KeyValueGridFixture);

        await DoubleClickCellAsync("Sales", GroupARow);

        await Poll(() => Ren.Report.CellTextAsync("Product", 3)).ToBe("P1");
        await Expect(Ren.Root.Locator(PopupWindow)).ToHaveCountAsync(0);

        await DoubleClickCellAsync("Sales", GroupARow);

        await Poll(() => Ren.Report.CellTextAsync("Product", 3)).Not.ToBe("P1");
    }

    [TestMethod("Double-clicking: a data row with a popup already open opens another")]
    public async Task ADataRowWithAPopupAlreadyOpenOpensAnother()
    {
        await Ren.OpenAsync(KeyValueGridFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        await DoubleClickCellAsync("Product", 3);
        await Expect(Ren.Root.Locator(PopupWindow)).ToHaveCountAsync(1);

        await DispatchDoubleClickOnCellAsync("Product", 4);
        await Expect(Ren.Root.Locator(PopupWindow)).ToHaveCountAsync(2);
    }

    [TestMethod("Double-clicking: a data row with Alt, with a popup already open, reuses the popup")]
    public async Task ADataRowWithAltWithAPopupAlreadyOpenReusesThePopup()
    {
        await Ren.OpenAsync(KeyValueGridFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        await DoubleClickCellAsync("Product", 4);
        await ExpectKeyValueGridTextAsync(new[] { "P2" }, new[] { "P1" });

        await DispatchDoubleClickOnCellAsync("Product", 3, altKey: true);

        await ExpectKeyValueGridTextAsync(new[] { "P1" }, new[] { "P2" });
        await Expect(Ren.Root.Locator(PopupWindow)).ToHaveCountAsync(1);
    }

    [TestMethod("Double-clicking: a group row that can't be expanded opens a key/value grid of it")]
    public async Task AGroupRowThatCantBeExpandedOpensAKeyValueGridOfIt()
    {
        await Ren.OpenAsync(PreventedExpansionFixture);

        await DoubleClickCellAsync("Sales", GroupARow);

        // Group A's total of P1's 10 and P2's 30.
        await ExpectKeyValueGridTextAsync(new[] { "40" }, Array.Empty<string>());
    }

    [TestMethod("The Row visualiser menu item: isn't offered on a group row that can be expanded")]
    public async Task IsntOfferedOnAGroupRowThatCanBeExpanded()
    {
        await Ren.OpenAsync(KeyValueGridFixture);

        await Ren.Report.RightClickCellAsync("Sales", GroupARow);

        await Expect(Ren.Root.Locator("#row-visualiser")).ToHaveCountAsync(0);
    }

    [TestMethod("The Row visualiser menu item: with no doubleClick setting offers only a key/value grid")]
    public async Task WithNoDoubleClickSettingOffersOnlyAKeyValueGrid()
    {
        await Ren.OpenAsync(KeyValueGridFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        await Ren.Report.RightClickCellAsync("Sales", 3);
        await Ren.Root.MouseOverAsync("#row-visualiser");

        await Expect(Ren.Root.Locator("#row-visualiser-0")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#row-visualiser-1")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#row-visualiser-default")).ToHaveCountAsync(0);
    }

    // The right-click has to select P1's row before the menu judges the selection.
    [TestMethod("The Row visualiser menu item: is offered on a data row with a group row selected")]
    public async Task IsOfferedOnADataRowWithAGroupRowSelected()
    {
        await Ren.OpenAsync(KeyValueGridFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);
        await Ren.Report.ClickCellAsync("Sales", GroupARow);

        await Ren.Report.RightClickCellAsync("Sales", 3);

        await Expect(Ren.Root.Locator("#row-visualiser")).ToHaveCountAsync(1);
    }

    [TestMethod("The Row visualiser menu item: with a key/value grid chosen opens one rather than the report")]
    public async Task WithAKeyValueGridChosenOpensOneRatherThanTheReport()
    {
        await Ren.OpenAsync(ReportFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupBRow);

        await ShowRowVisualiserMenuAsync(4);
        await Ren.Root.ClickAsync("#row-visualiser-0");

        await ExpectKeyValueGridTextAsync(new[] { "P3", "50" }, Array.Empty<string>());
    }

    [TestMethod("The Row visualiser menu item: set to default to a key/value grid makes double-clicking open one")]
    public async Task SetToDefaultToAKeyValueGridMakesDoubleClickingOpenOne()
    {
        await Ren.OpenAsync(ReportFixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupBRow);

        await ShowRowVisualiserMenuAsync(4);
        await Ren.Root.MouseOverAsync("#row-visualiser-default");
        await Ren.Root.ClickAsync("#row-visualiser-default-0");

        // P4's row.
        await DoubleClickCellAsync("Product", 5);

        await ExpectKeyValueGridTextAsync(new[] { "P4" }, Array.Empty<string>());
        await Expect(Ren.Root.Locator(PopupWindow)).ToHaveCountAsync(1);
    }
}
