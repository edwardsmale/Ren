using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover cell and row style functions, and group rows mixing the backgrounds of their
// data rows.
//
// The grid groups by Category, collapsed, so rows 2 to 5 are groups A to D.  The data rows' Sales
// cells are red over 20 and blue from 8 to 20, and the data row of product P4 is green throughout.
// The groups' Sales cells mix their data rows':
//
//     A - blue (P1, 10) and red (P2, 30), mixing to purple.
//     B - red (P3, 50) and none (P4, 5), which counts as transparent, so half red.
//     C - red and red, though its own style of yellow for a total over 60 wins.
//     D - red and red, all one colour.
[TestClass]
public class CellStyleFunctionTests : BrowserTest
{
    private const string Fixture = "ported/StyleFunctionTest01.html";

    private const string Red = "rgb(255, 0, 0)";
    private const string Blue = "rgb(0, 0, 255)";
    private const string Green = "rgb(0, 128, 0)";
    private const string Purple = "rgb(128, 0, 128)";
    private const string HalfRed = "rgba(255, 0, 0, 0.5)";
    private const string Yellow = "rgb(255, 255, 0)";
    private const string HoveredRowBackground = "rgb(255, 239, 254)";

    private const int GroupARow = 2;
    private const int GroupBRow = 3;
    private const int GroupCRow = 4;
    private const int GroupDRow = 5;

    private async Task<ILocator> CellAsync(string columnHeading, int rowHeading) =>
        Page.Locator(await Ren.Report.CellSelectorAsync(columnHeading, rowHeading)).First;

    private async Task<string> CellStyleAsync(string columnHeading, int rowHeading, string propertyName) =>
        await (await CellAsync(columnHeading, rowHeading)).EvaluateAsync<string>(
            "(element, name) => window.getComputedStyle(element).getPropertyValue(name)", propertyName);

    private Task ExpectCellStyleAsync(string columnHeading, int rowHeading, string propertyName, string expected) =>
        Poll(() => CellStyleAsync(columnHeading, rowHeading, propertyName)).ToBe(expected);

    private async Task ShowStylingMenuAsync(int rowHeading)
    {
        await Ren.Report.RightClickCellAsync("Sales", rowHeading);
        await Ren.Root.MouseOverAsync(".qa-ren-styling-menu-item");
    }

    private async Task ToggleMixDataRowsBackgroundsAsync(int rowHeading)
    {
        await ShowStylingMenuAsync(rowHeading);
        await Ren.Root.ClickAsync("#style-merge-data-row-backgrounds");
    }

    [TestMethod("A cell style function: styles each data row's cell by its value")]
    public async Task ACellStyleFunctionStylesEachDataRowsCellByItsValue()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        await ExpectCellStyleAsync("Sales", 3, "background-color", Blue);
        await ExpectCellStyleAsync("Sales", 4, "background-color", Red);
        await Expect(await CellAsync("Sales", 4)).ToHaveClassAsync(new Regex("(^| )ren-data-grid__cell--styled( |$)"));
        await Expect(await CellAsync("Sales", 4)).ToHaveClassAsync(new Regex("ren-data-grid__cell--styled-background"));
    }

    // P3 is row 4 and P4 row 5.
    [TestMethod("A row style function: styles every cell in the matching row")]
    public async Task ARowStyleFunctionStylesEveryCellInTheMatchingRow()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupBRow);

        await ExpectCellStyleAsync("Product", 5, "color", Green);
        await ExpectCellStyleAsync("Sales", 5, "color", Green);
        Expect(await CellStyleAsync("Product", 4, "color")).Not.ToBe(Green);
    }

    // P4's Sales of 5 gets no background from its cell style function, so the row's text colour
    // shows through, while P3's cell style gives its background alone.
    [TestMethod("A row style function: is merged under a cell's own style")]
    public async Task ARowStyleFunctionIsMergedUnderACellsOwnStyle()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupBRow);

        await ExpectCellStyleAsync("Sales", 5, "color", Green);
        await ExpectCellStyleAsync("Sales", 4, "background-color", Red);
    }

    [TestMethod]
    [DataRow(GroupARow, Purple, DisplayName = "A group row mixing its data rows' backgrounds: shows an even mix of two colours")]
    [DataRow(GroupBRow, HalfRed, DisplayName = "A group row mixing its data rows' backgrounds: counts a data row without a background as transparent")]
    [DataRow(GroupDRow, Red, DisplayName = "A group row mixing its data rows' backgrounds: shows the one colour its data rows share")]
    [DataRow(GroupCRow, Yellow, DisplayName = "A group row mixing its data rows' backgrounds: shows its own style instead when it has one")]
    public async Task AGroupRowMixingItsDataRowsBackgrounds(int rowHeading, string expected)
    {
        await Ren.OpenAsync(Fixture);

        await ExpectCellStyleAsync("Sales", rowHeading, "background-color", expected);
    }

    [TestMethod("A group row mixing its data rows' backgrounds: leaves out a data row that's filtered out")]
    public async Task AGroupRowMixingItsDataRowsBackgroundsLeavesOutADataRowThatsFilteredOut()
    {
        await Ren.OpenAsync(Fixture);

        await Filters.OpenColumnFilterAsync(Ren, "Product");
        await Filters.ClickFilterCheckboxAsync(Ren, "P2");
        await Ren.Root.ClickAsync(".ren-report-popup-window__close-button");

        // Only P1's blue is left in group A.
        await ExpectCellStyleAsync("Sales", GroupARow, "background-color", Blue);
    }

    // Group B's cell is used for the menu, as right-clicking selects the cell clicked.
    [TestMethod("The Mix data rows' backgrounds menu item: toggled off and on removes and restores the mix")]
    public async Task TheMixMenuItemToggledOffAndOnRemovesAndRestoresTheMix()
    {
        await Ren.OpenAsync(Fixture);
        await ExpectCellStyleAsync("Sales", GroupARow, "background-color", Purple);

        await ToggleMixDataRowsBackgroundsAsync(GroupBRow);

        await Poll(() => CellStyleAsync("Sales", GroupARow, "background-color")).Not.ToBe(Purple);

        await ToggleMixDataRowsBackgroundsAsync(GroupBRow);

        await ExpectCellStyleAsync("Sales", GroupARow, "background-color", Purple);
    }

    [TestMethod("The Mix data rows' backgrounds menu item: isn't offered on a data row's cell")]
    public async Task TheMixMenuItemIsntOfferedOnADataRowsCell()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        await ShowStylingMenuAsync(3);

        await Expect(Ren.Root.Locator("#style-cell")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#style-merge-data-row-backgrounds")).ToHaveCountAsync(0);
    }

    // P2's row, whose Sales cell is red and whose Product cell is unstyled.
    [TestMethod("A hovered row: keeps its cells' styled backgrounds")]
    public async Task AHoveredRowKeepsItsCellsStyledBackgrounds()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupARow);

        await (await CellAsync("Product", 4)).HoverAsync();

        await ExpectCellStyleAsync("Product", 4, "background-color", HoveredRowBackground);
        await ExpectCellStyleAsync("Sales", 4, "background-color", Red);
    }

    [TestMethod("A hovered row: keeps its cells' styled text colours")]
    public async Task AHoveredRowKeepsItsCellsStyledTextColours()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.ExpandCollapseGroupAsync(GroupBRow);

        await (await CellAsync("Product", 5)).HoverAsync();

        await ExpectCellStyleAsync("Product", 5, "background-color", HoveredRowBackground);
        await ExpectCellStyleAsync("Product", 5, "color", Green);
    }
}
