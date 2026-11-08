using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// Helpers for the column filter popup and the compare filters it hosts.  Each takes the test's
/// RenContext.
///
/// A column carries one compare filter strip per filter, and the compare helpers address a strip by
/// its position down the page, the first being 0.
/// </summary>
public static class Filters
{
    public const string FilterModuleOption = ".ren-filter-module__option[data-value]";

    private const string CompareStripSelector = ".qa-ren-filter-module-compare-strip";
    private const string FilterModuleBusySpinner = ".qa-ren-filter-module-busy-spinner";

    /// <summary>
    /// Opens a column's data row filter from its heading's down arrow, through the "Advanced
    /// filter" submenu, since the "Filter..." item opens whichever filter is the column's default.
    /// </summary>
    public static Task OpenColumnFilterAsync(RenContext ren, string columnHeading) =>
        OpenFromMoreFilterOptionsAsync(ren, columnHeading, "#more-filter-options-filter-data-rows-menu-item");

    /// <summary>
    /// Opens the "Filter groups..." popup for a column, which filters the group rows of the
    /// grouping beneath the totals row rather than the data rows.
    /// </summary>
    public static Task OpenFilterGroupsAsync(RenContext ren, string columnHeading) =>
        OpenFromMoreFilterOptionsAsync(ren, columnHeading, "#more-filter-options-filter-groups-menu-item");

