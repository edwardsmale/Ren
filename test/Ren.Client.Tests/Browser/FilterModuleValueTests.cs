namespace Ren.Client.Tests.Browser;

// These tests cover what a filter module item shows against its checkboxes and on its totals row:
// the "Value column" choice that replaces the default row count, the totals row's own aggregation,
// and "Flip sort order".
//
// The report has 54 rows, 22 Castings and 32 Structures.  They carry 34 distinct Ids, 16 on the
// Castings rows and 18 on the Structures ones.
[TestClass]
public class FilterModuleValueTests : BrowserTest
{
    private async Task OpenWithCategoryItemAsync(string fixture)
    {
        await Ren.OpenAsync(fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    [TestMethod("ValueColumn_IdCountedDistinctly_ShowsThatCountAgainstEachCheckbox")]
    public async Task ValueColumn_IdCountedDistinctly_ShowsThatCountAgainstEachCheckbox()
    {
        await OpenWithCategoryItemAsync("ported/FilterModuleTest12.html");

        await FilterModule.SetValueColumnAsync(Ren, "Category", "Id", "CountDistinct");

        await Poll(() => FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("16");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Structures")).ToBe("18");
    }

    // The totals row aggregates the row-count column, each row counting one, so averaging gives 1.
    // The caption reads as the aggregation in effect, and the options keep their own values.
    [TestMethod("TotalAggregation_Average_ChangesTheTotalsRowsLabelAndFigure")]
    public async Task TotalAggregation_Average_ChangesTheTotalsRowsLabelAndFigure()
    {
        await OpenWithCategoryItemAsync("ported/FilterModuleTest13.html");

        Expect(await FilterModule.TotalLabelAsync(Ren, "Category")).ToBe("Total");

        await FilterModule.SetTotalAggregationAsync(Ren, "Category", "Average");

        await Poll(() => FilterModule.TotalLabelAsync(Ren, "Category")).ToBe("Average");
        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBe("1");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("22");
    }

    [TestMethod("TotalAggregation_None_RemovesTheTotalsRow")]
    public async Task TotalAggregation_None_RemovesTheTotalsRow()
    {
        await OpenWithCategoryItemAsync("ported/FilterModuleTest14.html");

        await FilterModule.SetTotalAggregationAsync(Ren, "Category", "None");

        await Poll(() => FilterModule.TotalValueAsync(Ren, "Category")).ToBeNull();
        Expect(Text.Sorted(await FilterModule.OptionTextsAsync(Ren, "Category"))).ToEqual(new[] { "Castings", "Structures" });
    }

    // A text column starts sorted by row count, largest first.  Flipping is a one-shot action on
    // the direction in effect, so a second flip puts the options back.
    [TestMethod("FlipSortOrder_TextColumn_ReversesTheOrderInEffectEachTime")]
    public async Task FlipSortOrder_TextColumn_ReversesTheOrderInEffectEachTime()
    {
        await OpenWithCategoryItemAsync("ported/FilterModuleTest15.html");

        Expect(await FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Structures", "Castings" });

        await FilterModule.FlipSortOrderAsync(Ren, "Category");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Castings", "Structures" });

        await FilterModule.FlipSortOrderAsync(Ren, "Category");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, "Category")).ToEqual(new[] { "Structures", "Castings" });
    }
}
