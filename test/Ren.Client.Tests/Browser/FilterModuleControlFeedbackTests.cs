namespace Ren.Client.Tests.Browser;

// These tests cover what a filter module item shows while and after a filter is applied: the
// spinner beside the clicked checkbox or "Invert" link, and the item keeping the width its options
// need once an update re-renders it.
[TestClass]
public class FilterModuleControlFeedbackTests : BrowserTest
{
    private const string Fixture = "ported/FilterModuleTest01.html";

    private const string BusySpinner = ".qa-ren-filter-module-busy-spinner";

    private async Task OpenWithCategoryItemAsync()
    {
        await Ren.OpenAsync(Fixture);
        await FilterModule.CreateFromColumnHeaderAsync(Ren, "Id");
        await FilterModule.AddFirstItemForColumnAsync(Ren, "Category");
    }

    // Clicks a control in the Category item, within the named option or anywhere in the item, and
    // reads whether a spinner was put beside it as part of the click, as it goes once applied.
    private Task<bool> ClickReportingSpinnerAsync(string? optionText, string controlSelector) =>
        FilterModule.EvaluateAsync<bool>(Ren, """
            (finders, [text, selector, spinnerSelector]) => {

                const scope = text ? finders.findOption("Category", text) : finders.findItem("Category");
                const control = scope ? scope.querySelector(selector) : null;

                if (!control) {
                    return false;
                }

                control.click();

                const anchor = control.matches("input") ? control.parentElement : control;

                return anchor.querySelector(spinnerSelector) !== null;
            }
            """, new object?[] { optionText, controlSelector, BusySpinner });

    private Task ExpectCategoriesAsync(string csv) =>
        Poll(() => Filters.ColumnDistinctValuesCsvAsync(Ren, "Category")).ToBe(csv);

    [TestMethod("OptionCheckbox_Clicked_ShowsASpinnerBesideItUntilApplied")]
    public async Task OptionCheckbox_Clicked_ShowsASpinnerBesideItUntilApplied()
    {
        await OpenWithCategoryItemAsync();

        Expect(await ClickReportingSpinnerAsync("Castings", ".ren-filter-module__checkbox")).ToBe(true);

        await Expect(Ren.Root.Locator(BusySpinner)).ToHaveCountAsync(0);
        await ExpectCategoriesAsync("Structures");
    }

    [TestMethod("InvertLink_Clicked_ShowsASpinnerBesideItUntilApplied")]
    public async Task InvertLink_Clicked_ShowsASpinnerBesideItUntilApplied()
    {
        await OpenWithCategoryItemAsync();
        await FilterModule.ClickOptionAsync(Ren, "Category", "Castings");
        await Expect(Ren.Root.Locator(BusySpinner)).ToHaveCountAsync(0);

        Expect(await ClickReportingSpinnerAsync(null, ".qa-ren-filter-module-invert")).ToBe(true);

        await Expect(Ren.Root.Locator(BusySpinner)).ToHaveCountAsync(0);
        await ExpectCategoriesAsync("Castings");
    }

    // The operator applies as soon as it's picked, so the item is re-rendered before the strip's
    // operator change resizes it, which once measured the replaced item at zero wide.
    [TestMethod("CompareOperatorTakingNoValue_Picked_LeavesTheItemsOptionsVisible")]
    public async Task CompareOperatorTakingNoValue_Picked_LeavesTheItemsOptionsVisible()
    {
        await OpenWithCategoryItemAsync();
        await FilterModule.ShowCompareStripAsync(Ren, "Category");

        await Filters.SetCompareFilterOperatorAsync(Ren, "isNotBlank");
        await Ren.WaitUntilLoadedAsync();

        var widths = await FilterModule.EvaluateAsync<double[]>(Ren, """
            (finders) => {

                const item = finders.findItem("Category");

                if (!item) {
                    return [-1, -1];
                }

                const checkbox = item.querySelector(".ren-filter-module__option .ren-filter-module__checkbox");

                return [item.offsetWidth, checkbox ? checkbox.getBoundingClientRect().width : -1];
            }
            """);

        Expect(widths[0]).ToBeGreaterThan(0);
        Expect(widths[1]).ToBeGreaterThan(0);
    }
}
