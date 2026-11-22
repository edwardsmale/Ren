namespace Ren.Client.Tests.Browser;

// A menu item chosen with several cells selected applies to every selected column.
[TestClass]
public class MultiSelectContextMenuTests : BrowserTest
{
    // A grid grouped by AccountId whose other columns are all numbers.  Row 2 is a group row.
    private const string Fixture = "ported/MultiSelectContextMenuTest01.html";

    [TestMethod("FormattingMenu_SingleCellSelected_FormatAppliedToSingleColumn")]
    public async Task FormattingMenu_SingleCellSelected_FormatAppliedToSingleColumn()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SetCellFormatAsync("OrderRevenue", 2, "#format-as-currency", "#format-as-currency-no-dp");

        await Poll(() => Ren.Report.CellTextAsync("OrderRevenue", 2)).ToBe("£45");
        await Poll(() => Ren.Report.CellTextAsync("DiscountAmount", 2)).ToBe("£1.50");
    }

    [TestMethod("FormattingMenu_MultipleCellsSelected_FormatAppliedToAllSelectedColumns")]
    public async Task FormattingMenu_MultipleCellsSelected_FormatAppliedToAllSelectedColumns()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SelectCellsAsync("OrderRevenue", 2, "DiscountAmount", 2);
        await Ren.Report.SetCellFormatAsync("OrderRevenue", 2, "#format-as-currency", "#format-as-currency-no-dp");

        await Poll(() => Ren.Report.CellTextAsync("OrderRevenue", 2)).ToBe("£45");
        await Poll(() => Ren.Report.CellTextAsync("DiscountAmount", 2)).ToBe("£2");
    }

    [TestMethod("AggregationMenu_SingleCellSelected_AggregationAppliedToSingleColumn")]
    public async Task AggregationMenu_SingleCellSelected_AggregationAppliedToSingleColumn()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SelectAggregationTypeAsync("OrderCount", 2, "sum");

        await Poll(() => Ren.Report.CellTextAsync("OrderCount", 2)).ToBe("4");
        await Poll(() => Ren.Report.CellTextAsync("OrderLineCount", 2)).ToBe("3.5");
    }

    [TestMethod("AggregationMenu_MultipleCellsSelected_AggregationAppliedToAllSelectedColumns")]
    public async Task AggregationMenu_MultipleCellsSelected_AggregationAppliedToAllSelectedColumns()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SelectCellsAsync("OrderCount", 2, "OrderLineCount", 2);
        await Ren.Report.SelectAggregationTypeAsync("OrderCount", 2, "sum");

        await Poll(() => Ren.Report.CellTextAsync("OrderCount", 2)).ToBe("4");
        await Poll(() => Ren.Report.CellTextAsync("OrderLineCount", 2)).ToBe("7");
    }

    // Right-clicking a submenu item redraws the menu and is meant to reopen whichever submenu was
    // open.  Here that's opened by an item directly below another submenu item ("with respect to"
    // sits below "Aggregation").  As a submenu is drawn offset above its item, working out which to
    // reopen by comparing screen positions would reopen the one above instead.
    [TestMethod("ContextMenu_SubmenuItemRightClicked_ReopensTheSubmenuThatWasOpen")]
    public async Task ContextMenu_SubmenuItemRightClicked_ReopensTheSubmenuThatWasOpen()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2);
        await Ren.Root.MouseOverAsync("#aggregation-with-respect-to-parent-menu");

        await Expect(Ren.Root.Locator(".qa-ren-aggregate-with-respect-to-order-count")).Not.ToHaveCountAsync(0);

        await Ren.Root.RightClickAsync("#aggregation-with-respect-to-parent-menu");

        await Expect(Ren.Root.Locator(".qa-ren-aggregate-with-respect-to-order-count")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(".qa-ren-aggregation-menu-item-sum")).ToHaveCountAsync(0);
    }
}
