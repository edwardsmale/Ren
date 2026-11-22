using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the two tech menu items that write SQL from what's selected in a data grid:
// "Generate IN predicate", which lists one column's selected values, and "Generate INSERT
// statement", which writes the selected rows out as a table value constructor.  Both show their SQL
// in the same popup, read here through its textarea.
//
// The grid's rows read Frank, Eve, Charlotte, Alice, David and Bob, so row heading 2 is Frank and 3
// is Eve.  Eve and Bob have no nickname.  The query selects from an unaliased temporary table, so
// no column says which table it came from and the INSERT names the TableName placeholder.
[TestClass]
public class DataGridSqlPopupTests : BrowserTest
{
    private const string Fixture = "ported/CellSelectionTest01.html";

    private const string SqlPopup = ".qa-ren-data-grid-sql-popup";
    private const string SqlTextArea = ".qa-ren-data-grid-sql-popup-sql";
    private const string ExtraButton = ".qa-ren-data-grid-sql-popup-extra";
    private const string CloseButton = ".qa-ren-data-grid-sql-popup-close";

    private const string SelectedRowHeadingBackground = "rgb(210, 210, 210)";

    private Task<string> SqlTextAsync() => Ren.Root.Locator(SqlTextArea).First.InputValueAsync();

    private Task WaitForSqlAsync() =>
        Ren.Root.Locator(SqlTextArea).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

    // The SQL items are tech-only, so their menus are opened with Shift held.
    private async Task OpenInPredicateForColumnAsync(string columnHeading)
    {
        await Ren.Report.SelectColumnsAsync(columnHeading);
        await Ren.Report.RightClickAsync($".ren-data-grid__column-heading[title='{columnHeading}']", shiftKey: true);
        await Ren.Root.ClickAsync("#generate-in-predicate");
        await WaitForSqlAsync();
    }

    // The menu is opened on a cell inside the selection, which keeps it rather than reducing it to
    // the cell clicked.  A drag just after regrouping can miss its end cell, so it's retried until
    // the end row's heading is shaded as alongside the selection.
    private async Task OpenInPredicateForCellsAsync(string columnHeading, int startRowHeading, int endRowHeading)
    {
        var indexes = await Ren.Report.CellIndexesAsync(null, endRowHeading);
        var endRowHeadingCell = Ren.Report.Locator($".ren-data-grid__row-heading.ren-r-{indexes.RowIndex}").First;

        await ToPassAsync(async () =>
        {
            await Ren.Report.SelectCellsAsync(columnHeading, startRowHeading, columnHeading, endRowHeading);

            // Off the grid, so the end row isn't shaded as hovered instead.
            await Page.Mouse.MoveAsync(0, 0);

            Expect(await endRowHeadingCell.EvaluateAsync<string>("cell => getComputedStyle(cell).backgroundColor"))
                .ToBe(SelectedRowHeadingBackground);
        });

        await Ren.Report.RightClickCellAsync(columnHeading, startRowHeading, shiftKey: true);
        await Ren.Root.ClickAsync("#generate-in-predicate");
        await WaitForSqlAsync();
    }

    // A dispatched contextmenu doesn't select the row it lands on as a real right-click does, so
    // the rows are selected first.
    private async Task OpenInsertStatementForRowsAsync(params int[] rowHeadings)
    {
        await Ren.Report.SelectRowsAsync(rowHeadings);

        var indexes = await Ren.Report.CellIndexesAsync(null, rowHeadings[0]);

        await Ren.Report.RightClickAsync($".ren-data-grid__row-heading.ren-r-{indexes.RowIndex}", shiftKey: true);
        await Ren.Root.ClickAsync("#generate-insert-statement");
        await WaitForSqlAsync();
    }

