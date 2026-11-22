using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests;

/// <summary>
/// A scope within a fixture page: the page as a whole, a report, a popup or a data grid.  Each
/// derived context shares its page, so selectors built with Scope() address only what's inside it.
/// </summary>
public sealed partial class RenContext(IPage page, string scopeSelector = "")
{
    private const string ReportSelector = ".qa-ren-report-context";
    private const string PopupSelector = ".qa-ren-report-context--inside-popup";
    private const string EmbeddedReportSelector = ".qa-ren-report-context--embedded-report";
    private const string GridIndexClassPrefix = "qa-ren-grid-index-";

    // The elements Ren replaces with visualisations.  One still on the page hasn't been rendered.
    private const string UnrenderedElementsSelector = "ren-grid, ren-key-value-grid, ren-date-value-chart, ren-calendar";

    private static readonly JsonSerializerOptions ScriptJson = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public IPage Page { get; } = page;

    public string ScopeSelector { get; } = scopeSelector;

    /// <summary>
    /// Opens a page in test/browser/fixtures/ and waits for Ren to finish loading it.
    /// </summary>
    public async Task<RenContext> OpenAsync(string fixtureName)
    {
        await Page.AddInitScriptAsync("""
            document.addEventListener("DOMContentLoaded", () => {

                window.Ren.Messages.Events.allReportsLoaded.handle(() => {

                    window.renTestAllReportsLoaded = true;
                });
            });
            """);

        await Page.GotoAsync("/test/browser/fixtures/" + fixtureName);
        await WaitUntilLoadedAsync();

        return this;
    }

    /// <summary>
    /// Gets the report's settings as they'd be saved.
    /// </summary>
    public Task<JsonNode?> SavedSettingsAsync() =>
        Page.EvaluateJsonAsync("() => window.Ren.ReportSerializer.getReportSettingsObject(false)");

    /// <summary>
    /// Opens a page in test/browser/fixtures/ with the given report settings in place of its own,
    /// as though they had been saved and the report reloaded.
    /// </summary>
    public async Task<RenContext> OpenWithSettingsAsync(string fixtureName, object? settings)
    {
        await Page.RouteAsync("**/fixtures/" + fixtureName, async route =>
        {
            var response = RepoServer.Serve(route.Request.Url);
            var html = SettingsFileScript().Replace(
                response.Text,
                match => match.Groups[1].Value + JsonSerializer.Serialize(Matchers.ToNode(settings), ScriptJson) + match.Groups[2].Value,
                1);

            await route.FulfillAsync(new RouteFulfillOptions { Status = response.Status, ContentType = response.ContentType, Body = html });
        });

        return await OpenAsync(fixtureName);
    }

    /// <summary>
    /// Waits until every Ren element has been rendered, nothing is loading and no report is being
    /// reloaded.
    /// </summary>
    public async Task WaitUntilLoadedAsync()
    {
        await Page.WaitForFunctionAsync("""
            (unrenderedElementsSelector) => {

                return window.renTestAllReportsLoaded === true &&
                    !document.querySelector(unrenderedElementsSelector) &&
                    !window.Ren.LoadingAnimations.areAnyLoadingAnimationsPresent() &&
                    !window.Ren.QA.isReloading();
            }
            """, UnrenderedElementsSelector);
    }

    /// <summary>
    /// Prefixes a selector with this context's scope.
    /// </summary>
    public string Scope(string selector) => (ScopeSelector + " " + selector).Trim();

    /// <summary>
    /// Gets a locator for the elements matching a selector within this context.
    /// </summary>
    public ILocator Locator(string selector) => Page.Locator(Scope(selector));

    /// <summary>
    /// Gets a context scoped to the page as a whole.
    /// </summary>
    public RenContext Root => new(Page);

    /// <summary>
    /// Gets a context scoped to the report on the page.
    /// </summary>
    public RenContext Report => new(Page, ReportSelector);

    /// <summary>
    /// Waits until at least the given number of popup (or embedded) reports are open, then gets a
    /// context scoped to the one at that position, counting from 1 in the order they were opened.
    /// The scope is the popup's report context GUID, so it's unique to that popup.
    /// </summary>
    public async Task<RenContext> PopupAsync(int occurrence = 1)
    {
        const string IdentifiedPopupSelector =
            PopupSelector + "[data-report-context-guid], " + EmbeddedReportSelector + "[data-report-context-guid]";

        var popup = Page.Locator(IdentifiedPopupSelector).Nth(occurrence - 1);

        await popup.WaitForAsync();

        var reportContextGuid = await popup.GetAttributeAsync("data-report-context-guid");
        var context = new RenContext(Page, $"[data-report-context-guid=\"{reportContextGuid}\"]");

        await context.WaitUntilLoadedAsync();

        return context;
    }

