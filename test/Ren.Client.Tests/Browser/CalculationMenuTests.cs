namespace Ren.Client.Tests.Browser;

// These tests cover the Calculation submenu: its None option, the binning functions it offers on
// the menu itself, and the Custom option opening the function editor.
[TestClass]
public class CalculationMenuTests : BrowserTest
{
    private const string Fixture = "ported/MultiSelectContextMenuTest01.html";

    private const string CalculationMenuItem = ".qa-ren-calculating-menu-item";

    // The binning entries sit on the Calculation submenu itself, so one shows as soon as it's hovered.
    private const string ZeroOrNotCalculation = "#group-by-column-binning-zero-or-not-calc";

    [TestMethod("CalculationSubmenu_CellRightClicked_ShowsNoneBinningAndCustomOptions")]
    public async Task CalculationSubmenu_CellRightClicked_ShowsNoneBinningAndCustomOptions()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickCellAsync("OrderRevenue", 2);
        await Ren.Root.MouseOverAsync(CalculationMenuItem);

        await Expect(Ren.Root.Locator("#calc-normal")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(ZeroOrNotCalculation)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#calc-custom")).Not.ToHaveCountAsync(0);
    }

    // A binning calculation replaces each group's value with the bin it falls in.
    [TestMethod("CalcBinning_Applied_ChangesDisplayedValue")]
    public async Task CalcBinning_Applied_ChangesDisplayedValue()
    {
        await Ren.OpenAsync(Fixture);

        var originalValue = await Ren.Report.CellTextAsync("OrderRevenue", 2);

        await Ren.Report.ChooseFromCellMenuAsync("OrderRevenue", 2, CalculationMenuItem, ZeroOrNotCalculation);

        await Poll(() => Ren.Report.CellTextAsync("OrderRevenue", 2)).Not.ToBe(originalValue);
    }

    // None is a no-op on a column that has no calculation.
    [TestMethod("CalcNone_Applied_LeavesValueUnchanged")]
    public async Task CalcNone_Applied_LeavesValueUnchanged()
    {
        await Ren.OpenAsync(Fixture);

        var originalValue = await Ren.Report.CellTextAsync("OrderRevenue", 2);

        await Ren.Report.ChooseFromCellMenuAsync("OrderRevenue", 2, CalculationMenuItem, "#calc-normal");
        await Ren.Report.WaitUntilLoadedAsync();

        Expect(await Ren.Report.CellTextAsync("OrderRevenue", 2)).ToBe(originalValue);
    }

    [TestMethod("CalcCustom_Clicked_OpensFunctionEditorWindow")]
    public async Task CalcCustom_Clicked_OpensFunctionEditorWindow()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.ChooseFromCellMenuAsync("OrderRevenue", 2, CalculationMenuItem, "#calc-custom");

        await Expect(Ren.Root.Locator(".ren-calc-function-editor-window")).Not.ToHaveCountAsync(0);
    }

    // The editor highlights JavaScript with Ren's own Prism, which a page's Prism can't replace.
    [TestMethod("CalcCustom_FunctionTyped_IsHighlighted")]
    public async Task CalcCustom_FunctionTyped_IsHighlighted()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.ChooseFromCellMenuAsync("OrderRevenue", 2, CalculationMenuItem, "#calc-custom");

        var editWindow = Ren.Root.Locator(".ren-calc-function-editor-window").First;

        await editWindow.Locator(".ren-function-editor-widget__edit-textarea").FillAsync("return value + 1;");

        await Expect(editWindow.Locator(".ren-function-editor-widget__highlight-pre .token.keyword")).ToHaveTextAsync("return");
    }
}
