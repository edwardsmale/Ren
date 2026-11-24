Ren.GroupingFactory = (tabularData, dataGroupingSettings, aggregation) => {

    // Gets the report parameters that the group-by calc functions can read as paras.
    const getParas = () => Ren.ReportInputParameters.getInputParametersForGuid(
        dataGroupingSettings.containingReportGuid
    );

    /**
     * Glossary:
     *
     * Grouping: Holds properties such as which columns are being grouped by.
     *
     * Groupings: An array of 'grouping' objects.  To support multiple levels of grouping.
     *
     * Outermost Grouping: A 'grouping' that is applied last.  Contains a single 'group', which
     * includes all child rows (either 'data rows' or 'group rows').  This is used to create
     * for the totals row, and to apply sorting/filtering etc to the entire dataset.
     *
     * Group: A set of rows in a 'grouping' that share the same values in the group-by columns.
     * A 'grouping' has a Map of 'groups', where the key is the group index and the value is the
     * group object.
     *
     * Group row: A row that is created for a 'group', containing aggregated values (summarising
     * its contained rows).
     *
     * Data row: A row in the original data set (as opposed to a 'group row').
     *
     * Group row index: The row index (not including headings) of a 'group row'.
     */

    /**
     * Gets any aggregation types specified in the SQl query.
     */
    const columnModelAggTypes = tabularData.ColumnModels.map(c => c.AggregationType);

    /**
     * Gets any aggregation type 'with respect to' values specified in the SQl query.
     */
    const columnModelAggregateWithRespectTos = tabularData.ColumnModels.map(c => c.AggregateWithRespectTo);

    // Leaf groups never gain child groups, so they all share this one empty map rather than each
    // allocating their own.  Only groupings built from a child grouping populate containedGroups,
    // and they assign a fresh Map per group before writing to it.
    const EMPTY_CONTAINED_GROUPS = new Map();

    /**
     * Gets one array holding every row model's own compressed values, in row order.
     *
     * Where no calc function replaces a group-by value this array is the same for every grouping
     * ever built over this data - it holds pointers to the row models' arrays and nothing writes
     * through it - so it is built once and kept on the tabular data.
     *
     * The cache is keyed on the row models array itself, so replacing the rows - or filtering rows
     * out of them in place, which changes the length - rebuilds it.
     */
    const getSharedValuesInRows = () => {

        const rowModels = tabularData.RowModels;
        const rowCount = rowModels.length;
        const cached = tabularData._sharedValuesInRows;

        if (cached && cached.rowModels === rowModels && cached.valuesInRows.length === rowCount) {

            return cached.valuesInRows;
        }

        const valuesInRows = new Array(rowCount);

        for (let i = 0; i < rowCount; i++) {

            valuesInRows[i] = rowModels[i].CV;
        }

        tabularData._sharedValuesInRows = { rowModels, valuesInRows };

        return valuesInRows;
    };

    /**
     * Lays out one shared Int32Array for the whole grouping as contiguous per-group buckets, sized
     * from each group's already-tallied containedRowIndexCount, and points every group at its
     * bucket via containedRowIndexBuffer/containedRowIndexStart.  Row indexes are then written
     * straight into this buffer, so no transient per-group arrays are ever built or copied.
     *
     * Returns a cursor Int32Array, indexed by a group's local ID (groupId - startGroupId, which is
     * dense since group ids are assigned sequentially from startGroupId), initialised to each
     * group's bucket start.  A caller advances cursor[localId] as it writes row indexes.
     */
    const allocateContainedRowIndexBuckets = (groupsMap, startGroupId) => {

        let total = 0;
        groupsMap.forEach(group => { total += group.containedRowIndexCount; });

        const sharedBuffer = new Int32Array(total);
        const cursor = new Int32Array(groupsMap.size);
        let offset = 0;

        groupsMap.forEach((group, groupId) => {

            group.containedRowIndexBuffer = sharedBuffer;
            group.containedRowIndexStart = offset;
            group.containedRowIndexes = null; // No transient build array is used.

            cursor[groupId - startGroupId] = offset;
            offset += group.containedRowIndexCount;
        });

        return { sharedBuffer, cursor };
    };

    /**
     * Creates an empty group object.
     */
    const createGroup = (groupRowIndex, groupLevel) => {

        // containedGroups is only populated for non-leaf groups, so it defaults to a shared empty
        // map; groupings built from a child grouping replace it with their own.
        // containedRowIndexes is populated for every group with its descendant data rows, except
        // the outermost grouping's group, where it is a lazily-built range.

        return {
            groupRowIndex,
            groupLevel,
            // Row membership is tallied into containedRowIndexCount, then the row indexes are
            // written straight into the grouping's shared buffer; the fields below carry it, and
            // containedRowIndexes stays null.
            containedRowIndexes: null,
            containedRowIndexBuffer: null,
            containedRowIndexStart: 0,
            containedRowIndexCount: 0,
            containedGroups: EMPTY_CONTAINED_GROUPS,
            groupByColumnValues: [],
            formattedRowValues: [],
            // A group row's values are not held on the group: they live in one array per column,
            // shared by every group in the grouping, and the group is a position within them, so a
            // value is reached as group.groupValues.get(group.position, columnIndex).
            groupValues: null,
            position: -1,
            sortOrder: {
                columnIndex: -1,
                isDescending: false
            },
            summaryStats: [],
            // Statistics over group row values, read by group row style functions (see
            // Ren.SummaryStats' getGroupRowStatsTarget).
            childGroupRowSummaryStats: null,
            ownGroupRowSummaryStats: null
        };
    };

    /**
     * Installs a lazily-materialised containedRowIndexes on the outermost grouping's group(s).  The
     * outermost group always spans every data row, so rather than retain a full-length index copy
     * the getter builds the 0..rowCount-1 range only if something reads it, and caches it
     * thereafter.  Aggregation iterates all rows directly, so usually no array is ever allocated.
     */
    const installAllRowsRangeGetter = (groupsMap) => {

        const rowCount = tabularData.RowModels.length;

        groupsMap.forEach(group => {

            let cached = null;

            group.containedRowIndexes = null;
            group.containedRowIndexStart = 0;
            group.containedRowIndexCount = rowCount;

            // The outermost group spans every row, so its buffer is the identity range
            // 0..rowCount-1.  Almost nothing reads it, so build it lazily and cache it.
            Object.defineProperty(group, "containedRowIndexBuffer", {
                configurable: true,
                enumerable: true,
                get() {

                    if (cached === null) {

                        cached = new Int32Array(rowCount);

                        for (let r = 0; r < rowCount; r++) {

                            cached[r] = r;
                        }
                    }

                    return cached;
                },
                set(value) {

                    cached = value;
                }
            });
        });
    };

    /**
     * Builds the list of the columns that a value is written to, each carrying what writing it
     * needs, so that the loop over the groups does not work any of it out again for every group.
     * A column with no aggregated value is left out of the list rather than reached and skipped
     * once per group: on a derived settings that is most of the columns.
     */
    const buildColumnWritePlan = (grouping, columnAggTypes, columnAggregateWithRespectTos) => {

        const columnCount = tabularData.ColumnModels.length;
        const isGroupByColumn = grouping.isGroupByColumn;
        const groupByColumnIndexes = grouping.groupByColumnIndexes;
        const aggregatedColumnIndexes = dataGroupingSettings.aggregatedColumnIndexes;
        const isColumnCompressed = tabularData.IsColumnCompressed;

        const writePlan = [];

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

            const isCompressed = !!(isColumnCompressed && isColumnCompressed[columnIndex]);

            if (isGroupByColumn[columnIndex]) {

                writePlan.push({
                    columnIndex,
                    isCompressed,
                    isGroupBy: true,
                    positionInGroupBy: groupByColumnIndexes.indexOf(columnIndex),
                    aggType: null,
                    aggregateWithRespectTo: null
                });

                continue;
            }

            const isAggregated =
                !aggregatedColumnIndexes || aggregatedColumnIndexes.has(columnIndex);

            // Nothing is stored for a column with no aggregated value: the store reads an unwritten
            // column as an empty string, so it costs nothing rather than one entry per group.
            if (!isAggregated || columnAggTypes[columnIndex] === Ren.AggregationTypeEnum.NoTotal) {
                continue;
            }

            writePlan.push({
                columnIndex,
                isCompressed,
                isGroupBy: false,
                positionInGroupBy: -1,
                aggType: columnAggTypes[columnIndex],
                aggregateWithRespectTo: columnAggregateWithRespectTos[columnIndex]
            });
        }

        return writePlan;
    };

    /**
     * Goes through the groups and populates them with values for each column.  For group-by columns
     * the column value will be a single value; other columns will have aggregated values.
     *
     * @param {boolean} useTransformedGroupByValues - If true, use the transformed values from
     *   groupByCalcFunctions.
    */
    const populateGroupColumnValues = (grouping, groupsMap, columns, useTransformedGroupByValues) => {

        const columnCount = tabularData.ColumnModels.length;
        const isOutermostGrouping = grouping.isOutermostGrouping;

        const aggMerge = dataGroupingSettings.mergeColumnAggTypes(
            columnModelAggTypes,
            columnModelAggregateWithRespectTos,
            columns
        );

        const compiledFilter = Ren.Filter.createCompiledFilter(tabularData, dataGroupingSettings);

        const hasFilter = !!compiledFilter;

        // Group rows store compressed values, as data rows do, so that they share the source's
        // compression rather than holding duplicate literal strings.  Where client values do not
        // exist in the dictionary, they are added, so that a compressed column's group rows always
        // contain dictionary indexes and not actual values.
        const internDerivedValue = tabularData.CompressionDictionary.internDerivedValue;
        const compressValue = tabularData.CompressionDictionary.compressValue;
        const markIfAppended = tabularData.CompressionDictionary.markIfAppended;
        const appendedColumns = grouping.columnsWithAppendedValues;

        const writePlan = buildColumnWritePlan(
            grouping,
            aggMerge.columnAggTypes,
            aggMerge.columnAggregateWithRespectTos
        );

        const writeCount = writePlan.length;

        const columnAggregationTypes = new Array(columnCount).fill(null);

        for (let i = 0; i < writeCount; i++) {

            if (!writePlan[i].isGroupBy) {
                columnAggregationTypes[writePlan[i].columnIndex] = writePlan[i].aggType;
            }
        }

        grouping.setColumnAggregationTypes(columnAggregationTypes);

        const groupCount = groupsMap.size;

        const groupValues = Ren.GroupRowValues(
            columnCount,
            groupCount,
            tabularData.IsColumnCompressed
        );

        // The groups are taken into an array first so that the values can be written a column at a
        // time afterwards, which is the shape the store holds them in.  That keeps the per-column
        // facts - which aggregation, which position in the group-by - outside the loop over the
        // groups, and reads one column's values through to the end before starting the next.
        const groups = new Array(groupCount);

        let position = 0;

        groupsMap.forEach(group => {

            group.groupValues = groupValues;
            group.position = position;
            groups[position] = group;
            position++;
        });

        // The columns whose calc function is applied to each value before aggregating them rather
        // than to the aggregated value (see Ren.Aggregation's getPerValueCalcFunctions), which
        // applyCalcFunctionsToGroups is to leave alone.
        const columnsCalculatedPerValue = new Set();
        grouping.columnsCalculatedPerValue = columnsCalculatedPerValue;

        const paras = getParas();

        for (let writeIndex = 0; writeIndex < writeCount; writeIndex++) {

            const write = writePlan[writeIndex];
            const columnIndex = write.columnIndex;
            const isCompressed = write.isCompressed;
            const positionInGroupBy = write.positionInGroupBy;
            const columnValues = new Array(groupCount);

            if (write.isGroupBy) {

                for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {

                    const group = groups[groupIndex];

                    const transformedGroupByColumnValues = useTransformedGroupByValues
                        ? group.transformedGroupByColumnValues
                        : null;

                    let rowValue;

                    if (transformedGroupByColumnValues) {

                        // Transformed group-by values are decompressed display values, so they are
                        // interned like any other derived value: a binning function returning a
                        // number would otherwise be indistinguishable from a dictionary index.
                        rowValue = transformedGroupByColumnValues[positionInGroupBy];

                        if (isCompressed) {

                            rowValue = internDerivedValue(rowValue, columnIndex, appendedColumns);
                        }
                    }
                    else {

                        // The group-by value already originates from the source's compressed column
                        // values, so it is kept in that form.  It is not interned: where it is a
                        // number it is a dictionary index already.  It is still passed through
                        // compressValue for a value that reached the rows uncompressed, and marked
                        // where it is an index a data row calc function's result was appended at.
                        rowValue = markIfAppended(
                            compressValue(
                                group.groupByColumnValues[positionInGroupBy],
                                columnIndex
                            ),
                            columnIndex,
                            appendedColumns
                        );
                    }

                    columnValues[groupIndex] = rowValue;
                }
            }
            else {

                const aggType = write.aggType;
                const aggregateWithRespectTo = write.aggregateWithRespectTo;

                const calcFunctions =
                    aggregation.getPerValueCalcFunctions(columnIndex, columns, aggType, paras);

                if (calcFunctions) columnsCalculatedPerValue.add(columnIndex);

                for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {

                    // Non-group-by column, so add the aggregated value, compressed - and interned
                    // where the dictionary does not hold it already, as a multi-value aggregation
                    // such as Concatenate or DistinctValues produces.
                    let rowValue = aggregation.getAggregatedValue(
                        columnIndex,
                        groups[groupIndex],
                        isOutermostGrouping,
                        aggType,
                        aggregateWithRespectTo,
                        compiledFilter,
                        hasFilter,
                        calcFunctions
                    );

                    if (isCompressed) {

                        rowValue = internDerivedValue(rowValue, columnIndex, appendedColumns);
                    }

                    columnValues[groupIndex] = rowValue;
                }
            }

            groupValues.setColumn(columnIndex, columnValues);
        }
    };

    /**
     * Captures the parts of a built grouping that no filter can change: which row (or child group)
     * belongs to which group, and each group's position, group-by values and slice of the shared
     * contained-row-index buffer.  Group formation reads only the values being grouped, so a
     * rebuild prompted by a filter change produces exactly this structure again, and reusing it
     * leaves only the aggregated values to be recomputed.
     */
    const captureGroupingStructure = (groupsMap, groupIds, hasTransformedValues, sharedBuffer) => {

        const groupCount = groupsMap.size;

        const structure = {
            groupIds,
            hasTransformedValues,
            transformedDataColumns: null,
            groupIdsInOrder: new Int32Array(groupCount),
            groupRowIndexes: new Int32Array(groupCount),
            groupByColumnValues: new Array(groupCount),
            transformedGroupByColumnValues: hasTransformedValues ? new Array(groupCount) : null,
            containedRowIndexBuffer: sharedBuffer,
            containedRowIndexStarts: new Int32Array(groupCount),
            containedRowIndexCounts: new Int32Array(groupCount)
        };

        let position = 0;

        groupsMap.forEach((group, groupId) => {

            structure.groupIdsInOrder[position] = groupId;
            structure.groupRowIndexes[position] = group.groupRowIndex;
            structure.groupByColumnValues[position] = group.groupByColumnValues;

            if (hasTransformedValues) {

                structure.transformedGroupByColumnValues[position] =
                    group.transformedGroupByColumnValues;
            }

            structure.containedRowIndexStarts[position] = group.containedRowIndexStart;
            structure.containedRowIndexCounts[position] = group.containedRowIndexCount;
            position++;
        });

        return structure;
    };

    /**
     * Rebuilds a grouping's groups from a cached structure.  The group objects themselves are new
     * each time - the values they hold are the aggregated ones, which the filter does change, and
     * several visualisations' groupings are live at once - but they point at the cached buffers and
     * group-by values rather than allocating and filling their own.
     */
    const restoreGroupsFromStructure = (structure, groupLevel, needsContainedGroups) => {

        const groupIdsInOrder = structure.groupIdsInOrder;
        const groupCount = groupIdsInOrder.length;
        const transformedGroupByColumnValues = structure.transformedGroupByColumnValues;
        const sharedBuffer = structure.containedRowIndexBuffer;
        const groupsMap = new Map();

        for (let position = 0; position < groupCount; position++) {

            const group = createGroup(structure.groupRowIndexes[position], groupLevel);

            group.groupByColumnValues = structure.groupByColumnValues[position];

            if (transformedGroupByColumnValues !== null) {

                group.transformedGroupByColumnValues =
                    transformedGroupByColumnValues[position];
            }

            if (needsContainedGroups) {
                group.containedGroups = new Map();
            }

            group.containedRowIndexBuffer = sharedBuffer;
            group.containedRowIndexStart = structure.containedRowIndexStarts[position];
            group.containedRowIndexCount = structure.containedRowIndexCounts[position];

            groupsMap.set(groupIdsInOrder[position], group);
        }

        return groupsMap;
    };

    /**
     * Gets the cached structure held in the given slot, where it matches the number of rows (or
     * child groups) about to be grouped.  A mismatch means the data behind it has changed, so it is
     * ignored and the grouping is built from scratch.
     */
    const getCachedStructure = (structureSlot, expectedGroupIdCount) => {

        if (!structureSlot || !structureSlot.structure) {
            return null;
        }

        const structure = structureSlot.structure;

        return structure.groupIds.length === expectedGroupIdCount ? structure : null;
    };

    /**
     * Creates the first grouping from a cached structure, recomputing only the values that a
     * filter change can alter: each group's aggregated values.
     */
    const createGroupingFromDataRowStructure = (
        structure,
        groupingIndex,
        groupByColumnIndexes,
        groupLevel,
        startGroupId,
        columns,
        groupByCalcFunctions,
        filterSet) => {

        // The transformed data columns are a function of the data rows and the settings' calc
        // functions, both of which the structure's key covers, so they are cached alongside it.
        dataGroupingSettings.transformedDataColumns = structure.transformedDataColumns;

        const grouping = Ren.Grouping(
            groupingIndex,
            tabularData.ColumnModels.length,
            null, // The cached group ids stand in for grouping the rows, which aren't read.
            groupByColumnIndexes,
            startGroupId,
            null, // childGroupingIndex
            columns,
            groupByCalcFunctions,
            tabularData,
            filterSet,
            getParas(),
            { groupIds: structure.groupIds, transformedValuesPerRow: null }
        );

        const groups = restoreGroupsFromStructure(structure, groupLevel, false);

        populateGroupColumnValues(grouping, groups, columns, structure.hasTransformedValues);
        Ren.CalcFunctionsApplyer.applyCalcFunctionsToGroups(
            groups,
            columns,
            tabularData,
            grouping.columnsWithAppendedValues,
            getParas(),
            grouping.columnsCalculatedPerValue
        );

        grouping.setGroups(groups);

        return grouping;
    };

    /**
     * Creates a grouping object containing groups based on data rows: the first grouping.
     *
     * @param {Array} groupByCalcFunctions - Optional array of calc function specs for each group-by
     *   column.
     * @param {Object} filterSet - Optional filter set for this grouping.
     */
    const createGroupingBasedOnDataRows = (
        groupingIndex,
        groupByColumnIndexes,
        groupLevel,
        startGroupRowIndex,
        startGroupId,
        columns,
        groupByCalcFunctions,
        filterSet,
        structureSlot) => {

        const groups = new Map();
        const rowModels = tabularData.RowModels;
        const rowCount = rowModels.length;
        const columnCount = tabularData.ColumnModels.length;
        const cachedStructure = getCachedStructure(structureSlot, rowCount);

        if (cachedStructure) {

            return createGroupingFromDataRowStructure(
                cachedStructure,
                groupingIndex,
                groupByColumnIndexes,
                groupLevel,
                startGroupId,
                columns,
                groupByCalcFunctions,
                filterSet
            );
        }

        // Data-row calc functions are stored column-major (only the transformed columns), rather
        // than as a full row×column duplicate of the dataset. They depend only on the rows and the
        // data row settings, so an already-built set for these rows is used as it stands.
        const transformedDataColumns = structureSlot?.transformedDataColumns
            ?? Ren.CalcFunctionsApplyer.applyCalcFunctionsToDataRows(
                tabularData,
                dataGroupingSettings.dataRows.columns,
                getParas()
            );

        dataGroupingSettings.transformedDataColumns = transformedDataColumns;

        // Build the per-row values used for grouping/hashing.
        //
        // Only the group-by columns are ever read out of these rows, so a row needs a copy of its
        // own only when a calc function actually replaces one of those values.  Where the calc'd
        // columns are value columns (the usual case) the row models' own compressed values are used
        // as they stand, in an array shared between groupings.  Where a copy is needed the array is
        // local to this function and discarded once grouping is done.
        let valuesInRows;

        const calcColumnIndexes = transformedDataColumns
            ? Object.keys(transformedDataColumns).map(Number)
            : null;

        let hasCalcFunctionOnGroupByColumn = false;

        if (calcColumnIndexes) {

            for (let c = 0; c < calcColumnIndexes.length; c++) {

                if (groupByColumnIndexes.indexOf(calcColumnIndexes[c]) !== -1) {

                    hasCalcFunctionOnGroupByColumn = true;
                    break;
                }
            }
        }

        if (hasCalcFunctionOnGroupByColumn) {

            valuesInRows = new Array(rowCount);

            for (let i = 0; i < rowCount; i++) {

                const compressedValues = rowModels[i].CV;

                // A calc function's result is written into this copy, and can be a string or null.
                // When the rows were parsed on a worker in packed mode their CV is a view onto a
                // Float64Array, whose own slice() would give back another numeric buffer that turns
                // any such result into NaN, so the copy is made as a plain array instead.
                const row = ArrayBuffer.isView(compressedValues)
                    ? Array.from(compressedValues)
                    : compressedValues.slice();

                for (let c = 0; c < calcColumnIndexes.length; c++) {

                    const columnIndex = calcColumnIndexes[c];
                    row[columnIndex] = transformedDataColumns[columnIndex][i];
                }

                valuesInRows[i] = row;
            }
        }
        else {

            valuesInRows = getSharedValuesInRows();
        }

        const grouping = Ren.Grouping(
            groupingIndex,
            columnCount,
            valuesInRows,
            groupByColumnIndexes,
            startGroupId,
            null, // childGroupingIndex
            columns,
            groupByCalcFunctions,
            tabularData,
            filterSet,
            getParas()
        );

        const groupIds = grouping.groupIds();
        const transformedValuesPerRow = grouping.transformedValuesPerRow();
        const hasTransformedValues = transformedValuesPerRow !== null;

        let groupRowIndex = startGroupRowIndex;

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            const groupId = groupIds[rowIndex];
            let group = groups.get(groupId);

            if (!group) {

                group = createGroup(groupRowIndex++, groupLevel);

                // Store both original compressed values and transformed values
                const groupByColumnValues = [];

                for (let j = 0; j < groupByColumnIndexes.length; j++) {
                    groupByColumnValues[j] = valuesInRows[rowIndex][groupByColumnIndexes[j]];
                }
                group.groupByColumnValues = groupByColumnValues;

                // If calc functions were applied, store the transformed values
                if (hasTransformedValues) {
                    group.transformedGroupByColumnValues = transformedValuesPerRow[rowIndex];
                }

                groups.set(groupId, group);
            }

            group.containedRowIndexCount++;
        }

        // Now the buckets are sized, allocate the shared buffer and write each row's index straight
        // into its group's bucket, keyed by the row's group id via the cursor.
        const dataRowBuckets = allocateContainedRowIndexBuckets(groups, startGroupId);
        const dataRowBuffer = dataRowBuckets.sharedBuffer;
        const dataRowCursor = dataRowBuckets.cursor;

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            const localId = groupIds[rowIndex] - startGroupId;
            dataRowBuffer[dataRowCursor[localId]++] = rowIndex;
        }

        if (structureSlot) {

            const structure = captureGroupingStructure(
                groups,
                groupIds,
                hasTransformedValues,
                dataRowBuffer
            );

            structure.transformedDataColumns = transformedDataColumns;
            structureSlot.structure = structure;
            structureSlot.transformedDataColumns = transformedDataColumns;
        }

        populateGroupColumnValues(grouping, groups, columns, hasTransformedValues);
        Ren.CalcFunctionsApplyer.applyCalcFunctionsToGroups(
            groups,
            columns,
            tabularData,
            grouping.columnsWithAppendedValues,
            getParas(),
            grouping.columnsCalculatedPerValue
        );

        grouping.setGroups(groups);
        grouping.clearTransformedValuesPerRow();

        return grouping;
    };

    /**
     * Creates a grouping built on a child grouping from a cached structure, recomputing only the
     * values that a filter change can alter: each group's aggregated values.  The child groups
     * are the current rebuild's own, so the links to them are made afresh.
     */
    const createGroupingFromGroupingStructure = (
        structure,
        groupingIndex,
        childGrouping,
        groupByColumnIndexes,
        groupLevel,
        startGroupId,
        columns,
        groupByCalcFunctions,
        filterSet) => {

        const grouping = Ren.Grouping(
            groupingIndex,
            tabularData.ColumnModels.length,
            null, // The cached group ids stand in for grouping the child groups, which aren't read.
            groupByColumnIndexes,
            startGroupId,
            childGrouping.groupingIndex,
            columns,
            groupByCalcFunctions,
            tabularData,
            filterSet,
            getParas(),
            { groupIds: structure.groupIds, transformedValuesPerRow: null }
        );

        const groupsMap = restoreGroupsFromStructure(structure, groupLevel, true);
        const groupIds = structure.groupIds;

        // The child grouping's groups come back in the order they were created in, which is the
        // order they were grouped in when the structure was captured, so each child group's
        // position gives the id of the group that contains it.
        let childGroupPosition = 0;

        childGrouping.groups().forEach((childGroup, childGroupId) => {

            const group = groupsMap.get(groupIds[childGroupPosition++]);
            group.containedGroups.set(childGroupId, childGroup);
        });

        // The outermost grouping's single group spans every data row, so it holds no buffer of its
        // own; give it the same lazily-built range a freshly built one gets.
        if (grouping.isOutermostGrouping) {
            installAllRowsRangeGetter(groupsMap);
        }

        populateGroupColumnValues(grouping, groupsMap, columns, structure.hasTransformedValues);
        Ren.CalcFunctionsApplyer.applyCalcFunctionsToGroups(
            groupsMap,
            columns,
            tabularData,
            grouping.columnsWithAppendedValues,
            getParas(),
            grouping.columnsCalculatedPerValue
        );

        grouping.setGroups(groupsMap);

        return grouping;
    };

    /**
     * Creates a grouping object containing groups based on its child grouping: the second and
     * subsequent groupings.
     *
     * @param {Array} groupByCalcFunctions - Optional array of calc function specs for each group-by
     *   column.
     * @param {Object} filterSet - Optional filter set for this grouping.
     * @param {Object} structureSlot - Optional cache slot for this grouping's structure.
     */
    const createGroupingBasedOnGrouping = (
        groupingIndex,
        childGrouping,
        groupByColumnIndexes,
        groupLevel,
        startGroupRowIndex,
        startGroupId,
        columns,
        groupByCalcFunctions,
        filterSet,
        structureSlot
    ) => {

        const cachedStructure = getCachedStructure(structureSlot, childGrouping.numGroups());

        if (cachedStructure) {

            return createGroupingFromGroupingStructure(
                cachedStructure,
                groupingIndex,
                childGrouping,
                groupByColumnIndexes,
                groupLevel,
                startGroupId,
                columns,
                groupByCalcFunctions,
                filterSet
            );
        }

        // The child groups are read into parallel arrays - their ids, the groups themselves, and
        // the rows to group on - rather than into key/value pairs wrapped in an object apiece,
        // which cost two allocations per child group before anything was grouped at all.
        const childGroupCount = childGrouping.numGroups();
        const childGroupIds = new Int32Array(childGroupCount);
        const childGroupObjects = new Array(childGroupCount);
        const valuesInRows = new Array(childGroupCount);

        let childGroupPosition = 0;

        childGrouping.groups().forEach((childGroup, childGroupId) => {

            childGroupIds[childGroupPosition] = childGroupId;
            childGroupObjects[childGroupPosition] = childGroup;
            // A child group's row is materialised out of the column store to be grouped on, since
            // grouping reads whole rows.  It is transient, read while this grouping is formed and
            // dropped afterwards.
            valuesInRows[childGroupPosition] = childGroup.groupValues.getRow(childGroup.position);
            childGroupPosition++;
        });

        const columnCount = tabularData.ColumnModels.length;
        const grouping = Ren.Grouping(
            groupingIndex,
            columnCount,
            valuesInRows,
            groupByColumnIndexes,
            startGroupId,
            childGrouping.groupingIndex,
            columns,
            groupByCalcFunctions,
            tabularData, // Child group values are compressed, so decompression is needed for
                         // group-by calc functions applied at this grouping level.
            filterSet,
            getParas()
        );

        const groupIds = grouping.groupIds();
        const transformedValuesPerRow = grouping.transformedValuesPerRow();
        const hasTransformedValues = transformedValuesPerRow !== null;

        const groupsMap = new Map();
        let groupRowIndex = startGroupRowIndex;

        // The outermost grouping is a single group spanning every data row, so its
        // containedRowIndexes would just be a full-length copy of what the child groupings already
        // hold.  Aggregation for this group iterates all rows directly, and a lazy range is
        // installed below for the rare consumer that still reads the array.
        const isOutermostGrouping = grouping.isOutermostGrouping;

        // Build groups and aggregate contained row indexes.

        for (let childGroupRowIndex = 0; childGroupRowIndex < childGroupCount; childGroupRowIndex++) {

            const groupId = groupIds[childGroupRowIndex];
            let group = groupsMap.get(groupId);

            if (!group) {

                group = createGroup(groupRowIndex++, groupLevel);

                // This grouping is built from a child grouping, so its groups do gain child groups;
                // give each its own map rather than the shared empty default.
                group.containedGroups = new Map();

                group.groupByColumnValues = groupByColumnIndexes.map(
                    index => valuesInRows[childGroupRowIndex][index]
                );

                // If calc functions were applied, store the transformed values
                if (hasTransformedValues) {
                    group.transformedGroupByColumnValues = transformedValuesPerRow[childGroupRowIndex];
                }

                groupsMap.set(groupId, group);
            }

            const childGroup = childGroupObjects[childGroupRowIndex];
            group.containedGroups.set(childGroupIds[childGroupRowIndex], childGroup);

            if (!isOutermostGrouping) {

                // Tally this group's total row count from its child groups' buckets; the row
                // indexes themselves are copied straight into the shared buffer below.
                group.containedRowIndexCount += childGroup.containedRowIndexCount;
            }
        }

        // Held for the structure cache below; the outermost grouping has no buffer of its own.
        let capturedSharedBuffer = null;

        if (isOutermostGrouping) {
            installAllRowsRangeGetter(groupsMap);
        }
        else {

            // Buckets are sized, so allocate the shared buffer and copy each child group's row
            // indexes directly into its parent's bucket — no transient per-group array in
            // between.
            const buckets = allocateContainedRowIndexBuckets(groupsMap, startGroupId);
            const sharedBuffer = buckets.sharedBuffer;
            const cursor = buckets.cursor;

            capturedSharedBuffer = sharedBuffer;

            for (let childGroupRowIndex = 0; childGroupRowIndex < childGroupCount; childGroupRowIndex++) {

                const localId = groupIds[childGroupRowIndex] - startGroupId;
                const childGroup = childGroupObjects[childGroupRowIndex];
                const childBuffer = childGroup.containedRowIndexBuffer;
                const childStart = childGroup.containedRowIndexStart;
                const childCount = childGroup.containedRowIndexCount;

                let writePosition = cursor[localId];

                for (let i = 0; i < childCount; i++) {
                    sharedBuffer[writePosition++] = childBuffer[childStart + i];
                }

                cursor[localId] = writePosition;
            }
        }

        if (structureSlot) {

            structureSlot.structure = captureGroupingStructure(
                groupsMap,
                groupIds,
                hasTransformedValues,
                capturedSharedBuffer
            );
        }

        populateGroupColumnValues(grouping, groupsMap, columns, hasTransformedValues);
        Ren.CalcFunctionsApplyer.applyCalcFunctionsToGroups(
            groupsMap,
            columns,
            tabularData,
            grouping.columnsWithAppendedValues,
            getParas(),
            grouping.columnsCalculatedPerValue
        );

        grouping.setGroups(groupsMap);
        grouping.clearTransformedValuesPerRow();

        return grouping;
    };

    return {
        createGroupingBasedOnDataRows,
        createGroupingBasedOnGrouping
    };
};
