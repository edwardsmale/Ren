Ren.VisualisationTypes_DateValueChart = {
    visualisationTypeName: "DateValueChart",
    tagName: "ren-date-value-chart",
    supportsEffects: true,
    supportsFocusMode: true,
    availableOptions: {
        dataSourceUri: "String",
        dataTabIndex: "Number",
        dataTabGroup: "String",
        dateHeading: "String",
        valueHeading: "String",
        valueHeadings: "Array",
        selectedColumns: "Array",
        barNarrowingRatio: "Number",

        // The screen pixels left clear between periods, half at either side of each, narrowing
        // its bars to keep one period's apart from the next's.  0 by default.
        periodGap: "Number",

        // How several line series are drawn together: "Overlayed" (the default) or "Stacked", per
        // Ren.LineLayoutEnum.  Shaded, each line is filled down to the line below it, or to zero
        // where they are overlayed, at lineShadingOpacity (0 to 1, 0.25 by default).
        lineLayout: "String",
        shadeLines: "Boolean",
        lineShadingOpacity: "Number",

        // The column whose values subdivide each bar or pie slice, in its series' colour with white
        // borders.  subdivisionLabels is what each band is labelled with: "none", "names" (the
        // default), "values" or "both".  On pies, subdivisionLabelPlacement puts them "inside"
        // their bands (the default) or "around" the pie, stacked with the slices' own labels.
        subdivideColumn: "String",
        subdivisionLabels: "String",
        subdivisionLabelPlacement: "String",

        // The most subdivisions a bar or slice is drawn with, the smallest beyond it gathered into
        // one.  Unset, there are up to 20.
        subdivisionLimit: "Number",

        // The series drawn as pies (a series' chartType of "Pie") share a pie per period, each a
        // slice of it, with a hole in the middle pieHoleRadius (0 to 0.9 of the pie's radius, 0 by
        // default) across.  showAsPies, which drew every series so, is only read from charts
        // saved with it, whose series are then each made pies.
        showAsPies: "Boolean",
        pieHoleRadius: "Number",

        // Where the pies' slices are labelled: "auto" (inside a slice where the label fits,
        // otherwise outside the pie), "inside", "outside" (the default, stacked either side of
        // each pie, hugging it), "around" (in a column either side of each pie) or "off".  Outside
        // and around, the labels are joined to their slices by lines, the pies shrunk a little to
        // make room.  A label gives any of the series' name, the value and its share of the pie,
        // the name and the share by default.
        pieLabels: "String",
        pieLabelNames: "Boolean",
        pieLabelValues: "Boolean",
        pieLabelPercentages: "Boolean",

        // Where a label's value goes: "inline" (the default, after the name), "below" (with the
        // share, on a line below the name) or "inside" (inside the slice, above any share written
        // there, where the labels are "outside" or "around").
        pieValuePosition: "String",

        // Writes each slice's share inside it, the rest of its label outside the pie, where the
        // labels are "outside" or "around" and give the share.  On by default.
        pieSharesInside: "Boolean",

        // Writes each pie's total in its hole, where it has one.  On by default.
        pieHoleTotals: "Boolean",

        // The format function specs the totals are shown in.  Unset, they take their slices'
        // format.
        pieTotalFormatFunction: "Array",

        // The font size, in px, of the pies' labels, their totals a little bigger.
        pieLabelFontSize: "Number",
        datePeriod: "String",
        leftAxis: "Object",
        rightAxis: "Object",

        // Settings for the axis a series assigned "hiddenAxis" is scaled against, which is never
        // drawn, as for leftAxis and rightAxis but without a label.
        hiddenAxis: "Object",

        // Each series' settings.  A series' colourFunction is handed the series' value in a row
        // and the row, and returns a colour for that bar, line point or dot, or null.  A point the
        // chart's grouping aggregated is coloured by merging the colours of the rows behind it.  A
        // series' standardColour names a colour in Ren.StandardColoursConfig, which outranks its
        // own colour.  A series' trendLine draws a dashed "linear" fit or "movingAverage" over
        // its trendLinePeriods (3 by default) periods.  A series' markExtremes marks its highest
        // and lowest values, and its compareWithPreviousYear draws its values for the year before
        // over it.
        series: "Array",

        // The index of the scheme in Ren.DateValueChart_ColourSchemes the series' default colours
        // come from, 0 by default.
        colourScheme: "Number",

        // Series settings a split series takes over the usual defaults until it is styled, such
        // as { chartType: "Line" }.
        splitSeriesDefaults: "Object",

        // Hides by default a split series totalling a small fraction of the largest one's total.
        hideMinorSplitSeries: "Boolean",

        // The headings of the series the chart draws, any others having been removed from it,
        // legend entries and all.  Unset, every series is drawn.
        includedSeries: "Array",

        // Draws only this many series, those reaching highest, the others being left out as
        // removed ones are.  Unset, every series is drawn.
        legendSeriesLimit: "Number",

        // Set once the user has chosen the limit, which a split into many series then keeps to,
        // however many there are, rather than being limited to its top ones.
        legendSeriesLimitChosen: "Boolean",

        markerLines: "Array",

        // Dated events drawn as flagged vertical lines, read from a data source of their own.
        // dateMarkersDataSourceUri is the shorthand for a source and nothing else.
        dateMarkers: "Object",
        dateMarkersDataSourceUri: "String",

        // Lines at the start of each period in the charted range: any of "years", "quarters"
        // and "months".
        calendarMarkers: "Array",

        // Shades the weekends and holidays behind the series of a chart by the day or shorter.
        shadeNonWorkingDays: "Boolean",

        // The group the chart's dates grid keeps its filter under, defaulting to one of the chart's
        // own.  Every chart naming the same group redraws its markers when that filter changes.
        dateMarkersFilterGroup: "String",

        // The group the chart shares its date range under, defaulting to its filter group.  Every
        // chart naming the same group narrows to a range picked on any of them.
        dateRangeGroup: "String",

        // A slider beneath the plot stepping the date range through each "month", "quarter" or
        // "year" the data holds.  None by default.
        periodSlider: "String",

        // Draws the chart as several, side by side, each over one of the latest "month",
        // "quarter" or "year" periods the data holds, oldest first: at most multiChartMaxCount (4
        // by default), each named at its top left unless multiChartShowDateRange is false.  With
        // multiChartSlider, a slider beneath them steps back through the earlier periods.
        // Ctrl + wheel over the charts draws fewer or more of them, and Shift + wheel steps the
        // periods they show, both kept in these settings and the chart's date range.  Unless
        // multiChartKeepEmptyPeriods is false, the periods are every one from the first the data
        // holds to the last, whatever is filtered out, and one left with no rows shows "No data
        // for ..." in place of its chart, so that filtering leaves the charts and the slider where
        // they were.
        multiChartPeriod: "String",
        multiChartMaxCount: "Number",
        multiChartShowDateRange: "Boolean",
        multiChartSlider: "Boolean",
        multiChartKeepEmptyPeriods: "Boolean",

        // The range the chart's Reset button returns it to, defaulting to the range it is first
        // given on its date grouping entry.  Takes the same forms as that range.
        defaultDateRange: "Object",

        // "auto" (the default), "staggered", "numbered", "numbers" or "hover".
        markerLabelLayout: "String",

        // Handed a marker's label and row, and returning the shorter text its flag shows.
        markerLabelFormatFunction: "String",

        // The font sizes, in px, the chart's value labels and its axes' tick labels are drawn at.
        valueLabelFontSize: "Number",
        axisLabelFontSize: "Number",

        // The font size, in px, of the names written up the bars of a series set to show them.
        seriesNamesInBarsFontSize: "Number",

        // How bars' value labels are written: "auto" (the default, horizontal unless most labels
        // are wider than their bars, then "above"), "horizontal", "above" (horizontal, always
        // beyond the bar's end), "vertical" (running up the bar) or "diagonal" (rising at 45
        // degrees from the bar's end).
        barValueLabelLayout: "String",

        // How line series are named on the plot: "auto" (the default, at the lines' ends for 2 to
        // 8 lines), "ends" (in a column right of the plot, level with each line's end), "along"
        // (beside each line, where no other line passes) or "off".  With a right axis shown, the
        // names go along the lines rather than at their ends, which the axis' labels would cover.
        lineNames: "String",

        // The font size, in px, of the names of the lines.
        lineNamesFontSize: "Number",

        // A title shown above the chart, and in its image.
        chartTitle: "String",

        // A line beneath the title, in its image too; {filters} names the filters on the chart.
        chartSubtitle: "String",

        // Shown by default.  A hidden axis keeps its heading, and its room is given to the plot.
        showLeftAxis: "Boolean",
        showRightAxis: "Boolean",
        showDateAxis: "Boolean",

        // Independent of the axis' own visibility.
        showLeftAxisHeading: "Boolean",
        showRightAxisHeading: "Boolean",

        // Faint lines across the plot at the value axis' ticks.  Off by default.
        showGridlines: "Boolean",

        // A band following the pointer below the date axis, naming the hovered period.  Off by
        // default.
        showHoverDateLine: "Boolean",

        // Shades the hovered period up the plot, with or without the band below the axis.  Off by
        // default, keeping it clear of what is plotted.
        hoverDateLineFullHeight: "Boolean",

        // A box beneath the hovered date listing what each enabled series stands at in the hovered
        // period.  Off by default.
        showHoverValues: "Boolean",

        // Follows each value in the hovered values box with its change on the period before.  Off
        // by default.
        showHoverChange: "Boolean",

        // Clicking a split series or a subdivision band filters the chart's filter settings to its
        // value, as a filter module's radio button does.  Off by default.
        enableCrossFiltering: "Boolean",

        // When a last period that is still running is shown: "Always" (the default),
        // "FromHalfway", "FromOneThird", "FromTwoThirds" or "Never", per
        // Ren.ShowIncompleteLastPeriodEnum.
        showIncompleteLastPeriod: "String",

        // Whether the last period's estimate weights each day by the share of trade it usually
        // brings, per Ren.WorkingDayWeights.  On by default.
        seasonallyAdjustEstimate: "Boolean",

        // Plots each series as its share of each period's total over the series drawn, which
        // with stacked bars makes 100% bars.  A series' runningTotal plots its totals to date, and
        // its yearToDate its totals for the year to date, starting again each year, and its
        // rollingYearTotal its totals over the year to each period's end.
        showAsShareOfTotal: "Boolean",

        // Plots each series as an index of its first value, which is 100, so that series of
        // different sizes can be compared by how they have grown.  Shares win over it.
        showAsIndex: "Boolean",

        // Plots each series as its change on the period before, as a percentage.  Shares and an
        // index win over it.
        showAsChange: "Boolean",

        // Plots each series as its change on the same period a year before, as a percentage.
        // Shares, an index and changes on the period before win over it.
        showAsYearOnYearChange: "Boolean",

        // Plots each series of totals as its average per day over each period, so that months of
        // different lengths compare fairly.  Only for weeks or longer.
        showPerDay: "Boolean",

        // Horizontal lines across the plot at set values, such as targets: each { value, label,
        // axis }, the axis "leftAxis" (the default) or "rightAxis".
        valueLines: "Array",

        // Shading across the plot between two values, such as a target range: each { from, to,
        // label, axis }, the axis as for a value line.
        valueBands: "Array",

        // The chart's own grouping: how it bins dates, aggregates each value column, and splits its
        // data into a series per value where a further grouping level is declared.
        chartDataGroupingSettings: "Object"
    },
    synchronisedOptions: {

    },

    // Turns the enum key names persistedProperties writes back into the chart's own values.
    resolvePersistedProperties: (properties) => Ren.ChartEnumSettings.resolve(properties),

    persistedProperties: [
        {
            name: "barNarrowingRatio",
            transform: (barNarrowingRatio) => Math.round(barNarrowingRatio * 10000) / 10000
        },
        {
            name: "periodGap",
            transform: (periodGap) => periodGap > 0 ? periodGap : undefined
        },
        {
            name: "barLayout",
            transform: (barLayout) =>
                Ren.ChartEnumSettings.getChartEnumKey("barLayout", barLayout)
        },
        {
            name: "lineLayout",
            transform: (lineLayout) =>
                Ren.ChartEnumSettings.getChartEnumKey("lineLayout", lineLayout)
        },
        "shadeLines",
        "lineShadingOpacity",
        {
            name: "subdivideColumn",
            transform: (subdivideColumn) => subdivideColumn || undefined
        },
        {
            name: "subdivisionLabels",
            transform: (subdivisionLabels) =>
                subdivisionLabels === "names" ? undefined : subdivisionLabels
        },
        {
            name: "subdivisionLabelPlacement",
            transform: (subdivisionLabelPlacement) =>
                subdivisionLabelPlacement === "around" ? subdivisionLabelPlacement : undefined
        },
        {
            name: "subdivisionLimit",
            transform: (subdivisionLimit) => subdivisionLimit > 0 ? subdivisionLimit : undefined
        },
        {
            name: "showAsPies",
            transform: (showAsPies) => showAsPies === true ? true : undefined
        },
        {
            name: "pieHoleRadius",
            transform: (pieHoleRadius) => pieHoleRadius ? pieHoleRadius : undefined
        },
        {
            name: "pieLabels",
            transform: (pieLabels) => pieLabels === "outside" ? undefined : pieLabels
        },
        {
            name: "pieLabelNames",
            transform: (pieLabelNames) => pieLabelNames === false ? false : undefined
        },
        {
            name: "pieLabelValues",
            transform: (pieLabelValues) => pieLabelValues === true ? true : undefined
        },
        {
            name: "pieValuePosition",
            transform: (pieValuePosition) =>
                pieValuePosition === "inline" ? undefined : pieValuePosition
        },
        {
            name: "pieLabelPercentages",
            transform: (pieLabelPercentages) => pieLabelPercentages === false ? false : undefined
        },
        {
            name: "pieSharesInside",
            transform: (pieSharesInside) => pieSharesInside === false ? false : undefined
        },
        {
            name: "pieHoleTotals",
            transform: (pieHoleTotals) => pieHoleTotals === false ? false : undefined
        },
        {
            name: "pieTotalFormatFunction",
            transform: (pieTotalFormatFunction) => pieTotalFormatFunction || undefined
        },
        "pieLabelFontSize",

        // Saved by name, the enum's values having been renumbered before.
        {
            name: "datePeriod",
            transform: (datePeriod) =>
                Ren.DatePeriodEnum.AsString(Ren.DatePeriodEnum.Parse(datePeriod))
        },

        "leftAxis",
        "rightAxis",
        "hiddenAxis",
        {
            name: "series",
            transform: (series) => Ren.ChartEnumSettings.withSeriesEnumKeys(series)
        },
        {
            name: "colourScheme",
            transform: (colourScheme) => colourScheme ? colourScheme : undefined
        },
        {
            name: "splitSeriesDefaults",
            transform: (splitSeriesDefaults) =>
                Ren.ChartEnumSettings.withSeriesEnumKeys([splitSeriesDefaults])[0]
        },
        "hideMinorSplitSeries",
        {
            name: "includedSeries",
            transform: (includedSeries) => includedSeries ?? undefined
        },
        "legendSeriesLimit",
        "legendSeriesLimitChosen",
        "showLegend",
        {
            name: "chartTitle",
            transform: (chartTitle) => chartTitle || undefined
        },
        {
            name: "chartSubtitle",
            transform: (chartSubtitle) => chartSubtitle || undefined
        },
        "showValueLabelsWhenHighlighted",
        "valueLabelFontSize",
        "axisLabelFontSize",
        "seriesNamesInBarsFontSize",
        {
            name: "barValueLabelLayout",
            transform: (barValueLabelLayout) =>
                barValueLabelLayout === "auto" ? undefined : barValueLabelLayout
        },
        "lineNamesFontSize",
        {
            name: "lineNames",
            transform: (lineNames) => lineNames === "auto" ? undefined : lineNames
        },

        "showLeftAxis",
        "showRightAxis",
        "showDateAxis",
        "showLeftAxisHeading",
        "showRightAxisHeading",
        "showGridlines",

        "showHoverDateLine",
        "hoverDateLineFullHeight",
        "showHoverValues",
        "showHoverChange",
        "enableCrossFiltering",

        {
            name: "showIncompleteLastPeriod",
            transform: (showIncompleteLastPeriod) => Ren.ChartEnumSettings.getChartEnumKey(
                "showIncompleteLastPeriod",
                showIncompleteLastPeriod
            )
        },
        {
            name: "showAsShareOfTotal",
            transform: (showAsShareOfTotal) => showAsShareOfTotal === true ? true : undefined
        },
        {
            name: "showAsIndex",
            transform: (showAsIndex) => showAsIndex === true ? true : undefined
        },
        {
            name: "showAsChange",
            transform: (showAsChange) => showAsChange === true ? true : undefined
        },
        {
            name: "showAsYearOnYearChange",
            transform: (showAsYearOnYearChange) =>
                showAsYearOnYearChange === true ? true : undefined
        },
        {
            name: "showPerDay",
            transform: (showPerDay) => showPerDay === true ? true : undefined
        },
        {
            name: "valueLines",
            transform: (valueLines) => valueLines?.length > 0 ? valueLines : undefined
        },
        {
            name: "valueBands",
            transform: (valueBands) => valueBands?.length > 0 ? valueBands : undefined
        },
        {
            name: "seasonallyAdjustEstimate",
            transform: (seasonallyAdjustEstimate) =>
                seasonallyAdjustEstimate === false ? false : undefined
        },

        // The dates grid's filter is saved as the dates to keep, even where the grid holds it as
        // the dates to leave out.
        {
            name: "dateMarkers",
            transform: (dateMarkers) =>
                Ren.DateValueChart_DateMarkers.withoutFilterNegations(dateMarkers)
        },

        "dateMarkersFilterGroup",

        {
            name: "calendarMarkers",
            transform: (calendarMarkers) => calendarMarkers ?? undefined
        },
        {
            name: "shadeNonWorkingDays",
            transform: (shadeNonWorkingDays) => shadeNonWorkingDays === true ? true : undefined
        },

        "dateRangeGroup",

        "periodSlider",

        "multiChartPeriod",
        "multiChartMaxCount",
        {
            name: "multiChartShowDateRange",
            transform: (multiChartShowDateRange) =>
                multiChartShowDateRange === false ? false : undefined
        },
        {
            name: "multiChartSlider",
            transform: (multiChartSlider) => multiChartSlider === true ? true : undefined
        },
        {
            name: "multiChartKeepEmptyPeriods",
            transform: (multiChartKeepEmptyPeriods) =>
                multiChartKeepEmptyPeriods === false ? false : undefined
        },

        "markerLabelLayout",

        "markerLabelFormatFunction",

        // Saved with its columns by name alone, the indexes rebuilt as the chart is drawn.
        {
            name: "chartDataGroupingSettings",
            transform: (chartDataGroupingSettings) =>
                Ren.DateValueChart_GroupingEntries.getSettingsToSave(chartDataGroupingSettings)
        }
    ],
    defaultOptions: {
        visualisationWidth: "38rem",
        visualisationHeight: "25rem",
        datePeriod: Ren.DatePeriodEnum.Auto,
        dataTabIndex: 1,
        dataTabGroup: null,
        resizeToFitContentOnLoad: false, // Use of scale transform prevents auto-resize from
                                         // working.
        fillAvailableSpace: true
    },
    applyDefaultLogic: () => {

    },
    getCreateFunction: () => Ren.CreateDateValueChart
};
