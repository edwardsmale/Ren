using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the periods the grid's Create > Chart menu offers: only those at, or coarser
// than, the granularity of the data the chart would be made from.
[TestClass]
public class CreateVisualisationMenuTests : BrowserTest
{
    private static readonly string[] Periods = ["day", "week", "month", "quarter", "year"];

    // Leaves the Create > Chart submenu open, so the periods it offers can be read.
    private async Task HoverCreateChartAsync()
    {
        await Ren.Root.MouseOverAsync("#create-visualisation");
        await Ren.Root.MouseOverAsync("#create-visualisation-date-value-chart");
    }

    private ILocator PeriodItem(string period) => Ren.Root.Locator("#create-visualisation-date-value-chart-" + period);

    // The periods offered are waited for first, so that the rest aren't found missing from a
    // submenu yet to be drawn.
    private async Task ExpectPeriodsOfferedAsync(params string[] offered)
    {
        foreach (var period in offered)
        {
            await Expect(PeriodItem(period)).ToHaveCountAsync(1);
        }

        foreach (var period in Periods.Except(offered))
        {
            await Expect(PeriodItem(period)).ToHaveCountAsync(0);
        }
    }

    // The grid's rows say nothing about the granularity, as the Quarter column aggregates to
    // nothing on them, so the periods come from the column's own dates instead.
    [TestMethod("a quarter column selected on a grouped grid offers quarters and years")]
    public async Task QuarterColumnSelectedOnAGroupedGridOffersQuartersAndYears()
    {
        await Ren.OpenAsync("ported/DateValueChartTest07.html");
        await Ren.Report.SelectColumnsAsync("Quarter", "Order Lines");

        await Ren.Report.RightClickAsync(".ren-data-grid__column-heading[title='Quarter']");
        await HoverCreateChartAsync();

        await ExpectPeriodsOfferedAsync("quarter", "year");
    }

    // Order Date is a daily column, and the grid's first date column, so a menu that read the
    // granularity from the whole grid rather than the selection would offer every period.
    [TestMethod("quarter cells selected offer quarters and years")]
    public async Task QuarterCellsSelectedOfferQuartersAndYears()
    {
        await Ren.OpenAsync("ported/DateValueChartTest06.html");
        await Ren.Report.SelectCellsAsync("Quarter", 2, "Order Lines", 5);

        await Ren.Report.RightClickCellAsync("Quarter", 2);
        await HoverCreateChartAsync();

        await ExpectPeriodsOfferedAsync("quarter", "year");
    }

    [TestMethod("a daily column selected offers every period")]
    public async Task DailyColumnSelectedOffersEveryPeriod()
    {
        await Ren.OpenAsync("ported/DateValueChartTest06.html");
        await Ren.Report.SelectColumnsAsync("Order Date", "Order Lines");

        await Ren.Report.RightClickAsync(".ren-data-grid__column-heading[title='Order Date']");
        await HoverCreateChartAsync();

        await ExpectPeriodsOfferedAsync(Periods);
    }
}
