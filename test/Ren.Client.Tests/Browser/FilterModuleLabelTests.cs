namespace Ren.Client.Tests.Browser;

// These tests cover "Label calculation", which puts a filter module item's checkbox labels through
// a calc function before they're shown.  Only the labels are calculated: the value behind each
// checkbox is the column's own, so a checkbox reading as something else still filters the rows it
// always did.
//
// Category holds Castings on 22 rows and Structures on 32, whose lengths are 8 and 10.
[TestClass]
public class FilterModuleLabelTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    // The length calculation is one of the binning functions offered for a text column, so it
    // carries a binning ID.
    private const string LengthCalculation = "#group-by-column-binning-string-length-calc";

    private const string NoCalculation = "#calc-normal";

    private async Task CreateModuleWithCategoryItemAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    private Task SetLabelCalculationAsync(string calculationSelector) =>
        FilterModule.ChooseFromItemHeadingMenuAsync(Ren, "Category", "#filter-module-label-calculation", calculationSelector);

    private async Task<string[]> SortedOptionTextsAsync() => Text.Sorted(await FilterModule.OptionTextsAsync(Ren, "Category"));

    [TestMethod("LabelCalculation_Length_LabelsEachCheckboxWithItsValuesLength")]
    public async Task LabelCalculation_Length_LabelsEachCheckboxWithItsValuesLength()
    {
        await CreateModuleWithCategoryItemAsync();

        await SetLabelCalculationAsync(LengthCalculation);

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "10", "8" });
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "8")).ToBe("22");
        Expect(await FilterModule.OptionCountAsync(Ren, "Category", "10")).ToBe("32");
    }

    [TestMethod("LabelCalculation_AppliedThenSetBackToNone_RestoresTheValuesOwnLabels")]
    public async Task LabelCalculation_AppliedThenSetBackToNone_RestoresTheValuesOwnLabels()
    {
        await CreateModuleWithCategoryItemAsync();

        await SetLabelCalculationAsync(LengthCalculation);
        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "10", "8" });
        await SetLabelCalculationAsync(NoCalculation);

        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "Castings", "Structures" });
    }

    // "8" is Castings's checkbox reading as its length, so unticking it takes the Castings rows out.
    [TestMethod("LabelCalculation_CheckboxUnticked_FiltersOnTheValueBehindTheLabel")]
    public async Task LabelCalculation_CheckboxUnticked_FiltersOnTheValueBehindTheLabel()
    {
        await CreateModuleWithCategoryItemAsync();

        await SetLabelCalculationAsync(LengthCalculation);
        await Poll(SortedOptionTextsAsync).ToEqual(new[] { "10", "8" });
        await FilterModule.ClickOptionAsync(Ren, "Category", "8");

        await Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe("Structures");
    }
}
