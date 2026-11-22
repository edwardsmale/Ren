namespace Ren.Client.Tests.Browser;

// These tests cover the order a filter module item's checkboxes start out in, which is chosen from
// the column's type as the item is created. A number, date, date/time or enum column starts on the
// "Default" value sort, ascending, by label for the first three and by the enum's own integers for
// an enum.  Any other column keeps the module's usual sort by row count, descending.
[TestClass]
public class FilterModuleSortingTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    // NoteTypeEnum's three values over six rows.
    private const string EnumFixture = "ported/FilterModuleTest02.html";

    // Ids 16 to 19 are absent from the data.
    private const string AscendingIds =
        "2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,"
        + "36,37,38,39";

    // Chronological rather than alphabetical, which would put 01/10/2023 first.
    private const string AscendingDates = "14/06/2023,18/06/2023,01/10/2023,12/01/2024,15/01/2024,18/01/2024";

    private const string AscendingDateTimes =
        "14/06/2023 17:00:00,18/06/2023 17:00:00,01/10/2023 17:00:00,12/01/2024 09:00:00,"
        + "15/01/2024 09:00:00,18/01/2024 09:00:00";

    private async Task AddItemAsync(string fixture, string columnHeading)
    {
        await Ren.OpenAsync(fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, columnHeading);
        await FilterModule.AddFirstItemForColumnAsync(Ren, columnHeading);
    }

    private async Task<string> OptionTextsCsvAsync(string columnHeading) =>
        string.Join(",", await FilterModule.OptionTextsAsync(Ren, columnHeading));

    [TestMethod]
    [DataRow(Fixture, "Id", AscendingIds, DisplayName = "AddFilterModuleItem_NumericColumn_SortsCheckboxesByLabelAscending")]
    [DataRow(Fixture, "CreatedOn", AscendingDates, DisplayName = "AddFilterModuleItem_DateColumn_SortsCheckboxesByDateAscending")]
    [DataRow(Fixture, "Created At", AscendingDateTimes, DisplayName = "AddFilterModuleItem_DateTimeColumn_SortsCheckboxesByDateTimeAscending")]
    [DataRow(EnumFixture, "Note Type", "General,Reminder,Internal", DisplayName = "AddFilterModuleItem_EnumColumn_SortsCheckboxesByEnumValueAscending")]
    [DataRow(Fixture, "Category", "Structures,Castings", DisplayName = "AddFilterModuleItem_TextColumn_SortsCheckboxesByValueDescending")]
    public async Task AddFilterModuleItem_SortsCheckboxesInitially(string fixture, string columnHeading, string expected)
    {
        await AddItemAsync(fixture, columnHeading);

        Expect(await OptionTextsCsvAsync(columnHeading)).ToBe(expected);
    }

    // "Sort by label" is the same "Default" sort an item starts out on, so each test first sorts by
    // value, making what it asserts the menu item's own doing.
    [TestMethod]
    [DataRow(EnumFixture, "Note Type", "General,Reminder,Internal", DisplayName = "SortByLabel_EnumColumn_SortsByEnumValueAscending")]
    [DataRow(Fixture, "Id", AscendingIds, DisplayName = "SortByLabel_NumericColumn_SortsNumericallyAscending")]
    [DataRow(Fixture, "CreatedOn", AscendingDates, DisplayName = "SortByLabel_DateColumn_SortsChronologicallyAscending")]
    [DataRow(Fixture, "Created At", AscendingDateTimes, DisplayName = "SortByLabel_DateTimeColumn_SortsChronologicallyAscending")]
    [DataRow(Fixture, "Category", "Castings,Structures", DisplayName = "SortByLabel_TextColumn_SortsAlphabeticallyAscending")]
    public async Task SortByLabel_SortsByLabel(string fixture, string columnHeading, string expected)
    {
        await AddItemAsync(fixture, columnHeading);

        await FilterModule.ChooseFromItemHeadingMenuAsync(Ren, columnHeading, "#filter-module-sort-by-value");
        await FilterModule.ChooseFromItemHeadingMenuAsync(Ren, columnHeading, "#filter-module-sort-by-label");

        await Poll(() => OptionTextsCsvAsync(columnHeading)).ToBe(expected);
    }
}