    /// <summary>
    /// Gets a context scoped to the data grid with the given index within this context.  Grids are
    /// indexed in the order they were created, starting at 0.
    /// </summary>
    public RenContext Grid(int gridIndex) => new(Page, Scope("." + GridIndexClassPrefix + gridIndex));

    /// <summary>
    /// Gets a context scoped to the element matching a selector within this context.
    /// </summary>
    public RenContext Within(string selector) => new(Page, Scope(selector));

    /// <summary>
    /// Gets the index of the first data grid in this context, as Ren.QA numbers them.  It's read
    /// from the grid's class, so it's right however many grids and popups the page has.
    /// </summary>
    public async Task<int> DataGridIndexAsync()
    {
        // A context from Grid() is scoped to the grid element itself.
        var gridSelector = ScopeSelector.Contains(GridIndexClassPrefix)
            ? ScopeSelector
            : Scope($"[class*=\"{GridIndexClassPrefix}\"]");

        var className = await Page.Locator(gridSelector).First.GetAttributeAsync("class");
        var match = GridIndexClass().Match(className ?? "");

        return match.Success ? int.Parse(match.Groups[1].Value) : 0;
    }

    /// <summary>
    /// Gets the text of the named columns of this context's data grid, tab-separated as copying
    /// them would give, using Ren.QA.
    /// </summary>
    public async Task<string> ColumnTextAsync(params string[] columnHeadings)
    {
        var gridIndex = await DataGridIndexAsync();

        return await Page.EvaluateAsync<string>(
            "([index, headings]) => window.Ren.QA.getColumnText(index, headings)",
            new object[] { gridIndex, columnHeadings });
    }

    /// <summary>
    /// Gets the text of a data grid row's cells, by its row number (1 being the first data row).
    /// </summary>
    public async Task<IReadOnlyList<string>> RowTextAsync(int rowNumber) =>
        await Locator($".ren-data-grid__cell.ren-r-{rowNumber}").AllTextContentsAsync();

    /// <summary>
    /// The column and row indexes of a data grid cell.
    /// </summary>
    public sealed record CellIndexes(int ColumnIndex, int RowIndex);

    /// <summary>
    /// Gets the column index of the visible data grid column with the given heading (or -1 where
    /// there's none), and the row index of the row with the given row heading: the number shown
    /// beside the row plus one, since the header row used to be numbered too.  (So a row heading
    /// of 2 is the first data row.)
    /// </summary>
    public async Task<CellIndexes> CellIndexesAsync(string? columnHeading, int rowHeading)
    {
        await Locator(".ren-data-grid__cell.ren-c-0.ren-r-0").First.WaitForAsync(new() { State = WaitForSelectorState.Attached });

        var indexes = await Page.EvaluateAsAsync<CellIndexes>("""
            ([scope, heading, row]) => {

                const find = (selector) => document.querySelector((scope + " " + selector).trim());

                let columnIndex = -1;

                for (let c = 0; find(`.ren-data-grid__cell.ren-c-${c}.ren-r-0`); c++) {

                    const headerCell = find(`.ren-data-grid__cell.ren-c-${c}.ren-r-0`);
                    const value = find(`.ren-data-grid__cell.ren-c-${c}.ren-r-0 .ren-data-grid__header-cell-value`);

                    if (headerCell.offsetWidth > 0 && value && value.innerText === heading) {

                        columnIndex = c;
                        break;
                    }
                }

                const rowHeadings =
                    document.querySelectorAll((scope + " .ren-data-grid__row-heading").trim());

                let rowIndex = -1;

                for (let index = 0; index < rowHeadings.length; index++) {

                    const match = /\bren-r-(\d+)\b/.exec(rowHeadings[index].getAttribute("class"));

                    // The row numbers are drawn by the ::before pseudo-element, with hidden rows'
                    // as -1.
                    const content = getComputedStyle(rowHeadings[index], "::before").content;
                    const digits = content.replace(/\D/g, "");

                    if (match && content !== "\"-1\"" && digits && Number(digits) + 1 === row) {

                        rowIndex = Number(match[1]);
                        break;
                    }
                }

                return { columnIndex, rowIndex };
            }
            """, new object?[] { ScopeSelector, columnHeading, rowHeading });

        if (indexes.RowIndex == -1) throw new InvalidOperationException("No row with heading " + rowHeading);

        return indexes;
    }

