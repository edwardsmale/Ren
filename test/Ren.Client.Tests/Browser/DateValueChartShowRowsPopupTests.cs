using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace Ren.Client.Tests.Browser;

// These tests cover the popup grid that "Show rows" on a date/value chart's bar opens.  It lists
// the rows behind the bar, laid out as the chart's grid is, but with numbers that aren't whole
// given two decimal places and a Boolean's average a percentage, its group controls shown even
// where the grid collapses them, and none of the grid's row and column headings.  The chart plots
// Unique Searches Per Day, whose rows on 15 Jan 2024 include 0 and 0.1.
[TestClass]
public class DateValueChartShowRowsPopupTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string GridWithHeadingsFixture = "ported/DateValueChartTest02.html";

    private const string FirstBar = ".ren-bar.ren-vertical[data-series='1'][data-index='0']";

    private const string SecondBar = ".ren-bar.ren-vertical[data-series='1'][data-index='1']";

    // The chart is itself a popup, so the rows popup is the one not holding it.
    private const string Popup = ".ren-report-popup-window:not(:has(.ren-visualisation--date-value-chart))";

    private const string ValueColumn = "Unique Searches Per Day";

    // The popup's grid keeps the rows the bar leaves out, drawn level with its heading row, whose
    // hidden cells are drawn at the top, so only cells below the heading row are counted.
    private const string HeadingTopScript = """
        const headingTop = Math.max.apply(null, Array.from(
            document.querySelectorAll(popupSelector + " .ren-data-grid__cell.ren-h.ren-r-0"),
            heading => heading.getBoundingClientRect().top
        ));
        """;

    private async Task CreateChartAsync()
    {
        await Ren.Report.SelectColumnsAsync("CreatedOn", ValueColumn);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
        await Ren.Root.Locator(FirstBar).First.WaitForAsync(new() { State = WaitForSelectorState.Attached });
    }

    private async Task GroupByColumnAsync(string columnHeading)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, 2, "#grouping-menu", "#group-by-column");
        await Ren.WaitUntilLoadedAsync();
    }

    // Gets a selector for the popup's cells of a column, found by its heading, other than its heading.
    private async Task<string> PopupDataCellSelectorAsync(string columnHeading)
    {
        var columnClass = await Page.EvaluateAsync<string?>("""
            ({ popupSelector, heading }) => {

                const headingCell = Array.from(
                    document.querySelectorAll(popupSelector + " .ren-data-grid__cell.ren-h")
                )
                    .find(cell => cell.textContent.replace(/[^\w\s]/g, "").trim() === heading);

                return headingCell
                    ? Array.from(headingCell.classList).find(c => /^ren-c-\d+$/.test(c))
                    : null;
            }
            """, new { popupSelector = Popup, heading = columnHeading });

        return $"{Popup} .ren-data-grid__cell.{columnClass}:not(.ren-h)";
    }

    private async Task ShowRowsOfBarAsync(string barSelector)
    {
        await DateValueChart.OpenMenuAsync(Ren, barSelector);
        await Ren.Root.ClickAsync("#chart-show-data-point-rows");

        await Poll(async () => await Page.Locator(await PopupDataCellSelectorAsync(ValueColumn)).CountAsync())
            .ToBeGreaterThan(0);
    }

    // The texts of the popup's rendered cells matching the selector.
    private Task<string[]> RenderedPopupCellTextsAsync(string selector) => Page.EvaluateAsync<string[]>(
        "({ popupSelector, cells }) => {\n" + HeadingTopScript + """

            return Array.from(document.querySelectorAll(cells))
                .filter(cell => cell.getBoundingClientRect().top > headingTop)
                .map(cell => cell.textContent.trim());
        }
        """, new { popupSelector = Popup, cells = selector });

    private async Task<string[]> PopupDataTextsAsync(string columnHeading) => await RenderedPopupCellTextsAsync(
        await PopupDataCellSelectorAsync(columnHeading) + ":not(.ren-data-grid__cell--group)");

    private async Task<string[]> PopupGroupTextsAsync(string columnHeading) => await RenderedPopupCellTextsAsync(
        await PopupDataCellSelectorAsync(columnHeading) + ".ren-data-grid__cell--group");

    private async Task RightClickPopupDataCellAsync(string columnHeading, string text)
    {
        var cellSelector = await PopupDataCellSelectorAsync(columnHeading);

        var rowClass = await Page.EvaluateAsync<string>(
            "({ popupSelector, cells, cellText }) => {\n" + HeadingTopScript + """

                const cell = Array.from(document.querySelectorAll(cells))
                    .find(c => c.getBoundingClientRect().top > headingTop &&
                        c.textContent.trim() === cellText);

                return Array.from(cell.classList).find(c => /^ren-r-\d+$/.test(c));
            }
            """, new { popupSelector = Popup, cells = cellSelector, cellText = text });

        await Ren.Root.RightClickAsync(cellSelector + "." + rowClass);
    }

    private Task<string> DisplayOfAsync(string selector) =>
        Page.Locator(selector).First.EvaluateAsync<string>("element => getComputedStyle(element).display");

    [TestMethod("a bar's rows are those of its date")]
    public async Task ABarsRowsAreThoseOfItsDate()
    {
        await Ren.OpenAsync(Fixture);
        await CreateChartAsync();

        await ShowRowsOfBarAsync(FirstBar);

        await Expect(Page.Locator(Popup + " .ren-report-popup-window__title-bar-caption"))
            .ToHaveTextAsync("12 Jan 2024 Unique Searches Per Day");

        var dates = await PopupDataTextsAsync("CreatedOn");

        Expect(dates.Distinct().ToArray()).ToEqual(new[] { "12/01/2024" });
    }

    [TestMethod("a fractional number column is shown to two decimal places")]
    public async Task AFractionalNumberColumnIsShownToTwoDecimalPlaces()
    {
        await Ren.OpenAsync(Fixture);
        await CreateChartAsync();

        await ShowRowsOfBarAsync(SecondBar);

        var texts = await PopupDataTextsAsync(ValueColumn);

        Expect(texts).ToContain("0.00");
        Expect(texts).ToContain("1.30");
        Expect(texts.Where(text => !Regex.IsMatch(text, @"^\d+\.\d\d$")).ToArray()).ToEqual(Array.Empty<string>());
    }

    [TestMethod("a number formatted to all decimal places is shown as held")]
    public async Task ANumberFormattedToAllDecimalPlacesIsShownAsHeld()
    {
        await Ren.OpenAsync(Fixture);
        await CreateChartAsync();
        await ShowRowsOfBarAsync(SecondBar);

        await RightClickPopupDataCellAsync(ValueColumn, "1.30");
        await Ren.Root.MouseOverAsync(".qa-ren-formatting-menu-item");
        await Ren.Root.MouseOverAsync("#format-as-number");
        await Ren.Root.ClickAsync("#format-as-number-all-dp");

        await Poll(async () => (await PopupDataTextsAsync(ValueColumn)).Contains("1.3")).ToBe(true);
        Expect(await PopupDataTextsAsync(ValueColumn)).Not.ToContain("1.30");
    }

    [TestMethod("a Boolean averaged in a grouping is shown as a percentage")]
    public async Task ABooleanAveragedInAGroupingIsShownAsAPercentage()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("Search Terms");
        await Ren.Report.SelectAggregationTypeAsync("Active", 2, "average");
        await CreateChartAsync();

        await ShowRowsOfBarAsync(FirstBar);

        Expect((await PopupGroupTextsAsync("Active"))[0]).ToBe("100.0%");
    }

    [TestMethod("group controls the grid collapses are shown in the popup")]
    public async Task GroupControlsTheGridCollapsesAreShownInThePopup()
    {
        await Ren.OpenAsync(Fixture);
        await GroupByColumnAsync("Search Terms");
        await DateValueChart.ClickMenuPathOnAsync(Ren, ".ren-data-grid__group-ctrls", "Group Count Mode", "Collapsed");
        await CreateChartAsync();

        await ShowRowsOfBarAsync(FirstBar);

        await Expect(Page.Locator(Popup + " .ren-data-grid__group-ctrls").First).ToBeAttachedAsync();
    }

    [TestMethod("the grid's row and column headings aren't shown in the popup")]
    public async Task TheGridsRowAndColumnHeadingsArentShownInThePopup()
    {
        await Ren.OpenAsync(GridWithHeadingsFixture);
        await CreateChartAsync();

        await ShowRowsOfBarAsync(FirstBar);

        Expect(await DisplayOfAsync(".ren-data-grid__column-heading")).Not.ToBe("none");
        Expect(await DisplayOfAsync(Popup + " .ren-data-grid__column-heading")).ToBe("none");
    }
}
