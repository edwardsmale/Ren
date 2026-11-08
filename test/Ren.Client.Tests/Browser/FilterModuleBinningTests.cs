namespace Ren.Client.Tests.Browser;

// These tests cover a filter module item's binning function, the calc function its values go
// through before anything else reads them, chosen from the "+ binning function" link in its heading
// row.  A binned item shows a checkbox per bin, and its ticks match a row on the bin its value
// falls in.
//
// The report has 54 rows, 22 Castings and 32 Structures, so binning Category by first letter gives
// C (22) and S (32).  Unique Searches Per Day is zero on six rows and positive on the other 48.
[TestClass]
public class FilterModuleBinningTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private const string FirstLetterBinning = "#group-by-column-binning-first-letter-filter-module";
    private const string StringLengthBinning = "#group-by-column-binning-string-length-filter-module";
    private const string PositiveZeroNegativeBinning = "#group-by-column-binning-pos-zero-neg-filter-module";
    private const string NoBinning = "#group-by-column-binning-none-filter-module";

    private const string Searches = "Unique Searches Per Day";

    private async Task OpenWithItemAsync(string columnHeading)
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, columnHeading);
    }

    private Task ExpectOptionsInAnyOrderAsync(string itemHeading, params string[] expected) =>
        Poll(async () => Text.Sorted(await FilterModule.OptionTextsAsync(Ren, itemHeading)))
            .ToEqual(Text.Sorted(expected));

    // The link adding a function gives way to the function itself while one is in effect.
    [TestMethod("BinningFunction_FirstLetterOnATextItem_ShowsOneCheckboxPerBin")]
    public async Task BinningFunction_FirstLetterOnATextItem_ShowsOneCheckboxPerBin()
    {
        await OpenWithItemAsync("Category");

        await FilterModule.SetBinningFunctionAsync(Ren, "Category", FirstLetterBinning);

        await ExpectOptionsInAnyOrderAsync("Category", "S", "C");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "C")).ToBe("22");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "S")).ToBe("32");
        Expect(await FilterModule.BinningLabelAsync(Ren, "Category")).ToBe("First Letter");
    }

    // Sorting by label orders the bins by the sort key the function wrote them with, so Zero comes
    // before Positive, where the captions and the counts would both put Positive first.
    [TestMethod("BinningFunction_OnANumericItem_OrdersTheBinsAsTheFunctionMeantThem")]
    public async Task BinningFunction_OnANumericItem_OrdersTheBinsAsTheFunctionMeantThem()
    {
        await OpenWithItemAsync(Searches);

        await FilterModule.SetBinningFunctionAsync(Ren, Searches, PositiveZeroNegativeBinning);

        await Poll(() => FilterModule.OptionCountAsync(Ren, Searches, "Zero")).ToBe("6");
        Expect(await FilterModule.OptionCountAsync(Ren, Searches, "Positive")).ToBe("48");

        await FilterModule.ChooseFromItemHeadingMenuAsync(Ren, Searches, "#filter-module-sort-by-label");

        await Poll(() => FilterModule.OptionTextsAsync(Ren, Searches)).ToEqual(new[] { "Zero", "Positive" });
    }

    // A bin isn't a value any row holds, so unticking it filters the rows whose values bin to it.
    [TestMethod("BinnedOption_UntickedThenReticked_FiltersTheSourceGridByTheWholeBin")]
    public async Task BinnedOption_UntickedThenReticked_FiltersTheSourceGridByTheWholeBin()
    {
        await OpenWithItemAsync("Category");
        await FilterModule.SetBinningFunctionAsync(Ren, "Category", FirstLetterBinning);
        await ExpectOptionsInAnyOrderAsync("Category", "S", "C");

        await FilterModule.ClickOptionAsync(Ren, "Category", "C");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Structures");

        await FilterModule.ClickOptionAsync(Ren, "Category", "C");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Castings,Structures");
    }

    [TestMethod("BinningFunctionCross_Clicked_RestoresTheItemsOwnValues")]
    public async Task BinningFunctionCross_Clicked_RestoresTheItemsOwnValues()
    {
        await OpenWithItemAsync("Category");
        await FilterModule.SetBinningFunctionAsync(Ren, "Category", FirstLetterBinning);
        await ExpectOptionsInAnyOrderAsync("Category", "S", "C");

        await FilterModule.ClearBinningFunctionAsync(Ren, "Category");

        await ExpectOptionsInAnyOrderAsync("Category", "Castings", "Structures");
        Expect(await FilterModule.BinningLabelAsync(Ren, "Category")).ToBeNull();
    }

    // A second choice replaces the first rather than compounding with it.  "No binning" is only on
    // the menu the function's own button opens.
    [TestMethod("BinningFunction_ChangedThenTakenOff_ShowsEachChoicesBinsInTurn")]
    public async Task BinningFunction_ChangedThenTakenOff_ShowsEachChoicesBinsInTurn()
    {
        await OpenWithItemAsync("Category");
        await FilterModule.SetBinningFunctionAsync(Ren, "Category", FirstLetterBinning);
        await ExpectOptionsInAnyOrderAsync("Category", "S", "C");

        await FilterModule.ChangeBinningFunctionAsync(Ren, "Category", StringLengthBinning);

        await ExpectOptionsInAnyOrderAsync("Category", "8", "10");
        Expect(await FilterModule.BinningLabelAsync(Ren, "Category")).ToBe("String Length");

        await FilterModule.ChangeBinningFunctionAsync(Ren, "Category", NoBinning);

        await ExpectOptionsInAnyOrderAsync("Category", "Castings", "Structures");
    }

    // The link is offered where it was asked for, so an item added to a panel starts without it.
    [TestMethod("BinningFunctionLink_ItemAddedToTheModule_IsOfferedOnlyOnceAskedFor")]
    public async Task BinningFunctionLink_ItemAddedToTheModule_IsOfferedOnlyOnceAskedFor()
    {
        await OpenWithItemAsync("Category");

        Expect(await FilterModule.IsBinningLinkShownAsync(Ren, "Category")).ToBe(false);

        await FilterModule.ToggleBinningLinkAsync(Ren, "Category");

        Expect(await FilterModule.IsBinningLinkShownAsync(Ren, "Category")).ToBe(true);
    }

    // Choosing a function turns the link on, so turning the setting back off leaves the item binned
    // with it off.  The function stays stated, with its cross, so a binning is never left invisible.
    [TestMethod("BinningFunctionLink_TurnedOffWhileAFunctionIsInEffect_LeavesTheFunctionStated")]
    public async Task BinningFunctionLink_TurnedOffWhileAFunctionIsInEffect_LeavesTheFunctionStated()
    {
        await OpenWithItemAsync("Category");
        await FilterModule.SetBinningFunctionAsync(Ren, "Category", FirstLetterBinning);

        await FilterModule.ToggleBinningLinkAsync(Ren, "Category");

        Expect(await FilterModule.BinningLabelAsync(Ren, "Category")).ToBe("First Letter");
        await ExpectOptionsInAnyOrderAsync("Category", "S", "C");

        await FilterModule.ClearBinningFunctionAsync(Ren, "Category");

        await ExpectOptionsInAnyOrderAsync("Category", "Castings", "Structures");
        Expect(await FilterModule.IsBinningLinkShownAsync(Ren, "Category")).ToBe(false);
    }
}
