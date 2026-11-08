using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// Helpers for date/value charts.  Each takes the test's RenContext.  A chart created from a grid
/// opens in a popup, outside the report, so these look across the whole page.
/// </summary>
public static class DateValueChart
{
    private const string ChartSelector = "[data-qa-date-value-chart-date-range]";

    // Right-clicked to open the chart's own menu, since the x-axis sits outside every series.
    private const string AwayFromSeries = ".ren-x-axis";

    // What a chart's QA values hold for a date with no value.
    private const string NullSentinel = "\x01";

    // Walks the newest context menu to an item by its visible text, moving over it and, where
    // asked, clicking it.
    private const string MenuItemByText = """
        ([itemText, clickItem]) => {

            const menus = document.querySelectorAll(".ren-context-menu");
            const menu = menus[menus.length - 1];
            const items = menu
                ? Array.from(menu.querySelectorAll(".ren-context-menu__item--clickable"))
                : [];
            const item = items.find(i => i.offsetParent !== null &&
                i.textContent.trim().replace(/\s+/g, " ") === itemText);

            if (!item) {
                return false;
            }

            item.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

            if (clickItem) {
                item.click();
            }

            return true;
        }
        """;

    private static Task<int> ChartCountAsync(RenContext ren) => ren.Root.Locator(ChartSelector).CountAsync();

    /// <summary>
    /// Opens a menu of the chart by right-clicking a part of it, again while no menu shows, as a
    /// part right-clicked while the chart is drawn again is gone before it can open one.
    /// </summary>
    public static Task OpenMenuAsync(RenContext ren, string selector) =>
        Expectations.ToPassAsync(async () =>
        {
            await ren.Root.RightClickAsync(selector);
            await Assertions.Expect(ren.Root.Locator(".ren-context-menu").Last).ToBeVisibleAsync(new() { Timeout = 1000 });
        });

    /// <summary>
    /// Creates a date/value chart from the selected columns, through a column heading's Create
    /// menu, and waits for it to appear.
    /// </summary>
    public static async Task CreateFromColumnHeadingAsync(RenContext ren, string columnHeading)
    {
        var chartsBefore = await ChartCountAsync(ren);

        await ren.Report.RightClickAsync($".ren-data-grid__column-heading[title='{columnHeading}']");
        await ren.Root.MouseOverAsync("#create-visualisation");
        await ren.Root.ClickAsync("#create-visualisation-date-value-chart");

        await new PollExpectation<int>(() => ChartCountAsync(ren)).ToBeGreaterThan(chartsBefore);
        await ren.WaitUntilLoadedAsync();
    }

