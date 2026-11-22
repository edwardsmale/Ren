namespace Ren.Client.Tests.Browser;

// The data uses NoteTypeEnum (General=0, Reminder=1, Internal=2), whose alphabetical order differs
// from its integer order, so the tests can tell an alphabetical sort from an enum-order one.
[TestClass]
public class EnumColumnTests : BrowserTest
{
    private const string Fixture = "ported/EnumColumnTest01.html";

    private async Task<string> SortedColumnTextAsync(params string[] menuItemSelectors)
    {
        await Ren.Report.ChooseFromCellMenuAsync("Note Type", 2, menuItemSelectors);
        await Ren.Report.WaitUntilLoadedAsync();

        return Tsv(await Ren.Report.ColumnTextAsync("Note Type"));
    }

    [TestMethod("EnumColumn_Rendered_ShowsTextInsteadOfInteger")]
    public async Task EnumColumn_Rendered_ShowsTextInsteadOfInteger()
    {
        await Ren.OpenAsync(Fixture);

        // Row 2 has NoteType=1.
        await Poll(() => Ren.Report.CellTextAsync("Note Type", 2)).ToBe("Reminder");
    }

    [TestMethod("EnumColumn_SortedAscending_SortsAlphabetically")]
    public async Task EnumColumn_SortedAscending_SortsAlphabetically()
    {
        await Ren.OpenAsync(Fixture);

        Expect(await SortedColumnTextAsync("#sort-ascending")).ToBe(Tsv("""
            Note Type
            General
            Internal
            Reminder
            """));
    }

    [TestMethod("EnumColumn_SortedDescending_SortsAlphabeticallyReversed")]
    public async Task EnumColumn_SortedDescending_SortsAlphabeticallyReversed()
    {
        await Ren.OpenAsync(Fixture);

        Expect(await SortedColumnTextAsync("#sort-descending")).ToBe(Tsv("""
            Note Type
            Reminder
            Internal
            General
            """));
    }

    [TestMethod("EnumColumn_SortedByEnumOrderAscending_SortsByIntegerValueAscending")]
    public async Task EnumColumn_SortedByEnumOrderAscending_SortsByIntegerValueAscending()
    {
        await Ren.OpenAsync(Fixture);

        var text = await SortedColumnTextAsync("#advanced-sort", "#sort-by-enum-order", "#sort-by-enum-order-asc");

        Expect(text).ToBe(Tsv("""
            Note Type
            General
            Reminder
            Internal
            """));
    }

    [TestMethod("EnumColumn_SortedByEnumOrderDescending_SortsByIntegerValueDescending")]
    public async Task EnumColumn_SortedByEnumOrderDescending_SortsByIntegerValueDescending()
    {
        await Ren.OpenAsync(Fixture);

        var text = await SortedColumnTextAsync("#advanced-sort", "#sort-by-enum-order", "#sort-by-enum-order-desc");

        Expect(text).ToBe(Tsv("""
            Note Type
            Internal
            Reminder
            General
            """));
    }
}
