using System.Text.Json.Nodes;

namespace Ren.Client.Tests.Browser;

// These tests cover creating a date/value chart from a grid's columns or cells, the chart following
// filters on the grid, how it lays out bars for periods the data only partly fills, its marker
// lines, and its surviving having no rows to draw or its container leaving the page.
[TestClass]
public class DateValueChartTests : BrowserTest
{
    // An ungrouped grid of searches from 12 to 18 January 2024.
    private const string Fixture = "ported/DateValueChartTest01.html";

    // The same grid, grouped by CreatedOn.
    private const string GroupedByDateFixture = "ported/DateValueChartTest02.html";

    // The same grid ungrouped and grouped again, for CreatedOn With Null, which has a row with no date.
    private const string NullableDateFixture = "ported/DateValueChartTest03.html";
    private const string GroupedByNullableDateFixture = "ported/DateValueChartTest04.html";

    private const string NoDataError = ".ren-visualisation-initialisation-error";

    private async Task CreateChartAsync(string fixture, string dateColumnHeading = "CreatedOn")
    {
        await Ren.OpenAsync(fixture);
        await Ren.Report.SelectColumnsAsync(dateColumnHeading, "Unique Searches Per Day");
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, dateColumnHeading);
    }

    private Task ExpectDateRangeAsync(string from, string to) =>
        Expect(Ren.Root.Locator($"[data-qa-date-value-chart-date-range=\"{from} to {to}\"]")).ToHaveCountAsync(1);

    private Task ExpectDatesAsync(params string[] dates) =>
        Poll(() => DateValueChart.DatesWithValuesAsync(Ren)).ToEqual(dates);

    private Task ExpectNoErrorAsync() => Expect(Ren.Root.Locator(NoDataError)).ToHaveCountAsync(0);

    private async Task GroupByWeekAsync(string columnHeading)
    {
        await Ren.Report.ChooseFromCellMenuAsync(columnHeading, 2, "#grouping-menu", "#group-by-column", "#group-by-column-week");
        await Ren.WaitUntilLoadedAsync();
    }

    // Each marker line's label and date, as "label=date", sorted by label.
    private Task<string[]> MarkerLinesAsync() => EvaluateAsync<string[]>("""
        () => Array.prototype.map.call(
            document.querySelectorAll("[data-qa-marker-line]"),
            marker => marker.getAttribute("data-qa-marker-line") + "=" + marker.getAttribute("data-marker-date")
        ).sort()
        """);

    // Each bar's left and right edges, read from its transform and path.
    private Task<double[][]> BarEdgesAsync() => EvaluateAsync<double[][]>("""
        () => Array.prototype.map.call(
            document.querySelectorAll(".ren-bar.ren-vertical"),
            bar => {
                const centre = bar.getAttribute("transform").match(/translate\(([-\d.]+)/);
                const width = bar.querySelector("path").getAttribute("d").match(/h([-\d.]+)/);
                const centreX = centre ? parseFloat(centre[1]) : 0;
                const barWidth = width ? Math.abs(parseFloat(width[1])) : 0;

                return [centreX - barWidth / 2, centreX + barWidth / 2];
            }
        )
        """);

    [TestMethod]
    [DataRow(Fixture, "CreatedOn", DisplayName = "creating a chart: from a date and a number column")]
    [DataRow(GroupedByDateFixture, "CreatedOn", DisplayName = "creating a chart: from data already grouped by the date")]
    [DataRow(NullableDateFixture, "CreatedOn With Null", DisplayName = "creating a chart: from a nullable date column")]
    [DataRow(GroupedByNullableDateFixture, "CreatedOn With Null", DisplayName = "creating a chart: from data grouped by a nullable date")]
    public async Task CreatingAChart_FromColumns(string fixture, string dateColumnHeading)
    {
        await CreateChartAsync(fixture, dateColumnHeading);

        await ExpectDateRangeAsync("2024-01-12", "2024-01-18");
    }

    // The grid groups by ID and aggregates CreatedOn as an expand icon, and the chart carries the
    // grid's innermost grouping's aggregations over to aggregate its value columns as the grid
    // does.  The date column isn't one of those: it carries each group's binned date, so
    // aggregating it would leave every group without one and the chart missing its date column.
    [TestMethod("creating a chart: from a grid aggregating the date column plots its dates")]
    public async Task CreatingAChart_FromGridAggregatingTheDateColumn()
    {
        await Ren.OpenAsync("ported/DataGroupingSettingsTest03.html");
        await Ren.Report.SelectColumnsAsync("Days Active", "CreatedOn");

        await DateValueChart.CreateByPeriodFromColumnHeadingAsync(Ren, "CreatedOn", "day");

        await ExpectDatesAsync("2024-01-12", "2024-01-15", "2024-01-18");
        await ExpectNoErrorAsync();
    }

    // "Add to cart %" is calculated per group from AnyAddsToCart and UserGuid.  The chart
    // aggregates neither as a value column, so the calculation has to read them anyway,
    // AnyAddsToCart being summed as in the grid.
    [TestMethod("creating a chart: with a grouping calculation reading columns it doesn't chart")]
    public async Task CreatingAChart_WithGroupingCalculationReadingUnchartedColumns()
    {
        await Ren.OpenAsync("ported/DateValueChartTest12.html");
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Add to cart %");

        await DateValueChart.CreateByPeriodFromColumnHeadingAsync(Ren, "CreatedOn", "month");

        await ExpectNoErrorAsync();
        Expect(await DateValueChart.DateValuesAsync(Ren)).ToEqual(new Dictionary<string, string>
        {
            ["2024-01-01"] = "0.5",
            ["2024-02-01"] = "0.75",
            ["2024-03-01"] = "0.2"
        });
    }

    // A chart from selected cells rather than whole columns is built on a data source holding just
    // those cells, so has no selected columns of its own: it plots the columns that holds.
    [TestMethod("creating a chart: from quarter and value cells")]
    public async Task CreatingAChart_FromQuarterAndValueCells()
    {
        await Ren.OpenAsync("ported/DateValueChartTest06.html");
        await Ren.Report.SelectCellsAsync("Quarter", 2, "Order Lines", 5);

        await DateValueChart.CreateByPeriodFromCellAsync(Ren, "Quarter", 2, "quarter");

        // The quarters, shown as "Q1 2024" and so on, are charted as the dates they stand for.
        // The cells are the first four rows, the two quarters of 2024.
        await ExpectDatesAsync("2024-01-01", "2024-04-01");
        await ExpectNoErrorAsync();
    }

    [TestMethod("creating a chart: from date and number cells")]
    public async Task CreatingAChart_FromDateAndNumberCells()
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectCellsAsync("CreatedOn", 2, "Days Active", 5);

        await DateValueChart.CreateByPeriodFromCellAsync(Ren, "CreatedOn", 2, "day");

        await Expect(Ren.Root.Locator("[data-qa-date-value-chart-date-range]")).ToHaveCountAsync(1);
        await ExpectNoErrorAsync();
    }

    // The chart has its own data grouping settings group, keeping its own groupings, but shares
    // the grid's filter group, so the grid's column filters reach it.
    [TestMethod("filtering the grid: changes the chart's data")]
    public async Task FilteringTheGrid_ChangesTheChartsData()
    {
        await CreateChartAsync(Fixture);
        var datesBefore = string.Join(",", (await DateValueChart.DateValuesAsync(Ren)).Keys);

        await Filters.OpenColumnFilterAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-12");

        await Poll(async () => string.Join(",", (await DateValueChart.DateValuesAsync(Ren)).Keys)).Not.ToBe(datesBefore);
    }

    // The chart has its own settings group, so can draw before the grid applies its saved filter,
    // and has to be told of it.
    [TestMethod("filtering the grid: with a saved filter shows the filtered data on loading")]
    public async Task FilteringTheGrid_WithSavedFilterShowsFilteredDataOnLoading()
    {
        await Ren.OpenAsync("ported/DateValueChartTest11.html");

        await ExpectDatesAsync("2024-01-05", "2024-01-08");
    }

    // These filter the grid's groups rather than its data rows, from "Filter groups...".  The grid's
    // grouped by week, so the values that filter names, 2024-01-08 and 2024-01-15, are bins no data
    // row holds: the rows behind them hold 12, 15 and 18 January.  The chart answers such a filter by
    // binning each row as the grid does, so it follows the filter whatever period it bins by itself.

    [TestMethod("filtering the grid's groups: at the chart's period loses the chart that week")]
    public async Task FilteringTheGridsGroups_AtTheChartsPeriod()
    {
        await CreateChartAsync(Fixture);
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-week-start");
        await GroupByWeekAsync("CreatedOn");
        await ExpectDatesAsync("2024-01-08", "2024-01-15");

        await Filters.OpenFilterGroupsAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-08");

        await ExpectDatesAsync("2024-01-15");
    }

    // The chart keeps its own groupings, so stays binned by day while the grid's grouped by week.
    [TestMethod("filtering the grid's groups: at another period loses the chart that week's days")]
    public async Task FilteringTheGridsGroups_AtAnotherPeriod()
    {
        await CreateChartAsync(Fixture);
        await GroupByWeekAsync("CreatedOn");
        await ExpectDatesAsync("2024-01-12", "2024-01-15", "2024-01-18");

        // The week beginning 8 January holds 12 January alone.
        await Filters.OpenFilterGroupsAsync(Ren, "CreatedOn");
        await Filters.ClickFilterCheckboxAsync(Ren, "2024-01-08");

        await ExpectDatesAsync("2024-01-15", "2024-01-18");
    }

    // A compare filter at the grouping level is matched against the group rows, whose CreatedOn
    // is the week they begin, and the chart makes the same comparison against the week each row
    // falls in.
    [TestMethod("filtering the grid's groups: with a compare filter at the chart's period loses that week")]
    public async Task FilteringTheGridsGroups_CompareFilterAtTheChartsPeriod()
    {
        await CreateChartAsync(Fixture);
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-week-start");
        await GroupByWeekAsync("CreatedOn");
        await ExpectDatesAsync("2024-01-08", "2024-01-15");

        await Filters.OpenFilterGroupsAsync(Ren, "CreatedOn");
        await Filters.ApplyCompareFilterAsync(Ren, "dateAfter", "2024-01-15");

        await ExpectDatesAsync("2024-01-15");
    }

    [TestMethod("filtering the grid's groups: with a compare filter at another period loses that week's days")]
    public async Task FilteringTheGridsGroups_CompareFilterAtAnotherPeriod()
    {
        await CreateChartAsync(Fixture);
        await GroupByWeekAsync("CreatedOn");
        await ExpectDatesAsync("2024-01-12", "2024-01-15", "2024-01-18");

        // The filter names a week, not a day, so 12 January goes with the week it falls in.
        await Filters.OpenFilterGroupsAsync(Ren, "CreatedOn");
        await Filters.ApplyCompareFilterAsync(Ren, "dateAfter", "2024-01-15");

        await ExpectDatesAsync("2024-01-15", "2024-01-18");
    }

    // A period the data only partly fills is drawn across the part it fills rather than all of it, so
    // coarser periods can't push the bars at either end outside the plot.  The data runs from Friday
    // 12 to Thursday 18 January 2024, so by week the week beginning the 8th has three days of data and
    // the week beginning the 15th four.

    [TestMethod("grouped into partly filled weeks: the bars stay within the plot")]
    public async Task PartlyFilledWeeks_BarsStayWithinThePlot()
    {
        await CreateChartAsync(Fixture);
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-week-start");
        await Expect(Ren.Root.Locator(".ren-bar.ren-vertical")).ToHaveCountAsync(2);

        var edges = await BarEdgesAsync();
        var plotWidth = await Ren.Root.Locator(".ren-x-axis.ren-date-axis .domain").First
            .EvaluateAsync<double>("domain => domain.getBBox().width");

        Expect(edges.Min(edge => edge[0])).ToBeGreaterThanOrEqual(-1);
        Expect(edges.Max(edge => edge[1])).ToBeLessThanOrEqual(plotWidth + 1);
    }

    [TestMethod("grouped into partly filled weeks: each bar's width follows what its week holds")]
    public async Task PartlyFilledWeeks_EachBarsWidthFollowsWhatItsWeekHolds()
    {
        await CreateChartAsync(Fixture);
        await DateValueChart.SelectDateGroupingAsync(Ren, "date-week-start");
        await Expect(Ren.Root.Locator(".ren-bar.ren-vertical")).ToHaveCountAsync(2);

        var widths = (await BarEdgesAsync()).Select(edge => edge[1] - edge[0]).ToArray();

        Expect(widths[1] / widths[0]).ToBeCloseTo(4.0 / 3, 1);
    }

    // Published is a flag column, so its marker takes the marker line's own label, and Event is a
    // text column, so each of its markers is labelled with the cell's text.
    [TestMethod("marker lines: are drawn at the dates their columns mark")]
    public async Task MarkerLines_DrawnAtTheDatesTheirColumnsMark()
    {
        await Ren.OpenAsync("ported/DateValueChartTest05.html");

        await Poll(MarkerLinesAsync)
            .ToEqual(new[] { "Price rise=2024-01-05", "Published=2024-01-03", "Relisted=2024-01-08" });
    }

    // Labels go in a band above the plot, each in the lowest lane it's clear in, with its line
    // drawn up to it.  A negative y1 is a line reaching above the plot's top, and a lane of -1
    // would be a label there was no room for.
    [TestMethod("marker lines: have their labels placed in lanes above the plot")]
    public async Task MarkerLines_LabelsPlacedInLanesAboveThePlot()
    {
        await Ren.OpenAsync("ported/DateValueChartTest05.html");

        await Poll(() => EvaluateAsync<bool[]>("""
            () => Array.prototype.map.call(
                document.querySelectorAll("[data-qa-marker-line]"),
                marker => Number(marker.getAttribute("data-marker-lane") || "-1") >= 0 &&
                    Number(marker.querySelector(".ren-marker-line__line").getAttribute("y1")) < 0
            )
            """)).ToEqual(new[] { true, true, true });
    }

    [TestMethod("marker lines: from a data source are drawn at its dates")]
    public async Task MarkerLines_FromADataSourceDrawnAtItsDates()
    {
        await Ren.OpenAsync("ported/DateValueChartTest10.html");

        await Poll(MarkerLinesAsync).ToEqual(new[] { "Launch=2024-01-04", "Promotion=2024-01-07" });
    }

    // Unlike declared marker lines, which pin to the plot's edge, data source markers hide.
    [TestMethod("marker lines: from a data source outside the date range aren't drawn")]
    public async Task MarkerLines_FromADataSourceOutsideTheDateRangeArentDrawn()
    {
        await Ren.OpenAsync("ported/DateValueChartTest10.html");

        await DateValueChart.SetCustomDateRangeAsync(Ren, "2024-01-05", "2024-01-10");

        await Poll(MarkerLinesAsync).ToEqual(new[] { "Promotion=2024-01-07" });
    }

    // Two markers a day apart, the first with a label far wider than the gap between them, labelled
    // only while they're hovered.

    private const string LongLabel =
        "Launch of the new look site, with a label much longer than the gap to the next date";

    private async Task OpenHoverLabelledChartAsync()
    {
        var settingsPath = Path.Combine(RepoFiles.Root, "test", "browser", "fixtures", "ported", "DateValueChartTest10.json");
        var settings = JsonNode.Parse(await File.ReadAllTextAsync(settingsPath))!;

        settings["visualisations"]![0]!["markerLabelLayout"] = "hover";
        settings["visualisations"]![0]!["dateMarkersDataSourceUri"] =
            "/test/browser/fixtures/ported/data/DateValueChartDateMarkerTests_LongDates";

        await Ren.OpenWithSettingsAsync("ported/DateValueChartTest10.html", settings);
        await Poll(async () => (await MarkerLinesAsync()).Length).ToBe(2);
    }

    // Moves the pointer onto a marker's line, the given fraction of the way down it, in steps as a
    // hand would, so that it leaves whatever it was over on the way.
    private async Task HoverLineAsync(string label, double fractionDown)
    {
        var box = (await Page.Locator($"[data-qa-marker-line=\"{label}\"] .ren-marker-line__line--hit").BoundingBoxAsync())!;

        await Page.Mouse.MoveAsync(box.X + box.Width / 2, (float)(box.Y + box.Height * fractionDown), new() { Steps = 10 });
    }

    private Task<string[]> ShownLabelsAsync() => EvaluateAsync<string[]>("""
        () => Array.prototype.filter.call(
            document.querySelectorAll("[data-qa-marker-line]"),
            marker => getComputedStyle(marker.querySelector(".ren-text-wrapper")).opacity !== "0"
        ).map(marker => marker.getAttribute("data-qa-marker-line"))
        """);

    [TestMethod("marker labels shown on hover: show none until a line is hovered")]
    public async Task MarkerLabelsShownOnHover_ShowNoneUntilALineIsHovered()
    {
        await OpenHoverLabelledChartAsync();

        Expect(await ShownLabelsAsync()).ToEqual(Array.Empty<string>());
    }

    [TestMethod("marker labels shown on hover: show a marker's label when its line is hovered low down")]
    public async Task MarkerLabelsShownOnHover_ShowLabelWhenLineHoveredLowDown()
    {
        await OpenHoverLabelledChartAsync();

        await HoverLineAsync("Promotion", 0.8);

        await Poll(ShownLabelsAsync).ToEqual(new[] { "Promotion" });
    }

    // A label hidden over the next marker's line once caught the pointer there, so hovering that
    // line showed the long label again.
    [TestMethod("marker labels shown on hover: show the hovered line's label rather than a hidden one over it")]
    public async Task MarkerLabelsShownOnHover_ShowHoveredLinesLabelRatherThanAHiddenOne()
    {
        await OpenHoverLabelledChartAsync();

        await HoverLineAsync(LongLabel, 0.8);
        await Poll(ShownLabelsAsync).ToEqual(new[] { LongLabel });

        await HoverLineAsync("Promotion", 0.02);

        await Poll(ShownLabelsAsync).ToEqual(new[] { "Promotion" });
    }

    private async Task UntickBrandsAsync(params string[] brands)
    {
        await Filters.OpenColumnFilterAsync(Ren, "Brand");

        foreach (var brand in brands)
        {
            await Filters.ClickFilterCheckboxAsync(Ren, brand);
        }

        await Page.Keyboard.PressAsync("Escape");
    }

    // With no rows the chart can't find its date column, so it's created showing an error, and once
    // the rows come back the redraw has to put the chart in its place.
    [TestMethod("created over no rows the chart is drawn once rows return")]
    public async Task CreatedOverNoRows_DrawnOnceRowsReturn()
    {
        await Ren.OpenAsync("ported/DateValueChartTest17.html");
        await UntickBrandsAsync("Acorn", "Bramble", "Cedar");
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Units");

        await Ren.Report.RightClickAsync(".ren-data-grid__column-heading[title='CreatedOn']");
        await Ren.Root.MouseOverAsync("#create-visualisation");
        await Ren.Root.ClickAsync("#create-visualisation-date-value-chart");

        await Expect(Ren.Root.Locator(NoDataError).First).ToBeAttachedAsync();

        await UntickBrandsAsync("Acorn");

        await Expect(Ren.Root.Locator("[data-qa-date-value-chart-date-range]").First).ToBeAttachedAsync();
    }

    // The chart is first drawn on the next animation frame.  Its container leaving the page before
    // then without the chart being destroyed is stood in for by taking the popup off the page as soon
    // as the chart is put in it, as a mutation observer's callback runs ahead of that frame.
    [TestMethod("a chart whose container leaves the page before it's drawn isn't drawn")]
    public async Task ContainerLeavesThePageBeforeDrawn_NotDrawn()
    {
        await Ren.OpenAsync("ported/DateValueChartTest18.html");
        await Ren.Report.SelectColumnsAsync("CreatedOn", "Units");
        await Ren.Report.RightClickAsync(".ren-data-grid__column-heading[title='CreatedOn']");
        await Ren.Root.MouseOverAsync("#create-visualisation");

        var detached = await EvaluateAsync<bool>("""
            () => new Promise(resolve => {
                const observer = new MutationObserver(() => {
                    const chartElement = document.querySelector(".ren-report-popup-window .ren-date-value-chart");

                    if (!chartElement) {
                        return;
                    }

                    observer.disconnect();
                    chartElement.closest(".ren-report-popup-window").remove();
                    resolve(true);
                });

                observer.observe(document.body, { childList: true, subtree: true });
                document.querySelector("#create-visualisation-date-value-chart").click();

                setTimeout(() => {
                    observer.disconnect();
                    resolve(false);
                }, 5000);
            })
            """);

        Expect(detached).ToBe(true);

        // Any error the chart throws drawing into the detached popup fails the test.
        await Page.WaitForTimeoutAsync(1000);
    }
}