    private async Task GroupByColumnAsync(string columnHeading, params string[] periodSelectors)
    {
        await Ren.Report.ChooseFromCellMenuAsync(
            columnHeading, 2, new[] { "#grouping-menu", "#group-by-column" }.Concat(periodSelectors).ToArray());
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task HideColumnAsync(string columnHeading)
    {
        await Ren.Report.ClickAsync(".qa-ren-show-hide-columns-link");
        await Ren.Root.Locator(".qa-ren-show-hide-columns-list-item--" + columnHeading.Replace(" ", "")).First
            .DispatchEventAsync("mousedown", new { bubbles = true });
        await Ren.WaitUntilLoadedAsync();
        await Ren.Root.ClickAsync(".qa-ren-show-hide-columns-window .qa-ren-popup-window-close-button");
    }

    // Short enough to fit the wrapping width, so it's written on one line.
    [TestMethod("generating an IN predicate: for a whole string column lists every value on one line")]
    public async Task ForAWholeStringColumnListsEveryValueOnOneLine()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForColumnAsync("Name");

        Expect(await SqlTextAsync()).ToBe("[Name] IN ('Frank', 'Eve', 'Charlotte', 'Alice', 'David', 'Bob')");
    }

    [TestMethod("generating an IN predicate: for a whole number column writes its values unquoted")]
    public async Task ForAWholeNumberColumnWritesItsValuesUnquoted()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForColumnAsync("Age");

