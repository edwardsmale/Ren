namespace Ren.Client.Tests.Browser;

// These tests cover the stats-relative "Show as" formats on a filter module's per-option values,
// which are aggregations of the item's own counts grouping and so have summary stats behind them as
// a grid's cells do.
//
// The report has 54 rows: Castings counts 22 and Structures 32.  Each data row counts 1, so the
// stats sum to 54 and their maximum and average are 1.  Every Castings row is inactive and three
// Structures rows are, so Active beneath Category gives Castings one child (No, 22) and Structures
// two (Yes, 29 and No, 3).
[TestClass]
public class FilterModuleFormattingTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private async Task OpenWithItemAsync(string columnHeading)
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, columnHeading);
    }

    private Task SetShowAsAsync(string kind, string option) => FilterModule.SetValueFormatViaShowAsAsync(
        Ren, "Category", "#format-show-as-" + kind, "#format-show-as-" + kind + "-" + option);

    // "Show as" is offered where the value is an aggregation of a summarised grouping, so against the
    // per-option values but not the labels.  Active is Boolean and so numeric, leaving the stats as
    // the only thing deciding whether it shows.
    [TestMethod("ShowAsSubmenu_ValueFormatMenu_IsOffered")]
    public async Task ShowAsSubmenu_ValueFormatMenu_IsOffered()
    {
        await OpenWithItemAsync("Active");

        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Active");
        await Ren.Root.MouseOverAsync("#format-menu");

        await Expect(Ren.Root.Locator("#format-show-as")).Not.ToHaveCountAsync(0);
    }

    // The submenu's "Custom..." entry is checked first, so the absence is known not to be the submenu
    // still opening.
    [TestMethod("ShowAsSubmenu_LabelFormatMenu_IsNotOffered")]
    public async Task ShowAsSubmenu_LabelFormatMenu_IsNotOffered()
    {
        await OpenWithItemAsync("Active");

        await FilterModule.ShowItemHeadingMenuAsync(Ren, "Active");
        await Ren.Root.MouseOverAsync("#filter-module-label-format");

        await Expect(Ren.Root.Locator("#filter-module-label-format-custom")).Not.ToHaveCountAsync(0);
        await Expect(Ren.Root.Locator("#format-show-as")).ToHaveCountAsync(0);
    }

    // A flat item's options group into its grand total, so their group stats and overall stats are
    // the same, as in a grid grouped once.  22 / 54 = 40.74% and 32 / 54 = 59.26%.
    [TestMethod("ShowAsPercentageOfOverallTotal_FlatOptions_ShowShareOfItemTotal")]
    public async Task ShowAsPercentageOfOverallTotal_FlatOptions_ShowShareOfItemTotal()
    {
        await OpenWithItemAsync("Category");

        await SetShowAsAsync("percentage-of-overall-sum", "no-dp");

        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("41%");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Structures")).ToBe("59%");
    }

    [TestMethod("ShowAsPercentageOfGroupTotal_FlatOption_MatchesPercentageOfOverallTotal")]
    public async Task ShowAsPercentageOfGroupTotal_FlatOption_MatchesPercentageOfOverallTotal()
    {
        await OpenWithItemAsync("Category");

        await SetShowAsAsync("percentage-of-group-sum", "no-dp");

        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("41%");
    }

    // The largest data row counts 1, so each option is a multiple of it.  This format threw a
    // null-stats TypeError before filter module values had stats behind them.
    [TestMethod("ShowAsPercentageOfGroupMaximum_FlatOptions_ShowShareOfLargestOption")]
    public async Task ShowAsPercentageOfGroupMaximum_FlatOptions_ShowShareOfLargestOption()
    {
        await OpenWithItemAsync("Category");

        await SetShowAsAsync("percentage-of-group-max", "2-dp");

        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("2200.00%");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Structures")).ToBe("3200.00%");
    }

    [TestMethod("ShowAsDifferenceFromGroupAverage_FlatOptions_ShowSignedDifference")]
    public async Task ShowAsDifferenceFromGroupAverage_FlatOptions_ShowSignedDifference()
    {
        await OpenWithItemAsync("Category");

        await SetShowAsAsync("difference-from-group-avg", "no-dp");

        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("+21");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Structures")).ToBe("+31");
    }

    // The totals row is formatted against the options' stats, so it reads as the selected share of
    // the item's full total rather than always 100%.
    [TestMethod("ShowAsPercentageOfOverallTotal_TotalsRowEverythingSelected_ShowsWholeTotal")]
    public async Task ShowAsPercentageOfOverallTotal_TotalsRowEverythingSelected_ShowsWholeTotal()
    {
        await OpenWithItemAsync("Category");

        await SetShowAsAsync("percentage-of-overall-sum", "no-dp");

        Expect(await FilterModule.TotalValueAsync(Ren, "Category")).ToBe("100%");
    }

    // An item's options ignore its own filter, so Castings's share is unchanged.
    [TestMethod("ShowAsPercentageOfOverallTotal_TotalsRowOptionDeselected_ShowsSelectedShare")]
    public async Task ShowAsPercentageOfOverallTotal_TotalsRowOptionDeselected_ShowsSelectedShare()
    {
        await OpenWithItemAsync("Category");

        await SetShowAsAsync("percentage-of-overall-sum", "no-dp");
        await FilterModule.ClickOptionAsync(Ren, "Category", "Structures");

        await Poll(() => FilterModule.TotalValueAsync(Ren, "Category")).ToBe("41%");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "Castings")).ToBe("41%");
    }

    // In a hierarchy a node's group is its parent, so group and overall stats diverge.  The format is
    // set on the Active level, leaving Category's plain counts.
    [TestMethod("ShowAsPercentageOfGroupTotal_HierarchyNodes_ShowShareOfParentNode")]
    public async Task ShowAsPercentageOfGroupTotal_HierarchyNodes_ShowShareOfParentNode()
    {
        await OpenWithItemAsync("Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");

        await FilterModule.SetNodeValueFormatViaShowAsAsync(
            Ren, "Structures", "Yes",
            "#format-show-as-percentage-of-group-sum",
            "#format-show-as-percentage-of-group-sum-no-dp");

        Expect(await FilterModule.NodeValueAsync(Ren, "Structures", "Yes")).ToBe("91%");
        Expect(await FilterModule.NodeValueAsync(Ren, "Structures", "No")).ToBe("9%");
        Expect(await FilterModule.NodeValueAsync(Ren, "Castings", "No")).ToBe("100%");
        Expect(await FilterModule.NodeValueAsync(Ren, null, "Structures")).ToBe("32");
    }

    [TestMethod("ShowAsPercentageOfOverallTotal_HierarchyNodes_ShowShareOfWholeTree")]
    public async Task ShowAsPercentageOfOverallTotal_HierarchyNodes_ShowShareOfWholeTree()
    {
        await OpenWithItemAsync("Active");
        await FilterModule.GroupItemByAsync(Ren, "Active", "Category");

        await FilterModule.SetNodeValueFormatViaShowAsAsync(
            Ren, "Structures", "Yes",
            "#format-show-as-percentage-of-overall-sum",
            "#format-show-as-percentage-of-overall-sum-no-dp");

        Expect(await FilterModule.NodeValueAsync(Ren, "Structures", "Yes")).ToBe("54%");
        Expect(await FilterModule.NodeValueAsync(Ren, "Castings", "No")).ToBe("41%");
    }
}
