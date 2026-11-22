namespace Ren.Client.Tests.Browser;

// These tests cover selecting a data grid's cells, rows and columns by clicking and dragging, with
// Ctrl and Shift, and the text copying the selection gives.
[TestClass]
public class CellSelectionTests : BrowserTest
{
    // Six people, unsorted.
    private const string Fixture = "ported/CellSelectionTests.html";

    private async Task SortByNameAsync()
    {
        await Ren.Report.ChooseFromCellMenuAsync("Name", 2, "#sort-ascending");
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task OpenSortedAsync()
    {
        await Ren.OpenAsync(Fixture);
        await SortByNameAsync();
    }

    private async Task<(float X, float Y)> CentreOfAsync(string selector)
    {
        var box = (await Page.Locator(selector).First.BoundingBoxAsync())!;

        return (box.X + box.Width / 2, box.Y + box.Height / 2);
    }

    // Drags with the mouse from one element to another, holding Ctrl when asked.
    private async Task DragAsync(string startSelector, string endSelector, bool ctrlKey)
    {
        var start = await CentreOfAsync(startSelector);
        var end = await CentreOfAsync(endSelector);

        if (ctrlKey)
        {
            await Page.Keyboard.DownAsync("Control");
        }

        await Page.Mouse.MoveAsync(start.X, start.Y);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(end.X, end.Y);
        await Page.Mouse.UpAsync();

        if (ctrlKey)
        {
            await Page.Keyboard.UpAsync("Control");
        }
    }

    private async Task DragCellsAsync(string startColumn, int startRow, string endColumn, int endRow, bool ctrlKey = false) =>
        await DragAsync(
            await Ren.Report.CellSelectorAsync(startColumn, startRow),
            await Ren.Report.CellSelectorAsync(endColumn, endRow),
            ctrlKey);

    private async Task<string> RowHeadingSelectorAsync(int rowHeading)
    {
        var indexes = await Ren.Report.CellIndexesAsync(null, rowHeading);

        return $".ren-data-grid__row-heading.ren-r-{indexes.RowIndex}";
    }

    private async Task DragRowHeadingsAsync(int startRow, int endRow, bool ctrlKey = false) =>
        await DragAsync(await RowHeadingSelectorAsync(startRow), await RowHeadingSelectorAsync(endRow), ctrlKey);

    // Clicks a cell by dispatching a mousedown and a mouseup at it, with any keys held.
    private async Task ClickCellAsync(string columnHeading, int rowHeading, bool ctrlKey = false, bool shiftKey = false)
    {
        var element = Page.Locator(await Ren.Report.CellSelectorAsync(columnHeading, rowHeading));
        var init = new { bubbles = true, ctrlKey, shiftKey };

        await element.DispatchEventAsync("mousedown", init);
        await element.DispatchEventAsync("mouseup", init);
    }

    private Task ExpectSelectedTextAsync(RenContext context, string expected) =>
        Poll(async () => Tsv(await context.SelectedTextAsync())).ToBe(Tsv(expected));

    [TestMethod("whole rows and columns: selecting all copies every cell")]
    public async Task SelectingAllCopiesEveryCell()
    {
        await OpenSortedAsync();

        await Ren.Report.SelectAllAsync();

        await ExpectSelectedTextAsync(Ren.Report, """
            Id|Name|Nickname|RegisteredOn|LastPostedOn|Age|Birthday|TotalSpend|AvgMargin
            4|Alice|Al|03/01/2024 13:34:23||23|09/12/2023|£512.53|-2.56
            6|Bob||15/11/2023 10:26:24|05/01/2024 23:00:05|48|14/11/2023|-£100.00|45.85
            3|Charlotte|Charlie|23/09/2023 12:04:49|23/09/2023 12:10:02|21|11/12/2023||5
            5|David|Dave|23/09/2023 12:04:50|23/09/2023 12:06:12|16|16/12/2023|£512.54|
            2|Eve||20/09/2023 17:27:35||42|20/11/2023|£256.24|56.24
            1|Frank|Big Frank|01/01/2024 00:00:00|01/01/2024 00:01:06|56|06/11/2023|£1,024.50|56.23
            |||||206||£2,205.81|160.76
            """);
    }

    [TestMethod("whole rows and columns: selecting a column copies just that column")]
    public async Task SelectingAColumnCopiesJustThatColumn()
    {
        await OpenSortedAsync();

        await Ren.Report.SelectColumnsAsync("Nickname");

        await ExpectSelectedTextAsync(Ren.Report, "Nickname\nAl\n\nCharlie\nDave\n\nBig Frank");
    }

    [TestMethod("whole rows and columns: Ctrl-clicking more columns copies them all")]
    public async Task CtrlClickingMoreColumnsCopiesThemAll()
    {
        await OpenSortedAsync();

        await Ren.Report.SelectColumnsAsync("RegisteredOn", "LastPostedOn", "Age");

        await ExpectSelectedTextAsync(Ren.Report, """
            RegisteredOn|LastPostedOn|Age
            03/01/2024 13:34:23||23
            15/11/2023 10:26:24|05/01/2024 23:00:05|48
            23/09/2023 12:04:49|23/09/2023 12:10:02|21
            23/09/2023 12:04:50|23/09/2023 12:06:12|16
            20/09/2023 17:27:35||42
            01/01/2024 00:00:00|01/01/2024 00:01:06|56
            ||206
            """);
    }

    [TestMethod("whole rows and columns: selecting a row copies just that row")]
    public async Task SelectingARowCopiesJustThatRow()
    {
        await OpenSortedAsync();

        await Ren.Report.SelectRowsAsync(2);

        await ExpectSelectedTextAsync(Ren.Report, "4|Alice|Al|03/01/2024 13:34:23||23|09/12/2023|£512.53|-2.56");
    }

    [TestMethod("whole rows and columns: Ctrl-clicking more rows copies them in grid order")]
    public async Task CtrlClickingMoreRowsCopiesThemInGridOrder()
    {
        await OpenSortedAsync();

        await Ren.Report.SelectRowsAsync(6, 5);

        await ExpectSelectedTextAsync(Ren.Report, """
            5|David|Dave|23/09/2023 12:04:50|23/09/2023 12:06:12|16|16/12/2023|£512.54|
            2|Eve||20/09/2023 17:27:35||42|20/11/2023|£256.24|56.24
            """);
    }

    [TestMethod("whole rows and columns: dragging up the row headings selects the rows between")]
    public async Task DraggingUpTheRowHeadingsSelectsTheRowsBetween()
    {
        await OpenSortedAsync();

        await DragRowHeadingsAsync(6, 3);

        await ExpectSelectedTextAsync(Ren.Report, """
            6|Bob||15/11/2023 10:26:24|05/01/2024 23:00:05|48|14/11/2023|-£100.00|45.85
            3|Charlotte|Charlie|23/09/2023 12:04:49|23/09/2023 12:10:02|21|11/12/2023||5
            5|David|Dave|23/09/2023 12:04:50|23/09/2023 12:06:12|16|16/12/2023|£512.54|
            2|Eve||20/09/2023 17:27:35||42|20/11/2023|£256.24|56.24
            """);
    }

    [TestMethod("whole rows and columns: Ctrl-clicking a selected row heading deselects it")]
    public async Task CtrlClickingASelectedRowHeadingDeselectsIt()
    {
        await OpenSortedAsync();

        await DragRowHeadingsAsync(6, 3);
        await DragRowHeadingsAsync(4, 4, true);

        await ExpectSelectedTextAsync(Ren.Report, """
            6|Bob||15/11/2023 10:26:24|05/01/2024 23:00:05|48|14/11/2023|-£100.00|45.85
            5|David|Dave|23/09/2023 12:04:50|23/09/2023 12:06:12|16|16/12/2023|£512.54|
            2|Eve||20/09/2023 17:27:35||42|20/11/2023|£256.24|56.24
            """);
    }

    [TestMethod("cells: clicking a cell selects just that cell")]
    public async Task ClickingACellSelectsJustThatCell()
    {
        await OpenSortedAsync();

        await ClickCellAsync("Name", 2);
        await ExpectSelectedTextAsync(Ren.Report, "Alice");

        await DragCellsAsync("Name", 5, "Name", 5);
        await ExpectSelectedTextAsync(Ren.Report, "David");

        await ClickCellAsync("RegisteredOn", 2);
        await ExpectSelectedTextAsync(Ren.Report, "03/01/2024 13:34:23");

        // The column between the two is copied blank.
        await ClickCellAsync("Age", 2, ctrlKey: true);
        await ExpectSelectedTextAsync(Ren.Report, "03/01/2024 13:34:23||23");
    }

    [TestMethod("cells: Shift-clicking selects the rectangle from the last cell")]
    public async Task ShiftClickingSelectsTheRectangleFromTheLastCell()
    {
        await OpenSortedAsync();

        await ClickCellAsync("RegisteredOn", 3);
        await ClickCellAsync("Age", 5, shiftKey: true);

        await ExpectSelectedTextAsync(Ren.Report, """
            15/11/2023 10:26:24|05/01/2024 23:00:05|48
            23/09/2023 12:04:49|23/09/2023 12:10:02|21
            23/09/2023 12:04:50|23/09/2023 12:06:12|16
            """);
    }

    [TestMethod("cells: dragging selects the rectangle between")]
    public async Task DraggingSelectsTheRectangleBetween()
    {
        await OpenSortedAsync();

        await DragCellsAsync("Name", 2, "LastPostedOn", 5);

        await ExpectSelectedTextAsync(Ren.Report, """
            Alice|Al|03/01/2024 13:34:23|
            Bob||15/11/2023 10:26:24|05/01/2024 23:00:05
            Charlotte|Charlie|23/09/2023 12:04:49|23/09/2023 12:10:02
            David|Dave|23/09/2023 12:04:50|23/09/2023 12:06:12
            """);
    }

    [TestMethod("cells: Ctrl-dragging adds more rectangles, in any direction")]
    public async Task CtrlDraggingAddsMoreRectanglesInAnyDirection()
    {
        await OpenSortedAsync();

        await DragCellsAsync("Name", 3, "Nickname", 5);
        await DragCellsAsync("LastPostedOn", 5, "Birthday", 7, true);
        await DragCellsAsync("AvgMargin", 3, "TotalSpend", 2, true);

        await ExpectSelectedTextAsync(Ren.Report, """
            ||||||£512.53|-2.56
            Bob||||||-£100.00|45.85
            Charlotte|Charlie||||||
            David|Dave||23/09/2023 12:06:12|16|16/12/2023||
            ||||42|20/11/2023||
            |||01/01/2024 00:01:06|56|06/11/2023
            """);
    }

    [TestMethod("cells: a column shown from the show/hide window can be selected")]
    public async Task AColumnShownFromTheShowHideWindowCanBeSelected()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.ClickAsync(".qa-ren-show-hide-columns-link");
        await Ren.Root.Locator(".qa-ren-show-hide-columns-list-item--Count").First
            .DispatchEventAsync("mousedown", new { bubbles = true });
        await Ren.WaitUntilLoadedAsync();
        await Ren.Root.ClickAsync(".qa-ren-show-hide-columns-window .qa-ren-popup-window-close-button");

        await DragCellsAsync("Count", 3, "Count", 5);

        await ExpectSelectedTextAsync(Ren.Report, "1\n1\n1");
    }

