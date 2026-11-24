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

    // Applies a calc function to a column's data rows, as the Calculation menu does on a data row.
    private Task SetDataRowsCalcFunctionAsync(string columnHeading, string functionName) =>
        SetCalcFunctionAsync(columnHeading, null, functionName);

    // Applies a calc function to a column, as the Calculation menu does on the given row: on a
    // group row, to the column in that row's grouping, and with no row, to the data rows.
    private Task SetCalcFunctionAsync(string columnHeading, int? rowIndex, string functionName) =>
        Page.EvaluateAsync("""
            ([columnHeading, rowIndex, functionName]) => {
                const grid = Ren.VisualisationCollection.getVisualisations()
                    .find(visualisation => visualisation.instance?.dataGrids?.length)
                    .instance.dataGrids[0];

                grid.dataGroupingSettings.setCalcFunction(
                    grid.tabularData.findColumnIndex(columnHeading),
                    rowIndex,
                    { name: functionName }
                );
            }
            """, new object?[] { columnHeading, rowIndex, functionName });

    // A calc function giving numbers makes the column one of numbers as far as aggregating it goes.
    [TestMethod("AggregationMenu_StringColumnCalculatedAsLengths_OffersSumAndAverage")]
    public async Task AggregationMenu_StringColumnCalculatedAsLengths_OffersSumAndAverage()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await SetDataRowsCalcFunctionAsync("ProductName", "string-length");
        await Ren.Report.WaitUntilLoadedAsync();
        await OpenAggregationMenuAsync("ProductName");

        await Expect(Ren.Root.Locator(SumItem)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(AverageItem)).Not.ToHaveCountAsync(0);
    }

    // The lengths are added up, not the strings' places in the compression dictionary.
    [TestMethod("Sum_StringColumnCalculatedAsLengths_ShowsAWholeNumber")]
    public async Task Sum_StringColumnCalculatedAsLengths_ShowsAWholeNumber()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await SetDataRowsCalcFunctionAsync("ProductName", "string-length");
        await Ren.Report.WaitUntilLoadedAsync();

        await Ren.Report.ChooseFromCellMenuAsync("ProductName", 2, ".qa-ren-aggregation-menu-item", SumItem);

        await Poll(() => Ren.Report.CellTextAsync("ProductName", 2)).ToMatch(@"^[1-9][0-9,]*$");
    }

    // The same goes for a calc function chosen on a group row, which applies to that grouping.
    [TestMethod("AggregationMenu_GroupingCalculatesStringLengths_OffersSumAndAverage")]
    public async Task AggregationMenu_GroupingCalculatesStringLengths_OffersSumAndAverage()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await SetCalcFunctionAsync("ProductName", (await Ren.Report.CellIndexesAsync("ProductName", 2)).RowIndex, "string-length");
        await Ren.Report.WaitUntilLoadedAsync();
        await OpenAggregationMenuAsync("ProductName");

        await Expect(Ren.Root.Locator(SumItem)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(AverageItem)).Not.ToHaveCountAsync(0);
    }

    [TestMethod("Sum_GroupingCalculatesStringLengths_ShowsAWholeNumber")]
    public async Task Sum_GroupingCalculatesStringLengths_ShowsAWholeNumber()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await SetCalcFunctionAsync("ProductName", (await Ren.Report.CellIndexesAsync("ProductName", 2)).RowIndex, "string-length");
        await Ren.Report.WaitUntilLoadedAsync();

        await Ren.Report.ChooseFromCellMenuAsync("ProductName", 2, ".qa-ren-aggregation-menu-item", SumItem);

        // A whole number of at least two digits: the sum of several names' lengths, not the length
        // of one name or of a summed string.
        await Poll(() => Ren.Report.CellTextAsync("ProductName", 2)).ToMatch(@"^[1-9][0-9,]+$");
    }

    // Groups the grid by ParentCategoryName, and within that by ProductName, with a calc function
    // on that grouping's ProductName showing each group's name's length, as choosing one on its
    // group row does.  A grouping inside that one groups by ProductName too, without the function.
    private async Task GroupByParentCategoryThenProductNameLengthAsync()
    {
        await Page.EvaluateAsync("""
            () => {
                const settings = Ren.VisualisationCollection.getVisualisations()
                    .find(visualisation => visualisation.instance?.dataGrids?.length)
                    .instance.dataGrids[0].dataGroupingSettings;

                settings.sortFilterGroup.applyGroupings({
                    entries: [
                        { groupByColumns: ["ParentCategoryName", "ProductName", "CategoryName"] },
                        {
                            groupByColumns: ["ParentCategoryName", "ProductName"],
                            columns: { ProductName: { calcFunction: [{ name: "string-length" }] } }
                        },
                        { groupByColumns: ["ParentCategoryName"] },
                        { groupByColumns: [] }
                    ]
                });

                settings.fireChangedEvent();
            }
            """);

        await Ren.Report.WaitUntilLoadedAsync();
    }

    // The rows outside a grouping showing a calc function's results aggregate those results too.
    [TestMethod("AggregationMenu_OutsideGroupingByStringLengths_OffersSumAndAverage")]
    public async Task AggregationMenu_OutsideGroupingByStringLengths_OffersSumAndAverage()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await GroupByParentCategoryThenProductNameLengthAsync();
        await OpenAggregationMenuAsync("ProductName");

        await Expect(Ren.Root.Locator(SumItem)).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator(AverageItem)).Not.ToHaveCountAsync(0);
    }

    [TestMethod("Sum_OutsideGroupingByStringLengths_ShowsAWholeNumber")]
    public async Task Sum_OutsideGroupingByStringLengths_ShowsAWholeNumber()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await GroupByParentCategoryThenProductNameLengthAsync();

        await Ren.Report.ChooseFromCellMenuAsync("ProductName", 2, ".qa-ren-aggregation-menu-item", SumItem);

        await Poll(() => Ren.Report.CellTextAsync("ProductName", 2)).ToMatch(@"^[1-9][0-9,]+$");
    }

    // The averaged lengths are numbers, so they can be formatted as numbers.
    [TestMethod("FormatMenu_OutsideGroupingByStringLengthsAveraged_OffersNumberFormats")]
    public async Task FormatMenu_OutsideGroupingByStringLengthsAveraged_OffersNumberFormats()
    {
        await Ren.OpenAsync(StringColumnsFixture);
        await GroupByParentCategoryThenProductNameLengthAsync();

        await Ren.Report.ChooseFromCellMenuAsync("ProductName", 2, ".qa-ren-aggregation-menu-item", AverageItem);
        await Poll(() => Ren.Report.CellTextAsync("ProductName", 2)).ToMatch(@"^[0-9.,]+$");

        await Ren.Root.RightClickAsync(await Ren.Report.CellSelectorAsync("ProductName", 2));
        await Ren.Root.MouseOverAsync(".qa-ren-formatting-menu-item");

        await Expect(Ren.Root.Locator("#format-as-number")).Not.ToHaveCountAsync(0);
    }
}
