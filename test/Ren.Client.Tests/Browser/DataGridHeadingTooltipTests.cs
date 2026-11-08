namespace Ren.Client.Tests.Browser;

// Grid column headings carry a tooltip naming the column in full.  Header cells have no title until
// hovered, when they show their heading only if it's truncated.
[TestClass]
public class DataGridHeadingTooltipTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    [TestMethod("Grid_Rendered_ColumnHeadingsCarryTheirHeadingAsATooltip")]
    public async Task Grid_Rendered_ColumnHeadingsCarryTheirHeadingAsATooltip()
    {
        await Ren.OpenAsync(Fixture);

        await Expect(Ren.Report.Locator(".ren-data-grid__column-heading[title='CreatedOn']")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Report.Locator(".ren-data-grid__cell.ren-h.ren-r-0[title]")).ToHaveCountAsync(0);
    }

    [TestMethod("ChangeHeading_NewHeadingEntered_ColumnHeadingTooltipShowsTheNewHeading")]
    public async Task ChangeHeading_NewHeadingEntered_ColumnHeadingTooltipShowsTheNewHeading()
    {
        await Ren.OpenAsync(Fixture);

        await Ren.Report.RightClickAsync(".ren-data-grid__column-heading[title='CreatedOn']");
        await Ren.Root.ClickAsync("#change-heading");

        await Ren.Root.Locator(".qa-ren-text-editor-input").First.FillAsync("Created Date");
        await Ren.Root.ClickAsync(".qa-ren-text-editor-ok");

        await Expect(Ren.Report.Locator(".ren-data-grid__column-heading[title='Created Date']")).Not.ToHaveCountAsync(0);
    }
}