    /// <summary>
    /// Gets the selector of a data grid cell, by its column's heading and its row heading (see
    /// CellIndexesAsync).  The column must be visible.
    /// </summary>
    public async Task<string> CellSelectorAsync(string columnHeading, int rowHeading)
    {
        var (columnIndex, rowIndex) = await CellIndexesAsync(columnHeading, rowHeading);

        if (columnIndex == -1) throw new InvalidOperationException("No visible column headed " + columnHeading);

        return Scope($".ren-data-grid__cell.ren-c-{columnIndex}.ren-r-{rowIndex}");
    }

    /// <summary>
    /// Gets a data grid cell's text as it's shown, by its column's heading and its row heading (see
    /// CellIndexesAsync).
    /// </summary>
    public async Task<string> CellTextAsync(string columnHeading, int rowHeading) =>
        await Page.Locator(await CellSelectorAsync(columnHeading, rowHeading)).EvaluateAsync<string>("element => element.innerText");

    /// <summary>
    /// Gets a data grid cell's inner HTML, by its column's heading and its row heading (see
    /// CellIndexesAsync).
    /// </summary>
    public async Task<string> CellHtmlAsync(string columnHeading, int rowHeading) =>
        await Page.Locator(await CellSelectorAsync(columnHeading, rowHeading)).EvaluateAsync<string>("element => element.innerHTML");

    /// <summary>
    /// Clicks the expand/collapse button of a group row, by its row heading (see CellIndexesAsync),
    /// and waits for the grid to finish rendering.
    /// </summary>
    public async Task ExpandCollapseGroupAsync(int rowHeading)
    {
        var (_, rowIndex) = await CellIndexesAsync(null, rowHeading);

        await Locator($".ren-data-grid__group-ctrls.ren-r-{rowIndex} .ren-data-grid__group-expand-collapse-button")
            .EvaluateAsync("element => element.click()");

        await WaitUntilLoadedAsync();
    }

    /// <summary>
    /// Clicks the element matching a selector within this context with the element's click(), so
    /// it needn't be in view.
    /// </summary>
    public async Task ClickAsync(string selector) =>
        await Locator(selector).First.EvaluateAsync("element => element.click()");

    /// <summary>
    /// Clicks a data grid cell, by its column's heading and its row heading (see CellIndexesAsync).
    /// </summary>
    public async Task ClickCellAsync(string columnHeading, int rowHeading) =>
        await Root.ClickAsync(await CellSelectorAsync(columnHeading, rowHeading));

    /// <summary>
    /// Right-clicks a data grid cell, by its column's heading and its row heading (see
    /// CellIndexesAsync).
    /// </summary>
    public async Task RightClickCellAsync(string columnHeading, int rowHeading, bool ctrlKey = false, bool shiftKey = false) =>
        await Root.RightClickAsync(await CellSelectorAsync(columnHeading, rowHeading), ctrlKey, shiftKey);

    /// <summary>
    /// Opens a cell's context menu, then each submenu in turn by moving over its item, and clicks
    /// the last item named.
    /// </summary>
    public async Task ChooseFromCellMenuAsync(string columnHeading, int rowHeading, params string[] itemSelectors)
    {
        await RightClickCellAsync(columnHeading, rowHeading);

        foreach (var itemSelector in itemSelectors[..^1])
        {
            await Root.MouseOverAsync(itemSelector);
        }

        await Root.ClickAsync(itemSelectors[^1]);
    }

    /// <summary>
    /// Sets a cell's column's aggregation through its context menu, such as "sum" or
    /// "count-distinct".
    /// </summary>
    public Task SelectAggregationTypeAsync(string columnHeading, int rowHeading, string aggregationType) =>
        ChooseFromCellMenuAsync(
            columnHeading,
            rowHeading,
            ".qa-ren-aggregation-menu-item",
            ".qa-ren-aggregation-menu-item-" + aggregationType);

    /// <summary>
    /// Sets a cell's column's format through the Formatting submenu of its context menu.
    /// </summary>
    public Task SetCellFormatAsync(string columnHeading, int rowHeading, string subMenuSelector, string menuOptionSelector) =>
        ChooseFromCellMenuAsync(
            columnHeading,
            rowHeading,
            ".qa-ren-formatting-menu-item",
            subMenuSelector,
            menuOptionSelector);