    // Clicks a period, such as "day" or "quarter", in the Create > Chart submenu of the open menu.
    // The Chart item is only hovered, as clicking it would create a chart by the default period.
    private static async Task ClickCreateByPeriodAsync(RenContext ren, string datePeriod)
    {
        var chartsBefore = await ChartCountAsync(ren);

        await ren.Root.MouseOverAsync("#create-visualisation");
        await ren.Root.MouseOverAsync("#create-visualisation-date-value-chart");
        await ren.Root.ClickAsync("#create-visualisation-date-value-chart-" + datePeriod);

        await new PollExpectation<int>(() => ChartCountAsync(ren)).ToBeGreaterThan(chartsBefore);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Creates a date/value chart from the selected columns by a period, through a column
    /// heading's Create > Chart submenu.
    /// </summary>
    public static async Task CreateByPeriodFromColumnHeadingAsync(RenContext ren, string columnHeading, string datePeriod)
    {
        await ren.Report.RightClickAsync($".ren-data-grid__column-heading[title='{columnHeading}']");
        await ClickCreateByPeriodAsync(ren, datePeriod);
    }

    /// <summary>
    /// Creates a date/value chart from the selected cells by a period, through a cell's Create >
    /// Chart submenu.
    /// </summary>
    public static async Task CreateByPeriodFromCellAsync(RenContext ren, string columnHeading, int rowHeading, string datePeriod)
    {
        await ren.Report.RightClickCellAsync(columnHeading, rowHeading);
        await ClickCreateByPeriodAsync(ren, datePeriod);
    }

    /// <summary>
    /// Gets the chart's values by date, the dates sorted, leaving out those with no date.
    /// </summary>
    public static async Task<Dictionary<string, string>> DateValuesAsync(RenContext ren)
    {
        await ren.Root.Locator(ChartSelector).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        var entries = await ren.Page.EvaluateAsync<string[][]>("""
            () => {

                const dates = window.Ren.QA.DateValueChart.getDates();
                const values = window.Ren.QA.DateValueChart.getValues();

                return dates
                    .map((date, index) => [String(date), String(values[index])])
                    .filter(entry => entry[0] !== "null")
                    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
            }
            """);

        var result = new Dictionary<string, string>();

        foreach (var entry in entries)
        {
            result[entry[0]] = entry[1];
        }

        return result;
    }

    /// <summary>
    /// Gets the dates the chart has a value for, sorted.
    /// </summary>
    public static async Task<string[]> DatesWithValuesAsync(RenContext ren)
    {
        var values = await DateValuesAsync(ren);

        return values.Keys.Where(date => values[date] != "0" && values[date] != NullSentinel).ToArray();
    }

    /// <summary>
    /// Gets the x-axis tick labels shown, in axis order, each label's lines joined with a space.
    /// </summary>
    public static async Task<string[]> XAxisLabelsAsync(RenContext ren)
    {
        await ren.Root.Locator(".ren-x-axis.ren-date-axis g.tick text").First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        return await ren.Page.EvaluateAsync<string[]>("""
            () => Array.prototype.filter
                .call(
                    document.querySelectorAll(".ren-x-axis.ren-date-axis g.tick"),
                    tick => tick.style.display !== "none"
                )
                .map(tick => Array.prototype.map
                    .call(tick.querySelectorAll("text tspan"), tspan => tspan.textContent)
                    .join(" ")
                    .trim())
            """);
    }

    /// <summary>
    /// Changes the chart's own date grouping through its Group by submenu, such as
    /// "date-week-start".
    /// </summary>
    public static async Task SelectDateGroupingAsync(RenContext ren, string calcFunction)
    {
        await OpenMenuAsync(ren, AwayFromSeries);
        await ren.Root.MouseOverAsync("#chart-date-grouping");
        await ren.Root.ClickAsync("#chart-date-grouping-" + calcFunction);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Changes a series' aggregation through its bar's Aggregation submenu, such as "count".  The
    /// series number starts at 1.
    /// </summary>
    public static async Task SelectAggregationTypeAsync(RenContext ren, string aggregationType, int seriesNumber = 1)
    {
        await OpenMenuAsync(ren, $".ren-bar.ren-vertical[data-series='{seriesNumber}']");
        await ren.Root.MouseOverAsync("#chart-values");
        await ren.Root.MouseOverAsync("#chart-aggregation");
        await ren.Root.ClickAsync(".qa-ren-chart-aggregation-menu-item-" + aggregationType);
        await ren.WaitUntilLoadedAsync();
    }

    // Walks the newest context menu by the visible text of its items, opening each submenu along
    // the way, and clicks the last item, or only hovers it where clickLast is false.
    private static async Task WalkMenuPathAsync(RenContext ren, string[] itemTexts, bool clickLast)
    {
        for (var index = 0; index < itemTexts.Length; index++)
        {
            var click = clickLast && index == itemTexts.Length - 1;
            var itemText = itemTexts[index];

            await new PollExpectation<bool>(
                () => ren.Page.EvaluateAsync<bool>(MenuItemByText, new object[] { itemText, click }),
                "a menu item reading " + itemText)
                .ToBe(true);
        }
    }

    /// <summary>
    /// Opens the chart's own menu and clicks through it by the items' text.
    /// </summary>
    public static async Task ClickMenuPathAsync(RenContext ren, params string[] itemTexts)
    {
        await OpenMenuAsync(ren, AwayFromSeries);
        await WalkMenuPathAsync(ren, itemTexts, true);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Opens a series' menu, on its bar, and clicks through it by the items' text.  The series
    /// number starts at 1.
    /// </summary>
    public static async Task ClickSeriesMenuPathAsync(RenContext ren, int seriesNumber, params string[] itemTexts)
    {
        await OpenMenuAsync(ren, $".ren-bar.ren-vertical[data-series='{seriesNumber}']");
        await WalkMenuPathAsync(ren, itemTexts, true);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Opens the menu of the part of the chart the selector finds, such as a value axis, and clicks
    /// through it by the items' text.
    /// </summary>
    public static async Task ClickMenuPathOnAsync(RenContext ren, string selector, params string[] itemTexts)
    {
        await OpenMenuAsync(ren, selector);
        await WalkMenuPathAsync(ren, itemTexts, true);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Opens the chart's own menu and hovers through it by the items' text, leaving every submenu
    /// open.
    /// </summary>
    public static async Task HoverMenuPathAsync(RenContext ren, params string[] itemTexts)
    {
        await OpenMenuAsync(ren, AwayFromSeries);
        await WalkMenuPathAsync(ren, itemTexts, false);
    }

    /// <summary>
    /// Gets the texts of the visible ticked menu items.
    /// </summary>
    public static Task<string[]> TickedMenuItemsAsync(RenContext ren) => ren.Page.EvaluateAsync<string[]>("""
        () => Array.from(document.querySelectorAll(".ren-context-menu .ren-is-checked"))
            .filter(item => item.offsetParent !== null)
            .map(item => item.textContent.trim().replace(/\s+/g, " "))
        """);

    /// <summary>
    /// Gets the number of series the chart draws.
    /// </summary>
    public static async Task<int> SeriesCountAsync(RenContext ren)
    {
        await ren.Root.Locator(ChartSelector).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        return await ren.Page.EvaluateAsync<int>("""
            () => {

                const seriesNumbers = {};

                Array.prototype.forEach.call(
                    document.querySelectorAll(".ren-chart-group [data-series]"),
                    element => {
                        seriesNumbers[element.getAttribute("data-series")] = true;
                    }
                );

                return Object.keys(seriesNumbers).length;
            }
            """);
    }

    /// <summary>
    /// Splits the chart's data into a series per value of a column, through its "Split data"
    /// submenu.
    /// </summary>
    public static Task SplitDataAsync(RenContext ren, string columnHeading) => ClickMenuPathAsync(ren, "Split data", columnHeading);

    /// <summary>
    /// Adds a column to the chart as another series, through its "Add data series" submenu.
    /// </summary>
    public static Task AddDataSeriesAsync(RenContext ren, string columnHeading) => ClickMenuPathAsync(ren, "Add data series", columnHeading);

    // Scopes a selector to one chart, such as ".js-first-chart", where a page holds several.
    private static string Scoped(string? chartScope, string selector) => chartScope != null ? chartScope + " " + selector : selector;

    /// <summary>
    /// Clicks one of the items directly in the chart's Date range submenu, such as
    /// "chart-date-range-all".
    /// </summary>
    public static async Task SelectDateRangeAsync(RenContext ren, string menuItemId, string? chartScope = null)
    {
        await OpenMenuAsync(ren, Scoped(chartScope, AwayFromSeries));
        await ren.Root.MouseOverAsync("#chart-date-range");
        await ren.Root.ClickAsync("#" + menuItemId);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Gets the text of the chart's Date range menu item, which names the range the chart is
    /// narrowed to, leaving the menu open.
    /// </summary>
    public static async Task<string> DateRangeMenuItemTextAsync(RenContext ren, string? chartScope = null)
    {
        await OpenMenuAsync(ren, Scoped(chartScope, AwayFromSeries));

        var text = await ren.Root.Locator("#chart-date-range").First.TextContentAsync() ?? "";

        return System.Text.RegularExpressions.Regex.Replace(text.Trim(), @"\s+", " ");
    }

    /// <summary>
    /// Narrows the chart to a whole month from its Date range submenu, such as 2024 and "Jan".
    /// </summary>
    public static async Task SelectDateRangeMonthAsync(RenContext ren, int year, string month, string? chartScope = null)
    {
        await OpenMenuAsync(ren, Scoped(chartScope, AwayFromSeries));
        await ren.Root.MouseOverAsync("#chart-date-range");
        await ren.Root.MouseOverAsync("#date-selector-month");
        await ren.Root.MouseOverAsync("#date-selector-month-year-" + year);
        await ren.Root.ClickAsync($".qa-ren-chart-date-range-menu-item-{month}-{year}");
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Narrows the chart to a range picked on the calendar its Custom... item opens, by clicking
    /// the range's first day and then its last.  The dates are yyyy-MM-dd.
    /// </summary>
    public static async Task SetCustomDateRangeAsync(RenContext ren, string from, string to, string? chartScope = null)
    {
        await SelectDateRangeAsync(ren, "chart-date-range-custom", chartScope);
        await Calendar.ClickDayAsync(ren, from);
        await Calendar.ClickDayAsync(ren, to);
    }

    private sealed record PlotPoint(double X, double Y, double Right);

    // Gets a point of empty plot above a bar, the bar numbered from 1 at the left, or above the
    // shortest bar where there's no number, along with the plot's right-hand end.
    private static async Task<PlotPoint> PointAboveBarAsync(RenContext ren, int? barNumber, string? chartScope)
    {
        var barsSelector = Scoped(chartScope, ".ren-bar.ren-vertical");

        await ren.Root.Locator(barsSelector).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        return await ren.Page.EvaluateAsAsync<PlotPoint>("""
            ([bars, domainSelector, number]) => {

                // The chart ignores presses on these, and labels a few bars' values just above them.
                const occupied = "[data-series], .ren-axis, .ren-marker-lines, .ren-value-labels-layer, " +
                    ".ren-bar-resize-handle";
                const findEmptyYAbove = (x, y) => {

                    let emptyY = y;

                    while (emptyY > 0) {

                        const element = document.elementFromPoint(x, emptyY);

                        if (!element || !element.closest(occupied)) {
                            break;
                        }

                        emptyY -= 4;
                    }

                    return emptyY;
                };

                const domain = document.querySelector(domainSelector);

                domain.scrollIntoView({ block: "center" });

                const rects = Array.from(document.querySelectorAll(bars))
                    .map(bar => bar.getBoundingClientRect());

                // Three quarters across lands on the bar's own date, whether bars are centred on
                // their dates or start at them.
                const bar = number
                    ? rects.sort((a, b) => a.left - b.left)[number - 1]
                    : rects.sort((a, b) => b.top - a.top)[0];
                const x = bar.left + bar.width * (number ? 0.75 : 0.5);

                return {
                    x,
                    y: findEmptyYAbove(x, bar.top - 10),
                    right: domain.getBoundingClientRect().right
                };
            }
            """, new object?[] { barsSelector, Scoped(chartScope, ".ren-x-axis.ren-date-axis .domain"), barNumber });
    }

    /// <summary>
    /// Drags across the plot from empty space above a bar, numbered from 1 at the left, to beyond
    /// the plot's right-hand end, which narrows the chart to the dates from that bar's to the last.
    /// </summary>
    public static async Task DragFromBarAsync(RenContext ren, int barNumber, string? chartScope = null)
    {
        var point = await PointAboveBarAsync(ren, barNumber, chartScope);

        await ren.Page.Mouse.MoveAsync((float)point.X, (float)point.Y);
        await ren.Page.Mouse.DownAsync();
        await ren.Page.Mouse.MoveAsync((float)point.Right + 20, (float)point.Y);
        await ren.Page.Mouse.UpAsync();
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Double-clicks empty plot above the shortest bar.
    /// </summary>
    public static async Task DoubleClickPlotAsync(RenContext ren, string? chartScope = null)
    {
        var point = await PointAboveBarAsync(ren, null, chartScope);

        await ren.Page.Mouse.DblClickAsync((float)point.X, (float)point.Y);
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Moves the mouse over empty plot above the shortest bar.
    /// </summary>
    public static async Task MouseOverPlotAsync(RenContext ren, string? chartScope = null)
    {
        var point = await PointAboveBarAsync(ren, null, chartScope);

        await ren.Page.Mouse.MoveAsync((float)point.X, (float)point.Y);
    }

    // The zoom buttons are drawn in SVG, which has no click() of its own, so the click's
    // dispatched.
    private static async Task ClickZoomButtonAsync(RenContext ren, string buttonSelector, string? chartScope)
    {
        var button = ren.Root.Locator(Scoped(chartScope, buttonSelector)).First;

        await button.WaitForAsync(new() { State = WaitForSelectorState.Attached });
        await button.DispatchEventAsync("click");
        await ren.WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks the Reset zoom button a chart shows while narrowed to a date range.
    /// </summary>
    public static Task ClickResetZoomAsync(RenContext ren, string? chartScope = null) => ClickZoomButtonAsync(ren, ".ren-date-range-reset", chartScope);

    /// <summary>
    /// Clicks the Undo zoom button a chart shows while it has a zoom to undo.
    /// </summary>
    public static Task ClickUndoZoomAsync(RenContext ren, string? chartScope = null) => ClickZoomButtonAsync(ren, ".ren-date-range-undo", chartScope);

    /// <summary>
    /// Gets a value indicating whether the chart is drawing its crosshairs.
    /// </summary>
    public static Task<bool> IsCrosshairsShownAsync(RenContext ren, string? chartScope = null) => ren.Page.EvaluateAsync<bool>("""
        (selector) => {

            const crosshairs = document.querySelector(selector);

            return !!crosshairs && getComputedStyle(crosshairs).display !== "none";
        }
        """, Scoped(chartScope, "g.ren-crosshairs"));
}
