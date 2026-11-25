/**
 * Creates a date-value chart visualisation, detecting its date and value columns and date period.
 */
Ren.CreateDateValueChart = (() => {

    /**
     * Gets a value indicating whether the date column holds quarter-format values (e.g. "Q1 2024"),
     * judged by its first non-empty value.
     */
    const isQuarterDateColumn = (inputData, dateHeading) => {

        for (let i = 0, len = inputData.length; i < len; i++) {

            const value = inputData[i][dateHeading];

            if (Ren.IsNullOrEmpty(value)) continue;

            return typeof value === "string"
                && value.indexOf("Q") !== -1
                && Ren.DateUtils.parseDateTimeUniversal(value) !== null;
        }

        return false;
    };

    /**
     * Gets the default date-grouping bin function, used where no initialChartGroupCalcFunction is
     * set.  Quarter-format columns bin to whole quarters so bars span the correct width.
     */
    const getDefaultDateGroupCalcFunction = (inputData, dateHeading) => {

        return isQuarterDateColumn(inputData, dateHeading)
            ? "date-quarter-start"
            : "date-day-start";
    };

    /**
     * Gets the distinct headings of the columns the given series take their values from, leaving
     * out the series gathering others, which belongs to no column.
     */
    const getValueColumnHeadings = (seriesSourceHeadings, columnResolver) => {

        const headings = [];

        for (let i = 0; i < seriesSourceHeadings.length; i++) {

            const sourceHeading = seriesSourceHeadings[i];

            if (sourceHeading.indexOf(Ren.DateValueChart_OtherSeries.HEADING) === 0) continue;

            const heading = columnResolver
                ? resolveColumnHeading(columnResolver, sourceHeading)
                : sourceHeading;

            if (headings.indexOf(heading) === -1) headings.push(heading);
        }

        return headings;
    };

    /**
     * Gets a column ID or heading's heading, or the identifier itself where it does not resolve.
     */
    const resolveColumnHeading = (columnResolver, columnIdOrHeading) => {

        const columnIndex = columnResolver.getColumnIndex(columnIdOrHeading);

        const heading = columnIndex !== null
            ? columnResolver.getColumnHeading(columnIndex)
            : null;

        return heading ?? columnIdOrHeading;
    };

    /**
     * Gets the key a column's values are held under in the chart's rows - its ID, or its heading
     * where it has none - from either, or the identifier itself where it does not resolve.
     */
    const resolveColumnKey = (columnResolver, columnIdOrHeading) => {

        const columnIndex = columnResolver.getColumnIndex(columnIdOrHeading);

        const key = columnIndex !== null
            ? columnResolver.getColumnIdOrHeading(columnIndex)
            : null;

        return key ?? columnIdOrHeading;
    };

    /**
     * Gets a value indicating whether the aggregation type produces a count, whatever the source
     * column's type.
     */
    const isCountAggregationType = (aggregationType) => {

        // A reopened chart's settings may hold the string form.
        const type = typeof aggregationType === "string"
            ? Ren.AggregationTypeEnum[aggregationType]
            : aggregationType;

        return type === Ren.AggregationTypeEnum.Count
            || type === Ren.AggregationTypeEnum.CountDistinct;
    };

    /**
     * Gets the keys the two column maps hold between them, in the order they are met.
     */
    const collectColumnKeys = (firstColumns, secondColumns) => {

        const keys = [];
        const maps = [firstColumns, secondColumns];

        for (let m = 0; m < maps.length; m++) {

            if (!maps[m]) continue;

            for (const key in maps[m]) {

                if (!Object.prototype.hasOwnProperty.call(maps[m], key)) continue;

                if (keys.indexOf(key) === -1) keys.push(key);
            }
        }

        return keys;
    };

    /**
     * Keys the aggregation settings copied from the source grid's grouping by column ID or heading,
     * as the chart's rows are keyed.  The data rows' value format functions are merged in too, as
     * the chart reads its format overrides from this entry; the grouping's own format function
     * wins, being the one the grid uses for the aggregated values.
     */
    const buildInitialGroupingColumns = (
        sourceAggregations, sourceDataRowColumns, columnResolver
    ) => {

        const columns = {};

        if (!sourceAggregations && !sourceDataRowColumns) return columns;

        const resolveToKey = (columnIdOrHeading) =>
            resolveColumnKey(columnResolver, columnIdOrHeading);

        const columnIdOrHeadings = collectColumnKeys(sourceAggregations, sourceDataRowColumns);

        for (let c = 0; c < columnIdOrHeadings.length; c++) {

            const columnIdOrHeading = columnIdOrHeadings[c];
            const settings = sourceAggregations?.[columnIdOrHeading] ?? {};
            const columnSettings = {};

            if (settings.aggregationType != null) {
                columnSettings.aggregationType = settings.aggregationType;
            }

            if (settings.aggregateWithRespectToColumn != null) {

                columnSettings.aggregateWithRespectToColumn =
                    resolveToKey(settings.aggregateWithRespectToColumn);
            }

            if (settings.calcFunction != null) {

                columnSettings.calcFunction = Ren.ArrayUtils.ensureArray(settings.calcFunction);
            }

            const valueFormatFunction = settings.valueFormatFunction
                ?? sourceDataRowColumns?.[columnIdOrHeading]?.valueFormatFunction;

            if (valueFormatFunction != null) {

                columnSettings.valueFormatFunction =
                    Ren.ArrayUtils.ensureArray(valueFormatFunction);
            }

            columns[resolveToKey(columnIdOrHeading)] = columnSettings;
        }

        return columns;
    };

    /**
     * Keys the data row calculation functions copied from the source grid by column ID or heading,
     * so the chart plots the calculated values the grid shows.  Returns null when there are none.
     */
    const buildInitialDataRowColumns = (sourceDataRowColumns, columnResolver) => {

        if (!sourceDataRowColumns) return null;

        const columns = {};
        let hasAny = false;

        for (const columnIdOrHeading in sourceDataRowColumns) {

            if (!Object.prototype.hasOwnProperty.call(sourceDataRowColumns, columnIdOrHeading)) {
                continue;
            }

            const calcFunction = sourceDataRowColumns[columnIdOrHeading]?.calcFunction;

            if (calcFunction == null) continue;

            columns[resolveColumnKey(columnResolver, columnIdOrHeading)] = {
                calcFunction: Ren.ArrayUtils.ensureArray(calcFunction)
            };
            hasAny = true;
        }

        return hasAny ? columns : null;
    };

    const VALUE_AXIS_NAMES = ["leftAxis", "rightAxis", "hiddenAxis"];

    /**
     * Gets what a ratcheting axis' maximum was reached against: the column the data is split by,
     * the axis' format, and the columns plotted on it with their aggregations.  A maximum held for
     * other values would not fit the axis.
     */
    const getRatchetKey = (props, visualisation, axisName) => {

        const chartColumns =
            visualisation.chartDataGroupingSettings?.groupings?.entries?.[0]?.columns;

        const parts = [];

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i].valueAxis !== axisName) continue;

            const heading = props.seriesSourceHeadings[i];
            const part = heading + "|" + (chartColumns?.[heading]?.aggregationType ?? "");

            if (parts.indexOf(part) === -1) parts.push(part);
        }

        parts.sort();

        return [props.seriesSplit?.columnKey ?? "", props.axes[axisName].format ?? ""]
            .concat(parts)
            .join("\u0001");
    };

    /**
     * Carries each ratcheting axis' maximum over the axes being rebuilt from the saved settings,
     * which hold no ratcheted maximum.  Without it a filter change, which detects the columns
     * again, would rescale the axis to the filtered data, zooming in.  A split chart's series come
     * and go with the filter, so the maximum is kept for as long as the same columns are plotted.
     */
    const carryOverRatchetedMaxes = (props, visualisation, previousAxes, previousRatchetKeys) => {

        props.ratchetKeys = {};

        for (let i = 0; i < VALUE_AXIS_NAMES.length; i++) {

            const axisName = VALUE_AXIS_NAMES[i];
            const axis = props.axes[axisName];
            const previousAxis = previousAxes?.[axisName];
            const ratchetKey = getRatchetKey(props, visualisation, axisName);

            props.ratchetKeys[axisName] = ratchetKey;

            if (axis.updateYScaleBehaviour !== "Ratchet" || axis.fromSettings) continue;

            if (previousAxis?.updateYScaleBehaviour !== "Ratchet") continue;
            if (previousAxis.maxY === undefined) continue;
            if (previousRatchetKeys?.[axisName] !== ratchetKey) continue;

            axis.maxY = Math.max(axis.maxY ?? 0, previousAxis.maxY);
        }
    };

    /**
     * Gets a value indicating whether a column holds dates, judged by its first non-empty value.
     */
    const isDateColumn = (inputData, column) => {

        for (let ri = 0; ri < inputData.length; ri++) {

            const val = inputData[ri][column];

            if (Ren.IsNullOrEmpty(val)) continue;

            return !!Ren.DateUtils.parseDateTimeUniversal(val);
        }

        return false;
    };

    /**
     * Gets the chart's date column: the one its date grouping names, or else the first selected
     * column holding dates, as settings written before the column was named are read by.  Gets
     * null where the chart has no date column.
     */
    const findDateColumn = (inputData, selectedColumns, visualisation, columnResolver) => {

        const GroupingEntries = Ren.DateValueChart_GroupingEntries;
        const settings = visualisation.chartDataGroupingSettings;

        if (settings && !GroupingEntries.getDateEntry(settings)) return null;

        const namedColumn = settings
            ? GroupingEntries.getDateColumnKey(settings, columnResolver)
            : null;

        if (namedColumn) return namedColumn;

        for (let ci = 0; ci < selectedColumns.length; ci++) {

            if (isDateColumn(inputData, selectedColumns[ci])) return selectedColumns[ci];
        }

        return null;
    };

    const detectColumns =(inputData, dataGroupingSettings, visualisation, props, tabularData, columnResolver) => {

        // A settings file states the enum-valued settings by key name.
        Ren.ChartEnumSettings.resolve(visualisation);

        // Phase 1: the date column is the one the chart's date grouping names, or the first
        // selected column holding dates.  A chart with no date grouping, or created from columns
        // holding no dates, is drawn as an all-time chart, its rows given one date between them.
        const { columns: selectedColumns, countColumn } =
            Ren.VisualisationDetectionColumns.getDetectionColumns(
                inputData,
                visualisation.selectedColumns,
                tabularData,
                columnResolver
            );

        const GroupingEntries = Ren.DateValueChart_GroupingEntries;
        const isGroupingNew = !visualisation.chartDataGroupingSettings;
        const hasDateGrouping =
            !!GroupingEntries.getDateEntry(visualisation.chartDataGroupingSettings);
        const detectedDateHeading =
            findDateColumn(inputData, selectedColumns, visualisation, columnResolver);

        // Without a resolver no grouping is made, and the rows are drawn by their own dates.
        const isDateRequired = !columnResolver || hasDateGrouping;

        if (!detectedDateHeading && isDateRequired) return "Could not detect date column.";

        props.hasDateColumn = !!detectedDateHeading;
        props.dateHeading = detectedDateHeading ?? GroupingEntries.NO_DATE_HEADING;

        // Created against every candidate value column, so aggregation and calc functions run for
        // each before phase 3 filters them.  A selected column that is neither the date nor a value
        // splits the data.
        if (columnResolver && isGroupingNew) {

            const columns = buildInitialGroupingColumns(
                visualisation.initialChartGroupColumnAggregations,
                visualisation.initialChartDataRowColumnSettings,
                columnResolver
            );

            visualisation.chartDataGroupingSettings = {
                groupings: { entries: [{ groupByColumnIndexes: [], columns }] }
            };

            if (props.hasDateColumn) {

                GroupingEntries.setDateColumn(
                    visualisation.chartDataGroupingSettings,
                    columnResolver.getColumnIndex(props.dateHeading),
                    columnResolver,
                    visualisation.initialChartGroupCalcFunction
                        || getDefaultDateGroupCalcFunction(inputData, props.dateHeading)
                );
            }

            const dataRowColumns = buildInitialDataRowColumns(
                visualisation.initialChartDataRowColumnSettings,
                columnResolver
            );

            if (dataRowColumns) {

                visualisation.chartDataGroupingSettings.dataRows = { columns: dataRowColumns };
            }

            // One counted by its values is split by them even where they are numbers, as IDs are.
            const initialSplitColumn = visualisation.initialChartSplitColumn
                ?? Ren.DateValueChart_SeriesSplit.getInitialSplitColumn(
                    inputData,
                    selectedColumns,
                    props.dateHeading,
                    column => columns[resolveColumnKey(columnResolver, column)]
                );

            if (initialSplitColumn != null) {

                Ren.DateValueChart_SeriesSplit.setSplitColumn(
                    visualisation.chartDataGroupingSettings,
                    columnResolver.getColumnIndex(initialSplitColumn),
                    columnResolver
                );
            }
        }

        // A grouping level outside the date one splits the data into a series per value of its
        // column, so that column is never a value column itself.
        const splitColumnKey = Ren.DateValueChart_SeriesSplit.getSplitColumnKey(
            visualisation.chartDataGroupingSettings,
            columnResolver
        );

        const splitColumnIndex = (splitColumnKey != null && columnResolver)
            ? columnResolver.getColumnIndex(splitColumnKey)
            : null;

        const dateColumnIndex = (props.hasDateColumn && columnResolver)
            ? columnResolver.getColumnIndex(props.dateHeading)
            : null;

        const isDateOrSplitColumn = (heading) => {

            if (heading === detectedDateHeading) return true;

            const columnIndex = columnResolver?.getColumnIndex(heading) ?? null;

            return columnIndex != null
                && (columnIndex === dateColumnIndex || columnIndex === splitColumnIndex);
        };

        // A column of dates the chart is not grouped by, such as one it was grouped by until the
        // date column was set to none, is not a value, unless it is counted.
        const aggregationColumns = GroupingEntries
            .getAggregationEntry(visualisation.chartDataGroupingSettings)?.columns;

        const isUnaggregatedDateColumn = (heading) => !props.hasDateColumn
            && aggregationColumns?.[heading]?.aggregationType == null
            && isDateColumn(inputData, heading);

        let candidateValueHeadings = selectedColumns.filter(
            h => !isDateOrSplitColumn(h) && !isUnaggregatedDateColumn(h)
        );

        // Selected cells of names alone are charted by how many rows hold each name.
        if (candidateValueHeadings.length === 0 && countColumn) {
            candidateValueHeadings = [countColumn];
        }

        if (candidateValueHeadings.length === 0) return "No data to show.";

        Ren.DateValueChart_DateRange.rememberDefaultRange(visualisation);

        // Only as it is first drawn, as it follows its group's ranges from then on.
        if (props.isCatchingUpWithDateRangeGroup && props.hasDateColumn) {

            props.isCatchingUpWithDateRangeGroup = false;
            Ren.DateValueChart_DateRange.catchUpWithDateRangeGroup(visualisation, props);
        }

        const groupingEntry = (visualisation.chartDataGroupingSettings && columnResolver)
            ? Ren.DateValueChart_GroupingApplyer.initGroupingEntry(
                visualisation.chartDataGroupingSettings,
                props.dateHeading,
                candidateValueHeadings,
                columnResolver,
                Ren.ReportInputParameters.getInputParameters(visualisation.containingReport),
                tabularData?.ColumnModelFormats
            )
            : null;

        Ren.DateValueChart_MultiChart.applyChartRange(props, groupingEntry);

        // Phase 2: grouping is applied early, so phase 3 validates values after aggregation and
        // calc functions.  The result is cached on props for prepareData to reuse.
        const normalisedInput = Ren.CreateDateValueChart_PrepareData.normaliseQuarterDates(
            inputData,
            props.dateHeading
        );

        // A split making more series than can be read draws only the top ones, unless the user
        // has chosen a limit of their own.  A split keeping only its top values draws no more
        // series than it keeps.
        const splitTopValueCount = Ren.DateValueChart_SeriesSplit.getTopValueCount(
            visualisation.chartDataGroupingSettings
        );

        let splitValueCount = null;

        if (splitColumnKey && !splitTopValueCount) {

            const splitColumnHeading = columnResolver.getColumnHeading(splitColumnIndex);

            splitValueCount = Ren.DateValueChart_DataCache.readOrBuild(
                normalisedInput,
                "splitValueCount",
                splitColumnKey,
                () => Ren.DateValueChart_SeriesSplit
                    .collectValues(normalisedInput, splitColumnKey).length
            );

            Ren.DateValueChart_SeriesLimit.limitSplitSeries(
                visualisation,
                splitValueCount,
                splitColumnHeading,
                props.hasDateColumn
            );
        }

        // Taken before the grouping is applied, which coarsens the entry to the range drawn.
        const splitSeriesMaxes = (groupingEntry && splitColumnKey)
            ? Ren.DateValueChart_GroupingApplyer.getSplitSeriesMaxes(normalisedInput, groupingEntry)
            : null;

        const preGroupedData = groupingEntry
            ? Ren.DateValueChart_GroupingApplyer.applyGroupingWithinPointLimit(
                normalisedInput,
                groupingEntry
            )
            : normalisedInput;

        props.preGroupedData = preGroupedData;
        props.chartGroupingEntry = null; // Already applied above; prepareData must not re-apply.

        // Kept for the previous year to be binned from, as the chart's own rows are.
        props.previousYearGroupingEntry = groupingEntry ?? null;
        props.previousYearInputData = groupingEntry ? normalisedInput : null;

        // The period actually binned by, which is coarser than the settings' where the data would
        // otherwise have run to more points than the chart can draw.  The entry is compiled
        // afresh here on every draw, so zooming back in reinstates the settings' own bins.
        props.binPeriod = groupingEntry?.binPeriod;
        props.isAllTime = !!groupingEntry?.isAllTime;
        props.allTimeExtent = groupingEntry?.allTimeExtent ?? null;

        // Carried so prepareData can hold the date axis to the filtered range.
        props.chartDateRange = groupingEntry?.resolvedDateRange ?? null;

        // Where the data is split, the grouped rows carry a column per split value per value
        // column.
        const seriesColumns = groupingEntry?.seriesColumns ?? null;
        const valueHeadingBySeriesHeading = {};
        const splitValueBySeriesHeading = {};

        if (seriesColumns) {

            for (let ci = 0; ci < seriesColumns.length; ci++) {

                valueHeadingBySeriesHeading[seriesColumns[ci].heading] =
                    seriesColumns[ci].valueHeading;

                splitValueBySeriesHeading[seriesColumns[ci].heading] =
                    seriesColumns[ci].splitValue;
            }
        }

        const candidateHeadings = seriesColumns
            ? seriesColumns.map(seriesColumn => seriesColumn.heading)
            : candidateValueHeadings;

        // Phase 3: candidates are kept where the grouped data holds a number for them, so
        // count-aggregated string columns qualify.
        const actualValueHeadings = [];

        for (let ci = 0; ci < candidateHeadings.length; ci++) {

            const heading = candidateHeadings[ci];

            for (let ri = 0; ri < preGroupedData.length; ri++) {

                const v = Ren.TextUtils.parseFloat(preGroupedData[ri][heading]);

                if (v !== null && !isNaN(v)) {

                    actualValueHeadings.push(heading);
                    break;
                }
            }
        }

        if (actualValueHeadings.length === 0) return "No data to show.";

        props.valueHeadings = actualValueHeadings;

        // Added back once the series the data holds have theirs (see addSeries).
        const otherSeriesSettings = Ren.DateValueChart_OtherSeries.extractSettings(visualisation);

        // Split series come and go with the data, so rather than being filtered to the saved
        // series they are ordered by the most each reaches over every date.  Their settings follow
        // them by column, below.
        if (seriesColumns) {

            props.valueHeadings = Ren.DateValueChart_SeriesSplit.orderHeadingsByMax(
                props.valueHeadings,
                seriesColumns,
                splitSeriesMaxes || new Map()
            );
        }
        // Series column names are authoritative; selectedColumns serves settings that pre-date
        // them.
        else if (visualisation.series && visualisation.series.length > 0 && visualisation.series[0].column) {

            props.valueHeadings = visualisation.series
                .map(s => s.column)
                .filter(h => props.valueHeadings.includes(h));
        }
        else if (visualisation.selectedColumns && visualisation.selectedColumns.length > 0) {

            props.valueHeadings = visualisation.selectedColumns
                .filter(h => h !== props.dateHeading && props.valueHeadings.includes(h));
        }

        // Removed series are left out altogether, legend entries and all.
        props.allValueHeadings = props.valueHeadings;
        props.valueHeadings = Ren.DateValueChart_SeriesRemoval.getIncludedHeadings(
            props.allValueHeadings,
            visualisation.includedSeries
        );

        // So are those beyond the legend's limit.  A multi-chart's charts draw those the
        // multi-chart is limited to over all their periods.
        const includedHeadings = props.valueHeadings;
        const multiChartHeadings = props.multiChartLimitedHeadings;

        // A split of several value columns is limited within each column's series, or a column of
        // smaller values would lose all of its series before a larger one lost any.
        const getSeriesValueHeading = heading => valueHeadingBySeriesHeading[heading] ?? heading;
        const mostColumnSeries = seriesColumns
            ? Ren.DateValueChart_SeriesLimit.getLargestGroupSize(
                includedHeadings,
                getSeriesValueHeading
            )
            : includedHeadings.length;
        const isLimitedPerColumn = mostColumnSeries < includedHeadings.length;

        props.valueHeadings = multiChartHeadings
            ? includedHeadings.filter(heading => multiChartHeadings.indexOf(heading) !== -1)
            : Ren.DateValueChart_SeriesLimit.getLimitedHeadings(
                includedHeadings,
                preGroupedData,
                Ren.DateValueChart_SeriesLimit.getLimit(visualisation),
                isLimitedPerColumn ? getSeriesValueHeading : null
            );

        props.limitedOutHeadings = includedHeadings.filter(
            heading => props.valueHeadings.indexOf(heading) === -1
        );

        // A split of more values than can be shown gathers the rest into one series of each value
        // column's before the limit is applied (see GroupingApplyer.getCalculatedRows), so each of
        // those series counts as the many it gathers.
        const mostShown = Ren.DateValueChart_SeriesLimit.getMostShown(props.hasDateColumn);
        const gatheredCount = splitValueCount > mostShown ? splitValueCount - mostShown : 0;
        let gatheringSeriesCount = 0;

        if (gatheredCount > 0) {

            for (let index = 0; index < includedHeadings.length; index++) {

                const splitValue = splitValueBySeriesHeading[includedHeadings[index]];

                if (splitValue === Ren.DateValueChart_SeriesSplit.OTHER_VALUE) {
                    gatheringSeriesCount++;
                }
            }
        }

        const uncountedCount = gatheringSeriesCount > 0 ? gatheredCount - 1 : 0;

        props.limitableSeriesCount = includedHeadings.length
            + gatheringSeriesCount * uncountedCount;
        props.limitableSeriesPerColumnCount = isLimitedPerColumn
            ? mostColumnSeries + uncountedCount
            : null;

        // Where no limit is set, the series gathered make one anyway.
        props.gatheredSeriesLimit = gatheringSeriesCount > 0 ? mostShown : null;

        if (props.valueHeadings.length === 0) {

            Ren.DateValueChart_OtherSeries.keepSettings(visualisation, otherSeriesSettings);
            return "No data to show.";
        }

        // A split chart matches its series settings by column, below.
        if (!seriesColumns && props.valueHeadings.length < props.allValueHeadings.length) {

            visualisation.series = Ren.DateValueChart_SeriesRemoval.orderSeriesSettings(
                visualisation.series || [],
                props.valueHeadings,
                props.allValueHeadings
            );
        }

        props.valueHeading = props.valueHeadings[0]; // Backwards compatibility for single-column
                                                     // rendering.

        // A split series' heading names a value of the split column, so anything reading a series'
        // source column goes through these.
        props.seriesSourceHeadings = props.valueHeadings.map(
            heading => valueHeadingBySeriesHeading[heading] ?? heading
        );

        props.allSeriesSourceHeadings = props.allValueHeadings.map(
            heading => valueHeadingBySeriesHeading[heading] ?? heading
        );

        props.valueColumnHeadings = getValueColumnHeadings(
            props.allSeriesSourceHeadings,
            tabularData?.columnResolver
        );

        // What each value column is called on the chart, such as on its axis: what the grid the
        // chart was made from showed it as, or else its heading rather than its ID, as an internal
        // column such as __Count has.
        props.valueColumnLabels = {};

        for (let i = 0; i < props.allSeriesSourceHeadings.length; i++) {

            const sourceHeading = props.allSeriesSourceHeadings[i];

            props.valueColumnLabels[sourceHeading] = Ren.DateValueChart_InputColumns
                .getColumnLabel(visualisation, columnResolver, sourceHeading);
        }

        // A series of a whole column, unsplit, is named as its column is where it has no name of
        // its own.
        const getDefaultSeriesLabel = (index) => {

            if (seriesColumns || index >= props.valueHeadings.length) return null;

            const column = props.valueHeadings[index];
            const label = props.valueColumnLabels[column];

            return label && label !== column ? label : null;
        };

        props.seriesSplit = seriesColumns
            ? {
                columnIndex: splitColumnIndex,
                columnKey: splitColumnKey,
                columnHeading: splitColumnIndex == null || !tabularData?.columnResolver
                    ? splitColumnKey
                    : tabularData.columnResolver.getColumnHeading(splitColumnIndex),
                splitValueBySeriesHeading,
                // The menu (e.g. "brand") each split series' legend label is given.
                autoMenuName: splitColumnIndex == null
                    ? null
                    : Ren.AutoMenu.getMenuNameForColumn(tabularData.ColumnModels[splitColumnIndex])
            }
            : null;

        props.seriesCount = props.valueHeadings.length;

        props.rawInputData = inputData;

        // The format of the column subdividing the bars or slices, which their names are in.
        const subdivideColumnIndex = props.subdivideColumn && tabularData?.columnResolver
            ? tabularData.columnResolver.getColumnIndex(props.subdivideColumn)
            : null;

        props.subdivideColumnFormat = subdivideColumnIndex == null
            ? null
            : tabularData.ColumnModels[subdivideColumnIndex]?.ColumnFormat ?? null;

        // What a multi-chart's charts are each detected again from (see drawMultiChartItem).
        props.multiChartDetection = {
            inputData,
            dataGroupingSettings,
            tabularData,
            columnResolver
        };

        const xAxis = visualisation.xAxis || {};

        const previousAxes = props.axes;

        // A value axis' updateYScaleBehaviour is left unset until chosen, as how it scales by
        // default depends on what the chart draws (see
        // DateValueChart_Pies.getDefaultScaleBehaviour).
        props.axes = {
            xAxis: {
                updateXScaleBehaviour: xAxis.updateXScaleBehaviour || "AlwaysUpdate"
            },
            leftAxis: Ren.DateValueChart_Axes.buildValueAxis(visualisation.leftAxis),
            rightAxis: Ren.DateValueChart_Axes.buildValueAxis(visualisation.rightAxis),

            // Scales the series assigned to it independently of the left and right axes, but is
            // never drawn, e.g. for a percentage line alongside currency bars and a quantity line.
            hiddenAxis: Ren.DateValueChart_Axes.buildValueAxis(visualisation.hiddenAxis)
        };

        props.valueColumnHasOwnFormat = [];
        props.valueColumnDefaultFormats = [];

        if (columnResolver) {

            for (let i = 0; i < props.valueHeadings.length; i++) {

                const columnIndex = columnResolver.getColumnIndex(props.seriesSourceHeadings[i]);
                const columnFormats = Ren.VisualisationBuilderHelpers.getColumnFormats(
                    columnIndex,
                    dataGroupingSettings,
                    tabularData
                );

                props.valueColumnFormats[i] = columnFormats.format;
                props.valueColumnFormatFunctions[i] = columnFormats.formatFunction;

                // Chart format overrides are keyed by column ID or heading, as the rows are.
                const chartEntry = visualisation.chartDataGroupingSettings?.groupings?.entries?.[0];
                const colKey = props.seriesSourceHeadings[i];
                const chartColOverride = chartEntry?.columns?.[colKey];

                if (chartColOverride?.valueFormatFunction) {

                    if (dataGroupingSettings) {

                        const overrides = dataGroupingSettings.getColumnValueFormats(
                            { [colKey]: chartColOverride }
                        );

                        props.valueColumnFormatFunctions[i] = overrides.columnFormatFunctions[columnIndex];
                    }

                    props.valueColumnFormats[i] = Ren.DateValueChart_ValueFormats
                        .getFormatForFunction(
                            chartColOverride.valueFormatFunction,
                            props.valueColumnFormats[i]
                        );
                }

                const isCount = isCountAggregationType(chartColOverride?.aggregationType);
                const hasOwnFormat = !!chartColOverride?.valueFormatFunction;

                // The source column's format function may be a string/link formatter that would
                // mangle a count, so a count is shown as a number unless the chart formats it.
                if (isCount && !hasOwnFormat) {

                    props.valueColumnFormats[i] = Ren.SpreadsheetColumnFormatEnum.Number;
                    props.valueColumnFormatFunctions[i] = null;
                }

                // What a series without a format of its own is shown in, once its axis' scale is
                // known.
                props.valueColumnHasOwnFormat[i] = hasOwnFormat;

                props.valueColumnDefaultFormats[i] = isCount
                    ? { format: Ren.SpreadsheetColumnFormatEnum.Number, formatFunction: null }
                    : columnFormats;
            }
        }

        const getTypeCategory = format => {

            if (format === Ren.SpreadsheetColumnFormatEnum.Currency) return "currency";
            if (format === Ren.SpreadsheetColumnFormatEnum.Percentage) return "percentage";
            return "number";
        };

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

        // The removed series' aggregate, drawn after the rest, takes its settings from theirs, so
        // is added once they are in place.
        Ren.DateValueChart_OtherSeries.addSeries(
            props,
            visualisation,
            otherSeriesSettings,
            groupingEntry
        );

        // Overwrites the axis formats from the visualisation settings.
        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i].isEnabled === false) continue;

            const axisName = props.series[i].valueAxis;

            if (axisName && props.valueColumnFormats[i] !== undefined) {

                props.axes[axisName].format = props.valueColumnFormats[i];
                props.axes[axisName].formatFunction = props.valueColumnFormatFunctions[i];
            }
        }

        // Charts saved before axes had formats of their own keep showing their series' formats.
        if (isNewChart) {
            Ren.DateValueChart_ValueFormats.initialiseAxisFormats(props, visualisation);
        }
        // After the formats, which are part of what a ratcheted maximum is held against.
        carryOverRatchetedMaxes(props, visualisation, previousAxes, props.ratchetKeys);

        // The bin function sets the plotted points' granularity, so the period comes from it rather
        // than from raw data that may be finer (e.g. daily rows under monthly bars).  All time's
        // one point is drawn a year wide, which fills the axis.
        const periodFromBin = props.isAllTime
            ? Ren.DatePeriodEnum.Year
            : props.binPeriod ?? Ren.DateValueChart_GroupingApplyer.getBinPeriod(
                visualisation.chartDataGroupingSettings
            );

        const specifiedPeriod = Ren.DatePeriodEnum.Parse(visualisation.datePeriod);

        if (specifiedPeriod === Ren.DatePeriodEnum.Auto) {

            if (periodFromBin !== undefined) {

                props.datePeriod = periodFromBin;
                props.axisPeriod = periodFromBin;
            }
            else {

                const dates = Ren.CreateDateValueChart_PrepareData.getDates(inputData, props.dateHeading);
                const { datePeriod, axisPeriod } = Ren.DatePeriodDetector.detectDatePeriod(dates);

                // Unbinned points are never plotted finer than a day: times of day on them are
                // grouped by hour or finer only when a bin function asks for it.
                props.datePeriod = Math.max(datePeriod, Ren.DatePeriodEnum.Day);
                props.axisPeriod = Math.max(axisPeriod, Ren.DatePeriodEnum.Day);
            }
        }
        else {

            // A specified period can only coarsen the axis, as one finer than the bins would tick
            // dates with no data point.
            props.datePeriod = periodFromBin !== undefined
                ? Math.max(specifiedPeriod, periodFromBin)
                : specifiedPeriod;
            props.axisPeriod = props.datePeriod;
        }

        Ren.DateValueChart_Settings.applySettings(props, visualisation);

        props.visualisation = visualisation;

        return null;
    };

    /**
     * Sets up what a chart's drawing builds on, before its columns are first detected.
     */
    const initialiseDrawState = (props) => {

        const initialValueAxis = { updateYScaleBehaviour: "AlwaysUpdate" };

        props.axes = {
            xAxis: { updateXScaleBehaviour: "AlwaysUpdate" },
            leftAxis: Ren.DateValueChart_Axes.buildValueAxis(initialValueAxis),
            rightAxis: Ren.DateValueChart_Axes.buildValueAxis(initialValueAxis),
            hiddenAxis: Ren.DateValueChart_Axes.buildValueAxis(initialValueAxis)
        };
        props.series = [];
        props.valueColumnFormats = [];
        props.valueColumnFormatFunctions = [];
        props.valueColumnHasOwnFormat = [];
        props.valueColumnDefaultFormats = [];
    };

    const getInitialisation = (props, visualisation) => {

        const result = Ren.VisualisationBuilderHelpers.createInitialisationHandler({
            baseClassName: "ren-date-value-chart",
            guidPrefix: "ren-date-value-chart"
        })(props, visualisation);

        initialiseDrawState(props);

        Ren.DateValueChart_DateRange_Following.followDateRangeGroup(visualisation, props);
        Ren.DateValueChart_DateRange_Calendar.followCalendar(visualisation, props);

        props.isCatchingUpWithDateRangeGroup = true;

        return result;
    };

    /**
     * Detects, prepares and draws one of a multi-chart's charts from its own props, much as the
     * chart itself is, returning a message where it cannot be drawn.
     */
    const drawMultiChartItem = (props, visualisation) => {

        const detection = props.multiChartDetection;

        initialiseDrawState(props);

        const error = detectColumns(
            detection.inputData,
            detection.dataGroupingSettings,
            visualisation,
            props,
            detection.tabularData,
            detection.columnResolver
        );

        if (error) return error;

        const data = Ren.CreateDateValueChart_PrepareData.prepareData(detection.inputData, props);

        if (!data) return "No data to show.";

        const validationResult =
            Ren.CreateDateValueChart__DataValidator.validateDateValueChartData(props, data);

        if (validationResult !== true) {

            return typeof validationResult === "string" ? validationResult : "No data to show.";
        }

        const renderResult = Ren.DateValueChart_Render.renderDateValueChart(props, data);

        if (typeof renderResult === "string") return renderResult;

        if (props.svg && props.svg.parentNode) {

            getContextMenuItems(detection.tabularData, Ren.SetUpContextMenu(), visualisation, props)
                .addShowWindowsMenuItems(props.svg.parentNode);
        }

        Ren.DateValueChart_StyleUpdater.updateStylesheet(props);

        return null;
    };

    const renderVisualisation = (props, data, tabularData, visualisation) => {

        if (Ren.DateValueChart_MultiChart.isMultiChart(props)) {

            const multiChartResult = Ren.DateValueChart_MultiChart.render(
                props,
                (chartProps) => drawMultiChartItem(chartProps, visualisation),
                data
            );

            if (typeof multiChartResult !== "string") {
                announceShownRange(visualisation, props, props.multiChartShownRange);
            }

            return multiChartResult;
        }

        Ren.DateValueChart_MultiChart.clear(props);

        const result = Ren.DateValueChart_Render.renderDateValueChart(props, data);

        if (typeof result !== "string") {
            announceShownRange(visualisation, props, props.isAllTime ? null : props.chartDateRange);
        }

        return result;
    };

    // Tells whatever follows the chart's date range group (a filter module narrowing its figures
    // to the charts' dates, say) which dates the chart has just been drawn over.
    const announceShownRange = (visualisation, props, resolvedRange) =>
        Ren.DateValueChart_DateRange.announceShownRange(
            visualisation,
            resolvedRange,
            props.dateHeading
        );

    const getContextMenuItems = (tabularData, contextMenu, visualisation, props) => {

        return Ren.ContextMenuItems_DateValueChart(
            tabularData,
            contextMenu,
            visualisation,
            props
        );
    };

    const getStyleUpdater = () => Ren.DateValueChart_StyleUpdater;

    const getValidator = () => ({
        validate: (props, data) => Ren.CreateDateValueChart__DataValidator.validateDateValueChartData(props, data)
    });

    const getDataPreparer = () => Ren.CreateDateValueChart_PrepareData;

    const getQAHelper = () => ({
        setQa: (props, inputData) => Ren.QA.DateValueChart.setQaDateValueChart(props, inputData)
    });

    return Ren.BaseVisualisationCreator({
        visualisationName: "DateValueChart",
        detectColumns,
        getInitialisation,
        renderVisualisation,
        getContextMenuItems,
        getStyleUpdater,
        getValidator,
        getDataPreparer,
        getQAHelper,
        shouldUseErrorElement: true,
        getRequiredInputColumns: (visualisation, tabularData) =>
            Ren.DateValueChart_InputColumns.getRequiredColumnIndexes(visualisation, tabularData),
        getUnfilteredColumns: (visualisation, tabularData) =>
            Ren.DateValueChart_CrossFiltering.getUnfilteredColumns(visualisation, tabularData)
    });
})();
