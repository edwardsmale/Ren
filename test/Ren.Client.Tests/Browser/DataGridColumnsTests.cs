namespace Ren.Client.Tests.Browser;

// These tests cover a data grid's column order, set in the settings or by a variation, and
// columns being pressed on and duplicated without errors or losing their grouping or width.
[TestClass]
public class DataGridColumnsTests : BrowserTest
{
    private const string InSettingsOrder = """
        Amount|UpdatedDate|Status|CreatedDate|Email|Name|Id
        £150.00|15/01/2024 14:30:00|Active|01/01/2024 10:00:00|alice@example.com|Alice|1
        £200.00||Inactive|02/01/2024 11:00:00|bob@example.com|Bob|2
        £300.00|10/01/2024 09:00:00|Active|03/01/2024 12:00:00|charlie@example.com|Charlie|3
        £100.00||Pending|04/01/2024 13:00:00|david@example.com|David|4
        £250.00|20/01/2024 16:00:00|Active|05/01/2024 14:00:00|eve@example.com|Eve|5
        £1,000.00||||||
        """;

    private Task ExpectAllTextAsync(string expected) => Poll(async () =>
    {
        await Ren.Report.SelectAllAsync();

        return Tsv(await Ren.Report.SelectedTextAsync());

    }).ToBe(Tsv(expected));

    private async Task<string> ColumnHeadingSelectorAsync(string columnHeading)
    {
        var indexes = await Ren.Report.CellIndexesAsync(columnHeading, 2);

        return ".ren-data-grid__column-heading.ren-c-" + indexes.ColumnIndex;
    }

    private async Task<int> ColumnWidthAsync(string columnHeading) =>
        await Ren.Report.Locator(await ColumnHeadingSelectorAsync(columnHeading)).First
            .EvaluateAsync<int>("element => element.clientWidth");

    private async Task DuplicateColumnAsync(string columnHeading)
    {
        await Ren.Report.RightClickAsync(await ColumnHeadingSelectorAsync(columnHeading));
        await Ren.Root.ClickAsync("#duplicate-column");
        await Ren.WaitUntilLoadedAsync();
    }

    [TestMethod("column order: the columns are in the order the settings give, after a reload too")]
    public async Task TheColumnsAreInTheOrderTheSettingsGiveAfterAReloadToo()
    {
        const string fixture = "ported/DataGridColumnTest01.html";

        await Ren.OpenAsync(fixture);

        await ExpectAllTextAsync(InSettingsOrder);

        await Ren.OpenWithSettingsAsync(fixture, await Ren.SavedSettingsAsync());

        await ExpectAllTextAsync(InSettingsOrder);
    }

    [TestMethod("column order: choosing a variation puts the columns in its order")]
    public async Task ChoosingAVariationPutsTheColumnsInItsOrder()
    {
        await Ren.OpenAsync("ported/DataGridColumnTest02.html");

        await ExpectAllTextAsync(InSettingsOrder);

        // The "Another" variation puts the Id column first.
        await Ren.Report.ClickAsync(".qa-ren-data-grid-variation-link-another");
        await Ren.WaitUntilLoadedAsync();

        await ExpectAllTextAsync("""
            Id|Amount|UpdatedDate|Status|CreatedDate|Email|Name
            1|£150.00|15/01/2024 14:30:00|Active|01/01/2024 10:00:00|alice@example.com|Alice
            2|£200.00||Inactive|02/01/2024 11:00:00|bob@example.com|Bob
            3|£300.00|10/01/2024 09:00:00|Active|03/01/2024 12:00:00|charlie@example.com|Charlie
            4|£100.00||Pending|04/01/2024 13:00:00|david@example.com|David
            5|£250.00|20/01/2024 16:00:00|Active|05/01/2024 14:00:00|eve@example.com|Eve
            |£1,000.00|||||
            """);
    }

    [TestMethod("a second press on a heading before the mouseup doesn't start a drag later")]
    public async Task ASecondPressOnAHeadingBeforeTheMouseupDoesntStartADragLater()
    {
        await Ren.OpenAsync("ported/DataGridColumnTest04.html");

        // A button released outside the browser window sends no mouseup, so the next press on a
        // heading comes while the first is still waiting to become a drag.
        await Ren.Report.Locator(await ColumnHeadingSelectorAsync("Units")).First.EvaluateAsync("""
            heading => {

                const press = () => heading.dispatchEvent(
                    new MouseEvent("mousedown", { bubbles: true, button: 0 })
                );

                press();
                press();
                document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
            }
            """);

        // Past the delay after which a held press becomes a drag.
        await Page.WaitForTimeoutAsync(1000);
    }

    [TestMethod("duplicating a column: before a column grouped by date keeps the date grouping")]
    public async Task DuplicatingBeforeAColumnGroupedByDateKeepsTheDateGrouping()
    {
        await Ren.OpenAsync("ported/DataGridColumnTest05.html");

        await Ren.Report.ChooseFromCellMenuAsync("CreatedOn", 2, "#grouping-menu", "#group-by-column", "#group-by-column-date");
        await Ren.WaitUntilLoadedAsync();

        await DuplicateColumnAsync("Category");
    }

    [TestMethod("duplicating a column: before a resized column keeps its width")]
    public async Task DuplicatingBeforeAResizedColumnKeepsItsWidth()
    {
        await Ren.OpenAsync("ported/DataGridColumnTest06.html");

        var indexes = await Ren.Report.CellIndexesAsync("Units", 2);

        await Page.EvaluateAsync(
            "index => window.Ren.Messages.Requests.qaColumnWidthChange.notify(index, 250)",
            indexes.ColumnIndex);

        // Less the border.
        await Poll(async () => Math.Abs(await ColumnWidthAsync("Units") - 250)).ToBeLessThan(3);
        var widthBefore = await ColumnWidthAsync("Units");

        await DuplicateColumnAsync("Category");

        Expect(await ColumnWidthAsync("Units")).ToBe(widthBefore);
    }
}
