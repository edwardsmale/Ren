Ren.Grouping_Functions = (() => {

    /**
     * Creates an array of booleans, where each entry is true if the column at that index is a
     * group-by column.
     */
    const createIsGroupByColumnArray = (groupByColumnIndexes, columnCount) => {

        const groupBySet = new Set(groupByColumnIndexes);
        const isGroupByColumn = new Array(columnCount);

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
            isGroupByColumn[columnIndex] = groupBySet.has(columnIndex);
        }

        return isGroupByColumn;
    };

    /**
     * Compiles the groupByCalcFunctions specs, with null for a column without one.
     */
    const createCompiledCalcFunctions = (groupByCalcFunctions, paras) => {

        if (!groupByCalcFunctions || !Array.isArray(groupByCalcFunctions)) {
            return null;
        }

        return groupByCalcFunctions.map(spec => {

            if (!spec) return null;

            try {

                return Ren.FormatFunctions.createFunction(spec, paras);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[Grouping] Error creating groupByCalcFunction:",
                    e
                );

                return null;
            }
        });
    };

    /**
     * Applies calc functions to a row's group-by column values, decompressing them first where
     * tabularData is given.
     */
    const applyCalcFunctionsToGroupByValues = (valuesInRow, groupByColumnIndexes, compiledCalcFunctions, tabularData) => {

        const transformedValues = new Array(groupByColumnIndexes.length);

        for (let j = 0; j < groupByColumnIndexes.length; j++) {

            const columnIndex = groupByColumnIndexes[j];
            const value = valuesInRow[columnIndex];

            const decompressedValue = tabularData
                ? tabularData.CompressionDictionary.decompressValue(value, columnIndex)
                : value;

            if (compiledCalcFunctions && compiledCalcFunctions[j]) {

                try {

                    transformedValues[j] = compiledCalcFunctions[j](decompressedValue, null, null, null, null);
                }
                catch (e) {

                    Ren.GlobalErrorHandler.logError(
                        "[Grouping] Error applying groupByCalcFunction:",
                        e
                    );

                    transformedValues[j] = decompressedValue;
                }
            }
            else {

                transformedValues[j] = decompressedValue;
            }
        }

        return transformedValues;
    };

    /**
     * Groups the data rows by their group-by column values, returning { groupIds,
     * transformedValuesPerRow }, the latter null unless there are calc functions.
     */
    const groupDataRows = (valuesInRows, groupByColumnIndexes, startGroupId, groupByCalcFunctions, tabularData, paras) => {

        const map = new Map();
        const n = valuesInRows.length;

        // Retained for the life of the report at every grouping level, so held densely.
        const groupIds = new Int32Array(n);
        let groupId = startGroupId;

        const compiledCalcFunctions = createCompiledCalcFunctions(groupByCalcFunctions, paras);
        const hasCalcFunctions = compiledCalcFunctions && compiledCalcFunctions.some(f => f !== null);

        const transformedValuesPerRow = hasCalcFunctions ? new Array(n) : null;

        const groupByColumnCount = groupByColumnIndexes.length;

        // The hashing strategy is picked once, with a dedicated loop per case, rather than per row.

        if (groupByColumnCount === 0) {

            for (let i = 0; i < n; i++) {
                groupIds[i] = groupId;
            }

            return { groupIds, transformedValuesPerRow };
        }

        const sep = '\u0001'; // Non-printable separator.

        if (hasCalcFunctions) {

            // A calc function is a pure function of its value, so the outcome is cached against the
            // raw group-by values: "by quarter" is millions of rows over a few dozen dates.  The
            // cached arrays are shared between rows, which is safe as only a group's first is read.
            const entriesByRawKey = new Map();

            // Several columns are keyed as the composite hash below is, conflating values
            // as it does.
            const singleGroupByColumnIndex = groupByColumnCount === 1 ? groupByColumnIndexes[0] : -1;

            for (let i = 0; i < n; i++) {

                const valuesInRow = valuesInRows[i];

                let rawKey;

                if (singleGroupByColumnIndex !== -1) {

                    rawKey = valuesInRow[singleGroupByColumnIndex];
                }
                else {

                    rawKey = "";

                    for (let k = 0; k < groupByColumnCount; k++) {
                        rawKey += valuesInRow[groupByColumnIndexes[k]] + sep;
                    }
                }

                let entry = entriesByRawKey.get(rawKey);

                if (entry === undefined) {

                    const transformedValues = applyCalcFunctionsToGroupByValues(
                        valuesInRow,
                        groupByColumnIndexes,
                        compiledCalcFunctions,
                        tabularData,
                        i
                    );

                    let hash;

                    if (transformedValues.length === 1) {

                        hash = String(transformedValues[0] ?? "");
                    }
                    else {

                        hash = "";

                        for (let k = 0; k < transformedValues.length; k++) {
                            hash += String(transformedValues[k] ?? "") + sep;
                        }
                    }

                    let id = map.get(hash);

                    if (id === undefined) {

                        id = groupId++;
                        map.set(hash, id);
                    }

                    entry = { id, transformedValues };
                    entriesByRawKey.set(rawKey, entry);
                }

                groupIds[i] = entry.id;
                transformedValuesPerRow[i] = entry.transformedValues;
            }

            return { groupIds, transformedValuesPerRow };
        }

        if (groupByColumnCount === 1) {

            const columnIndex = groupByColumnIndexes[0];

            // A compressed column's values are dictionary indexes, so a group ID is looked up in a
            // flat array rather than hashed, where that is no bigger than the rows it serves.  A
            // value that is not a usable index (an aggregated literal, a null) falls through to
            // the map.
            const dictionarySize = tabularData?.IsColumnCompressed?.[columnIndex]
                ? (tabularData.CompressionDictionary?.dictionarySize ?? 0)
                : 0;

            // Entries hold the group ID offset by startGroupId and biased by one, so that zero (the
            // array's initial state) means "no group yet".
            const idByValue = (dictionarySize > 0 && dictionarySize <= n)
                ? new Int32Array(dictionarySize)
                : null;

            for (let i = 0; i < n; i++) {

                const hash = valuesInRows[i][columnIndex];

                if (idByValue !== null && typeof hash === "number"
                    && hash >= 0 && hash < dictionarySize && (hash | 0) === hash) {

                    const storedId = idByValue[hash];

                    if (storedId !== 0) {

                        groupIds[i] = storedId - 1 + startGroupId;
                        continue;
                    }

                    const newId = groupId++;

                    idByValue[hash] = newId - startGroupId + 1;
                    groupIds[i] = newId;
                    continue;
                }

                let id = map.get(hash);

                if (id === undefined) {

                    id = groupId++;
                    map.set(hash, id);
                }

                groupIds[i] = id;
            }

            return { groupIds, transformedValuesPerRow };
        }

        // Multiple group-by columns: build a composite hash from the column values.
        for (let i = 0; i < n; i++) {

            const valuesInRow = valuesInRows[i];

            let hash = "";

            for (let k = 0; k < groupByColumnCount; k++) {
                hash += valuesInRow[groupByColumnIndexes[k]] + sep;
            }

            let id = map.get(hash);

            if (id === undefined) {

                id = groupId++;
                map.set(hash, id);
            }

            groupIds[i] = id;
        }

        return { groupIds, transformedValuesPerRow };
    };

    return {
        createIsGroupByColumnArray,
        groupDataRows,
        createCompiledCalcFunctions,
        applyCalcFunctionsToGroupByValues
    };
})();

