/**
 * Applies the date/value chart's own dataGroupingSettings to a flat inputData array.
 * Groups rows by the date column (with an optional bin function such as date-month-start),
 * then aggregates value columns per group, whether or not the source was already grouped by date.
 */
Ren.DateValueChart_GroupingApplyer = (() => {

    const ALL_TIME_CALC_FUNCTION = "date-all-time";
    const ALL_TIME_BIN_FUNCTION = "date-day-start";

    /**
     * Gets a value indicating whether a date-grouping calc function puts every date in one group.
     */
    const isAllTimeCalcFunction = (calcFunctionName) => calcFunctionName === ALL_TIME_CALC_FUNCTION;

    /**
     * Gets the chart grouping's date entry, or null where the chart has no date column.
     */
    const getDateEntry = (chartDataGroupingSettings) =>
        Ren.DateValueChart_GroupingEntries.getDateEntry(chartDataGroupingSettings);

    /**
     * Gets the date period the chart's own grouping bins by (e.g. Month for date-month-start),
     * or undefined if there is no grouping or its bin function is not a date-grouping function.
     */
    const getBinPeriod = (chartDataGroupingSettings) => {

        const binFunctionName = Ren.DerivedDataGroupingSettings.getGroupByCalcFunctionName(
            getDateEntry(chartDataGroupingSettings)
        );

        return binFunctionName
            ? Ren.DatePeriodDetector.getPeriodForCalcFunction(binFunctionName)
            : undefined;
    };

    /**
     * A chart's date range is the one setting its bins do not depend on - it chooses among
     * them - and it lives on the date grouping entry, so it is left out of the signature the
     * bins are held under (see Ren.DateValueChart_DataCache).
     */
    const withoutDateRange = (key, value) => key === "dateRange" ? undefined : value;

    /**
     * Gets what a data set's bins depend on, as a string to hold them under: the grouping
     * settings bar the date range, and the columns the chart reads them through.
     */
    const getGroupingSignature = (chartDataGroupingSettings, dateHeading, valueHeadings) =>
        JSON.stringify(chartDataGroupingSettings, withoutDateRange) +
        "|" + dateHeading +
        "|" + (valueHeadings ? valueHeadings.join("\u0001") : "");

    /**
     * Compiles a column's calcFunction specs into a single function applying them in order, or null
     * where none of them compiles.  The label names the column in any compilation error.
     */
    const compileCalcFunctionChain = (calcFunction, label, paras) => {

        if (!calcFunction) return null;

        const specs = Ren.ArrayUtils.ensureArray(calcFunction);
        const fns = [];

        for (let k = 0; k < specs.length; k++) {

            try {

                const fn = Ren.FormatFunctions.createFunction(specs[k], paras);
                if (fn) fns.push(fn);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[DateValueChartGroupingApplyer] Error compiling calcFunction for '" +
                    label + "':",
                    e
                );
            }
        }

        if (fns.length === 0) return null;

        if (fns.length === 1) return fns[0];

        return ((capturedFns) => (value, rowVals) => {

            let v = value;

            for (let k = 0; k < capturedFns.length; k++) {
                v = capturedFns[k](v, rowVals, null, null, null);
            }

            return v;
        })(fns);
    };

    /**
     * Compiles the calculation functions the chart applies to each data row before aggregating,
     * from the dataRows section of its settings.  As in the grid, each row is calculated and then
     * aggregated.  Each column's calculated value is written back under every key that names it.
     *
     * @returns {Array|null} One entry of { keys, compiledCalcFunction } per calculated column, or
     *     null where no column has one.
     */
    const initDataRowCalcFunctions = (chartDataGroupingSettings, columnResolver, paras) => {

        const columns = chartDataGroupingSettings?.dataRows?.columns;

        if (!columns) return null;

        const dataRowCalcFunctions = [];

        for (const columnIdOrHeading in columns) {

            if (!Object.prototype.hasOwnProperty.call(columns, columnIdOrHeading)) continue;

            const compiledCalcFunction = compileCalcFunctionChain(
                columns[columnIdOrHeading]?.calcFunction,
                columnIdOrHeading,
                paras
            );

            if (!compiledCalcFunction) continue;

            const keys = [columnIdOrHeading];
            const columnIndex = columnResolver
                ? columnResolver.getColumnIndex(columnIdOrHeading)
                : null;

            if (columnIndex !== null && columnIndex !== undefined && columnIndex !== -1) {

                const alternativeKeys = [
                    columnResolver.getColumnIdOrHeading(columnIndex),
                    columnResolver.getColumnHeading(columnIndex)
                ];

                for (let k = 0; k < alternativeKeys.length; k++) {

                    if (alternativeKeys[k] && keys.indexOf(alternativeKeys[k]) === -1) {
                        keys.push(alternativeKeys[k]);
                    }
                }
            }

            dataRowCalcFunctions.push({ keys, compiledCalcFunction });
        }

        return dataRowCalcFunctions.length > 0 ? dataRowCalcFunctions : null;
    };

    /**
     * Re-keys an entry's column settings by column ID or heading, as the rows are keyed, along
     * with the columns they are aggregated with respect to.  Charts once keyed them by heading,
     * which left a column whose ID differs from its heading, such as the hidden __Count column,
     * unconfigured: summed, with no calc or format function.  A key that names no column, or
     * whose column already has settings under its own key, is left as it is.
     */
    const keyColumnsAsRows = (entry, columnResolver) => {

        const columns = entry?.columns;

        if (!columns || !columnResolver) return;

        const toRowKey = (columnIdOrHeading) => {

            const columnIndex = columnResolver.getColumnIndex(columnIdOrHeading);

            return columnIndex == null
                ? columnIdOrHeading
                : columnResolver.getColumnIdOrHeading(columnIndex) ?? columnIdOrHeading;
        };

        let isRekeyed = false;
        const rekeyed = {};

        for (const key in columns) {

            if (!Object.prototype.hasOwnProperty.call(columns, key)) continue;

            const settings = columns[key];
            const withRespectTo = settings?.aggregateWithRespectToColumn;

            if (withRespectTo != null && toRowKey(withRespectTo) !== withRespectTo) {
                settings.aggregateWithRespectToColumn = toRowKey(withRespectTo);
            }

            const rowKey = toRowKey(key);

            if (rowKey !== key && !Object.prototype.hasOwnProperty.call(columns, rowKey)) {

                rekeyed[rowKey] = settings;
                isRekeyed = true;
            }
            else {

                rekeyed[key] = settings;
            }
        }

        if (isRekeyed) entry.columns = rekeyed;
    };

    /**
     * Gets the column the data is split by, as { heading, format }, or null where it isn't split.
     */
    const getSplitColumn = (chartDataGroupingSettings, columnResolver, columnFormats) => {

        const columnIndex = Ren.DateValueChart_SeriesSplit.getSplitColumnIndex(
            chartDataGroupingSettings,
            columnResolver
        );

        if (columnIndex == null || !columnResolver) return null;

        return {
            heading: columnResolver.getColumnHeading(columnIndex),
            format: columnFormats?.[columnIndex] ?? null
        };
    };

    /**
     * Prepares a compiled grouping entry from the chart's own grouping settings.
     *
     * @param {Object} chartDataGroupingSettings - The chart's own dataGroupingSettings (plain
     *   settings object).
     * @param {string} dateHeading - Heading of the date column (as detected by the chart), or
     *   what the rows are grouped under in its place where the chart has none.
     * @param {string[]} valueHeadings - Headings of value columns to aggregate.
     * @param {Object} columnResolver - Resolves column IDs and headings to column indexes.
     * @param {Object} paras - The containing report's parameters, for the functions to use.
     * @param {Array} columnFormats - The data's column formats by column index, which name a split
     *   series of a Boolean or numeric column by its column too.
     * @returns {Object|null} A compiled grouping entry ready for applyGrouping, or null if no valid
     *   settings.
     */
    const initGroupingEntry = (
        chartDataGroupingSettings, dateHeading, valueHeadings, columnResolver, paras, columnFormats
    ) => {

        // The saved settings name their columns alone, so the indexes are rebuilt from the names.
        Ren.DateValueChart_GroupingEntries.resolveColumnIndexes(
            chartDataGroupingSettings,
            columnResolver,
            dateHeading
        );

        const aggregationEntry =
            Ren.DateValueChart_GroupingEntries.getAggregationEntry(chartDataGroupingSettings);

        if (!aggregationEntry) return null;

        keyColumnsAsRows(aggregationEntry, columnResolver);

        // A chart without a date column is drawn as an all-time chart, its rows all given one date.
        const dateEntry = getDateEntry(chartDataGroupingSettings);
        const hasDateColumn = !!dateEntry;

        // A further grouping level splits the data into a series per value of its column (see
        // Ren.DateValueChart_SeriesSplit).  Rows are keyed by column ID or heading, which is the
        // form the split entry names its column in, so the rows can be read by it directly.
        const splitColumnKey = Ren.DateValueChart_SeriesSplit.getSplitColumnKey(
            chartDataGroupingSettings,
            columnResolver
        );

        const splitColumn = splitColumnKey
            ? getSplitColumn(chartDataGroupingSettings, columnResolver, columnFormats)
            : null;

        // Compile the bin function (e.g. date-month-start) for the date column.  An all-time chart
        // bins by day, so a date range can still choose among its dates, and its drawn bins are
        // then merged into one (see mergeBins).
        const isAllTime = !hasDateColumn || isAllTimeCalcFunction(
            Ren.DerivedDataGroupingSettings.getGroupByCalcFunctionName(dateEntry)
        );

        const binFnSpec = isAllTime
            ? { name: ALL_TIME_BIN_FUNCTION }
            : dateEntry.groupByCalcFunctions && dateEntry.groupByCalcFunctions[0];
        let compiledBinFunction = null;

        if (binFnSpec) {

            try {

                compiledBinFunction = Ren.FormatFunctions.createFunction(binFnSpec, paras);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[DateValueChartGroupingApplyer] Error compiling bin function:",
                    e
                );
            }
        }

        // Compile per-column settings (aggregationType and post-aggregation calcFunction).
        const columns = aggregationEntry.columns || {};
        const compiledColumns = {};

        // Aggregate every column configured in the grouping, not just the selected value columns,
        // so a post-aggregation calc function can reference sibling columns via rowVals, as in the
        // grid.  Unconfigured value columns are appended (defaulting to Sum).  A column configured
        // only with a format function is not aggregated unless it is one of the value columns.
        const configuredHeadings = Object.keys(columns);
        const aggregationHeadings = [];

        for (let i = 0; i < configuredHeadings.length; i++) {

            // The date column carries the group's binned date, so it is never aggregated, even
            // where the source grid's settings configure it; that would overwrite the date with
            // null.
            if (configuredHeadings[i] === dateHeading) continue;

            const colSettings = columns[configuredHeadings[i]] || {};

            if (colSettings.aggregationType == null
                && colSettings.aggregateWithRespectToColumn == null
                && !colSettings.calcFunction) continue;

            aggregationHeadings.push(configuredHeadings[i]);
        }

        for (let i = 0; i < valueHeadings.length; i++) {

            if (aggregationHeadings.indexOf(valueHeadings[i]) === -1) {
                aggregationHeadings.push(valueHeadings[i]);
            }
        }

        for (let i = 0; i < aggregationHeadings.length; i++) {

            const heading = aggregationHeadings[i];
            const colSettings = columns[heading] || {};

            const aggregationType = colSettings.aggregationType != null
                ? colSettings.aggregationType
                : null;

            const compiledCalcFunction =
                compileCalcFunctionChain(colSettings.calcFunction, heading, paras);

            compiledColumns[heading] = {
                aggregationType,
                aggregateWithRespectToColumn: colSettings.aggregateWithRespectToColumn ?? null,
                compiledCalcFunction
            };
        }

        return {
            dateHeading,
            hasDateColumn,
            compiledBinFunction,
            valueHeadings,
            aggregationHeadings,
            columns: compiledColumns,
            splitColumnKey,
            splitColumn,
            splitTopValueCount:
                Ren.DateValueChart_SeriesSplit.getTopValueCount(chartDataGroupingSettings),

            // The chart's own client-side date filter, and the period its bins are aligned to,
            // which is what the filter snaps to so no bin is drawn from part of a period.
            binPeriod: isAllTime ? Ren.DatePeriodEnum.Day : getBinPeriod(chartDataGroupingSettings),
            isAllTime,
            dateRange: dateEntry?.dateRange ?? null,
            excludePartialLeadingPeriod: !!dateEntry?.excludePartialLeadingPeriod,
            excludePartialTrailingPeriod: !!dateEntry?.excludePartialTrailingPeriod,

            // What the bins this entry makes are held under, the bin function named separately
            // as coarsening changes it without the settings changing (see getBins).
            groupingSignature: getGroupingSignature(
                chartDataGroupingSettings,
                dateHeading,
                valueHeadings
            ) + "|" + (splitColumn?.format ?? ""),
            binFunctionName: isAllTime
                ? ALL_TIME_BIN_FUNCTION
                : Ren.DerivedDataGroupingSettings.getGroupByCalcFunctionName(dateEntry) || "",

            // Applied to each row before any grouping, as the grid applies its own data row
            // calculations before aggregating.
            dataRowCalcFunctions: initDataRowCalcFunctions(
                chartDataGroupingSettings,
                columnResolver,
                paras
            ),

            // Filled in by applyGrouping, which is where the data itself says which values the
            // split column actually holds: the series the aggregated rows carry a column for.
            seriesColumns: null,

            // Filled in by applyGrouping too: a relative range ("the last 12 months") only names
            // dates once the rows it filters are in hand.
            resolvedDateRange: null,

            // Filled in by applyGrouping for an all-time entry: the dates its one row covers.
            allTimeExtent: null
        };
    };

    // Chart values are already parsed plain numbers, so no decompression is needed.  Created on
    // first use, as the bundle's file order doesn't put Ren.AggregationFns before this file.
    let _aggFns = null;

    /**
     * Gets a value indicating whether the aggregation type is one of those that read the "with
     * respect to" column as an ordering (First, Last and Median) rather than as a column to
     * deduplicate rows by.
     */
    const isOrderedAggregation = (aggregationType) => {

        return aggregationType === Ren.AggregationTypeEnum.First
            || aggregationType === Ren.AggregationTypeEnum.Last
            || aggregationType === Ren.AggregationTypeEnum.Median;
    };

    /**
     * Gets the subset of rows to aggregate, deduplicating by wrtColumn when specified.
     * The first row encountered for each distinct wrtColumn value is kept.
     */
    const getRowsForAggregation = (rows, wrtColumn) => {

        if (!wrtColumn) return rows;

        const seen = new Set();
        const result = [];

        for (let i = 0; i < rows.length; i++) {

            const key = rows[i][wrtColumn];

            const sizeBeforeAdd = seen.size;

            seen.add(key);

            if (seen.size !== sizeBeforeAdd) result.push(rows[i]);
        }

        return result;
    };

    /**
     * Aggregates a value column from an array of rows using the specified aggregation type.
     * Defaults to Sum when no aggregationType is specified.
     *
     * orderColumn names the column the First, Last and Median aggregations order the rows by, or
     * null to take the rows as they arrive (Median then orders by the values themselves).
     */
    const aggregateColumn = (rows, heading, aggregationType, orderColumn) => {

        // Count aggregations tally the raw cell values (distinct or non-empty), so they must keep
        // the original values - parsing to a float first would null out non-numeric values (e.g.
        // account references) and yield a count of zero.  All other aggregations are numeric.
        const isCount = aggregationType === Ren.AggregationTypeEnum.Count
            || aggregationType === Ren.AggregationTypeEnum.CountDistinct;

        const values = [];

        // Order keys are the ordering column's values as they stand, which for a date column are
        // yyyy-MM-dd strings and so compare chronologically.
        const orderKeys = orderColumn ? [] : null;

        for (let i = 0; i < rows.length; i++) {

            if (isCount) {

                values.push(rows[i][heading]);
            }
            else {

                const v = Ren.TextUtils.parseFloat(rows[i][heading]);
                values.push(v === null || isNaN(v) ? null : v);
            }

            if (orderKeys !== null) orderKeys.push(rows[i][orderColumn]);
        }

        _aggFns ??= Ren.AggregationFns(null);

        const fn = _aggFns.aggFunc(Ren.SpreadsheetColumnFormatEnum.Number, aggregationType);

        if (!fn) return null;

        const result = fn(values, 0, 0, values.length, 0, false, orderKeys);

        if (result === null || result === Ren.NullSentinel) return null;

        const numeric = parseFloat(result);
        return isNaN(numeric) ? null : numeric;
    };

    /**
     * Gets the rowVals post-aggregation calc functions are passed.  As in the grid, any column can
     * be read from it: one the grouping does not aggregate is summed the first time it is read.
     */
    const createCalcRowVals = (rowVals, rows) =>
        new Proxy(rowVals, {
            get: (target, key) => {

                if (typeof key !== "string" || key in target) return target[key];

                if (rows.length === 0 || !Object.prototype.hasOwnProperty.call(rows[0], key)) {
                    return undefined;
                }

                const value = aggregateColumn(rows, key, null, null);
                target[key] = value;

                return value;
            }
        });

    /**
     * Aggregates one group's rows into a single row of aggregated values, keyed by column heading
     * and carrying the group's date.  This is the whole of the aggregation for a date group, and
     * for one split value's share of a date group.
     */
    const aggregateRows = (rows, groupingEntry, binnedDate) => {

        const { dateHeading, aggregationHeadings, columns } = groupingEntry;

        const aggregatedRow = {};
        aggregatedRow[dateHeading] = binnedDate;

        // rowVals mirrors the @rowVals.X convention used by CalcFunctionsApplyer,
        // allowing post-aggregation calc functions to reference sibling column values.
        const rowVals = {};
        rowVals[dateHeading] = binnedDate;

        for (let v = 0; v < aggregationHeadings.length; v++) {

            const heading = aggregationHeadings[v];
            const colConfig = columns[heading];
            const aggregationType = colConfig?.aggregationType;
            const withRespectToColumn = colConfig?.aggregateWithRespectToColumn;

            // First, Last and Median order the rows by the "with respect to" column rather than
            // collapsing duplicates by it, so they keep every row and pass it as the ordering.
            const ordersByWithRespectTo = isOrderedAggregation(aggregationType);

            const rowsToAggregate = ordersByWithRespectTo
                ? rows
                : getRowsForAggregation(rows, withRespectToColumn);

            const aggregatedValue = aggregateColumn(
                rowsToAggregate,
                heading,
                aggregationType,
                ordersByWithRespectTo ? withRespectToColumn : null
            );

            aggregatedRow[heading] = aggregatedValue;
            rowVals[heading] = aggregatedValue;
        }

        // Apply post-aggregation calc functions across all aggregated columns, so a calc column
        // referenced by another is itself computed first where possible.
        let calcRowVals = null;

        for (let v = 0; v < aggregationHeadings.length; v++) {

            const heading = aggregationHeadings[v];
            const colConfig = columns[heading];

            if (!colConfig?.compiledCalcFunction) continue;

            calcRowVals ??= createCalcRowVals(rowVals, rows);

            try {

                const newValue = colConfig.compiledCalcFunction(
                    aggregatedRow[heading],
                    calcRowVals,
                    null,
                    null,
                    null
                );

                aggregatedRow[heading] = newValue;
                rowVals[heading] = newValue;
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[DateValueChartGroupingApplyer] Error applying calcFunction for '" +
                    heading + "':",
                    e
                );
            }
        }

        return aggregatedRow;
    };

    /**
     * Groups inputData rows by binned date, in the insertion order of the input.  Each group holds
     * its rows, and - where the data is split - those rows keyed by their split value.
     */
    const groupRowsByDate = (inputData, groupingEntry, keptSplitValues) => {

        const { dateHeading, hasDateColumn, compiledBinFunction, splitColumnKey } = groupingEntry;
        const noDateValue = Ren.DateValueChart_GroupingEntries.NO_DATE_VALUE;

        const groups = new Map();
        const groupOrder = [];

        // A bin function is passed only the date, so each distinct date is binned once rather than
        // once per row.  A date whose bin is null maps to null.
        const groupByRawDate = new Map();

        for (let i = 0; i < inputData.length; i++) {

            const row = inputData[i];
            const rawDate = hasDateColumn ? row[dateHeading] : noDateValue;

            if (rawDate == null) continue;

            let group = groupByRawDate.get(rawDate);

            if (group === undefined) {

                // Every bin the rows hold is made, whatever the chart's date range; which of them
                // are drawn is settled once they are known (see selectBinKeysInRange).
                const binnedDate = compiledBinFunction
                    ? compiledBinFunction(rawDate, null, null, null, null)
                    : rawDate;

                group = null;

                if (binnedDate != null) {

                    const key = String(binnedDate);

                    group = groups.get(key);

                    if (!group) {

                        group = {
                            binnedDate,
                            rows: [],
                            rowsBySplitValue: splitColumnKey ? new Map() : null
                        };

                        groups.set(key, group);
                        groupOrder.push(key);
                    }
                }

                groupByRawDate.set(rawDate, group);
            }

            if (group === null) continue;

            // A split group's rows are only ever aggregated a split value at a time, so they are
            // held under those values rather than twice over.
            if (!splitColumnKey) {

                group.rows.push(row);
                continue;
            }

            const splitValue = Ren.DateValueChart_SeriesSplit.readSplitValue(
                row,
                splitColumnKey,
                keptSplitValues
            );

            const splitRows = group.rowsBySplitValue.get(splitValue);

            if (splitRows) {
                splitRows.push(row);
            }
            else {

                group.rowsBySplitValue.set(splitValue, [row]);
            }
        }

        return { groups, groupOrder };
    };

    /**
     * Applies the per-row calculation functions to a copy of each input row.  The row itself stands
     * in for rowVals.  The rows are copied because inputData is cached and shared.
     */
    const applyDataRowCalcFunctions = (inputData, dataRowCalcFunctions) => {

        const result = [];

        for (let i = 0; i < inputData.length; i++) {

            const row = inputData[i];
            const newRow = {};

            for (const key in row) {

                if (!Object.prototype.hasOwnProperty.call(row, key)) continue;

                newRow[key] = row[key];
            }

            for (let c = 0; c < dataRowCalcFunctions.length; c++) {

                const calculatedColumn = dataRowCalcFunctions[c];
                const keys = calculatedColumn.keys;

                // The column's value sits under whichever of its keys the row is keyed by; a
                // calculation adding a column of its own has no value under any of them.
                let currentValue = undefined;

                for (let k = 0; k < keys.length; k++) {

                    if (newRow[keys[k]] === undefined) continue;

                    currentValue = newRow[keys[k]];
                    break;
                }

                try {

                    const newValue = calculatedColumn.compiledCalcFunction(
                        currentValue,
                        newRow,
                        null,
                        null,
                        null
                    );

                    for (let k = 0; k < keys.length; k++) {
                        newRow[keys[k]] = newValue;
                    }
                }
                catch (e) {

                    Ren.GlobalErrorHandler.logError(
                        "[DateValueChartGroupingApplyer] Error applying data row calcFunction " +
                        "for '" + keys[0] + "':",
                        e
                    );
                }
            }

            result.push(newRow);
        }

        return result;
    };

    /**
     * Gets what a grouping makes of a data set before it is binned: the rows with their data
     * row calculations made, the dates they cover, and the series the split column asks for.
     *
     * Held apart from the bins, as coarsening the bins to fit the chart does not change any of
     * it, and the calculations are over every row.
     */
    const getCalculatedRows = (inputData, groupingEntry) => {

        const key = groupingEntry.groupingSignature;

        return Ren.DateValueChart_DataCache.readOrBuild(inputData, "calculatedRows", key, () => {

            const { dateHeading, hasDateColumn, valueHeadings } = groupingEntry;
            const { splitColumnKey, splitTopValueCount } = groupingEntry;
            const dataRowCalcFunctions = groupingEntry.dataRowCalcFunctions;

            // Done first, so everything below - the split's values and the aggregation alike -
            // sees the calculated rows rather than the raw ones.
            const rows = dataRowCalcFunctions
                ? applyDataRowCalcFunctions(inputData, dataRowCalcFunctions)
                : inputData;

            // Ranked by the first value column over every row, so the date range does not change
            // which values have a series of their own.  A split keeping every value still keeps
            // no more than the legend can show, as a column of thousands of values would
            // otherwise make thousands of series in every bin, only for the legend to drop them.
            const keptSplitValues = splitColumnKey
                ? Ren.DateValueChart_SeriesSplit.getTopValues(
                    rows,
                    splitColumnKey,
                    valueHeadings[0],
                    splitTopValueCount
                        || Ren.DateValueChart_SeriesLimit.getMostShown(hasDateColumn)
                )
                : null;

            const splitValues = splitColumnKey
                ? Ren.DateValueChart_SeriesSplit.collectValues(
                    rows,
                    splitColumnKey,
                    keptSplitValues
                )
                : null;

            return {
                rows,
                keptSplitValues,
                splitValues,
                seriesColumns: splitColumnKey
                    ? Ren.DateValueChart_SeriesSplit.buildSeriesColumns(
                        valueHeadings,
                        splitValues,
                        dateHeading,
                        groupingEntry.splitColumn
                    )
                    : null,

                // Taken from the calculated rows, so a range relative to the last date in the
                // data counts back from the dates as the chart itself reads them.
                dataExtent: hasDateColumn
                    ? Ren.DateValueChart_DateRange.getDataExtent(rows, dateHeading)
                    : null,

                // Where the data's last date stops covering, for excludePartialPeriods.
                sourcePeriod: hasDateColumn
                    ? Ren.DatePeriodDetector.detectDatePeriodForRows(rows, dateHeading)
                    : null
            };
        });
    };

    /**
     * Gets a grouping's bins over every row it is given, with no date range applied: each bin
     * with the rows that fall in it, beside what getCalculatedRows made of those rows.
     *
     * Held per data set, grouping and bin period, as a date range chooses among these bins
     * rather than changing them, so panning and zooming a chart reads the bins it already has.
     */
    const getBins = (inputData, groupingEntry) => {

        const key = groupingEntry.groupingSignature + "|" + groupingEntry.binFunctionName;

        return Ren.DateValueChart_DataCache.readOrBuild(inputData, "bins", key, () => {

            const calculated = getCalculatedRows(inputData, groupingEntry);
            const grouped = groupRowsByDate(
                calculated.rows,
                groupingEntry,
                calculated.keptSplitValues
            );

            return {
                rows: calculated.rows,
                splitValues: calculated.splitValues,
                seriesColumns: calculated.seriesColumns,
                dataExtent: calculated.dataExtent,
                sourcePeriod: calculated.sourcePeriod,
                groups: grouped.groups,
                groupOrder: grouped.groupOrder,

                // Filled in as each bin is first drawn, so a chart zoomed into a month of ten
                // years of data aggregates that month alone.
                aggregatedByKey: new Map()
            };
        });
    };

    /**
     * Gets the keys of the bins a resolved range leaves drawn, in the order the rows made them.
     */
    const selectBinKeysInRange = (bins, resolvedDateRange) => {

        const groupOrder = bins.groupOrder;

        if (!resolvedDateRange) return groupOrder;

        const groups = bins.groups;
        const selected = [];

        for (let g = 0; g < groupOrder.length; g++) {

            const key = groupOrder[g];

            // The range is snapped to the bin boundaries, so a bin falls wholly inside it or
            // wholly outside, and the rows behind the bin need not be tested one by one.
            const isShown = Ren.DateValueChart_DateRange.includes(
                resolvedDateRange,
                groups.get(key).binnedDate
            );

            if (isShown) selected.push(key);
        }

        return selected;
    };

    /**
     * Records on the entry what its bins say about the data - the series the split found, and the
     * dates a relative range works out to - and gets the keys of the bins left drawn.
     */
    const selectBinKeys = (bins, groupingEntry) => {

        groupingEntry.seriesColumns = bins.seriesColumns;

        const DateRange = Ren.DateValueChart_DateRange;

        groupingEntry.resolvedDateRange = DateRange.excludePartialPeriods(
            DateRange.resolveFromExtent(
                bins.dataExtent,
                groupingEntry.binPeriod,
                groupingEntry.dateRange
            ),
            bins.dataExtent,
            bins.sourcePeriod,
            groupingEntry.binPeriod,
            {
                leading: groupingEntry.excludePartialLeadingPeriod,
                trailing: groupingEntry.excludePartialTrailingPeriod
            }
        );

        return selectBinKeysInRange(bins, groupingEntry.resolvedDateRange);
    };

    /**
     * Aggregates one bin over the rows of each of the split's values, so that a post-aggregation
     * calc function sees the sibling values of the same series.
     */
    const aggregateSplitBin = (group, groupingEntry, bins) => {

        const seriesColumns = bins.seriesColumns;
        const splitValues = bins.splitValues;
        const aggregatedBySplitValue = new Map();

        for (let s = 0; s < splitValues.length; s++) {

            const splitValue = splitValues[s];
            const splitRows = group.rowsBySplitValue.get(splitValue) || [];

            aggregatedBySplitValue.set(
                splitValue,
                aggregateRows(splitRows, groupingEntry, group.binnedDate)
            );
        }

        const aggregatedRow = {};
        aggregatedRow[groupingEntry.dateHeading] = group.binnedDate;

        for (let c = 0; c < seriesColumns.length; c++) {

            const seriesColumn = seriesColumns[c];
            const aggregated = aggregatedBySplitValue.get(seriesColumn.splitValue);
            aggregatedRow[seriesColumn.heading] = aggregated[seriesColumn.valueHeading];
        }

        return aggregatedRow;
    };

    // Each aggregated row's bin, so what was aggregated into a row can be found from it.
    const binsByAggregatedRow = new WeakMap();

    /**
     * Gets the rows aggregated into one of an aggregated row's columns, with the heading their
     * values are under, as { rows, valueHeading }, or null where the row was not aggregated here.
     * A split series' column was aggregated from its split value's rows alone.
     */
    const getAggregatedRows = (aggregatedRow, heading) => {

        const bin = binsByAggregatedRow.get(aggregatedRow);

        if (!bin || Ren.DateValueChart_OtherSeries.isOtherHeading(heading)) return null;

        if (!bin.seriesColumns) return { rows: bin.group.rows, valueHeading: heading };

        for (let i = 0; i < bin.seriesColumns.length; i++) {

            const seriesColumn = bin.seriesColumns[i];

            if (seriesColumn.heading !== heading) continue;

            return {
                rows: bin.group.rowsBySplitValue.get(seriesColumn.splitValue) || [],
                valueHeading: seriesColumn.valueHeading
            };
        }

        return null;
    };

    /**
     * Aggregates the rows of the series an unsplit chart's "Other" series gathers, each column's
     * values pooled as its own aggregation would read them, under the first column's aggregation.
     */
    const aggregateGatheredColumns = (rows, groupingEntry, gatheredHeadings) => {

        const firstConfig = groupingEntry.columns[gatheredHeadings[0]];
        const aggregationType = firstConfig?.aggregationType;
        const isOrdered = isOrderedAggregation(aggregationType);
        const pooledRows = [];

        for (let h = 0; h < gatheredHeadings.length; h++) {

            const heading = gatheredHeadings[h];
            const withRespectToColumn =
                groupingEntry.columns[heading]?.aggregateWithRespectToColumn;
            const columnRows = isOrdered ? rows : getRowsForAggregation(rows, withRespectToColumn);

            for (let r = 0; r < columnRows.length; r++) {

                pooledRows.push({
                    value: columnRows[r][heading],
                    order: isOrdered && withRespectToColumn
                        ? columnRows[r][withRespectToColumn]
                        : null
                });
            }
        }

        return aggregateColumn(
            pooledRows,
            "value",
            aggregationType,
            isOrdered && firstConfig?.aggregateWithRespectToColumn ? "order" : null
        );
    };

    /**
     * Aggregates one bin's rows for an "Other" series: those of its gathered split values together
     * where the data is split, or those of its gathered columns where not.
     */
    const aggregateOtherSeries = (bin, groupingEntry, otherSeries) => {

        const group = bin.group;

        if (!bin.seriesColumns) {

            return aggregateGatheredColumns(
                group.rows,
                groupingEntry,
                otherSeries.gatheredHeadings
            );
        }

        const pooledRows = [];

        for (let c = 0; c < bin.seriesColumns.length; c++) {

            const seriesColumn = bin.seriesColumns[c];

            if (otherSeries.gatheredHeadings.indexOf(seriesColumn.heading) === -1) continue;

            const splitRows = group.rowsBySplitValue.get(seriesColumn.splitValue);

            if (splitRows) Ren.ArrayUtils.pushAll(pooledRows, splitRows);
        }

        const aggregated = aggregateRows(pooledRows, groupingEntry, group.binnedDate);

        return aggregated[otherSeries.sourceHeading];
    };

    // Sums the gathered series' values in a row the chart did not aggregate itself.
    const sumGatheredValues = (row, gatheredHeadings) => {

        let total = null;

        for (let h = 0; h < gatheredHeadings.length; h++) {

            const value = Ren.TextUtils.parseFloat(row[gatheredHeadings[h]]);

            if (value !== null && !isNaN(value)) total = (total ?? 0) + value;
        }

        return total;
    };

    // Each bin's "Other" series values, held by what they gather, as the bins are kept.
    const otherValuesByGroup = new WeakMap();

    /**
     * Gets copies of aggregated rows with a column added for each "Other" series, under its
     * heading, of what the series it gathers aggregate to together.  A row with nothing to
     * aggregate holds zero, so that it is not dropped as missing a value.
     *
     * @param {Array} aggregatedRows - The rows from applyGrouping, or the chart's input rows where
     *     it has no grouping of its own, in which case the gathered values are summed.
     * @param {Array} otherSeries - One { heading, sourceHeading, gatheredHeadings } per series.
     */
    const addOtherSeriesColumns = (aggregatedRows, groupingEntry, otherSeries) => {

        const result = new Array(aggregatedRows.length);

        for (let i = 0; i < aggregatedRows.length; i++) {

            const row = aggregatedRows[i];
            const bin = groupingEntry ? binsByAggregatedRow.get(row) : undefined;
            const copy = Object.assign({}, row);

            let cachedValues = null;

            if (bin) {

                cachedValues = otherValuesByGroup.get(bin.group);

                if (!cachedValues) {

                    cachedValues = new Map();
                    otherValuesByGroup.set(bin.group, cachedValues);
                }

                binsByAggregatedRow.set(copy, bin);
            }

            for (let k = 0; k < otherSeries.length; k++) {

                const other = otherSeries[k];
                let value;

                if (bin) {

                    const cacheKey =
                        other.heading + "\u0002" + other.gatheredHeadings.join("\u0002");

                    value = cachedValues.get(cacheKey);

                    if (value === undefined) {

                        value = aggregateOtherSeries(bin, groupingEntry, other);
                        cachedValues.set(cacheKey, value);
                    }
                }
                else {

                    value = sumGatheredValues(row, other.gatheredHeadings);
                }

                copy[other.heading] = value ?? 0;
            }

            result[i] = copy;
        }

        return result;
    };

    /**
     * Gets one aggregated row per bin, taking the bins already aggregated as they stand and
     * keeping the ones it works out for the next draw.
     */
    const aggregateBins = (bins, groupingEntry, binKeys) => {

        const aggregatedByKey = bins.aggregatedByKey;
        const splitColumnKey = groupingEntry.splitColumnKey;
        const result = new Array(binKeys.length);

        for (let g = 0; g < binKeys.length; g++) {

            const key = binKeys[g];
            let aggregatedRow = aggregatedByKey.get(key);

            if (aggregatedRow === undefined) {

                const group = bins.groups.get(key);

                aggregatedRow = splitColumnKey
                    ? aggregateSplitBin(group, groupingEntry, bins)
                    : aggregateRows(group.rows, groupingEntry, group.binnedDate);

                aggregatedByKey.set(key, aggregatedRow);
                binsByAggregatedRow.set(aggregatedRow, {
                    group,
                    seriesColumns: splitColumnKey ? bins.seriesColumns : null
                });
            }

            result[g] = aggregatedRow;
        }

        return result;
    };

    /**
     * Builds what mergeBins gets for a set of bins: the aggregated row and the dates it covers, or
     * null where there are no bins.
     */
    const buildMergedBin = (bins, groupingEntry, binKeys) => {

        if (binKeys.length === 0) return null;

        const splitColumnKey = groupingEntry.splitColumnKey;
        const group = {
            binnedDate: null,
            rows: [],
            rowsBySplitValue: splitColumnKey ? new Map() : null
        };

        const appendSplitRows = (splitRows, splitValue) => {

            const mergedRows = group.rowsBySplitValue.get(splitValue);

            if (mergedRows) {
                Ren.ArrayUtils.pushAll(mergedRows, splitRows);
            }
            else {

                group.rowsBySplitValue.set(splitValue, splitRows.slice());
            }
        };

        let firstDate = null;
        let lastDate = null;

        for (let g = 0; g < binKeys.length; g++) {

            const binGroup = bins.groups.get(binKeys[g]);
            const binnedDate = binGroup.binnedDate;

            if (firstDate === null || binnedDate < firstDate) firstDate = binnedDate;
            if (lastDate === null || binnedDate > lastDate) lastDate = binnedDate;

            if (splitColumnKey) {
                binGroup.rowsBySplitValue.forEach(appendSplitRows);
            }
            else {

                Ren.ArrayUtils.pushAll(group.rows, binGroup.rows);
            }
        }

        group.binnedDate = Ren.DateUtils.toSortableStartOfYear(firstDate);

        const aggregatedRow = splitColumnKey
            ? aggregateSplitBin(group, groupingEntry, bins)
            : aggregateRows(group.rows, groupingEntry, group.binnedDate);

        binsByAggregatedRow.set(aggregatedRow, {
            group,
            seriesColumns: splitColumnKey ? bins.seriesColumns : null
        });

        return {
            aggregatedRow,
            extent: {
                from: firstDate,
                toExclusive: Ren.DateValueChart_DateRange.addPeriods(
                    lastDate,
                    Ren.DatePeriodEnum.Day,
                    1
                )
            }
        };
    };

    /**
     * Merges the bins left drawn into the one row an all-time chart draws, dated at the start of
     * the year its first date falls in, and records the dates the row covers on the entry.
     */
    const mergeBins = (bins, groupingEntry, binKeys) => {

        const range = groupingEntry.resolvedDateRange;
        const cacheKey = range ? range.from + "|" + range.toExclusive : "";

        bins.mergedByRange ??= new Map();

        let merged = bins.mergedByRange.get(cacheKey);

        if (merged === undefined) {

            merged = buildMergedBin(bins, groupingEntry, binKeys);
            bins.mergedByRange.set(cacheKey, merged);
        }

        // A chart without a date column covers no dates, only the one its rows are given.
        groupingEntry.allTimeExtent = merged && groupingEntry.hasDateColumn ? merged.extent : null;

        return merged ? [merged.aggregatedRow] : [];
    };

    /**
     * Groups inputData rows by binned date, aggregating value columns per group.
     * Returns one aggregated row per date group, in the insertion order of the input.
     * Where the chart's grouping settings split the data (a grouping level outside the date one),
     * each date group is aggregated once per value of the split column, written out as a column
     * per series.  The series are recorded on the grouping entry.
     *
     * @param {Array} inputData - Flat array of row objects keyed by column heading.
     * @param {Object} groupingEntry - Compiled grouping entry from initGroupingEntry.
     * @returns {Array} One aggregated row per date group.
     */
    const applyGrouping = (inputData, groupingEntry) => {

        const bins = getBins(inputData, groupingEntry);
        const binKeys = selectBinKeys(bins, groupingEntry);

        return groupingEntry.isAllTime
            ? mergeBins(bins, groupingEntry, binKeys)
            : aggregateBins(bins, groupingEntry, binKeys);
    };

    /**
     * Coarsens a compiled entry's bins by one period, hours to days and so on.  Returns false where
     * the entry bins by no date period at all, or by the coarsest there is.
     */
    const coarsenBinPeriod = (groupingEntry) => {

        const period = groupingEntry.binPeriod;

        if (period == null || period >= Ren.DatePeriodEnum.Year) return false;

        const calcFunctionName = Ren.DatePeriodDetector.getCalcFunctionForPeriod(period + 1);

        if (!calcFunctionName) return false;

        let compiledBinFunction = null;

        try {

            compiledBinFunction = Ren.FormatFunctions.createFunction({ name: calcFunctionName });
        }
        catch (e) {

            Ren.GlobalErrorHandler.logError(
                "[DateValueChartGroupingApplyer] Error compiling coarsened bin function '" +
                calcFunctionName + "':",
                e
            );
        }

        if (!compiledBinFunction) return false;

        groupingEntry.binPeriod = period + 1;
        groupingEntry.compiledBinFunction = compiledBinFunction;
        groupingEntry.binFunctionName = calcFunctionName;

        return true;
    };

    /**
     * Gets how many periods the chart would draw for the given bins: the axis ticks every period
     * between the first bin and the last, not only the bins with data in them, so daily data
     * binned by the minute is a tick a minute across its whole range.
     */
    const countPeriodsDrawn = (bins, binKeys, binPeriod) => {

        const periodMs = Ren.DateValueChartCalculator.getSubDayPeriodMilliseconds(binPeriod);

        if (periodMs === null || binKeys.length < 2) return binKeys.length;

        let minTime = Infinity;
        let maxTime = -Infinity;

        for (let i = 0; i < binKeys.length; i++) {

            const time = Ren.DateValueChart_DateRange.toTime(
                bins.groups.get(binKeys[i]).binnedDate
            );

            if (time < minTime) minTime = time;
            if (time > maxTime) maxTime = time;
        }

        if (!isFinite(minTime) || !isFinite(maxTime)) return binKeys.length;

        return Math.max(binKeys.length, Math.floor((maxTime - minTime) / periodMs) + 1);
    };

    /**
     * Applies the grouping, coarsening its bins a period at a time until the chart is left with no
     * more points than it can draw.  The coarsening is made on the compiled entry and not on the
     * chart's settings, so narrowing the date range brings the finer bins back.
     */
    const applyGroupingWithinPointLimit = (inputData, groupingEntry) => {

        const maxPoints = Ren.CreateDateValueChart_PrepareData.MAX_DATA_POINTS;

        let bins = getBins(inputData, groupingEntry);
        let binKeys = selectBinKeys(bins, groupingEntry);

        // All time draws a single point however finely its dates are binned.
        if (groupingEntry.isAllTime) return mergeBins(bins, groupingEntry, binKeys);

        // Counted before any bin is aggregated, so a draw that is about to be coarsened away
        // costs no more than the binning, which is kept anyway.
        while (
            countPeriodsDrawn(bins, binKeys, groupingEntry.binPeriod) > maxPoints &&
            coarsenBinPeriod(groupingEntry)
        ) {

            bins = getBins(inputData, groupingEntry);
            binKeys = selectBinKeys(bins, groupingEntry);
        }

        return aggregateBins(bins, groupingEntry, binKeys);
    };

    /**
     * Gets the chart's rows for the year before each period it draws, each dated to the period it
     * is compared with.  A day or a week is compared with the one 52 weeks before, so that it falls
     * on the same day of the week, and a longer period with the same one a year before.  A period
     * with no data a year before is left out.  Call it after the entry is applied, so that it
     * compares the periods drawn.
     */
    const getPreviousYearRows = (inputData, groupingEntry) => {

        if (groupingEntry.isAllTime) return [];

        const bins = getBins(inputData, groupingEntry);
        const toDate = value => value instanceof Date
            ? value
            : Ren.DateUtils.parseDateTimeUniversal(value, true);
        const keysByDay = new Map();

        for (let g = 0; g < bins.groupOrder.length; g++) {

            const key = bins.groupOrder[g];
            const date = toDate(bins.groups.get(key).binnedDate);

            if (date) keysByDay.set(Ren.DateUtils.toSortableDate(date), key);
        }

        const shownKeys = selectBinKeysInRange(bins, groupingEntry.resolvedDateRange);
        const isWeekAligned = groupingEntry.binPeriod <= Ren.DatePeriodEnum.Week;
        const rows = [];

        for (let g = 0; g < shownKeys.length; g++) {

            const binnedDate = bins.groups.get(shownKeys[g]).binnedDate;
            const date = toDate(binnedDate);

            if (!date) continue;

            const earlier = new Date(date.getTime());

            if (isWeekAligned) {
                earlier.setDate(earlier.getDate() - 364);
            }
            else {

                earlier.setFullYear(earlier.getFullYear() - 1);
            }

            const earlierKey = keysByDay.get(Ren.DateUtils.toSortableDate(earlier));

            if (earlierKey === undefined) continue;

            // A copy, as the aggregated row is held for the earlier period's own draw.
            const row = Object.assign({}, aggregateBins(bins, groupingEntry, [earlierKey])[0]);

            row[groupingEntry.dateHeading] = binnedDate;
            rows.push(row);
        }

        return rows;
    };

    /**
     * Gets the most each split series reaches over every date, by series heading, as the series are
     * ranked by.  Taken at the period the whole date range would be drawn at, rather than the one
     * the current draw uses, so that zooming does not reorder the series.  Call it before the
     * entry is applied, as applying coarsens the entry to the range drawn.
     */
    const getSplitSeriesMaxes = (inputData, groupingEntry) => {

        const key = groupingEntry.groupingSignature + "|" + groupingEntry.binFunctionName;

        return Ren.DateValueChart_DataCache.readOrBuild(inputData, "splitSeriesMaxes", key, () => {

            // Coarsened on a copy, so the entry itself keeps the settings' period.
            const entry = Object.assign({}, groupingEntry);
            const maxPoints = Ren.CreateDateValueChart_PrepareData.MAX_DATA_POINTS;

            let bins = getBins(inputData, entry);

            if (entry.isAllTime) {

                return Ren.DateValueChart_SeriesSplit.getSeriesMaxes(
                    mergeBins(bins, entry, bins.groupOrder),
                    bins.seriesColumns
                );
            }

            while (
                countPeriodsDrawn(bins, bins.groupOrder, entry.binPeriod) > maxPoints &&
                coarsenBinPeriod(entry)
            ) {

                bins = getBins(inputData, entry);
            }

            return Ren.DateValueChart_SeriesSplit.getSeriesMaxes(
                aggregateBins(bins, entry, bins.groupOrder),
                bins.seriesColumns
            );
        });
    };

    /**
     * Gets the period a chart's bins are drawn at: the one its settings name, unless the data was
     * too fine to fit in one chart and was coarsened for this draw.
     */
    const getEffectiveBinPeriod = (props) =>
        props?.binPeriod ?? getBinPeriod(props?.visualisation?.chartDataGroupingSettings);

    return {
        ALL_TIME_CALC_FUNCTION,
        isAllTimeCalcFunction,
        getBinPeriod,
        getEffectiveBinPeriod,
        initGroupingEntry,
        applyGrouping,
        applyGroupingWithinPointLimit,
        getPreviousYearRows,
        getSplitSeriesMaxes,
        aggregateRows,
        getAggregatedRows,
        addOtherSeriesColumns
    };
})();
