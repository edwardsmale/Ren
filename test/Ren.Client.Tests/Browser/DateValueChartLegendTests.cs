using System.Text.RegularExpressions;

namespace Ren.Client.Tests.Browser;

// These tests cover a date/value chart's legend: the order its entries run in, what clicking them
// does to which series are shown and selected, and the entry picked out while its series is
// hovered.  They also cover the order a split chart's series are drawn in, and a hidden split
// series staying hidden while a filter takes its value out of the data and puts it back.  Days
// Active reaches far higher than Unique Searches Per Day, so a chart of the two lists it first.
[TestClass]
public class DateValueChartLegendTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private static string BarSelector(int seriesNumber) => $".ren-bar.ren-vertical[data-series='{seriesNumber}']";

    private static string LegendTextSelector(int seriesNumber) =>
        $".ren-legend-item[data-series='{seriesNumber}'] .ren-legend-text";

    private async Task CreateChartAsync(params string[] columnHeadings)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync(columnHeadings);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task CreateSingleSeriesChartAsync() => CreateChartAsync("CreatedOn", "Unique Searches Per Day");

    private Task CreateTwoSeriesChartAsync() => CreateChartAsync("CreatedOn", "Unique Searches Per Day", "Days Active");

    private async Task CreateSplitChartAsync(string columnHeading)
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.SplitDataAsync(Ren, columnHeading);

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBeGreaterThan(2);
    }

    private Task<int> SeriesCountAsync() => DateValueChart.SeriesCountAsync(Ren);

    // Each series' legend entry as "<series number>:<shown>", in series order.
    private Task<string> SeriesShownAsync() => EvaluateAsync<string>("""
        () => Array.from(document.querySelectorAll(".ren-legend-item"))
            .sort((a, b) => a.getAttribute("data-series") - b.getAttribute("data-series"))
            .map(item => item.getAttribute("data-series") + ":" + item.getAttribute("data-series-enabled"))
            .join(",")
        """);

    private Task<string> ShownSeriesAsync() => EvaluateAsync<string>("""
        () => Array.from(document.querySelectorAll(".ren-legend-item[data-series-enabled='true']"))
            .map(item => parseInt(item.getAttribute("data-series"), 10))
            .sort((a, b) => a - b)
            .join(",")
        """);

    // A selected series' legend entry is outlined.
    private Task<string> SelectedSeriesAsync() => EvaluateAsync<string>("""
        () => Array.from(document.querySelectorAll(".ren-legend-item"))
            .filter(item => getComputedStyle(item.querySelector(".ren-legend-entry")).outlineStyle !== "none")
            .map(item => parseInt(item.getAttribute("data-series"), 10))
            .sort((a, b) => a - b)
            .join(",")
        """);

    private async Task CtrlClickLegendEntryAsync(int seriesNumber)
    {
        await Ren.Root.Locator(LegendTextSelector(seriesNumber)).First
            .DispatchEventAsync("click", new { bubbles = true, ctrlKey = true, detail = 1 });
        await Ren.WaitUntilLoadedAsync();
    }

    private async Task ChooseFromSeriesMenuAsync(int seriesNumber, string itemSelector)
    {
        await DateValueChart.OpenMenuAsync(Ren, BarSelector(seriesNumber));
        await Ren.Root.ClickAsync(itemSelector);
        await Ren.WaitUntilLoadedAsync();
    }

    private Task HideOtherSeriesAsync(int seriesNumber) => ChooseFromSeriesMenuAsync(seriesNumber, "#hide-other-series");

    private Task RemoveSeriesAsync(int seriesNumber) => ChooseFromSeriesMenuAsync(seriesNumber, "#remove-series");

    // Whether the series whose label ends with the text is shown, or null where there's none.
    private Task<string?> SeriesShownByLabelEndingAsync(string labelEnding) => EvaluateAsync<string?>("""
        (ending) => {
            const item = Array.from(document.querySelectorAll(".ren-legend-item"))
                .find(i => i.textContent.trim().endsWith(ending));

            return item ? item.getAttribute("data-series-enabled") : null;
        }
        """, labelEnding);

    private Task<string?> OtherShownAsync() => SeriesShownByLabelEndingAsync("Other");

    private Task<string[]> LegendTextsAsync() => EvaluateAsync<string[]>("""
        () => Array.from(document.querySelectorAll(".ren-legend-item .ren-legend-text"))
            .map(text => text.textContent.trim())
        """);

    [TestMethod("the legend's order: two series have the higher one first")]
    public async Task LegendOrder_TwoSeriesHaveTheHigherOneFirst()
    {
        await CreateTwoSeriesChartAsync();

        await Poll(() => EvaluateAsync<string>("""
            () => Array.from(document.querySelectorAll(".ren-legend-item"))
                .map(item => item.getAttribute("data-series"))
                .join(",")
            """)).ToBe("2,1");
    }

    [TestMethod("the legend's order: splitting by a column numbers the series highest first")]
    public async Task LegendOrder_SplittingNumbersTheSeriesHighestFirst()
    {
        await CreateSplitChartAsync("Search Terms");

        var tallestBars = await EvaluateAsync<double[]>("""
            () => {
                const tallest = [];

                Array.prototype.forEach.call(
                    document.querySelectorAll(".ren-bar.ren-vertical[data-series]"),
                    bar => {
                        const index = parseInt(bar.getAttribute("data-series"), 10) - 1;

                        tallest[index] = Math.max(tallest[index] || 0, bar.getBBox().height);
                    }
                );

                return Array.from(tallest, height => height || 0);
            }
            """);

        for (var index = 1; index < tallestBars.Length; index++)
        {
            Expect(tallestBars[index]).ToBeLessThanOrEqual(tallestBars[index - 1]);
        }

        // The labels in order of height aren't in the alphabetical order it falls back on.
        var labels = await EvaluateAsync<string[]>("""
            () => Array.from(document.querySelectorAll(".ren-legend-item"))
                .sort((a, b) => a.getAttribute("data-series") - b.getAttribute("data-series"))
                .map(item => item.textContent.trim())
            """);

        var sortedLabels = await EvaluateAsync<string[]>("(labels) => labels.slice().sort()", labels);

        Expect(labels).Not.ToEqual(sortedLabels);
    }

    // Every row of the data is active, and active 118 days.
    [TestMethod("a split series' name: names a Boolean column's value as True or False with the column")]
    public async Task SplitSeriesName_NamesABooleanColumnsValueWithTheColumn()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.SplitDataAsync(Ren, "Active");

        await Poll(LegendTextsAsync).ToEqual(new[] { "Active = True" });
    }

    [TestMethod("a split series' name: names a text column's value alone")]
    public async Task SplitSeriesName_NamesATextColumnsValueAlone()
    {
        await CreateSplitChartAsync("Search Terms");

        var texts = await LegendTextsAsync();

        Expect(texts.Any(text => text.Contains(" = "))).ToBe(false);
    }

    [TestMethod("clicking an entry: of a hidden series shows it")]
    public async Task ClickingAnEntry_OfAHiddenSeriesShowsIt()
    {
        await CreateTwoSeriesChartAsync();
        await HideOtherSeriesAsync(1);
        Expect(await SeriesShownAsync()).ToBe("1:true,2:false");

        await Ren.Root.ClickAsync(LegendTextSelector(2));

        await Poll(SeriesShownAsync).ToBe("1:true,2:true");
        await Poll(SeriesCountAsync).ToBe(2);
    }

    [TestMethod("clicking an entry: twice shows its series alone")]
    public async Task ClickingAnEntry_TwiceShowsItsSeriesAlone()
    {
        await CreateTwoSeriesChartAsync();

        await Ren.Root.Locator(LegendTextSelector(1)).First.DblClickAsync();

        await Poll(SeriesShownAsync).ToBe("1:true,2:false");
        await Poll(SeriesCountAsync).ToBe(1);
    }

    [TestMethod("clicking an entry: twice again shows every series again")]
    public async Task ClickingAnEntry_TwiceAgainShowsEverySeriesAgain()
    {
        await CreateTwoSeriesChartAsync();
        await Ren.Root.Locator(LegendTextSelector(1)).First.DblClickAsync();
        await Poll(SeriesShownAsync).ToBe("1:true,2:false");

        await Ren.Root.Locator(LegendTextSelector(1)).First.DblClickAsync();

        await Poll(SeriesShownAsync).ToBe("1:true,2:true");
    }

    [TestMethod("clicking an entry: with Ctrl adds its series to the selection")]
    public async Task ClickingAnEntry_WithCtrlAddsItsSeriesToTheSelection()
    {
        await CreateTwoSeriesChartAsync();
        await Ren.Root.ClickAsync(LegendTextSelector(1));
        await Poll(SelectedSeriesAsync).ToBe("1");

        await CtrlClickLegendEntryAsync(2);

        await Poll(SelectedSeriesAsync).ToBe("1,2");
    }

    [TestMethod("clicking an entry: with Ctrl when selected takes its series from the selection")]
    public async Task ClickingAnEntry_WithCtrlWhenSelectedTakesItsSeriesFromTheSelection()
    {
        await CreateTwoSeriesChartAsync();
        await CtrlClickLegendEntryAsync(1);
        await CtrlClickLegendEntryAsync(2);

        await CtrlClickLegendEntryAsync(1);

        await Poll(SelectedSeriesAsync).ToBe("2");
    }

    [TestMethod("hide all other: keeps every series selected in the legend")]
    public async Task HideAllOther_KeepsEverySeriesSelectedInTheLegend()
    {
        await CreateSplitChartAsync("Search Terms");
        await CtrlClickLegendEntryAsync(1);
        await CtrlClickLegendEntryAsync(3);
        await Poll(SelectedSeriesAsync).ToBe("1,3");

        await HideOtherSeriesAsync(1);

        await Poll(ShownSeriesAsync).ToBe("1,3");
    }

    [TestMethod("hide all other: on a series outside the selection keeps that series alone")]
    public async Task HideAllOther_OnASeriesOutsideTheSelectionKeepsThatSeriesAlone()
    {
        await CreateSplitChartAsync("Search Terms");
        await CtrlClickLegendEntryAsync(1);
        await CtrlClickLegendEntryAsync(3);
        await Poll(SelectedSeriesAsync).ToBe("1,3");

        await HideOtherSeriesAsync(2);

        await Poll(ShownSeriesAsync).ToBe("2");
    }

    [TestMethod("hovering a series picks out its legend entry")]
    public async Task HoveringASeries_PicksOutItsLegendEntry()
    {
        await CreateTwoSeriesChartAsync();

        await Ren.Root.MouseOverAsync(BarSelector(1));

        Task<string> ColourAsync(int seriesNumber) => Ren.Root.Locator(LegendTextSelector(seriesNumber)).First
            .EvaluateAsync<string>("element => getComputedStyle(element).color");

        await Poll(() => ColourAsync(1)).ToBe("rgb(0, 0, 0)");
        Expect(await ColourAsync(2)).ToBe("rgb(51, 51, 51)");
    }

    [TestMethod("a hidden split series stays hidden while filtered out and back")]
    public async Task AHiddenSplitSeries_StaysHiddenWhileFilteredOutAndBack()
    {
        const string splitValue = "SY91043";

        await CreateSplitChartAsync("Discontinued");

        var seriesNumber = await EvaluateAsync<int>("""
            (ending) => {
                const item = Array.from(document.querySelectorAll(".ren-legend-item"))
                    .find(i => i.textContent.trim().endsWith(ending));

                return parseInt(item.getAttribute("data-series"), 10);
            }
            """, splitValue);

        await DateValueChart.OpenMenuAsync(Ren, BarSelector(seriesNumber));
        await Ren.Root.ClickAsync("#show-hide-series");
        await Poll(() => SeriesShownByLabelEndingAsync(splitValue)).ToBe("false");

        var row = 2;

        while (await Ren.Report.CellTextAsync("Discontinued", row) != splitValue)
        {
            row++;
        }

        await Ren.Report.ChooseFromCellMenuAsync("Discontinued", row, "#filter-menu-option", "#filter-exclude-this-value");
        await Poll(() => SeriesShownByLabelEndingAsync(splitValue)).ToBeNull();

        await Ren.Report.ChooseFromCellMenuAsync("Discontinued", 2, "#filter-menu-option", "#clear-all-column-filters-menu-item");
        await Poll(() => SeriesShownByLabelEndingAsync(splitValue)).Not.ToBeNull();

        Expect(await SeriesShownByLabelEndingAsync(splitValue)).ToBe("false");
    }

    [TestMethod("the \"Other\" series: is not drawn while no series is removed")]
    public async Task OtherSeries_IsNotDrawnWhileNoSeriesIsRemoved()
    {
        await CreateTwoSeriesChartAsync();

        await Poll(SeriesCountAsync).ToBe(2);
        Expect(await OtherShownAsync()).ToBeNull();
    }

    [TestMethod("the \"Other\" series: is shown once a series is removed")]
    public async Task OtherSeries_IsShownOnceASeriesIsRemoved()
    {
        await CreateTwoSeriesChartAsync();

        await RemoveSeriesAsync(1);

        await Poll(OtherShownAsync).ToBe("true");
        Expect(await SeriesCountAsync()).ToBe(2);
    }

    private async Task<string> LegendTextAsync(int seriesNumber) =>
        (await Page.Locator(LegendTextSelector(seriesNumber)).TextContentAsync() ?? "").Trim();

    [TestMethod("the \"Other\" series: legend entry's tooltip lists the series it gathers")]
    public async Task OtherSeries_LegendEntrysTooltipListsTheSeriesItGathers()
    {
        await CreateTwoSeriesChartAsync();
        var removedLabel = await LegendTextAsync(1);

        await RemoveSeriesAsync(1);
        await Poll(OtherShownAsync).ToBe("true");

        var tooltip = await EvaluateAsync<string?>("""
            () => Array.from(document.querySelectorAll(".ren-legend-text"))
                .find(text => text.textContent.trim() === "Other")?.title ?? null
            """);

        Expect(tooltip).ToBe("\"Other\" represents 1 series:\n" + removedLabel);
    }

    // Removes the first series, then gets the "Other" series' number and the removed series' label.
    private async Task<(string RemovedLabel, int OtherNumber)> RemoveFirstSeriesAsync()
    {
        await CreateTwoSeriesChartAsync();
        var removedLabel = await LegendTextAsync(1);

        await RemoveSeriesAsync(1);
        await Poll(OtherShownAsync).ToBe("true");

        var otherNumber = await EvaluateAsync<string>("""
            () => Array.from(document.querySelectorAll(".ren-legend-item"))
                .find(item => item.textContent.trim() === "Other")
                .getAttribute("data-series")
            """);

        return (removedLabel, int.Parse(otherNumber));
    }

    // Gets the text of the first title within the elements the selector finds.
    private Task<string?> TitleWithinAsync(string selector) => EvaluateAsync<string?>(
        "(within) => document.querySelector(within + \" title\")?.textContent ?? null",
        selector);

    [TestMethod("the \"Other\" series: line's tooltip lists the series it gathers")]
    public async Task OtherSeries_LinesTooltipListsTheSeriesItGathers()
    {
        var (removedLabel, otherNumber) = await RemoveFirstSeriesAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, otherNumber, "Draw as", "Lines");

        var lineSelector = $".ren-series-{otherNumber} .ren-data-series--line";

        await Poll(() => TitleWithinAsync(lineSelector)).ToBe("\"Other\" represents 1 series:\n" + removedLabel);
    }

    [TestMethod("the \"Other\" series: pie labels' tooltip lists the series it gathers")]
    public async Task OtherSeries_PieLabelsTooltipListsTheSeriesItGathers()
    {
        var (removedLabel, otherNumber) = await RemoveFirstSeriesAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");

        await Poll(() => TitleWithinAsync(".ren-pie-labels--other")).ToBe("\"Other\" represents 1 series:\n" + removedLabel);
        Expect(await Page.Locator($".ren-pie-labels-layer > .ren-series-{otherNumber}").GetAttributeAsync("class"))
            .ToContain("ren-pie-labels--other");
    }

    [TestMethod("the \"Other\" series: is not gathering a hidden series")]
    public async Task OtherSeries_IsNotGatheringAHiddenSeries()
    {
        await CreateTwoSeriesChartAsync();

        await HideOtherSeriesAsync(1);

        await Poll(SeriesShownAsync).ToBe("1:true,2:false");
        Expect(await OtherShownAsync()).ToBeNull();
    }

    [TestMethod("the \"Other\" series: is hidden and shown again from the menu")]
    public async Task OtherSeries_IsHiddenAndShownAgainFromTheMenu()
    {
        await CreateTwoSeriesChartAsync();
        await RemoveSeriesAsync(1);
        await Poll(OtherShownAsync).ToBe("true");

        await ChooseFromSeriesMenuAsync(1, "#show-other-series");
        await Poll(OtherShownAsync).ToBe("false");

        await ChooseFromSeriesMenuAsync(1, "#show-other-series");
        await Poll(OtherShownAsync).ToBe("true");
    }

    [TestMethod("the \"Other\" series: goes once the removed series are reinstated")]
    public async Task OtherSeries_GoesOnceTheRemovedSeriesAreReinstated()
    {
        await CreateTwoSeriesChartAsync();
        await RemoveSeriesAsync(1);
        await Poll(OtherShownAsync).ToBe("true");

        await ChooseFromSeriesMenuAsync(1, "#reinstate-removed-series");

        await Poll(OtherShownAsync).ToBeNull();
        Expect(await SeriesCountAsync()).ToBe(2);
    }

    [TestMethod("the \"Other\" series: is removed, legend entry and all, and reinstated alone")]
    public async Task OtherSeries_IsRemovedAndReinstatedAlone()
    {
        await CreateTwoSeriesChartAsync();
        await RemoveSeriesAsync(1);
        await Poll(OtherShownAsync).ToBe("true");

        await RemoveSeriesAsync(2);
        await Poll(OtherShownAsync).ToBeNull();
        Expect(await SeriesCountAsync()).ToBe(1);

        await ChooseFromSeriesMenuAsync(1, "#reinstate-other-series");

        await Poll(OtherShownAsync).ToBe("true");
        Expect(await SeriesCountAsync()).ToBe(2);
    }

    [TestMethod("the \"Other\" series: is reinstated with every removed series")]
    public async Task OtherSeries_IsReinstatedWithEveryRemovedSeries()
    {
        await CreateTwoSeriesChartAsync();
        await RemoveSeriesAsync(1);
        await RemoveSeriesAsync(2);
        await Poll(SeriesCountAsync).ToBe(1);

        await ChooseFromSeriesMenuAsync(1, "#reinstate-removed-series");

        await Poll(SeriesCountAsync).ToBe(2);
        Expect(await OtherShownAsync()).ToBeNull();
    }

    private async Task<string> LimitTextAsync() => await Ren.Root
        .Locator(".ren-date-value-chart-series-limit .ren-date-value-chart-column-pickers__value")
        .First
        .TextContentAsync() ?? "";

    private async Task OpenLimitEditorAsync()
    {
        await Ren.Root.ClickAsync(".ren-date-value-chart-series-limit");
        await Expect(Ren.Root.Locator(".qa-ren-number-editor-input")).ToHaveCountAsync(1);
    }

    [TestMethod("the series limit: is typed into its editor")]
    public async Task SeriesLimit_IsTypedIntoItsEditor()
    {
        await CreateSplitChartAsync("Search Terms");
        await OpenLimitEditorAsync();

        var input = Ren.Root.Locator(".qa-ren-number-editor-input");

        await input.FillAsync("");
        await input.PressSequentiallyAsync("2");
        await input.PressAsync("Enter");
        await Ren.WaitUntilLoadedAsync();

        await Poll(LimitTextAsync).ToMatch(new Regex(@"^top 2 of \d+$"));

        // The top two and the "Other" series gathering the rest.
        Expect(await SeriesCountAsync()).ToBe(3);
    }

    [TestMethod("the series limit: is shown all at the top of its slider")]
    public async Task SeriesLimit_IsShownAllAtTheTopOfItsSlider()
    {
        await CreateSplitChartAsync("Search Terms");
        var seriesCount = await SeriesCountAsync();
        await OpenLimitEditorAsync();

        var slider = Ren.Root.Locator(".qa-ren-number-editor-slider");

        await slider.FillAsync("1");
        await Poll(LimitTextAsync).ToMatch(new Regex(@"^top 1 of \d+$"));

        await slider.FillAsync(await slider.GetAttributeAsync("max") ?? "");
        await Poll(LimitTextAsync).ToMatch(new Regex(@"^all \d+$"));
        await Poll(SeriesCountAsync).ToBe(seriesCount);
    }

    private record LegendLayout(int RowCount, bool IsOverflowing, double FirstMoved);

    [TestMethod("the series limit: shown all scrolls the legend across beyond three rows")]
    public async Task SeriesLimit_ShownAllScrollsTheLegendAcrossBeyondThreeRows()
    {
        await CreateSplitChartAsync("Search Terms");
        await OpenLimitEditorAsync();

        var slider = Ren.Root.Locator(".qa-ren-number-editor-slider");

        await slider.FillAsync(await slider.GetAttributeAsync("max") ?? "");
        await Poll(LimitTextAsync).ToMatch(new Regex(@"^all \d+$"));
        await Page.Mouse.ClickAsync(5, 5);

        var layout = await EvaluateAsync<LegendLayout>("""
            () => {
                const legend = document.querySelector(".ren-date-value-chart-legend-html");
                const items = legend.querySelector(".ren-legend-items");
                const first = items.querySelector(".ren-legend-item");
                const rowTops = {};

                items.querySelectorAll(".ren-legend-item").forEach(item => {
                    rowTops[item.offsetTop] = true;
                });

                const firstLeft = first.getBoundingClientRect().left;

                items.scrollLeft = 100;

                return {
                    rowCount: Object.keys(rowTops).length,
                    isOverflowing: items.scrollWidth > items.clientWidth,
                    firstMoved: first.getBoundingClientRect().left - firstLeft
                };
            }
            """);

        Expect(layout).ToEqual(new LegendLayout(3, true, -100));
    }

    [TestMethod("the series limit: editor closes when clicked outside")]
    public async Task SeriesLimit_EditorClosesWhenClickedOutside()
    {
        await CreateSplitChartAsync("Search Terms");
        await OpenLimitEditorAsync();

        await Page.Mouse.ClickAsync(5, 5);

        await Expect(Ren.Root.Locator(".qa-ren-number-editor-input")).ToHaveCountAsync(0);
    }

    private Microsoft.Playwright.ILocator ConfirmMessage => Ren.Root.Locator(".js-ren-popup-confirm-message");

    [TestMethod("the Delete key: removes the selected series without asking")]
    public async Task DeleteKey_RemovesTheSelectedSeriesWithoutAsking()
    {
        await CreateTwoSeriesChartAsync();
        await Ren.Root.ClickAsync(LegendTextSelector(1));
        await Poll(SelectedSeriesAsync).ToBe("1");

        await Page.Keyboard.PressAsync("Delete");
        await Ren.WaitUntilLoadedAsync();

        await Expect(ConfirmMessage).ToHaveCountAsync(0);

        // The series left and the "Other" series gathering the one removed.
        await Poll(OtherShownAsync).ToBe("true");
    }

    [TestMethod("the Delete key: removes several selected series together")]
    public async Task DeleteKey_RemovesSeveralSelectedSeriesTogether()
    {
        await CreateSplitChartAsync("Search Terms");
        var seriesCount = await SeriesCountAsync();
        await CtrlClickLegendEntryAsync(1);
        await CtrlClickLegendEntryAsync(2);

        await Page.Keyboard.PressAsync("Delete");
        await Ren.WaitUntilLoadedAsync();

        // Two fewer, and the "Other" series gathering them.
        await Poll(SeriesCountAsync).ToBe(seriesCount - 1);
    }

    [TestMethod("the Delete key: does nothing with every series selected")]
    public async Task DeleteKey_DoesNothingWithEverySeriesSelected()
    {
        await CreateTwoSeriesChartAsync();
        await CtrlClickLegendEntryAsync(1);
        await CtrlClickLegendEntryAsync(2);

        await Page.Keyboard.PressAsync("Delete");

        await Expect(ConfirmMessage).ToHaveCountAsync(0);
        Expect(await SeriesCountAsync()).ToBe(2);
    }
}