    /// <summary>
    /// Right-clicks the element matching a selector within this context by dispatching a
    /// contextmenu event at it.  Holding Shift opens the menu in tech mode.
    /// </summary>
    public async Task RightClickAsync(string selector, bool ctrlKey = false, bool shiftKey = false)
    {
        // Playwright's DispatchEventAsync makes a contextmenu a plain Event, without the keys.
        await Locator(selector).First.EvaluateAsync(
            "(element, keys) => element.dispatchEvent(new MouseEvent(\"contextmenu\", keys))",
            new { bubbles = true, ctrlKey, shiftKey });

        // The menu can open under the real pointer, wherever an earlier step left it, and the
        // browser then moves over the item there itself.  That would close a submenu opened by
        // MouseOverAsync, so it's let happen first.
        await Page.EvaluateAsync("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    }

    /// <summary>
    /// Moves the mouse over the element matching a selector within this context, by dispatching a
    /// mouseover event at it.
    /// </summary>
    public async Task MouseOverAsync(string selector) =>
        await Locator(selector).First.DispatchEventAsync("mouseover", new { bubbles = true });

    /// <summary>
    /// Selects every cell of this context's data grid, through the corner of its headings.
    /// </summary>
    public async Task SelectAllAsync() => await Locator(".qa-ren-heading-corner").ClickAsync();

    /// <summary>
    /// Selects the cells from one to another by dragging between them, each found by its column's
    /// heading and its row heading (see CellIndexesAsync).
    /// </summary>
    public async Task SelectCellsAsync(string startColumnHeading, int startRowHeading, string endColumnHeading, int endRowHeading)
    {
        var startSelector = await CellSelectorAsync(startColumnHeading, startRowHeading);
        var endSelector = await CellSelectorAsync(endColumnHeading, endRowHeading);

        var start = (await Page.Locator(startSelector).BoundingBoxAsync())!;
        var end = (await Page.Locator(endSelector).BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(start.X + start.Width / 2, start.Y + start.Height / 2);
        await Page.Mouse.DownAsync();
        await Page.Mouse.MoveAsync(end.X + end.Width / 2, end.Y + end.Height / 2);
        await Page.Mouse.UpAsync();
    }

    /// <summary>
    /// Selects whole columns by their headings, holding Ctrl for each after the first.
    /// </summary>
    public async Task SelectColumnsAsync(params string[] columnHeadings)
    {
        for (var index = 0; index < columnHeadings.Length; index++)
        {
            await PressAndReleaseAsync($".ren-data-grid__column-heading[title='{columnHeadings[index]}']", index > 0);
        }
    }

    /// <summary>
    /// Selects whole rows by their row headings (see CellIndexesAsync), holding Ctrl for each after
    /// the first.
    /// </summary>
    public async Task SelectRowsAsync(params int[] rowHeadings)
    {
        for (var index = 0; index < rowHeadings.Length; index++)
        {
            var (_, rowIndex) = await CellIndexesAsync(null, rowHeadings[index]);

            await PressAndReleaseAsync($".ren-data-grid__row-heading.ren-r-{rowIndex}", index > 0);
        }
    }

    /// <summary>
    /// Dispatches a mousedown then a mouseup at the element matching a selector within this
    /// context.
    /// </summary>
    public async Task PressAndReleaseAsync(string selector, bool ctrlKey = false)
    {
        var element = Locator(selector).First;

        await element.DispatchEventAsync("mousedown", new { bubbles = true, ctrlKey });
        await element.DispatchEventAsync("mouseup", new { bubbles = true, ctrlKey });
    }

    /// <summary>
    /// Gets the text of this context's data grid's selected cells, tab-separated as copying them
    /// would give, using Ren.QA.
    /// </summary>
    public async Task<string> SelectedTextAsync()
    {
        var gridIndex = await DataGridIndexAsync();

        return await Page.EvaluateAsync<string>("index => window.Ren.QA.getSelectedText(index)", gridIndex);
    }

    [GeneratedRegex("""(class="js-ren-report-settings js-ren-report-settings-file">)[\s\S]*?(</script>)""")]
    private static partial Regex SettingsFileScript();

    [GeneratedRegex(GridIndexClassPrefix + @"(\d+)")]
    private static partial Regex GridIndexClass();
}
