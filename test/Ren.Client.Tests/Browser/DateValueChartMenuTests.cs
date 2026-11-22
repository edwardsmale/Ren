namespace Ren.Client.Tests.Browser;

// These tests cover what a date/value chart's context menu offers and what its items act on.  A
// series' menu is its own, holding none of the chart's date items, while the chart's menu, opened
// away from every series, offers most of the series' items to act on them all at once.  Both keep
// the series' items in the submenus they share with the chart's, such as Values and Draw as.
// The bar layout is how bars are laid out against each other, so it's only offered with more than
// one series.  Draw as lists the kinds with the series' own options, such as Lines' Line style,
// then the chart's layouts.  On a series' menu, Draw as and Labels are with the series' own items.
[TestClass]
public class DateValueChartMenuTests : BrowserTest
{
    private const string Fixture = "ported/DateValueChartTest01.html";

    private const string ChartTypeItem = "#chart-type";
    private const string BarsItem = "#chart-type-bars";
    private const string PiesItem = "#chart-type-pies";
    private const string ValuesItem = "#chart-values";
    private const string AggregationItem = "#chart-aggregation";
    private const string BarLayoutItem = "#bar-layout";
    private const string EstimateLastPeriodItem = "#chart-estimate-last-period";
    private const string InPlaceEstimateItem = "#chart-estimate-last-period-in-place-estimate";
    private const string NoEstimateItem = "#chart-estimate-last-period-no-estimate";
    private const string SeasonallyAdjustedItem = "#chart-estimate-last-period-seasonally-adjusted";
    private const string DateGroupingItem = "#chart-date-grouping";

    private async Task CreateChartAsync(params string[] columnHeadings)
    {
        await Ren.OpenAsync(Fixture);
        await Ren.Report.SelectColumnsAsync(columnHeadings);
        await DateValueChart.CreateFromColumnHeadingAsync(Ren, "CreatedOn");
    }

    private Task CreateSingleSeriesChartAsync() => CreateChartAsync("CreatedOn", "Unique Searches Per Day");

    private async Task CreateTwoSeriesChartAsync()
    {
        await CreateChartAsync("CreatedOn", "Unique Searches Per Day", "Days Active");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
    }

    private Task OpenChartMenuAsync() => DateValueChart.OpenMenuAsync(Ren, ".ren-x-axis");

    private Task OpenSeriesMenuAsync(int seriesNumber = 1) =>
        DateValueChart.OpenMenuAsync(Ren, $".ren-bar.ren-vertical[data-series='{seriesNumber}']");

    private async Task OpenSeriesValuesMenuAsync(int seriesNumber = 1)
    {
        await OpenSeriesMenuAsync(seriesNumber);
        await Ren.Root.MouseOverAsync(ValuesItem);
    }

    private Task ExpectShownAsync(string selector) => Expect(Ren.Root.Locator(selector).First).ToBeAttachedAsync();

    private Task ExpectNotShownAsync(string selector) => Expect(Ren.Root.Locator(selector)).ToHaveCountAsync(0);

    private async Task SelectEstimateLastPeriodAsync(string optionSelector)
    {
        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(EstimateLastPeriodItem);
        await Ren.Root.ClickAsync(optionSelector);
        await Ren.WaitUntilLoadedAsync();
    }

    // Read from the tick its option carries the next time the chart's menu is opened, which
    // shows what the series all share.
    private async Task ExpectEstimatedInPlaceAsync(int seriesNumber)
    {
        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(EstimateLastPeriodItem);

        await ExpectShownAsync(InPlaceEstimateItem + ".ren-is-checked");
        await ExpectNotShownAsync(NoEstimateItem + ".ren-is-checked");
    }

    [TestMethod("the chart's menu: offers the series' items for every series")]
    public async Task OffersTheSeriesItemsForEverySeries()
    {
        await CreateTwoSeriesChartAsync();

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);

        await ExpectShownAsync(BarsItem);
        await ExpectShownAsync(EstimateLastPeriodItem);

        await Ren.Root.MouseOverAsync(ValuesItem);

        await ExpectShownAsync(AggregationItem);

