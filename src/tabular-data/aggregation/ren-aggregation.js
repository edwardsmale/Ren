Ren.Aggregation = (tabularData, dataGroupingSettings) => {

    const aggFuncs = Ren.AggregationFns(
        tabularData.CompressionDictionary.decompressValue,
        () => tabularData.CompressionDictionary.dictionarySize
    );

    const callAggFunc = (formatType, aggType, values, columnIndex, startRowIndex, stopRowIndex, groupRowIndex, isOutermostGrouping, orderKeys) => {

        const func = aggFuncs.aggFunc(formatType, aggType);

        return func(
            values,
            columnIndex,
            startRowIndex,
            stopRowIndex,
            groupRowIndex,
            isOutermostGrouping,
            orderKeys
        );
    };

    /**
     * Gets a value indicating whether the aggregation type is one of those that read the "with
     * respect to" column as an ordering (First, Last and Median) rather than as a column to
     * deduplicate rows by.
     */
    const isOrderedAggregation = (aggType) => {

        return aggType === Ren.AggregationTypeEnum.First
            || aggType === Ren.AggregationTypeEnum.Last
            || aggType === Ren.AggregationTypeEnum.Median;
    };

    /**
     * Checks if a column has a calcFunction defined in the dataRows section of settings.
     * @param {number} columnIndex - The column index to check.
     * @returns {boolean} True if the column has a data row calc function.
     */
    const columnHasDataRowCalcFunction = (columnIndex) => {

        const dataRowsColumns = dataGroupingSettings.dataRows?.columns;
        if (!dataRowsColumns) return false;

        const columnModel = tabularData.ColumnModels[columnIndex];
        if (!columnModel) return false;

        const columnIdOrHeading = columnModel.ColumnIdOrHeading;
        const columnSettings = dataRowsColumns[columnIdOrHeading];

        return columnSettings && !!columnSettings.calcFunction;
    };

    // Memoised per column, as aggregation runs once per group x column.  The answers depend on the
    // data rows' calc functions, and the transformed columns are worked out afresh whenever those
    // change, so the memos are kept for one set of transformed columns and cleared for the next.
    const columnHasDataRowCalcFunctionCache = new Array(tabularData.ColumnModels.length);
    const aggregatesCalculatedNumbersCache = new Array(tabularData.ColumnModels.length);
    let cachedForTransformedDataColumns = null;

    const clearCachesIfStale = (transformedDataColumns) => {

        if (transformedDataColumns === cachedForTransformedDataColumns) return;

        columnHasDataRowCalcFunctionCache.fill(undefined);
        aggregatesCalculatedNumbersCache.fill(undefined);
        cachedForTransformedDataColumns = transformedDataColumns;
    };

    /**
     * Gets the column-major transformed values array for a column that has a data-row calc
     * function, or null where it has none.
     */
    const getTransformedColumn = (columnIndex) => {

        const transformedDataColumns = dataGroupingSettings.transformedDataColumns;
        if (!transformedDataColumns) return null;

        clearCachesIfStale(transformedDataColumns);

        let hasCalcFunc = columnHasDataRowCalcFunctionCache[columnIndex];

        if (hasCalcFunc === undefined) {

            hasCalcFunc = columnHasDataRowCalcFunction(columnIndex);
            columnHasDataRowCalcFunctionCache[columnIndex] = hasCalcFunc;
        }

        return hasCalcFunc ? transformedDataColumns[columnIndex] : null;
    };

    /**
     * Gets a value indicating whether a column is compressed but its data rows' calc function
     * turns its values into numbers (the lengths of a column of strings, say).  Its transformed
     * values are then dictionary indexes standing for numbers, which have to be read as the numbers
     * for any aggregation doing arithmetic on them or comparing them.
     */
    const aggregatesCalculatedNumbers = (columnIndex) => {

        if (!getTransformedColumn(columnIndex)) return false;

        let result = aggregatesCalculatedNumbersCache[columnIndex];

        if (result === undefined) {

            const columnModel = tabularData.ColumnModels[columnIndex];

            const calcValueFormat = tabularData.IsColumnCompressed?.[columnIndex]
                ? Ren.FunctionTags.getCalcFunctionsValueFormat(
                    dataGroupingSettings.dataRows.columns[columnModel.ColumnIdOrHeading]
                        .calcFunction,
                    columnModel.ColumnFormat
                )
                : null;

            result = calcValueFormat !== null
                && Ren.SpreadsheetColumnFormatEnum.IsArithmetic(calcValueFormat);

            aggregatesCalculatedNumbersCache[columnIndex] = result;
        }

        return result;
    };

    /**
     * Gets a value indicating whether the aggregation type does arithmetic on the values or
     * compares them with each other, and so has to read numbers as numbers.
     */
    const isNumericAggregation = Ren.AggregationTypeFormatConverter.isNumericAggregation;

    // The aggregation functions for values that are not dictionary indexes, built on first use.
    let uncompressedAggFuncs = null;

    // A third reused buffer, for a calc'd column's values read as the numbers they stand for.
    let numberBuffer = [];

    /**
     * Returns the numbers a group's gathered dictionary indexes stand for, with null for a blank
     * or NULL and for anything that is not a number.
     */
    const decompressValuesToNumbers = (values, valueCount, columnIndex, calcFunctions) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;

        if (numberBuffer.length < valueCount) numberBuffer = new Array(valueCount);

        for (let i = 0; i < valueCount; i++) {

            let value = decompressValue(values[i], columnIndex);

            if (calcFunctions) value = applyCalcFunctions(calcFunctions, value, columnIndex);

            numberBuffer[i] = toNumber(value);
        }

        return numberBuffer;
    };

    // Gets the number a value stands for, or null for a blank or NULL or anything not a number.
    const toNumber = (value) => {

        if (value == null || value === "" || value === Ren.NullSentinel) return null;

        const number = typeof value === "number" ? value : Number(value);

        return Number.isFinite(number) ? number : null;
    };

    /**
     * Gets a function reading a column's value on a data row as the number a grouping's sum,
     * average or the like of the column reads it as: the data rows' calc function's result where
     * there is one, through the grouping's calc function applied to each value where there is
     * one (see getPerValueCalcFunctions), and null for a blank or NULL or anything not a number.
     *
     * @param {Object} groupingColumns The grouping's columns settings.
     * @param {Object} paras The containing report's parameters, which the functions read as paras.
     * @returns {function(number): ?number} Reads the number for a data row index.
     */
    const getRowNumberReader = (columnIndex, groupingColumns, paras) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const values = getTransformedColumn(columnIndex) ?? tabularData.getColumnCV(columnIndex);

        const calcFunctions = getPerValueCalcFunctions(
            columnIndex,
            groupingColumns,
            Ren.AggregationTypeEnum.Sum,
            paras
        );

        return (rowIndex) => {

            let value = decompressValue(values[rowIndex], columnIndex);

            if (calcFunctions) value = applyCalcFunctions(calcFunctions, value, columnIndex);

            return toNumber(value);
        };
    };

    /**
     * Passes a value through a chain of compiled calc functions, logging (and passing on the value
     * as it stood) where one throws.
     */
    const applyCalcFunctions = (calcFunctions, value, columnIndex) => {

        for (let k = 0; k < calcFunctions.length; k++) {

            try {

                value = calcFunctions[k](value, {}, null, null, null);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[Aggregation] Error applying calcFunction for column '" +
                    tabularData.ColumnModels[columnIndex].ColumnIdOrHeading + "':",
                    e
                );
            }
        }

        return value;
    };

    // The compiled functions for each calc function applied value by value, keyed by the calc
    // function setting, so they are compiled once for each setting.  A setting that is a bare
    // string of code cannot key it, and is compiled each time.
    const perValueCalcFunctionsCache = new WeakMap();

    /**
     * Gets the compiled calc functions a grouping applies to each of a column's values before
     * aggregating them, or null where it applies its calc function (if any) to the aggregated value
     * as usual.  A calc function that gives numbers from what may not be numbers (the lengths of
     * strings, say) makes the column one of numbers, so an aggregation doing arithmetic on the
     * values or comparing them works on the function's results.  That is the grouping's own calc
     * function for the column, or where it has none, the one the column is grouped by the results
     * of elsewhere.
     *
     * @param {Object} columns The grouping's columns settings.
     * @param {Object} paras The containing report's parameters, which the functions read as paras.
     */
    const getPerValueCalcFunctions = (columnIndex, columns, aggType, paras) => {

        if (!isNumericAggregation(aggType)) return null;

        const columnModel = tabularData.ColumnModels[columnIndex];

        const calcFunction = Ren.FunctionTags.getPerValueCalcFunction(
            dataGroupingSettings.groupings?.entries,
            columns,
            columnIndex,
            columnModel.ColumnIdOrHeading
        );

        return compileArithmeticCalcFunctions(calcFunction, columnModel, paras);
    };

    /**
     * Gets a value indicating whether a grouping's aggregation of a column leaves the grouping's
     * calc function on it unapplied (see Ren.AggregationTypeFormatConverter's
     * ignoresCalcFunction).
     *
     * @param {Object} columns The grouping's columns settings.
     */
    const ignoresCalcFunction = (columnIndex, columns, aggType) => {

        const columnModel = tabularData.ColumnModels[columnIndex];

        return Ren.AggregationTypeFormatConverter.ignoresCalcFunction(
            aggType,
            columns?.[columnModel.ColumnIdOrHeading]?.calcFunction,
            columnModel.ColumnFormat
        );
    };

    /**
     * Compiles a calc function setting where it names numbers as the kind of value it gives, and
     * otherwise gives null.
     */
    const compileArithmeticCalcFunctions = (calcFunction, columnModel, paras) => {

        if (!calcFunction) return null;

        const isCacheable = typeof calcFunction === "object";

        let compiled = isCacheable ? perValueCalcFunctionsCache.get(calcFunction) : undefined;

        if (compiled === undefined) {

            const valueFormat = Ren.FunctionTags.getCalcFunctionsValueFormat(
                calcFunction,
                columnModel.ColumnFormat
            );

            compiled = null;

            if (valueFormat !== null && Ren.SpreadsheetColumnFormatEnum.IsArithmetic(valueFormat)) {

                compiled = [];

                for (const spec of Ren.ArrayUtils.ensureArray(calcFunction)) {

                    try {

                        const fn = Ren.FormatFunctions.createFunction(spec, paras);
                        if (fn) compiled.push(fn);
                    }
                    catch (e) {

                        Ren.GlobalErrorHandler.logError(
                            "[Aggregation] Error creating calcFunction for column '" +
                            columnModel.ColumnIdOrHeading + "':",
                            e
                        );
                    }
                }

                if (!compiled.length) compiled = null;
            }

            if (isCacheable) perValueCalcFunctionsCache.set(calcFunction, compiled);
        }

        return compiled;
    };

    // Rows excluded by the outer filter are marked in a reused epoch-stamped array rather than
    // collected into a Set per group x column.  It is allocated on first use; bumping the epoch
    // clears it in O(1), and the first epoch used (1) never collides with a zero-initialised slot.
    let outerExclusionStamp = null;
    let outerExclusionEpoch = 0;

    // Epoch-stamped "seen" array backing the fused CountDistinct fast path.  Compressed values are
    // dictionary indexes in [0, dictionarySize), so distinctness is tracked by stamping
    // seen[index] with a per-group epoch rather than hashing into a Set per group.
    //
    // The size is read when the array is allocated, since interning a derived value grows the
    // dictionary.  A value interned after that is outside it, which the range checks at the
    // stamping sites fall back to the Set path for.
    let distinctSeen = null;
    let distinctEpoch = 0;

    const dictionaryHasEntries = () => tabularData.CompressionDictionary.dictionarySize > 0;

    const getDistinctSeenArray = () => {

        if (distinctSeen === null) {
            distinctSeen = new Int32Array(tabularData.CompressionDictionary.dictionarySize);
        }

        return distinctSeen;
    };

    // The same epoch-stamped trick for the with-respect-to dedupe, in an array of its own since a
    // column can be counted distinctly and aggregated with respect to another in the same pass.
    let wrtSeen = null;
    let wrtEpoch = 0;

    const getWrtSeenArray = () => {

        if (wrtSeen === null) {
            wrtSeen = new Int32Array(tabularData.CompressionDictionary.dictionarySize);
        }

        return wrtSeen;
    };

    // Reused buffer a group's values are gathered into, rather than an array per group x column.
    // The aggregation functions read [0, gatheredValueCount) and never retain it; it only grows.
    let gatherBuffer = [];

    // How many values the last gather wrote into gatherBuffer, held here to save a result object.
    let gatheredValueCount = 0;

    const getGatherBuffer = (requiredLength) => {

        if (gatherBuffer.length < requiredLength) gatherBuffer = new Array(requiredLength);

        return gatherBuffer;
    };

    // A second buffer, for decompressed copies of a calc'd column's values.  A copy is taken since
    // the gather returns the source column itself for a group covering every row in order.
    let decompressedBuffer = [];

    const getDecompressedBuffer = (requiredLength) => {

        if (decompressedBuffer.length < requiredLength) {
            decompressedBuffer = new Array(requiredLength);
        }

        return decompressedBuffer;
    };

    /**
     * Gets a value indicating whether the aggregation type picks its result by comparing the values
     * with each other, rather than by counting them or collecting them all.
     */
    const isOrderedByValueAggregation = (aggType) => {

        return aggType === Ren.AggregationTypeEnum.Min
            || aggType === Ren.AggregationTypeEnum.Max
            || aggType === Ren.AggregationTypeEnum.Median;
    };

    /**
     * Gets a value indicating whether a column's transformed values include one appended to the
     * compression dictionary out of its sorted order (see
     * CalcFunctionsApplyer.applyCalcFunctionsToDataRows).
     */
    const transformedColumnHasAppendedValues = (columnIndex) => {

        const transformedDataColumns = dataGroupingSettings.transformedDataColumns;

        return !!transformedDataColumns?.columnsWithAppendedValues?.[columnIndex];
    };

    /**
     * Returns a decompressed copy of the values gathered for a group, for an aggregation that
     * compares them with each other.  A source column's compressed values are in the dictionary's
     * sorted order, so comparing those orders them as their display values would be; a value the
     * client derived is appended out of that order, and only the value itself says where it comes.
     */
    const decompressValuesToAggregate = (values, valueCount, columnIndex) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const decompressed = getDecompressedBuffer(valueCount);

        for (let i = 0; i < valueCount; i++) {
            decompressed[i] = decompressValue(values[i], columnIndex);
        }

        return decompressed;
    };

    // The same reused buffer for the order keys the First, Last and Median aggregations read,
    // allocated only where one of them has a "with respect to" column.
    let orderKeyBuffer = [];

    // The order keys the last gather wrote, or null when it gathered none (every aggregation but
    // First, Last and Median, and those with no "with respect to" column).
    let gatheredOrderKeys = null;

    const getOrderKeyBuffer = (requiredLength) => {

        if (orderKeyBuffer.length < requiredLength) orderKeyBuffer = new Array(requiredLength);

        return orderKeyBuffer;
    };

    /**
     * Returns an aggregated value for the passed array of compressed data over the specified range.
     *
     * @returns {Array} Decompressed, optionally formatted, values to display.
     */
    const aggregate = (
        valuesToAggregate,
        valueCount,
        columnIndex,
        aggregationType,
        group,
        isOutermostGrouping,
        orderKeys
    ) => {

        const value = callAggFunc(
            null, // formatType
            aggregationType,
            valuesToAggregate,
            columnIndex,
            0,
            valueCount,
            group.groupRowIndex,
            isOutermostGrouping,
            orderKeys
        );

        return Array.isArray(value) ? value.join("，") : value;
    };

    /**
     * Marks the row indexes excluded from aggregation by outerFilterSet, by stamping
     * outerExclusionStamp with a fresh epoch, and returns how many rows were marked (0 where no
     * outer filter is active).  A row is marked where its stamp equals outerExclusionEpoch.
     *
     * Where the group has child groups, the rows of those with excludedByOuterFilter are marked;
     * otherwise its data rows are tested against outerFilterSet directly.
     */
    const markRowsExcludedByOuterFilter = (group, isOutermostGrouping) => {

        const outerFilterSet = dataGroupingSettings.outerFilterSet;

        if (!outerFilterSet) return 0;

        if (outerExclusionStamp === null) {
            outerExclusionStamp = new Int32Array(tabularData.RowModels.length);
        }

        const stamp = outerExclusionStamp;
        const epoch = ++outerExclusionEpoch;
        let excludedCount = 0;

        // Case 1: Group has child groups (normal case with multiple groupings)
        if (group.containedGroups && group.containedGroups.size > 0) {

            group.containedGroups.forEach(childGroup => {

                if (childGroup.excludedByOuterFilter) {

                    // Mark all row indexes from this excluded child group.
                    const childBuffer = childGroup.containedRowIndexBuffer;
                    const childStart = childGroup.containedRowIndexStart;
                    const childCount = childGroup.containedRowIndexCount;

                    for (let i = 0; i < childCount; i++) {

                        const rowIndex = childBuffer[childStart + i];

                        if (stamp[rowIndex] === epoch) continue;

                        stamp[rowIndex] = epoch;
                        excludedCount++;
                    }
                }
            });

            return excludedCount;
        }

        // Case 2: Group contains data rows directly (no child groups), as with only the outermost
        // grouping.
        if (isOutermostGrouping && (!group.containedGroups || group.containedGroups.size === 0)) {

            const filterColumns = Ren.OuterFilterSetUtils.getFilterColumnsForTab(outerFilterSet, tabularData);

            if (filterColumns) {

                const buffer = group.containedRowIndexBuffer;
                const start = group.containedRowIndexStart;
                const count = group.containedRowIndexCount;

                for (let i = 0; i < count; i++) {

                    const rowIndex = buffer[start + i];

                    if (!Ren.OuterFilterSetUtils.dataRowMatchesOuterFilter(rowIndex, filterColumns, tabularData)) {

                        if (stamp[rowIndex] === epoch) continue;

                        stamp[rowIndex] = epoch;
                        excludedCount++;
                    }
                }
            }
        }

        return excludedCount;
    };

    // The rows a data-row filter keeps for the group currently being aggregated, gathered once and
    // reused across that group's columns.  A list of the kept rows is a straight, branchless read
    // rather than a walk of every row testing the exclusion mask, which a selective filter wins by
    // several times over.
    let keptRows = null;
    let keptRowsCount = 0;
    let keptRowsGroup = null;
    let keptRowsFilter = null;
    let keptRowsUseAllRows = false;
    let keptRowsSourceBuffer = null;
    let keptRowsSourceStart = 0;
    let keptRowsSourceCount = 0;

    /**
     * Gets the row indexes of the group that the filter keeps, reusing the previous gather where
     * it was for this same group and filter.
     *
     * The compiled filter is memoised per filter definition, so a changed filter is always a
     * different object.  The group's slice of the contained-row-index buffer is checked as well, so
     * that a group object reused across passes cannot carry a list gathered over different rows.
     */
    const getKeptRowIndexes = (group, useAllRows, compiledFilter) => {

        // The outermost group spans every data row; reading its containedRowIndexBuffer would
        // materialise that range as an array.
        const sourceBuffer = useAllRows ? null : group.containedRowIndexBuffer;
        const sourceStart = useAllRows ? 0 : group.containedRowIndexStart;
        const sourceCount = useAllRows
            ? tabularData.RowModels.length
            : group.containedRowIndexCount;

        if (keptRowsGroup === group
            && keptRowsFilter === compiledFilter
            && keptRowsUseAllRows === useAllRows
            && keptRowsSourceBuffer === sourceBuffer
            && keptRowsSourceStart === sourceStart
            && keptRowsSourceCount === sourceCount) {

            return keptRows;
        }

        const excludedMask = compiledFilter.getExcludedRowsMask();

        if (keptRows === null || keptRows.length < sourceCount) {
            keptRows = new Int32Array(sourceCount);
        }

        const kept = keptRows;
        let count = 0;

        if (useAllRows) {

            for (let rowIndex = 0; rowIndex < sourceCount; rowIndex++) {

                if (excludedMask[rowIndex]) continue;

                kept[count++] = rowIndex;
            }
        }
        else {

            for (let i = 0; i < sourceCount; i++) {

                const rowIndex = sourceBuffer[sourceStart + i];

                if (excludedMask[rowIndex]) continue;

                kept[count++] = rowIndex;
            }
        }

        keptRowsCount = count;
        keptRowsGroup = group;
        keptRowsFilter = compiledFilter;
        keptRowsUseAllRows = useAllRows;
        keptRowsSourceBuffer = sourceBuffer;
        keptRowsSourceStart = sourceStart;
        keptRowsSourceCount = sourceCount;

        return kept;
    };

    // The rows the last resolveRowsToAggregate call settled on, held here to save a result object
    // per cell.  A null buffer means the row index is the position itself.
    let resolvedRowsBuffer = null;
    let resolvedRowsStart = 0;
    let resolvedRowsCount = 0;

    /**
     * Settles which rows a group's aggregation should read: with a data-row filter the group's kept
     * rows, and without one its own contained rows - or, for the outermost group, every row.
     */
    const resolveRowsToAggregate = (group, isOutermostGrouping, compiledFilter, hasFilter) => {

        if (hasFilter) {

            resolvedRowsBuffer = getKeptRowIndexes(group, isOutermostGrouping, compiledFilter);
            resolvedRowsStart = 0;
            resolvedRowsCount = keptRowsCount;

            return;
        }

        if (isOutermostGrouping) {

            resolvedRowsBuffer = null;
            resolvedRowsStart = 0;
            resolvedRowsCount = tabularData.RowModels.length;

            return;
        }

        resolvedRowsBuffer = group.containedRowIndexBuffer;
        resolvedRowsStart = group.containedRowIndexStart;
        resolvedRowsCount = group.containedRowIndexCount;
    };

    const getCompressedValuesToAggregate_noWrt = (columnIndex, group, compiledFilter, isOutermostGrouping, hasFilter) => {

        // For a column with a data-row calc function the transformed values are stored column-major
        // (one array per calc'd column); otherwise read the source column's compressed values.
        const transformedColumn = getTransformedColumn(columnIndex);
        const columnCVs = transformedColumn ? null : tabularData.getColumnCV(columnIndex);

        // Read through one binding so that the choice is not re-tested for every row.
        const sourceColumn = transformedColumn ? transformedColumn : columnCVs;

        // A row is excluded where its stamp matches the epoch captured straight after marking.
        const hasOuterFilterExclusions = markRowsExcludedByOuterFilter(group, isOutermostGrouping) > 0;
        const outerExclusionStampArray = outerExclusionStamp;
        const outerExclusionMark = outerExclusionEpoch;

        // Which rows to read, with any data-row filter already applied.  A null buffer means the
        // row index is the position itself.
        resolveRowsToAggregate(group, isOutermostGrouping, compiledFilter, hasFilter);

        const buffer = resolvedRowsBuffer;
        const start = resolvedRowsStart;
        const n = resolvedRowsCount;
        const useAllRows = buffer === null;

        if (hasOuterFilterExclusions) {

            const values = getGatherBuffer(n);
            let count = 0;

            // The buffer test is loop invariant, so each case gets its own loop rather than being
            // re-tested for every row.
            if (useAllRows) {

                for (let rowIndex = 0; rowIndex < n; rowIndex++) {

                    if (outerExclusionStampArray[rowIndex] === outerExclusionMark) continue;

                    values[count++] = sourceColumn[rowIndex];
                }
            }
            else {

                for (let i = 0; i < n; i++) {

                    const rowIndex = buffer[start + i];

                    if (outerExclusionStampArray[rowIndex] === outerExclusionMark) continue;

                    values[count++] = sourceColumn[rowIndex];
                }
            }

            gatheredValueCount = count;

            return values;
        }

        // Fastest path: with no filter and no outer exclusions the outermost group's values are the
        // source column itself, so it is returned rather than copied.
        if (useAllRows) {

            gatheredValueCount = n;

            return sourceColumn;
        }

        const values = getGatherBuffer(n);

        for (let i = 0; i < n; i++) {
            values[i] = sourceColumn[buffer[start + i]];
        }

        gatheredValueCount = n;

        return values;
    };

    /**
     * Gets a group's compressed values to aggregate "with respect to" column X, keeping only the
     * first row for each distinct value of that column.  For example, "Sum Days Active with
     * respect to ID" sums each ID's Days Active once, however many product rows it has.
     * First, Last and Median read the column as an ordering instead (see
     * getCompressedValuesToAggregate_ordered).
     */
    const getCompressedValuesToAggregate_wrt = (columnIndex, wrtColumnIndex, group, compiledFilter, isOutermostGrouping, hasFilter) => {

        // A row is excluded where its stamp matches the epoch captured straight after marking.
        const hasOuterFilterExclusions = markRowsExcludedByOuterFilter(group, isOutermostGrouping) > 0;
        const outerExclusionStampArray = outerExclusionStamp;
        const outerExclusionMark = outerExclusionEpoch;

        // Which rows to read, with any data-row filter already applied.  A null buffer means the
        // row index is the position itself.
        resolveRowsToAggregate(group, isOutermostGrouping, compiledFilter, hasFilter);

        const sourceBuffer = resolvedRowsBuffer;
        const sourceStart = resolvedRowsStart;
        const sourceCount = resolvedRowsCount;
        const useAllRows = sourceBuffer === null;

        const transformedColumn = getTransformedColumn(columnIndex);
        const wrtColumnCVs = tabularData.getColumnCV(wrtColumnIndex);
        const sourceColumn = transformedColumn ? transformedColumn : tabularData.getColumnCV(columnIndex);

        // Keep only the first row for each distinct value of the wrt column, gathering the kept
        // rows' values in the same pass.  A dense Int32Array column is deduplicated by stamping the
        // seen-array at each dictionary index; anything else falls back to a Set, allocated only if
        // such a value actually turns up.
        const isStamped = wrtColumnCVs instanceof Int32Array && dictionaryHasEntries();
        const seen = isStamped ? getWrtSeenArray() : null;
        const epoch = isStamped ? ++wrtEpoch : 0;

        let seenValues = null;

        const values = getGatherBuffer(sourceCount);
        let count = 0;

        for (let i = 0; i < sourceCount; i++) {

            const rowIndex = useAllRows ? i : sourceBuffer[sourceStart + i];

            if (hasOuterFilterExclusions && outerExclusionStampArray[rowIndex] === outerExclusionMark) continue;

            const compressedValueInWrtColumn = wrtColumnCVs[rowIndex];

            if (isStamped && compressedValueInWrtColumn >= 0
                && compressedValueInWrtColumn < seen.length) {

                if (seen[compressedValueInWrtColumn] === epoch) continue;

                seen[compressedValueInWrtColumn] = epoch;
            }
            else {

                if (seenValues === null) seenValues = new Set();

                const sizeBeforeAdd = seenValues.size;

                seenValues.add(compressedValueInWrtColumn);

                if (seenValues.size === sizeBeforeAdd) continue;
            }

            values[count++] = sourceColumn[rowIndex];
        }

        gatheredValueCount = count;

        return values;
    };

    /**
     * Gets a group's compressed values to aggregate for First, Last or Median with a "with respect
     * to" column, which is read as an ordering rather than something to deduplicate by.  Every row
     * contributes a value, and its wrt-column value is gathered into the order-key buffer at the
     * same position.
     */
    const getCompressedValuesToAggregate_ordered = (columnIndex, wrtColumnIndex, group, compiledFilter, isOutermostGrouping, hasFilter) => {

        // A row is excluded where its stamp matches the epoch captured straight after marking.
        const hasOuterFilterExclusions = markRowsExcludedByOuterFilter(group, isOutermostGrouping) > 0;
        const outerExclusionStampArray = outerExclusionStamp;
        const outerExclusionMark = outerExclusionEpoch;

        // Which rows to read, with any data-row filter already applied.  A null buffer means the
        // row index is the position itself.
        resolveRowsToAggregate(group, isOutermostGrouping, compiledFilter, hasFilter);

        const sourceBuffer = resolvedRowsBuffer;
        const sourceStart = resolvedRowsStart;
        const sourceCount = resolvedRowsCount;
        const useAllRows = sourceBuffer === null;

        const transformedColumn = getTransformedColumn(columnIndex);
        const sourceColumn = transformedColumn ? transformedColumn : tabularData.getColumnCV(columnIndex);
        const orderColumn = tabularData.getColumnCV(wrtColumnIndex);

        const values = getGatherBuffer(sourceCount);
        const orderKeys = getOrderKeyBuffer(sourceCount);
        let count = 0;

        for (let i = 0; i < sourceCount; i++) {

            const rowIndex = useAllRows ? i : sourceBuffer[sourceStart + i];

            if (hasOuterFilterExclusions && outerExclusionStampArray[rowIndex] === outerExclusionMark) continue;

            orderKeys[count] = orderColumn[rowIndex];
            values[count++] = sourceColumn[rowIndex];
        }

        gatheredValueCount = count;
        gatheredOrderKeys = orderKeys;

        return values;
    };

    const getCompressedValuesToAggregate = (columnIndex, wrtColumnIndex, group, compiledFilter, isOutermostGrouping, hasFilter, aggType) => {

        // First, Last and Median read the "with respect to" column as the order to pick a value
        // from, rather than as a column to collapse duplicate rows by.
        if (wrtColumnIndex != null && isOrderedAggregation(aggType)) {

            return getCompressedValuesToAggregate_ordered(columnIndex, wrtColumnIndex, group, compiledFilter, isOutermostGrouping, hasFilter);
        }

        gatheredOrderKeys = null;

        if (wrtColumnIndex == null) {

            return getCompressedValuesToAggregate_noWrt(columnIndex, group, compiledFilter, isOutermostGrouping, hasFilter);
        }
        else {

            return getCompressedValuesToAggregate_wrt(columnIndex, wrtColumnIndex, group, compiledFilter, isOutermostGrouping, hasFilter);
        }
    };

    /**
     * Set-based distinct count over a group's rows, reading the source column directly (no
     * intermediate values array).  Matches the general countDistinct's null/empty handling exactly.
     */
    const countDistinctWithSet = (
        columnCVs, useAllRows, buffer, start, n,
        hasOuterFilterExclusions, outerExclusionStampArray, outerExclusionMark
    ) => {

        const distinct = new Set();

        for (let i = 0; i < n; i++) {

            const rowIndex = useAllRows ? i : buffer[start + i];

            if (hasOuterFilterExclusions && outerExclusionStampArray[rowIndex] === outerExclusionMark) continue;

            const value = columnCVs[rowIndex];
            if (Ren.IsNullOrEmpty(value)) continue;

            distinct.add(value);
        }

        return distinct.size.toString();
    };

    /**
     * Fused CountDistinct: counts a column's distinct values across a group's rows in a single
     * pass, without materialising the intermediate values array.  A dense Int32Array column is
     * counted by stamping the seen-array by dictionary index, since every value is a valid, non
     * null-or-empty index; any other column through a Set (see countDistinctWithSet).
     *
     * @returns {string} The distinct count, as a string (matching the general countDistinct).
     */
    const countDistinctFused = (columnIndex, group, isOutermostGrouping, compiledFilter, hasFilter, columnCVs) => {

        // A row is excluded where its stamp matches the epoch captured straight after marking.
        const hasOuterFilterExclusions = markRowsExcludedByOuterFilter(group, isOutermostGrouping) > 0;
        const outerExclusionStampArray = outerExclusionStamp;
        const outerExclusionMark = outerExclusionEpoch;

        // Which rows to read, with any data-row filter already applied.  A null buffer means the
        // row index is the position itself.
        resolveRowsToAggregate(group, isOutermostGrouping, compiledFilter, hasFilter);

        const buffer = resolvedRowsBuffer;
        const start = resolvedRowsStart;
        const n = resolvedRowsCount;
        const useAllRows = buffer === null;

        if (columnCVs instanceof Int32Array && dictionaryHasEntries()) {

            const seen = getDistinctSeenArray();
            const epoch = ++distinctEpoch;
            let count = 0;

            for (let i = 0; i < n; i++) {

                const rowIndex = useAllRows ? i : buffer[start + i];

                if (hasOuterFilterExclusions && outerExclusionStampArray[rowIndex] === outerExclusionMark) continue;

                const value = columnCVs[rowIndex];

                // A value outside the dictionary range can't be stamped in the seen array, so fall
                // back to the Set path for this group rather than miscount.
                if (value < 0 || value >= seen.length) {

                    return countDistinctWithSet(
                        columnCVs,
                        useAllRows,
                        buffer,
                        start,
                        n,
                        hasOuterFilterExclusions,
                        outerExclusionStampArray,
                        outerExclusionMark
                    );
                }

                if (seen[value] !== epoch) {

                    seen[value] = epoch;
                    count++;
                }
            }

            return count.toString();
        }

        return countDistinctWithSet(
            columnCVs,
            useAllRows,
            buffer,
            start,
            n,
            hasOuterFilterExclusions,
            outerExclusionStampArray,
            outerExclusionMark
        );
    };

    /**
     * Gets the aggregated value for the specified column.
     */
    const getAggregatedValue = (
        columnIndex,
        group,
        isOutermostGrouping,
        aggType,
        wrtColumnIndex,
        compiledFilter,
        hasFilter,
        calcFunctions
    ) => {

        // CountDistinct fast path: with no with-respect-to column, count in a single fused pass.
        if (aggType === Ren.AggregationTypeEnum.CountDistinct && wrtColumnIndex == null) {

            // A calc'd column's transformed values are in the same compressed form as the source
            // column's, so they are counted the same way.
            const transformedColumn = getTransformedColumn(columnIndex);

            return countDistinctFused(
                columnIndex,
                group,
                isOutermostGrouping,
                compiledFilter,
                hasFilter,
                transformedColumn ?? tabularData.getColumnCV(columnIndex)
            );
        }

        const compressedValuesToAggregate = getCompressedValuesToAggregate(
            columnIndex,
            wrtColumnIndex,
            group,
            compiledFilter,
            isOutermostGrouping,
            hasFilter,
            aggType
        );

        // The gather writes into a reused buffer, so this group's value count is read from
        // gatheredValueCount rather than the buffer's length.  The order keys are null unless the
        // gather was the ordered one.
        const valueCount = gatheredValueCount;
        const orderKeys = gatheredOrderKeys;

        if (calcFunctions ||
            (isNumericAggregation(aggType) && aggregatesCalculatedNumbers(columnIndex))) {

            uncompressedAggFuncs ??= Ren.AggregationFns(null);

            return uncompressedAggFuncs.aggFunc(null, aggType)(
                decompressValuesToNumbers(
                    compressedValuesToAggregate,
                    valueCount,
                    columnIndex,
                    calcFunctions
                ),
                columnIndex,
                0,
                valueCount,
                group.groupRowIndex,
                isOutermostGrouping,
                orderKeys
            );
        }

        const valuesToAggregate =
            isOrderedByValueAggregation(aggType) && transformedColumnHasAppendedValues(columnIndex)
                ? decompressValuesToAggregate(compressedValuesToAggregate, valueCount, columnIndex)
                : compressedValuesToAggregate;

        return aggregate(
            valuesToAggregate,
            valueCount,
            columnIndex,
            aggType,
            group,
            isOutermostGrouping,
            orderKeys
        );
    };

    return {
        callAggFunc,
        getAggregatedValue,
        getPerValueCalcFunctions,
        getRowNumberReader,
        ignoresCalcFunction
    };
};