    private static async Task OpenFromMoreFilterOptionsAsync(RenContext ren, string columnHeading, string menuItemSelector)
    {
        var headerCell = await ren.Report.CellSelectorAsync(columnHeading, 1);

        await ren.Root.ClickAsync(headerCell + " .qa-ren-down-arrow-button");
        await ren.Root.MouseOverAsync("#more-filter-options-menu-item");
        await ren.Root.ClickAsync(menuItemSelector);
        await ren.Root.Locator(FilterModuleOption).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    /// <summary>
    /// Gets a locator for the compare filter strip at the given position.
    /// </summary>
    public static ILocator CompareStrip(RenContext ren, int stripIndex) => ren.Root.Locator(CompareStripSelector).Nth(stripIndex);

    /// <summary>
    /// Gets a locator for the compare filter strips on the page.
    /// </summary>
    public static ILocator CompareStrips(RenContext ren) => ren.Root.Locator(CompareStripSelector);

    // Clicks something within a compare filter strip, with the element's click().
    private static async Task ClickWithinStripAsync(RenContext ren, int stripIndex, string selector) =>
        await CompareStrip(ren, stripIndex).Locator(selector).First.EvaluateAsync("element => element.click()");

    /// <summary>
    /// Selects an operator in a compare filter's picker.  The picker is either a select or a button
    /// opening a context menu, so this drives whichever it finds, hovering first over the submenu
    /// the operator may be filed under.
    /// </summary>
    public static async Task SetCompareFilterOperatorAsync(RenContext ren, string operatorId, int stripIndex = 0)
    {
        var menuOpened = await CompareStrip(ren, stripIndex)
            .Locator(".qa-ren-compare-filter-operator")
            .First
            .EvaluateAsync<bool>("""
                (picker, id) => {

                    if (picker.tagName === "SELECT") {

                        picker.value = id;
                        picker.dispatchEvent(new Event("change", { bubbles: true }));
                        return false;
                    }

                    picker.click();
                    return true;
                }
                """, operatorId);

        if (menuOpened)
        {
            var submenuId = await ren.Page.EvaluateAsync<string?>("""
                (id) => {

                    const operator = window.Ren.FilterCompareOperators.getOperator(id);
                    return operator && operator.submenu ? String(operator.submenu.id) : null;
                }
                """, operatorId);

            if (submenuId != null)
            {
                await ren.Root.MouseOverAsync("#compare-operator-submenu-" + submenuId);
            }

            await ren.Root.ClickAsync("#compare-operator-" + operatorId);
        }
    }

    /// <summary>
    /// Sets the text of one of a compare filter's value inputs (1 or 2), firing the input event
    /// that typing would.
    /// </summary>
    public static async Task SetCompareFilterInputValueAsync(RenContext ren, int inputNumber, string value, int stripIndex = 0) =>
        await CompareStrip(ren, stripIndex)
            .Locator(".qa-ren-compare-filter-value-" + inputNumber)
            .First
            .FillAsync(value);

    /// <summary>
    /// Clicks a compare filter's Apply button and waits for it to come out of its applying state,
    /// which is how the control says the filter has been applied and the grid re-rendered.
    /// </summary>
    public static async Task ClickCompareFilterApplyAsync(RenContext ren, int stripIndex = 0)
    {
        await ClickWithinStripAsync(ren, stripIndex, ".qa-ren-compare-filter-apply");
        await ren.Root
            .Locator(".qa-ren-compare-filter-applying")
            .First
            .WaitForAsync(new() { State = WaitForSelectorState.Detached });
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Sets a compare filter's operator and value(s), then applies it.
    /// </summary>
    public static async Task ApplyCompareFilterAsync(RenContext ren, string operatorId, string? value1 = null, string? value2 = null, int stripIndex = 0)
    {
        await SetCompareFilterOperatorAsync(ren, operatorId, stripIndex);

        if (value1 != null) await SetCompareFilterInputValueAsync(ren, 1, value1, stripIndex);

        if (value2 != null) await SetCompareFilterInputValueAsync(ren, 2, value2, stripIndex);

        await ClickCompareFilterApplyAsync(ren, stripIndex);
    }

    /// <summary>
    /// Clicks a compare filter's cross, which takes the filter off the column where it's one of
    /// several, and empties it where it's the only one.
    /// </summary>
    public static Task ClickCompareFilterClearAsync(RenContext ren, int stripIndex = 0) =>
        ClickWithinStripAsync(ren, stripIndex, ".qa-ren-compare-filter-clear");

    /// <summary>
    /// Clicks a compare filter's "and" or "or" link, giving the column a further compare filter,
    /// and waits for the strip it adds.
    /// </summary>
    public static async Task ClickCompareFilterJoinLinkAsync(RenContext ren, int stripIndex, string word)
    {
        var stripCount = await CompareStrips(ren).CountAsync();

        await ClickWithinStripAsync(ren, stripIndex, ".qa-ren-compare-filter-" + word);
        await CompareStrip(ren, stripCount).WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    /// <summary>
    /// Gets the operator a compare filter's picker has selected: the select's value, or the
    /// operator the context-menu picker's button carries.
    /// </summary>
    public static Task<string> CompareFilterOperatorAsync(RenContext ren, int stripIndex = 0) =>
        CompareStrip(ren, stripIndex)
            .Locator(".qa-ren-compare-filter-operator")
            .First
            .EvaluateAsync<string>("picker => picker.tagName === \"SELECT\" ? picker.value : picker.getAttribute(\"data-operator\")");

    /// <summary>
    /// Gets the text of one of a compare filter's value inputs (1 or 2).
    /// </summary>
    public static Task<string> CompareFilterInputValueAsync(RenContext ren, int inputNumber, int stripIndex = 0) =>
        CompareStrip(ren, stripIndex)
            .Locator(".qa-ren-compare-filter-value-" + inputNumber)
            .First
            .InputValueAsync();

    /// <summary>
    /// Gets a value indicating whether a compare filter's Apply button shows the "in effect"
    /// colouring, which says its column has a compare filter applied.
    /// </summary>
    public static async Task<bool> IsCompareFilterInEffectAsync(RenContext ren, int stripIndex = 0) =>
        await CompareStrip(ren, stripIndex)
            .Locator(".qa-ren-compare-filter-apply.qa-ren-compare-filter-in-effect")
            .CountAsync() > 0;

    /// <summary>
    /// Fixes the date Ren.DateUtils.today gives for the rest of the page's life, so the relative
    /// date operators reckon their windows from a known day.
    /// </summary>
    public static async Task SetTodayAsync(RenContext ren, int year, int month, int day) =>
        await ren.Page.EvaluateAsync(
            "([y, m, d]) => { window.Ren.DateUtils.today = () => new Date(Date.UTC(y, m - 1, d)); }",
            new[] { year, month, day });

    /// <summary>
    /// Clicks the checkbox for a value in the filter showing, toggling it in or out of the filter,
    /// and waits for the filter module to finish applying it.
    /// </summary>
    public static async Task ClickFilterCheckboxAsync(RenContext ren, string value)
    {
        var clicked = await ren.Page.EvaluateAsync<bool>("""
            ([optionSelector, optionValue]) => {

                const options = Array.from(document.querySelectorAll(optionSelector));
                const option = options.find(o => o.dataset.value === optionValue);

                if (!option) {
                    return false;
                }

                option.querySelector(".ren-filter-module__checkbox").click();
                return true;
            }
            """, new[] { FilterModuleOption, value });

        if (!clicked) throw new InvalidOperationException("Expected the filter to offer the value " + value);

        await WaitForFilterAppliedAsync(ren);
    }

    /// <summary>
    /// Clicks the "All" checkbox of the filter showing, and waits for the filter to be applied.
    /// </summary>
    public static async Task ClickFilterAllCheckboxAsync(RenContext ren)
    {
        await ren.Root.ClickAsync(".ren-filter-module__all-option .ren-filter-module__checkbox");
        await WaitForFilterAppliedAsync(ren);
    }

    private static async Task WaitForFilterAppliedAsync(RenContext ren)
    {
        await ren.Root.Locator(FilterModuleBusySpinner).First.WaitForAsync(new() { State = WaitForSelectorState.Detached });
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks "Clear filter" on a column heading's down arrow menu.
    /// </summary>
    public static async Task ClearColumnFilterAsync(RenContext ren, string columnHeading)
    {
        var headerCell = await ren.Report.CellSelectorAsync(columnHeading, 1);

        await ren.Root.ClickAsync(headerCell + " .qa-ren-down-arrow-button");
        await ren.Root.ClickAsync(".qa-ren-clear-column-filter-menu-item");
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Gets the background colour of a column heading's down arrow, which turns pink while the
    /// column is filtered.
    /// </summary>
    public static async Task<string> DownArrowBackgroundColourAsync(RenContext ren, string columnHeading)
    {
        var headerCell = await ren.Report.CellSelectorAsync(columnHeading, 1);

        return await ren.Page.Locator(headerCell + " .qa-ren-down-arrow-button")
            .EvaluateAsync<string>("arrow => window.getComputedStyle(arrow).backgroundColor");
    }

    /// <summary>
    /// Gets the distinct values of a column of the report's grid, without its heading: sorted
    /// numerically where they're all numbers, and as text otherwise.
    /// </summary>
    public static async Task<string[]> ColumnDistinctValuesAsync(RenContext ren, string columnHeading)
    {
        var lines = (await ren.Report.ColumnTextAsync(columnHeading))
            .Replace("\r", "")
            .Split('\n')
            .Skip(1)
            .Distinct()
            .ToArray();

        static bool IsNumber(string line) => line.Trim() != "" && double.TryParse(line, System.Globalization.CultureInfo.InvariantCulture, out _);

        if (lines.All(IsNumber))
        {
            return lines
                .OrderBy(line => double.Parse(line, System.Globalization.CultureInfo.InvariantCulture))
                .Select(line => Js.NumberToString(double.Parse(line, System.Globalization.CultureInfo.InvariantCulture)))
                .ToArray();
        }

        return lines.Order(StringComparer.Ordinal).ToArray();
    }

    /// <summary>
    /// Gets a column's distinct values as ColumnDistinctValuesAsync does, comma-separated.
    /// </summary>
    public static async Task<string> ColumnDistinctValuesCsvAsync(RenContext ren, string columnHeading) =>
        string.Join(",", await ColumnDistinctValuesAsync(ren, columnHeading));
}
