namespace Ren.Client.Tests.Browser;

// These tests cover the "Expand initially" grouping option, which expands a grouping's groups
// when its settings are applied, and stays ticked when the groupings are rebuilt.
[TestClass]
public class GroupingExpandInitiallyTests : BrowserTest
{
    // Grouped by CreatedOn (rows 2 to 4, with the totals row at 5) and within that by ID.
    private const string Fixture = "ported/DataGroupingSettingsTest04.html";

    // As above, with the CreatedOn grouping expanding initially.
    private const string ExpandedInJsonFixture = "ported/DataGroupingSettingsTest32.html";

    private const string TickedSelector = "#expand-initially.ren-is-checked";

    private async Task ToggleExpandInitiallyAsync(string columnHeading)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, 2, "#grouping-menu", "#expand-initially");
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task ExpectTickedAsync(string columnHeading)
    {
        await Ren.Report.RightClickCellAsync(columnHeading, 2);
        await Ren.Root.MouseOverAsync("#grouping-menu");

        await Expect(Ren.Root.Locator(TickedSelector)).ToHaveCountAsync(1);
    }

    [TestMethod("set in the settings JSON, the groups start expanded")]
    public async Task SetInTheSettingsJsonTheGroupsStartExpanded()
    {
        await Ren.OpenAsync(ExpandedInJsonFixture);

        await Poll(() => Ren.Report.CellTextAsync("Product Code", 4)).ToBe("SX01725，XN31916");
    }

    [TestMethod("set in the settings JSON, the option is ticked")]
    public async Task SetInTheSettingsJsonTheOptionIsTicked()
    {
        await Ren.OpenAsync(ExpandedInJsonFixture);

        await ExpectTickedAsync("CreatedOn");
    }

    [TestMethod("the option stays ticked when the date grouping's period changes")]
    public async Task TheOptionStaysTickedWhenTheDateGroupingsPeriodChanges()
    {
        // "Group by month instead" is only offered on a date grouping with a calc function.
        await Ren.OpenAsync("ported/GroupTests.html");

        await Ren.Report.ChooseFromCellMenuAsync("UpdatedOn", 2, "#grouping-menu", "#group-by-column", "#group-by-column-week");
        await Ren.WaitUntilLoadedAsync();
        await ToggleExpandInitiallyAsync("UpdatedOn");

        await Ren.Report.ChooseFromCellMenuAsync("UpdatedOn", 2, "#grouping-menu", "#group-by-month-instead");
        await Ren.WaitUntilLoadedAsync();

        await ExpectTickedAsync("UpdatedOn");
    }

    [TestMethod("the option stays ticked when a grouping is added")]
    public async Task TheOptionStaysTickedWhenAGroupingIsAdded()
    {
        await Ren.OpenAsync(Fixture);

        await ToggleExpandInitiallyAsync("CreatedOn");

        // The new grouping goes in beneath CreatedOn, which keeps row 2.
        await Ren.Report.ChooseFromCellMenuAsync("Active", 2, "#grouping-menu", "#add-grouping-submenu", "#group-by-column");
        await Ren.WaitUntilLoadedAsync();

        await ExpectTickedAsync("CreatedOn");
    }

    [TestMethod("the option stays ticked when the grid is filtered")]
    public async Task TheOptionStaysTickedWhenTheGridIsFiltered()
    {
        await Ren.OpenAsync(Fixture);

        await ToggleExpandInitiallyAsync("CreatedOn");

        await Ren.Report.ChooseFromCellMenuAsync("CreatedOn", 2, "#filter-menu-option", "#filter-this-value-only");
        await Ren.WaitUntilLoadedAsync();

        await ExpectTickedAsync("CreatedOn");
    }
}
