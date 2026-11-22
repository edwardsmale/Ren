namespace Ren.Client.Tests.Browser;

// These tests cover which aggregations the Aggregation submenu offers a column.  Summing or
// averaging only means anything for numbers, so those two are left out for a column of strings.
// The rest of the menu is checked alongside, so that a missing Sum is the item being left out
// rather than the menu having failed to open.
[TestClass]
public class AggregationMenuTests : BrowserTest
{
    // A grid grouped by AccountId whose other columns are all numbers.  Row 2 is a group row.
    private const string NumberColumnsFixture = "ported/MultiSelectContextMenuTest01.html";

    // A grid grouped by ParentCategoryName and CategoryName whose ProductName column holds text.
    private const string StringColumnsFixture = "ported/StringAggregationTest01.html";

    private const string SumItem = ".qa-ren-aggregation-menu-item-sum";
    private const string AverageItem = ".qa-ren-aggregation-menu-item-average";
    private const string CountDistinctItem = ".qa-ren-aggregation-menu-item-count-distinct";

    // Opens the Aggregation submenu on a column's group row (row 2), the row the aggregations apply to.
    private async Task OpenAggregationMenuAsync(string columnHeading)
    {
        await Ren.Root.RightClickAsync(await Ren.Report.CellSelectorAsync(columnHeading, 2));
        await Ren.Root.MouseOverAsync(".qa-ren-aggregation-menu-item");
    }

    [TestMethod("AggregationMenu_NumericColumn_OffersSumAndAverage")]
    public async Task AggregationMenu_NumericColumn_OffersSumAndAverage()
    {
        await Ren.OpenAsync(NumberColumnsFixture);
        await OpenAggregationMenuAsync("OrderRevenue");

        await Expect(Ren.Root.Locator(SumItem)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(AverageItem)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(CountDistinctItem)).Not.ToHaveCountAsync(0);
    }

    [TestMethod("AggregationMenu_StringColumn_DoesNotOfferSumOrAverage")]
    public async Task AggregationMenu_StringColumn_DoesNotOfferSumOrAverage()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await OpenAggregationMenuAsync("ProductName");

        // The aggregations that say something about text are still offered.
        await Expect(Ren.Root.Locator(CountDistinctItem)).Not.ToHaveCountAsync(0);

        await Expect(Ren.Root.Locator(SumItem)).ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(AverageItem)).ToHaveCountAsync(0);
    }
}
