namespace Ren.Client.Tests.Browser;

// These tests cover the "Prevent expansion" grouping option, which stops a grouping's groups
// being expanded and hides their expand buttons, whether it's set from the grouping menu, from
// Edit Groupings or in the settings JSON.
[TestClass]
public class GroupingPreventExpansionTests : BrowserTest
{
    // Grouped by CreatedOn (rows 2 to 4, with the totals row at 5) and within that by ID.
    private const string Fixture = "ported/DataGroupingSettingsTest04.html";

    // As above, with the ID grouping preventing expansion.
    private const string PreventedInJsonFixture = "ported/DataGroupingSettingsTest31.html";

    private const string ToggleSelector = ".js-ren-data-grouping-settings-editor-grouping-prevent-expansion";

    private const string GroupedProductCodes = "SX01725，XN31916";

    private async Task ShowGroupingMenuAsync(int rowHeading)
    {
        await Ren.Report.RightClickCellAsync("CreatedOn", rowHeading);
        await Ren.Root.MouseOverAsync("#grouping-menu");
    }

    private async Task TogglePreventExpansionAsync()
    {
        await Ren.Report.ChooseFromCellMenuAsync("CreatedOn", 2, "#grouping-menu", "#prevent-expansion");
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task<bool> IsExpandButtonHiddenAsync(int rowHeading)
    {
        var rowIndex = (await Ren.Report.CellIndexesAsync(null, rowHeading)).RowIndex;

        return await Ren.Report
            .Locator($".ren-data-grid__group-ctrls.ren-r-{rowIndex} .ren-data-grid__group-expand-collapse-button")
            .First
            .EvaluateAsync<bool>("element => getComputedStyle(element).visibility === 'hidden'");
    }

    private async Task OpenEditGroupingsAsync()
    {
        await ShowGroupingMenuAsync(2);
        await Ren.Root.Locator(".ren-context-menu").Last
            .Locator(".ren-context-menu__item--clickable", new() { HasText = "Edit Groupings..." })
            .EvaluateAsync("element => element.click()");

        await Expect(Ren.Root.Locator(ToggleSelector).First).ToBeAttachedAsync();
    }

    private Task<bool> IsToggleTickedAsync(int toggleIndex) =>
        Ren.Root.Locator(ToggleSelector + " input").Nth(toggleIndex).IsCheckedAsync();

    private Task ExpectCellTextAsync(string columnHeading, int rowHeading, string expected) =>
        Poll(() => Ren.Report.CellTextAsync(columnHeading, rowHeading)).ToBe(expected);

    // Expanding the first group leaves the second group's row where it was.
    private async Task ExpectFirstGroupNotExpandedAsync()
    {
        await Ren.Report.ExpandCollapseGroupAsync(2);

        await ExpectCellTextAsync("CreatedOn", 3, "15/01/2024");
    }

    [TestMethod("turned on from the grouping menu: the group can't be expanded")]
    public async Task TheGroupCantBeExpanded()
    {
        await Ren.OpenAsync(Fixture);

        await TogglePreventExpansionAsync();

        await ExpectFirstGroupNotExpandedAsync();
    }

    [TestMethod("turned on from the grouping menu: the expand buttons are hidden")]
    public async Task TheExpandButtonsAreHidden()
    {
        await Ren.OpenAsync(Fixture);

        Expect(await IsExpandButtonHiddenAsync(2)).ToBe(false);

        await TogglePreventExpansionAsync();

        await Poll(() => IsExpandButtonHiddenAsync(2)).ToBe(true);
        Expect(await IsExpandButtonHiddenAsync(3)).ToBe(true);
        Expect(await IsExpandButtonHiddenAsync(4)).ToBe(true);
    }

    [TestMethod("turned on from the grouping menu: the option is ticked and the expand items go")]
    public async Task TheOptionIsTickedAndTheExpandItemsGo()
    {
        await Ren.OpenAsync(Fixture);

        await ShowGroupingMenuAsync(2);

        await Expect(Ren.Root.Locator("#expand-group")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#expand-grouping-level")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#prevent-expansion.ren-is-checked")).ToHaveCountAsync(0);

        await Ren.Root.ClickAsync("#prevent-expansion");
        await Ren.WaitUntilLoadedAsync();
        await ShowGroupingMenuAsync(2);

        await Expect(Ren.Root.Locator("#prevent-expansion.ren-is-checked")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#expand-group")).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#expand-grouping-level")).ToHaveCountAsync(0);
    }

    [TestMethod("turned on from the grouping menu: turned off again, the group expands")]
    public async Task TurnedOffAgainTheGroupExpands()
    {
        await Ren.OpenAsync(Fixture);

        await TogglePreventExpansionAsync();
        await TogglePreventExpansionAsync();

        Expect(await IsExpandButtonHiddenAsync(2)).ToBe(false);

        await Ren.Report.ExpandCollapseGroupAsync(2);

        await ExpectCellTextAsync("Product Code", 4, GroupedProductCodes);
    }

    [TestMethod("turned on from the grouping menu: an inner group expanded beforehand is put back when turned off")]
    public async Task AnInnerGroupExpandedBeforehandIsPutBackWhenTurnedOff()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await ExpectCellTextAsync("Product Code", 4, GroupedProductCodes);
        var textBefore = await Ren.Report.ColumnTextAsync("Product Code");

        await Ren.Report.ExpandCollapseGroupAsync(4);
        await ExpectCellTextAsync("Product Code", 5, "SX01725");

        await TogglePreventExpansionAsync();
        await ExpectCellTextAsync("CreatedOn", 3, "15/01/2024");

        await TogglePreventExpansionAsync();
        await Ren.Report.ExpandCollapseGroupAsync(2);

        await Poll(() => Ren.Report.ColumnTextAsync("Product Code")).ToBe(textBefore);
    }

    [TestMethod("turned on from the grouping menu: it isn't offered on the totals row")]
    public async Task ItIsntOfferedOnTheTotalsRow()
    {
        await Ren.OpenAsync(Fixture);

        await ShowGroupingMenuAsync(5);

        await Expect(Ren.Root.Locator("#remove-all-groupings")).ToHaveCountAsync(1);
        await Expect(Ren.Root.Locator("#prevent-expansion")).ToHaveCountAsync(0);
    }

    [TestMethod("turned on from the grouping menu: it's ticked in Edit Groupings")]
    public async Task ItsTickedInEditGroupings()
    {
        await Ren.OpenAsync(Fixture);

        await TogglePreventExpansionAsync();
        await OpenEditGroupingsAsync();

        Expect(await IsToggleTickedAsync(0)).ToBe(true);
        Expect(await IsToggleTickedAsync(1)).ToBe(false);
    }

    [TestMethod("ticked in Edit Groupings, the group can't be expanded")]
    public async Task TickedInEditGroupingsTheGroupCantBeExpanded()
    {
        await Ren.OpenAsync(Fixture);

        await OpenEditGroupingsAsync();

        // The totals row has no toggle, and the tiles run outermost first, so the first toggle is
        // CreatedOn's.
        await Expect(Ren.Root.Locator(ToggleSelector)).ToHaveCountAsync(2);

        await Ren.Root.Locator(ToggleSelector + " input").First.ClickAsync();

        // So a click that lands elsewhere fails here, rather than as an expand button left showing.
        await Expect(Ren.Root.Locator(ToggleSelector + " input").First).ToBeCheckedAsync();
        await Expect(Ren.Root.Locator(ToggleSelector + " input").Nth(1)).Not.ToBeCheckedAsync();

        await Ren.WaitUntilLoadedAsync();

        await Poll(() => IsExpandButtonHiddenAsync(2)).ToBe(true);
        await ExpectFirstGroupNotExpandedAsync();
    }

    [TestMethod("set in the settings JSON, the inner groups can't be expanded")]
    public async Task SetInTheSettingsJsonTheInnerGroupsCantBeExpanded()
    {
        await Ren.OpenAsync(PreventedInJsonFixture);

        Expect(await IsExpandButtonHiddenAsync(2)).ToBe(false);

        await Ren.Report.ExpandCollapseGroupAsync(2);
        await ExpectCellTextAsync("Product Code", 4, GroupedProductCodes);

        Expect(await IsExpandButtonHiddenAsync(4)).ToBe(true);
        var textBefore = await Ren.Report.ColumnTextAsync("Product Code");

        await Ren.Report.ExpandCollapseGroupAsync(4);

        Expect(await Ren.Report.ColumnTextAsync("Product Code")).ToBe(textBefore);
    }
}