    [TestMethod("cells: selecting all includes the rows not yet rendered")]
    public async Task SelectingAllIncludesTheRowsNotYetRendered()
    {
        await Ren.OpenAsync("ported/LotsOfRowsTest01.html");

        await Ren.Report.SelectAllAsync();

        await Poll(async () =>
        {
            var lines = (await Ren.Report.SelectedTextAsync()).Replace("\r", "").Split('\n');

            if (lines.Length < 200) return false;

            var lastRow = lines[^3].Split('\t');

            // The second column is formatted, by a cell-link format function.
            return lastRow.Length >= 4 && lastRow.Take(4).All(value => value.Length > 0);

        }).ToBe(true);
    }

    [TestMethod("cells: a column hidden in the SQL but shown by settings can be selected")]
    public async Task AColumnHiddenInTheSqlButShownBySettingsCanBeSelected()
    {
        await Ren.OpenAsync("ported/RowMouseEventsTest01.html");

        await DragCellsAsync("CreatedOn", 2, "Days Active", 5);

        await ExpectSelectedTextAsync(Ren.Report, """
            12/01/2024|118
            12/01/2024|118
            12/01/2024|118
            12/01/2024|118
            """);
    }

    [TestMethod("right-clicking: inside the selection keeps it")]
    public async Task RightClickingInsideTheSelectionKeepsIt()
    {
        await Ren.OpenAsync(Fixture);

        await DragCellsAsync("Name", 2, "RegisteredOn", 5);
        await Ren.Report.RightClickCellAsync("Name", 3);

        await ExpectSelectedTextAsync(Ren.Report, """
            Frank|Big Frank|01/01/2024 00:00:00
            Eve||20/09/2023 17:27:35
            Charlotte|Charlie|23/09/2023 12:04:49
            Alice|Al|03/01/2024 13:34:23
            """);
    }

    [TestMethod("right-clicking: outside the selection selects the cell instead")]
    public async Task RightClickingOutsideTheSelectionSelectsTheCellInstead()
    {
        await Ren.OpenAsync(Fixture);

        await DragCellsAsync("Name", 2, "RegisteredOn", 5);
        await Ren.Report.RightClickCellAsync("TotalSpend", 3);

        await ExpectSelectedTextAsync(Ren.Report, "£256.24");
    }

    // Both build in the same tick, which once wired the grid's mouse handlers up twice, so a
    // Ctrl-click toggled the column on and straight back off.
    [TestMethod("a filter module sharing the grid's data doesn't stop Ctrl-click adding a column")]
    public async Task AFilterModuleSharingTheGridsDataDoesntStopCtrlClickAddingAColumn()
    {
        await Ren.OpenAsync("ported/DoubleRepaintTest01.html");

        var grid = Ren.Grid(0);

        await grid.SelectColumnsAsync("Name", "Age");

        await ExpectSelectedTextAsync(grid, """
            Name|Age
            Alice|23
            Bob|48
            Charlotte|21
            |92
            """);
    }
}
