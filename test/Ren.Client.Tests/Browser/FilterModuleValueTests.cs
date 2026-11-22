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

    // A new item starts with the "Values" settings of the last item shown.
    [TestMethod("ValueColumn_NewItem_TakesTheLastItemsValueSettings")]
    public async Task ValueColumn_NewItem_TakesTheLastItemsValueSettings()
    {
        await Ren.OpenAsync("ported/FilterModuleTest12.html");
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Active");
        await FilterModule.SetValueColumnAsync(Ren, "Active", "Id", "CountDistinct");

        await FilterModule.AddItemForColumnAsync(Ren, "Active", "Category");

        await Poll(() => FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("16");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Structures")).ToBe("18");
    }

    // A hierarchy shows each level's own values, so it's its top level's that a new item takes.
    [TestMethod("ValueColumn_NewItemAfterAHierarchy_TakesItsTopLevelsValueSettings")]
    public async Task ValueColumn_NewItemAfterAHierarchy_TakesItsTopLevelsValueSettings()
    {
        await Ren.OpenAsync("ported/FilterModuleTest12.html");
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Product Code");
        await FilterModule.GroupItemByAsync(Ren, "Product Code", "Active");

        await FilterModule.RightClickOptionTextAsync(Ren, "Active", "Yes");
        await Ren.Root.MouseOverAsync("#filter-module-value-column");
        await FilterModule.ClickMenuItemByTextAsync(Ren, "Id");
        await Ren.WaitUntilLoadedAsync();
        await FilterModule.RightClickOptionTextAsync(Ren, "Active", "Yes");
        await Ren.Root.MouseOverAsync("#filter-module-value-aggregation");
        await FilterModule.ClickMenuItemByTextAsync(Ren, "CountDistinct");
        await Ren.WaitUntilLoadedAsync();

        await FilterModule.AddItemForColumnAsync(Ren, "Active", "Category");

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