/**
 * A 'grouping', which is comprised of a group-by columns array and a sort order.
 */
Ren.Grouping = (
    groupingIndex,
    columnCount,
    valuesInRows,
    groupByColumnIndexes,
    startGroupId,
    childGroupingIndex,
    _columns,
    groupByCalcFunctions,
    tabularData,
    filterSet,
    paras,
    precomputedGroupResult) => {

    const parentGroupingIndex = groupingIndex + 1;

    const isOutermostGrouping = groupByColumnIndexes.length === 0;

    const isGroupByColumn = Ren.Grouping_Functions.createIsGroupByColumnArray(
        groupByColumnIndexes,
        columnCount
    );

    /**
     * Per-column flags, true for a column whose group rows hold a value appended to the compression
     * dictionary out of sorted order, so its compressed values must be decompressed to be compared.
     */
    const columnsWithAppendedValues = new Array(columnCount);

    /**
     * The group ID for each row index, plus optional transformed values.  Grouping never depends on
     * a filter, so a caller already holding this result passes it in.
     */
    const groupResult = precomputedGroupResult ?? Ren.Grouping_Functions.groupDataRows(
        valuesInRows,
        groupByColumnIndexes,
        startGroupId,
        groupByCalcFunctions,
        tabularData,
        paras
    );

    const _groupIds = groupResult.groupIds;
    let _transformedValuesPerRow = groupResult.transformedValuesPerRow;

    const groupIds = () => _groupIds;
    const transformedValuesPerRow = () => _transformedValuesPerRow;

    /**
     * Releases the per-row transformed group-by values, which are only needed while the factory
     * builds the groups.
     */
    const clearTransformedValuesPerRow = () => {

        _transformedValuesPerRow = null;
    };

    let _groups = new Map();
    let _groupsValues = [];
    let _lastGroupId = null;
    let _lastGroupRowIndex = null;
    let _groupRowIndexMap = new Map();
    let _containedGroupParentMap = new Map();

    const setGroups = (newGroups) => {

        _groups = newGroups;

        const size = _groups.size;
        _groupsValues = new Array(size);
        _groupRowIndexMap.clear();
        _containedGroupParentMap.clear();

        let i = 0;
        let lastGroup = null;
        let lastGroupId = null;

        _groups.forEach((group, groupId) => {

            _groupsValues[i++] = group;
            _groupRowIndexMap.set(group.groupRowIndex, group);

            // Keys are read straight off the map, avoiding an array of them per group.
            group.containedGroups.forEach((containedGroup, containedGroupId) => {

                _containedGroupParentMap.set(containedGroupId, group);
            });

            lastGroup = group;
            lastGroupId = groupId;
        });

        if (size === 0) {

            _lastGroupRowIndex = -1;
            _lastGroupId = null;
            return;
        }

        _lastGroupRowIndex = lastGroup.groupRowIndex;
        _lastGroupId = lastGroupId;
    };

    const groups = () => _groups;
    const numGroups = () => _groups.size;

    const firstGroup = () => _groupsValues[0];
    const lastGroupId = () => _lastGroupId;

    const sortOrder = {
        columnIndex: -1,
        isDescending: false,
        sortCalcFunction: null,
        thenBy: null
    };

    /**
     * Sets the sort order for this grouping's groups.  thenBy is an optional array of tie-breaking
     * levels ({ columnIndex, isDescending, sortCalcFunction }); omitting it clears any existing
     * ones.
     */
    const setSortOrder = (columnIndex, isDescending, sortCalcFunction, thenBy) => {

        sortOrder.columnIndex = columnIndex;
        sortOrder.isDescending = isDescending;
        sortOrder.sortCalcFunction = sortCalcFunction ?? null;
        sortOrder.thenBy = (thenBy && thenBy.length) ? thenBy : null;
        delete sortOrder._compiledSortCalcFunctions;
    };

    /**
     * The columns that are part of this grouping, mapping column ID/heading to its settings.
     */
    const columns = _columns ?? {};

    /**
     * Gets the maximum row index of the group rows created for the grouping.
     */
    const lastGroupRowIndex = () => _lastGroupRowIndex;

    /**
     * Gets the group containing the given row.
     */
    const getGroupContainingRow = (rowIndex) => _groupsValues[_groupIds[rowIndex]];

    /**
     * Gets the group containing the given group.
     */
    const getGroupContainingGroup = (groupIndex) => _containedGroupParentMap.get(groupIndex) || null;

    /**
     * Gets the group object that creates the given (group) row.
     */
    const getGroupWithRowIndex = (rowIndex) => _groupRowIndexMap.get(rowIndex) || null;

    // Null for a column with no aggregated value, such as a group-by or NoTotal column.
    let _columnAggregationTypes = [];

    const setColumnAggregationTypes = (columnAggregationTypes) => {

        _columnAggregationTypes = columnAggregationTypes;
    };

    /**
     * Gets the aggregation type a column's group row values were made with, or null where they
     * aren't aggregated.
     */
    const getColumnAggregationType = (columnIndex) => _columnAggregationTypes[columnIndex] ?? null;

    return {
        childGroupingIndex,
        clearTransformedValuesPerRow,
        columns,
        columnsWithAppendedValues,
        filterSet,
        firstGroup,
        getColumnAggregationType,
        getGroupContainingGroup,
        getGroupContainingRow,
        getGroupWithRowIndex,
        groupByColumnIndexes,
        groupByCalcFunctions,
        groupIds,
        groupingIndex,
        groups,
        isGroupByColumn,
        isOutermostGrouping,
        lastGroupId,
        lastGroupRowIndex,
        numGroups,
        parentGroupingIndex,
        setColumnAggregationTypes,
        setGroups,
        setSortOrder,
        sortOrder,
        transformedValuesPerRow
    };
};
