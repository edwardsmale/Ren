namespace Ren.Client.Tests.Browser;

// These tests cover sorting by length, from a column heading's menu and from a cell's "Advanced
// sort" submenu, and that the sort survives saving and reopening.
[TestClass]
public class SortCalcFunctionTests : BrowserTest
{
    private const string UngroupedFixture = "ported/SortCalcFunctionTest01.html";

    private const string GroupedFixture = "ported/SortCalcFunctionTest02.html";

    private static readonly string[] ShortestFirst = ["Name", "Ed", "Sam", "Alice", "William", "Jonathan", "Elizabeth"];

    private async Task SortColumnByLengthAsync(string columnHeading, string direction)
    {
        await Ren.Report.RightClickAsync($".ren-data-grid__column-heading[title='{columnHeading}']");
        await Ren.Root.MouseOverAsync("#sort-by-length");
        await Ren.Root.ClickAsync("#sort-by-length-" + direction);
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task SortCellByLengthAsync(string columnHeading, int rowHeading, string direction)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, rowHeading,
            "#advanced-sort", "#sort-by-length", "#sort-by-length-" + direction);
        await Ren.WaitUntilLoadedAsync();
    }

    private Task ExpectNamesAsync(params string[] expected) =>
        Poll(async () => Tsv(await Ren.Report.ColumnTextAsync("Name"))).ToBe(string.Join("\n", expected));

    [TestMethod("a column heading's menu sorts it shortest first")]
    public async Task AColumnHeadingsMenuSortsItShortestFirst()
    {
        await Ren.OpenAsync(UngroupedFixture);

        await SortColumnByLengthAsync("Name", "asc");

        await ExpectNamesAsync(ShortestFirst);
    }

    [TestMethod("a column heading's menu sorts it longest first")]
    public async Task AColumnHeadingsMenuSortsItLongestFirst()
    {
        await Ren.OpenAsync(UngroupedFixture);

        await SortColumnByLengthAsync("Name", "desc");

        await ExpectNamesAsync("Name", "Elizabeth", "Jonathan", "William", "Alice", "Sam", "Ed");
    }

    [TestMethod("a sort by length survives saving and reopening")]
    public async Task ASortByLengthSurvivesSavingAndReopening()
    {
        await Ren.OpenAsync(UngroupedFixture);

        await SortColumnByLengthAsync("Name", "asc");

        var settings = await Ren.SavedSettingsAsync();

        await Ren.OpenWithSettingsAsync(UngroupedFixture, settings);

        await ExpectNamesAsync(ShortestFirst);
    }

    [TestMethod("a cell's menu sorts its group's rows shortest first")]
    public async Task ACellsMenuSortsItsGroupsRowsShortestFirst()
    {
        await Ren.OpenAsync(GroupedFixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await SortCellByLengthAsync("Name", 3, "asc");

        await Poll(() => Ren.Report.CellTextAsync("Name", 3)).ToBe("Ed");
        await Poll(() => Ren.Report.CellTextAsync("Name", 4)).ToBe("Alice");
        await Poll(() => Ren.Report.CellTextAsync("Name", 5)).ToBe("William");
    }

    [TestMethod("a cell's menu sorts its group's rows longest first")]
    public async Task ACellsMenuSortsItsGroupsRowsLongestFirst()
    {
        await Ren.OpenAsync(GroupedFixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await SortCellByLengthAsync("Name", 3, "desc");

        await Poll(() => Ren.Report.CellTextAsync("Name", 3)).ToBe("William");
        await Poll(() => Ren.Report.CellTextAsync("Name", 4)).ToBe("Alice");
        await Poll(() => Ren.Report.CellTextAsync("Name", 5)).ToBe("Ed");
    }
}