        // One colour for every series would leave nothing to tell them apart, and hiding or
        // removing every series would leave nothing drawn.
        await ExpectNotShownAsync("#series-colour");
        await ExpectNotShownAsync("#show-hide-series");
        await ExpectNotShownAsync("#remove-series");
    }

    [TestMethod("the chart's menu: sets every series' type")]
    public async Task SetsEverySeriesType()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Lines");

        await ExpectShownAsync("g.ren-series-1 .ren-data-series__line-path");
        await ExpectShownAsync("g.ren-series-2 .ren-data-series__line-path");
        await ExpectNotShownAsync(".ren-bar.ren-vertical");
    }

    [TestMethod("the chart's menu: sets every series' last period estimate")]
    public async Task SetsEverySeriesLastPeriodEstimate()
    {
        await CreateTwoSeriesChartAsync();

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(EstimateLastPeriodItem);
        await Ren.Root.ClickAsync(InPlaceEstimateItem);
        await Ren.WaitUntilLoadedAsync();

        await ExpectEstimatedInPlaceAsync(1);
        await ExpectEstimatedInPlaceAsync(2);
    }

    [TestMethod("the chart's menu: offers the bar layout only with more than one series")]
    public async Task OffersTheBarLayoutOnlyWithMoreThanOneSeries()
    {
        await CreateSingleSeriesChartAsync();

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);

        await ExpectShownAsync(PiesItem);
        await ExpectNotShownAsync(BarLayoutItem);
    }

    [TestMethod("the chart's menu: offers the bar layout with two series drawn as bars")]
    public async Task OffersTheBarLayoutWithTwoSeriesDrawnAsBars()
    {
        await CreateTwoSeriesChartAsync();

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);

        await ExpectShownAsync(BarLayoutItem);
    }

    [TestMethod("the chart's menu: lists the kinds, then the layouts")]
    public async Task ListsTheKindsThenTheLayouts()
    {
        await CreateTwoSeriesChartAsync();
        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, "Draw as", "Lines");

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);
        await ExpectShownAsync("#line-layout");

        var ids = await Ren.Root.Locator(".ren-context-menu").Last.EvaluateAsAsync<string[]>(
            "menu => Array.from(menu.querySelectorAll('[id]')).map(item => item.id)");
        var order = new[]
        {
            "chart-type-bars",
            "chart-type-lines",
            "chart-type-dots",
            "chart-type-pies",
            "series-line-style",
            "bar-layout",
            "line-layout"
        };

        Expect(ids.Where(order.Contains).ToArray()).ToEqual(order);
    }

    [TestMethod("a series' menu: has Draw as and Labels once each, with the series' own items")]
    public async Task HasDrawAsAndLabelsWithTheSeriesOwnItems()
    {
        await CreateTwoSeriesChartAsync();

        await OpenSeriesMenuAsync();

        // Each item with the heading of the section it's in.
        var entries = await Ren.Root.Locator(".ren-context-menu").First.EvaluateAsAsync<string[]>("""
            menu => {
                let section = "";
                return Array.from(menu.querySelectorAll(".ren-context-menu__section-heading, [id]"))
                    .map(entry => entry.classList.contains("ren-context-menu__section-heading")
                        ? (section = entry.textContent, null)
                        : section + ": " + entry.id)
                    .filter(entry => entry);
            }
            """);

        Expect(entries.Where(entry => entry.EndsWith(": chart-type") || entry.EndsWith(": chart-labels")).ToArray())
            .ToEqual(new[] { "Series: chart-type", "Series: chart-labels" });
    }

    [TestMethod("the chart's menu: turns pies off when the series are drawn as bars")]
    public async Task TurnsPiesOffWhenTheSeriesAreDrawnAsBars()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Bars");

        await ExpectShownAsync(".ren-bar.ren-vertical[data-series='1']");
        await ExpectShownAsync(".ren-bar.ren-vertical[data-series='2']");
    }

    [TestMethod("the chart's menu: turns the pies' holes on and off, with their totals")]
    public async Task TurnsThePiesHolesOnAndOff()
    {
        await CreateTwoSeriesChartAsync();
        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pies");

        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pie layout", "Holes");

        StringAssert.Contains(await SavedSettingsTextAsync(), "\"pieHoleRadius\":0.4");

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);
        await Ren.Root.MouseOverAsync("#pie-layout");
        await ExpectShownAsync("#pie-hole-size");
        await ExpectShownAsync("#pie-hole-totals");
        await ExpectShownAsync("#pie-total-format");
        await Page.Keyboard.PressAsync("Escape");

        await DateValueChart.ClickMenuPathAsync(Ren, "Draw as", "Pie layout", "Holes");

        var savedOff = await SavedSettingsTextAsync();
        Assert.IsFalse(savedOff.Contains("\"pieHoleRadius\":0.4"), savedOff);

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);
        await Ren.Root.MouseOverAsync("#pie-layout");
        await ExpectShownAsync("#pie-holes");
        await ExpectNotShownAsync("#pie-hole-size");
        await ExpectNotShownAsync("#pie-hole-totals");
        await ExpectNotShownAsync("#pie-total-format");
    }

    [TestMethod("a series' menu: draws just that series as pies, beside the others' bars")]
    public async Task DrawsJustThatSeriesAsPies()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, "Draw as", "Pies");

        await ExpectShownAsync(".ren-bar.ren-vertical[data-series='1']");
        await ExpectShownAsync(".ren-pie-slice[data-series='2']");
        await ExpectNotShownAsync(".ren-bar.ren-vertical[data-series='2']");
        await ExpectNotShownAsync(".ren-pie-slice[data-series='1']");
    }

    [TestMethod("a series' menu: offers the series' items")]
    public async Task OffersTheSeriesItems()
    {
        await CreateSingleSeriesChartAsync();

        await OpenSeriesMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);

        await ExpectShownAsync(BarsItem);

        await Ren.Root.MouseOverAsync(ValuesItem);

        await ExpectShownAsync(AggregationItem);
    }

    [TestMethod("a series' menu: doesn't offer the chart's date items")]
    public async Task DoesntOfferTheChartsDateItems()
    {
        await CreateSingleSeriesChartAsync();

        await OpenSeriesMenuAsync();

        await ExpectShownAsync(ValuesItem);
        await ExpectNotShownAsync(DateGroupingItem);
    }

    // The series' items in a submenu shared with the chart's are headed by the series' name, so
    // they can be told from the chart's own.
    [TestMethod("a series' menu: heads the series' items with its name")]
    public async Task HeadsTheSeriesItemsWithItsName()
    {
        await CreateSingleSeriesChartAsync();

        await OpenSeriesMenuAsync();
        await Ren.Root.MouseOverAsync(ChartTypeItem);

        var submenu = Ren.Root.Locator(".ren-context-menu").Last;

        await Expect(submenu.Locator(".ren-context-menu__section-heading").First)
            .ToHaveTextAsync("Series \"Unique Searches Per Day\"");
    }

    [TestMethod("a series' menu: sets the type of its series alone")]
    public async Task SetsTheTypeOfItsSeriesAlone()
    {
        await CreateTwoSeriesChartAsync();

        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, "Draw as", "Lines");

        await ExpectShownAsync("g.ren-series-2 .ren-data-series__line-path");
        await ExpectNotShownAsync(".ren-bar.ren-vertical[data-series='2']");
        await ExpectShownAsync(".ren-bar.ren-vertical[data-series='1']");
    }

    [TestMethod("a series' menu: leaves out the formats only a data grid cell can carry")]
    public async Task LeavesOutTheFormatsOnlyADataGridCellCanCarry()
    {
        await CreateSingleSeriesChartAsync();

        // The chart's Format submenu sits in its Values submenu.
        await OpenSeriesValuesMenuAsync();
        await Ren.Root.MouseOverAsync("#chart-format");

        await ExpectShownAsync("#format-as-number");
        await ExpectShownAsync("#format-as-currency");
        await ExpectNotShownAsync("#format-as-expand-icon");
    }

    // Scaling a part period up to a whole one only says anything about a running total, so the
    // estimate is offered where a series' values are summed or counted, and not where averaged.
    [TestMethod("estimate last period: is offered for a summed series")]
    public async Task IsOfferedForASummedSeries()
    {
        await CreateSingleSeriesChartAsync();

        await OpenChartMenuAsync();

        await ExpectShownAsync(EstimateLastPeriodItem);
    }

    [TestMethod("estimate last period: is offered for a counted series")]
    public async Task IsOfferedForACountedSeries()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.SelectAggregationTypeAsync(Ren, "count");

        await OpenChartMenuAsync();

        await ExpectShownAsync(EstimateLastPeriodItem);
    }

    // It's set for the chart as a whole, so it's with the chart's dates and not on a series.
    [TestMethod("estimate last period: isn't on a series' menu")]
    public async Task IsntOnASeriesMenu()
    {
        await CreateSingleSeriesChartAsync();

        await OpenSeriesMenuAsync();

        await ExpectShownAsync(ValuesItem);
        await ExpectNotShownAsync(EstimateLastPeriodItem);
    }

    [TestMethod("estimate last period: isn't offered for an averaged series")]
    public async Task IsntOfferedForAnAveragedSeries()
    {
        await CreateSingleSeriesChartAsync();
        await DateValueChart.SelectAggregationTypeAsync(Ren, "average");

        await OpenChartMenuAsync();

        await ExpectShownAsync(ValuesItem);
        await ExpectNotShownAsync(EstimateLastPeriodItem);
    }

    [TestMethod("estimate last period: is ticked the next time the menu's opened")]
    public async Task IsTickedTheNextTimeTheMenusOpened()
    {
        await CreateSingleSeriesChartAsync();

        await SelectEstimateLastPeriodAsync(InPlaceEstimateItem);

        await ExpectEstimatedInPlaceAsync(1);
    }

    // A new series is drawn against the ones already there, so it estimates as they do, as one
    // that didn't would read as a fall in the period they all scale up.
    [TestMethod("estimate last period: is taken up by a series added")]
    public async Task IsTakenUpByASeriesAdded()
    {
        await CreateSingleSeriesChartAsync();
        await SelectEstimateLastPeriodAsync(InPlaceEstimateItem);

        await DateValueChart.AddDataSeriesAsync(Ren, "Active");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(2);
        await ExpectEstimatedInPlaceAsync(2);
    }

    [TestMethod("estimate last period: is taken up by every series of a split")]
    public async Task IsTakenUpByEverySeriesOfASplit()
    {
        await CreateSingleSeriesChartAsync();
        await SelectEstimateLastPeriodAsync(InPlaceEstimateItem);

        // The split drops the series it was set on, so every series afterwards is a new one.
        await DateValueChart.SplitDataAsync(Ren, "Discontinued");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBeGreaterThan(1);

        var seriesCount = await DateValueChart.SeriesCountAsync(Ren);

        for (var seriesNumber = 1; seriesNumber <= seriesCount; seriesNumber++)
        {
            await ExpectEstimatedInPlaceAsync(seriesNumber);
        }
    }

    [TestMethod("a split: keeps each value column's series drawn as they were")]
    public async Task KeepsEachValueColumnsSeriesDrawnAsTheyWere()
    {
        await CreateTwoSeriesChartAsync();
        await DateValueChart.ClickSeriesMenuPathAsync(Ren, 2, "Draw as", "Pies");

        // The split drops both series, each column's new ones taking up how it was drawn.
        await DateValueChart.SplitDataAsync(Ren, "Discontinued");

        await Poll(() => DateValueChart.SeriesCountAsync(Ren)).ToBe(6);

        var drawnSeries = await Page.EvaluateAsync<int[]>("""
            () => [".ren-bar.ren-vertical", ".ren-pie-slice"].map(selector =>
                new Set(Array.from(document.querySelectorAll(selector + "[data-series]"))
                    .map(mark => mark.getAttribute("data-series"))).size)
            """);

        Expect(drawnSeries).ToEqual(new[] { 3, 3 });
    }

    [TestMethod("estimate last period: is seasonally adjusted by default")]
    public async Task IsSeasonallyAdjustedByDefault()
    {
        await CreateSingleSeriesChartAsync();
        await SelectEstimateLastPeriodAsync(InPlaceEstimateItem);

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(EstimateLastPeriodItem);

        await ExpectShownAsync(SeasonallyAdjustedItem + ".ren-is-checked");
    }

    [TestMethod("estimate last period: is unticked as seasonally adjusted once that's turned off")]
    public async Task IsUntickedAsSeasonallyAdjustedOnceThatsTurnedOff()
    {
        await CreateSingleSeriesChartAsync();
        await SelectEstimateLastPeriodAsync(InPlaceEstimateItem);
        await SelectEstimateLastPeriodAsync(SeasonallyAdjustedItem);

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(EstimateLastPeriodItem);

        await ExpectShownAsync(SeasonallyAdjustedItem);
        await ExpectNotShownAsync(SeasonallyAdjustedItem + ".ren-is-checked");
    }

    [TestMethod("estimate last period: with no estimate doesn't offer the seasonal adjustment")]
    public async Task WithNoEstimateDoesntOfferTheSeasonalAdjustment()
    {
        await CreateSingleSeriesChartAsync();

        await OpenChartMenuAsync();
        await Ren.Root.MouseOverAsync(EstimateLastPeriodItem);

        await ExpectShownAsync(InPlaceEstimateItem);
        await ExpectNotShownAsync(SeasonallyAdjustedItem);
    }
}
