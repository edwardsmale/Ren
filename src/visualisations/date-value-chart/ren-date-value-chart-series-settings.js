/**
 * The date/value chart's per-series settings: those saved on the visualisation, one for each
 * series its data now gives, and the props each series is drawn from.
 */
Ren.DateValueChart_SeriesSettings = (() => {

    const getTypeCategory = format => {

        if (format === Ren.SpreadsheetColumnFormatEnum.Currency) return "currency";
        if (format === Ren.SpreadsheetColumnFormatEnum.Percentage) return "percentage";
        return "number";
    };

    /**
     * Ensures the visualisation holds settings for each series the data now gives: its saved
     * ones, matched by column where the chart is split, or else defaults, or the settings a split
     * has just dropped.
     *
     * @param {Array} seriesColumns - The grouping entry's split columns, or null where unsplit.
     * @param {Object} preGroupedData - The chart's grouped rows, which a split's minor series are
     *   told apart in.
     * @returns {boolean} Whether the chart had no series settings before, so is new.
     */
    const ensureSeriesSettings = (props, visualisation, seriesColumns, preGroupedData) => {

        // A series the chart gains takes up the estimate setting the series already there carry.
        // Where a split has just dropped the series it would come from, the menu leaves it on
        // props.
        const inheritedEstimateLastPeriod = visualisation.series?.length
            ? Ren.DateValueChart_LastPeriodEstimate.getInheritedMode(visualisation.series)
            : props.inheritedEstimateLastPeriod ?? Ren.EstimateLastPeriodEnum.None;

        const isNewChart = !visualisation.series?.length;

        // How the series a split has just dropped were drawn, which the series replacing them
        // take up from those of the same value column, or else from them all.
        const getInheritedSeriesSettings = (index) => {

            if (!isNewChart) return null;

            const sourceHeading = props.seriesSourceHeadings?.[index] ?? props.valueHeadings[index];

            return props.inheritedSeriesSettingsBySource?.get(sourceHeading) ??
                props.inheritedSeriesSettings;
        };

        // A percentage series is drawn as a line, on its own axis where shown alongside other
        // units.
        const buildDefaultSeriesSettings = (index) => {

            const seriesCategory = getTypeCategory(props.valueColumnFormats[index]);

            // Named as the grid named the column, if it renamed it.
            const initialLabel = seriesColumns
                ? null
                : visualisation.initialChartColumnLabels?.[props.valueHeadings[index]];

            return Object.assign({
                column: props.valueHeadings[index],
                ...(initialLabel ? { label: initialLabel } : {}),
                valueAxis: Ren.DateValueChart_Axes.getDefaultValueAxis(
                    props.valueColumnFormats[index],
                    props.valueColumnFormats
                ),
                colour: Ren.DateValueChart_SeriesColours.getDefaultColour(
                    index,
                    visualisation.colourScheme
                ),
                chartType: seriesCategory === "percentage"
                    ? Ren.SeriesChartTypeEnum.Line
                    : Ren.SeriesChartTypeEnum.Bar,
                showValueLabels: true,
                colourFilter: null,
                curved: false,
                lineStyle: "solid",
                lineWidth: "normal",
                dotSize: "medium",
                isEnabled: true,
                estimateLastPeriod: inheritedEstimateLastPeriod
            }, getInheritedSeriesSettings(index));
        };

        // A split series nobody has styled yet takes the chart's splitSeriesDefaults over the usual
        // defaults, so a report can draw its split as lines, for example.  With
        // hideMinorSplitSeries on, a series dwarfed by the others starts hidden.
        const minorSplitSeriesHeadings = (seriesColumns && visualisation.hideMinorSplitSeries)
            ? Ren.DateValueChart_SeriesSplit.getMinorSeriesHeadings(
                preGroupedData,
                props.valueHeadings
            )
            : null;

        const buildDefaultSplitSeriesSettings = (index) => {

            // Those inherited from the series a change of split dropped are how the user last saw
            // the chart drawn, so outrank the report's defaults.
            const settings = Object.assign(
                buildDefaultSeriesSettings(index),
                visualisation.splitSeriesDefaults,
                getInheritedSeriesSettings(index)
            );

            if (minorSplitSeriesHeadings?.has(props.valueHeadings[index])) {
                settings.isEnabled = false;
            }

            return settings;
        };

        // Split series are matched to saved settings by column rather than position, so a series'
        // settings stay with its split value as the values come and go.  The settings of values
        // the data no longer holds, such as under a filter, are kept after those drawn, so that a
        // hidden series stays hidden when its value comes back.
        if (seriesColumns) {

            const savedSeries = visualisation.series || [];
            const savedSeriesByColumn = {};

            for (let i = 0; i < savedSeries.length; i++) {

                if (savedSeries[i] && savedSeries[i].column) {
                    savedSeriesByColumn[savedSeries[i].column] = savedSeries[i];
                }
            }

            // The first saved settings of a series split from each value column, which a series
            // without its own takes how the column is drawn from.
            const savedSeriesBySourceHeading = {};

            for (let i = 0; i < props.seriesCount; i++) {

                const sourceHeading = props.seriesSourceHeadings[i];
                const saved = savedSeriesByColumn[props.valueHeadings[i]];

                if (saved && !savedSeriesBySourceHeading[sourceHeading]) {
                    savedSeriesBySourceHeading[sourceHeading] = saved;
                }
            }

            const sharedProperties = Ren.DateValueChart_SeriesSplit.SHARED_SERIES_PROPERTIES;

            visualisation.series = [];

            for (let i = 0; i < props.seriesCount; i++) {

                const saved = savedSeriesByColumn[props.valueHeadings[i]];

                if (saved) {

                    visualisation.series[i] = saved;
                    continue;
                }

                const settings = buildDefaultSplitSeriesSettings(i);
                const sibling = savedSeriesBySourceHeading[props.seriesSourceHeadings[i]];

                for (let j = 0; sibling && j < sharedProperties.length; j++) {

                    if (sibling[sharedProperties[j]] !== undefined) {
                        settings[sharedProperties[j]] = sibling[sharedProperties[j]];
                    }
                }

                visualisation.series[i] = settings;
            }

            for (let i = 0; i < savedSeries.length; i++) {

                const column = savedSeries[i]?.column;

                if (column && props.valueHeadings.indexOf(column) === -1) {
                    visualisation.series.push(savedSeries[i]);
                }
            }
        }
        else if (!visualisation.series || visualisation.series.length === 0) {

            visualisation.series = [];

            for (let i = 0; i < props.seriesCount; i++) {

                visualisation.series[i] = buildDefaultSeriesSettings(i);
            }
        }

        // A chart saved with fewer series than it now draws would otherwise drop per-series
        // settings written to the extra ones.
        visualisation.series ??= [];

        for (let i = 0; i < props.seriesCount; i++) {

            visualisation.series[i] ??= buildDefaultSeriesSettings(i);
        }

        // Charts drawn wholly as pies were once marked so as a whole, and are now so by each series
        // being drawn as a pie.
        if (visualisation.showAsPies === true) {

            for (let i = 0; i < visualisation.series.length; i++) {

                visualisation.series[i] ??= buildDefaultSeriesSettings(i);
                visualisation.series[i].chartType = Ren.SeriesChartTypeEnum.Pie;
            }

            delete visualisation.showAsPies;
        }

        // Taken up now, so not by series the user later clears away.
        props.inheritedSeriesSettings = null;
        props.inheritedSeriesSettingsBySource = null;

        return isNewChart;
    };

    /**
     * Builds the props each series is drawn from out of its settings, each as its default where
     * unset.
     *
     * @param {Function} getDefaultSeriesLabel - Gets the label of the series at an index without a
     *   label of its own, or null.
     */
    const buildSeriesProps = (props, visualisation, seriesColumns, getDefaultSeriesLabel) => {

        props.series = [];

        // A split chart's settings beyond those drawn are for values the data doesn't hold.
        const effectiveSeriesCount = seriesColumns
            ? props.seriesCount
            : Math.max(props.seriesCount, visualisation.series?.length || 0);

        for (let i = 0; i < effectiveSeriesCount; i++) {

            const seriesSettings = visualisation.series && visualisation.series[i] ? visualisation.series[i] : {};
            const defaultAxis = Ren.DateValueChart_Axes.getDefaultValueAxis(
                props.valueColumnFormats[i],
                props.valueColumnFormats
            );

            let defaultChartType = Ren.SeriesChartTypeEnum.Bar;
            const defaultColour = Ren.DateValueChart_SeriesColours.getDefaultColour(
                i,
                visualisation.colourScheme
            );

            if (i < props.seriesCount) {

                const seriesCategory = getTypeCategory(props.valueColumnFormats[i]);
                defaultChartType = seriesCategory === "percentage" ? Ren.SeriesChartTypeEnum.Line : Ren.SeriesChartTypeEnum.Bar;
            }

            // A standard colour is looked up as the chart is drawn, so follows changes to the
            // config. Everything drawn for the series, its legend entry included, takes its colour.
            props.series[i] = {
                valueAxis: seriesSettings.valueAxis || defaultAxis,
                colour: Ren.StandardColoursConfig.getColour(seriesSettings.standardColour)
                    || seriesSettings.colour
                    || defaultColour,
                standardColour: seriesSettings.standardColour || null,
                chartType: seriesSettings.chartType !== undefined ? seriesSettings.chartType : defaultChartType,
                showValueLabels: seriesSettings.showValueLabels !== undefined ? seriesSettings.showValueLabels : true,
                showNameInBars: seriesSettings.showNameInBars === true,
                label: seriesSettings.label || getDefaultSeriesLabel(i),
                colourFilter: seriesSettings.colourFilter || null,
                colourFunction: seriesSettings.colourFunction || null,
                lineShape: Ren.DateValueChartCalculator.getLineShape(seriesSettings),
                lineStyle: seriesSettings.lineStyle || "solid",
                lineWidth: seriesSettings.lineWidth || "normal",
                dotSize: seriesSettings.dotSize || "medium",

                // Settings that pre-date the legend toggle have no isEnabled, and still plot.
                isEnabled: seriesSettings.isEnabled !== false,

                estimateLastPeriod:
                    seriesSettings.estimateLastPeriod ?? Ren.EstimateLastPeriodEnum.None,
                runningTotal: seriesSettings.runningTotal === true,
                yearToDate: seriesSettings.yearToDate === true,
                rollingYearTotal: seriesSettings.rollingYearTotal === true,
                trendLine: seriesSettings.trendLine || null,
                trendLinePeriods: seriesSettings.trendLinePeriods || null,
                markExtremes: seriesSettings.markExtremes === true,
                compareWithPreviousYear: seriesSettings.compareWithPreviousYear === true
            };
        }
    };

    return {
        buildSeriesProps,
        ensureSeriesSettings
    };
})();