        Expect(await SqlTextAsync()).ToBe("[Age] IN (56, 42, 21, 23, 16, 48)");
    }

    // SQL Server matches NULL to nothing, so listing it would only mislead.
    [TestMethod("generating an IN predicate: for a column holding nulls leaves them out")]
    public async Task ForAColumnHoldingNullsLeavesThemOut()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForColumnAsync("Nickname");

        Expect(await SqlTextAsync()).ToBe("[Nickname] IN ('Big Frank', 'Charlie', 'Al', 'Dave')");
    }

    [TestMethod("generating an IN predicate: for a range of cells lists only their rows")]
    public async Task ForARangeOfCellsListsOnlyTheirRows()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForCellsAsync("Name", 2, 3);

        Expect(await SqlTextAsync()).ToBe("[Name] IN ('Frank', 'Eve')");
    }

    // Six timestamps are too wide for one line, so the list is wrapped between the brackets.
    // Frank registered at midnight, which is written as a date alone.
    [TestMethod("generating an IN predicate: for a date and time column wraps the list and drops midnight")]
    public async Task ForADateAndTimeColumnWrapsTheListAndDropsMidnight()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForColumnAsync("RegisteredOn");

        var sql = await SqlTextAsync();
        var lines = sql.Split('\n');

        Expect(lines.Length).ToBeGreaterThan(2);
        Expect(lines[0]).ToBe("[RegisteredOn] IN (");
        Expect(lines[^1]).ToBe(")");
        Expect(lines.Where(line => line.Length > 100).ToArray()).ToEqual(Array.Empty<string>());
        Expect(sql).ToContain("'2024-01-01',");
        Expect(sql).ToContain("'2023-09-20 17:27:35'");
    }

    // The values written are those the grid holds rather than shows, so "£1,024.50" is written as
    // a bare number rather than a string.  Charlotte has spent nothing, so is left out.
    [TestMethod("generating an IN predicate: for a currency column writes bare numbers")]
    public async Task ForACurrencyColumnWritesBareNumbers()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForColumnAsync("TotalSpend");

        var sql = await SqlTextAsync();

        Expect(sql.StartsWith("[TotalSpend] IN (")).ToBe(true);
        Expect(sql).Not.ToContain("'");
        Expect(sql).Not.ToContain("£");
        Expect(sql).ToContain("-100");
        Expect(sql).Not.ToContain("NULL");
    }

    // Eve has never posted, and an empty IN list isn't SQL that runs.
    [TestMethod("generating an IN predicate: for only empty cells says there's nothing to match on")]
    public async Task ForOnlyEmptyCellsSaysTheresNothingToMatchOn()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForCellsAsync("LastPostedOn", 3, 3);

        Expect(await SqlTextAsync()).ToBe("-- None of the selected cells holds a value.");
    }

    // Grouped by name, row headings 3 and 4 are Bob's and Charlotte's collapsed group rows.
    [TestMethod("generating an IN predicate: for group row cells lists their group values")]
    public async Task ForGroupRowCellsListsTheirGroupValues()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("Name");

        await OpenInPredicateForCellsAsync("Name", 3, 4);

        Expect(await SqlTextAsync()).ToBe("[Name] IN ('Bob', 'Charlotte')");
    }

    // Grouped by quarter, row headings 2 to 4 are Q3 2023 (Eve, Charlotte and David), Q4 2023
    // (Bob) and Q1 2024 (Frank and Alice), each group row holding the date its quarter starts on.
    [TestMethod("generating an IN predicate: for binned group row cells lists their bins")]
    public async Task ForBinnedGroupRowCellsListsTheirBins()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("RegisteredOn", "#group-by-column-quarter");

        await OpenInPredicateForCellsAsync("RegisteredOn", 2, 3);

        Expect(await SqlTextAsync()).ToBe("[RegisteredOn] IN ('2023-07-01', '2023-10-01')");
    }

    // The ages sum to 79, 48 and 79, and the second 79 is listed once.
    [TestMethod("generating an IN predicate: for summed group row cells lists their sums")]
    public async Task ForSummedGroupRowCellsListsTheirSums()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("RegisteredOn", "#group-by-column-quarter");

        await OpenInPredicateForCellsAsync("Age", 2, 4);

        Expect(await SqlTextAsync()).ToBe("[Age] IN (79, 48)");
    }

    // A name shows on a group row only where its rows share one, which only Bob's Q4 2023 does.
    // The others show blank, which is left out rather than listed as ''.
    [TestMethod("generating an IN predicate: for single value group row cells lists only shared values")]
    public async Task ForSingleValueGroupRowCellsListsOnlySharedValues()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("RegisteredOn", "#group-by-column-quarter");

        await OpenInPredicateForCellsAsync("Name", 2, 4);

        Expect(await SqlTextAsync()).ToBe("[Name] IN ('Bob')");
    }

    // Q1 2024's group row shows an expand button, its rows' dates differing, which is markup
    // rather than a value.  Pressing on an expand button starts no selection, so it starts on
    // Bob's.
    [TestMethod("generating an IN predicate: for expand icon group row cells leaves the buttons out")]
    public async Task ForExpandIconGroupRowCellsLeavesTheButtonsOut()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("RegisteredOn", "#group-by-column-quarter");

        await OpenInPredicateForCellsAsync("LastPostedOn", 3, 4);

        Expect(await SqlTextAsync()).ToBe("[LastPostedOn] IN ('2024-01-05 23:00:05')");
    }

    [TestMethod("generating an IN predicate: isn't offered for several columns")]
    public async Task IsntOfferedForSeveralColumns()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.SelectColumnsAsync("Name");
        await Ren.Report.RightClickCellAsync("Name", 2, shiftKey: true);
        await Expect(Ren.Root.Locator("#generate-in-predicate").First).ToBeAttachedAsync();

        await Page.Keyboard.PressAsync("Escape");
        await Ren.Report.SelectColumnsAsync("Name", "Age");
        await Ren.Report.RightClickCellAsync("Name", 2, shiftKey: true);

        await Expect(Ren.Root.Locator("#generate-in-predicate")).ToHaveCountAsync(0);
    }

    [TestMethod("generating an IN predicate: shows no extra button")]
    public async Task ShowsNoExtraButton()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInPredicateForColumnAsync("Name");

        await Expect(Ren.Root.Locator(ExtraButton).First).ToBeHiddenAsync();
    }

    // The textarea has the focus and keeps the grid's keystrokes off what's typed in it.
    [TestMethod("the SQL popup: closes on Escape")]
    public async Task ClosesOnEscape()
    {
        await Ren.OpenAsync(Fixture);
        await OpenInPredicateForColumnAsync("Name");

        await Page.Keyboard.PressAsync("Escape");

        await Expect(Ren.Root.Locator(SqlPopup)).ToHaveCountAsync(0);
    }

    [TestMethod("the SQL popup: closes from its Close button")]
    public async Task ClosesFromItsCloseButton()
    {
        await Ren.OpenAsync(Fixture);
        await OpenInPredicateForColumnAsync("Name");

        await Ren.Root.ClickAsync(CloseButton);

        await Expect(Ren.Root.Locator(SqlPopup)).ToHaveCountAsync(0);
    }

    [TestMethod("generating an INSERT statement: for one row writes its values")]
    public async Task ForOneRowWritesItsValues()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInsertStatementForRowsAsync(2);

        var sql = await SqlTextAsync();

        Expect(sql.StartsWith("INSERT INTO TableName")).ToBe(true);
        Expect(sql).ToContain("[Id], [Name], [Nickname]");
        Expect(sql).ToContain("'Frank', 'Big Frank'");
        Expect(sql.EndsWith(");")).ToBe(true);
    }

    // Unlike an IN list, an INSERT has to give every row's column a value, so Eve's is NULL.
    [TestMethod("generating an INSERT statement: for several rows writes a tuple for each")]
    public async Task ForSeveralRowsWritesATupleForEach()
    {
        await Ren.OpenAsync(Fixture);

        await OpenInsertStatementForRowsAsync(2, 3);

        var sql = await SqlTextAsync();

        Expect(sql).ToContain("'Frank', 'Big Frank'");
        Expect(sql).ToContain("'Eve', NULL,");
        Expect(sql).ToContain("    ),");
    }

    // The statement is written again rather than cut about as text, so its column list and values
    // still agree, and the button then has nothing left to do.
    [TestMethod("generating an INSERT statement: without its ID column rewrites it and hides the button")]
    public async Task WithoutItsIdColumnRewritesItAndHidesTheButton()
    {
        await Ren.OpenAsync(Fixture);
        await OpenInsertStatementForRowsAsync(2);
        await Expect(Ren.Root.Locator(ExtraButton).First).ToHaveTextAsync("Remove Id column");
        Expect(await SqlTextAsync()).ToContain("[Id]");

        await Ren.Root.ClickAsync(ExtraButton);

        await Poll(async () => (await SqlTextAsync()).Contains("[Id]")).ToBe(false);
        Expect(await SqlTextAsync()).ToContain("'Frank', 'Big Frank'");
        await Expect(Ren.Root.Locator(ExtraButton).First).ToBeHiddenAsync();
    }

    [TestMethod("generating an INSERT statement: leaves a hidden column out")]
    public async Task LeavesAHiddenColumnOut()
    {
        await Ren.OpenAsync(Fixture);
        await HideColumnAsync("Nickname");

        await OpenInsertStatementForRowsAsync(2);

        var sql = await SqlTextAsync();

        Expect(sql).Not.ToContain("[Nickname]");
        Expect(sql).Not.ToContain("'Big Frank'");
        Expect(sql).ToContain("'Frank'");
    }

    // The button's offered against the columns inserted rather than the table's.
    [TestMethod("generating an INSERT statement: with its ID column hidden offers no button to remove it")]
    public async Task WithItsIdColumnHiddenOffersNoButtonToRemoveIt()
    {
        await Ren.OpenAsync(Fixture);
        await HideColumnAsync("Id");

        await OpenInsertStatementForRowsAsync(2);

        Expect(await SqlTextAsync()).Not.ToContain("[Id]");
        await Expect(Ren.Root.Locator(ExtraButton).First).ToBeHiddenAsync();
    }
}
