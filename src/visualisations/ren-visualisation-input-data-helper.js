/**
 * Gets and filters the input data for visualisations, ad-hoc or grouped.
 */
Ren.VisualisationInputDataHelper = (() => {

    // A report's visualisations all redraw together on a filter change, so each keyed cache must
    // hold an entry per visualisation or they evict each other and never hit.
    const CACHE_MAX_ENTRIES = 32;

    // Bounded far more tightly, as its entries are whole materialised datasets and visualisations
    // over one data source ask for the same one or two ranges.
    const ROWS_CACHE_MAX_ENTRIES = 4;

    /**
     * Reads a bounded cache, refreshing the entry's recency.
     */
    const readCache = (cache, key) => {

        if (!cache.has(key)) return undefined;

        const value = cache.get(key);

        cache.delete(key);
        cache.set(key, value);

        return value;
    };

    /**
     * Writes a bounded cache, dropping the oldest entry once it is full.
     */
    const writeCache = (cache, key, value, maxEntries) => {

        if (cache.has(key)) cache.delete(key);

        cache.set(key, value);

        while (cache.size > (maxEntries || CACHE_MAX_ENTRIES)) {

            cache.delete(cache.keys().next().value);
        }
    };

    // Fully-resolved results, keyed by settings group plus signifiers.
    const _resultCache = new Map();

    // The applied grouping settings and materialised rows, keyed without the filter module's
    // signifier.  On the data-row range path these are independent of the filter module, so a
    // filter change re-runs only the cheap row-level passes.
    const _baseCache = new Map();

    // The materialised rows alone, shared between visualisations, as on the data-row range path
    // they depend only on the tabular data and the range.  Consumers copy before writing.
    const _rowsCacheByTabularData = new WeakMap();

    // The row-level filter passes' results, shared by visualisations filtering the same base by the
    // same filterGroup.  Keyed weakly by that base, so an entry goes when the base does.
    const _filteredRowsCacheByInputData = new WeakMap();

    /**
     * Copies an object's own keys into a new object, leaving the values themselves shared.
     */
    const shallowCopy = (source) => {

        const copy = {};

        for (const key in source) {

            copy[key] = source[key];
        }

        return copy;
    };

    /**
     * Copies the levels of a filter set that ensureTabFiltersExist can write to, so the filterGroup
     * source's own filter set is left alone.  The value lists, the bulk of it, stay shared.
     */
    const copyFilterSetForOverlay = (filterSet) => {

        const copy = {};

        for (const tabTitle in filterSet) {

            const tabFilters = filterSet[tabTitle];

            if (!tabFilters || typeof tabFilters !== "object") {

                copy[tabTitle] = tabFilters;
                continue;
            }

            const tabFiltersCopy = shallowCopy(tabFilters);

            if (tabFilters.columnValueFilters) {
                tabFiltersCopy.columnValueFilters = shallowCopy(tabFilters.columnValueFilters);
            }

            if (tabFilters.rowFilter) {
                tabFiltersCopy.rowFilter = shallowCopy(tabFilters.rowFilter);
            }

            copy[tabTitle] = tabFiltersCopy;
        }

        return copy;
    };

    /**
     * Gets a filter set without one tab's filters on the given columns, copied where it has any.
     */
    const withoutColumnFilters = (filterSet, tabTitle, columnSet) => {

        const tabFilters = filterSet?.[tabTitle];
        const columnValueFilters = tabFilters?.columnValueFilters;

        if (!columnValueFilters) return filterSet;

        const filteredColumns = Array.from(columnSet).filter(
            column => Object.prototype.hasOwnProperty.call(columnValueFilters, column)
        );

        if (filteredColumns.length === 0) return filterSet;

        const copy = copyFilterSetForOverlay(filterSet);
        const tabFiltersCopy = copy[tabTitle];

        for (let i = 0; i < filteredColumns.length; i++) {

            delete tabFiltersCopy.columnValueFilters[filteredColumns[i]];
        }

        if (Array.isArray(tabFilters.negatedColumns)) {

            tabFiltersCopy.negatedColumns =
                tabFilters.negatedColumns.filter(column => !columnSet.has(column));
        }

        return copy;
    };

    // A begotten chart keeps its own minimal grouping shape, so the grid's compiled filter cannot
    // be relied on to reduce its rows and they are filtered as row objects instead.
    const filterRowsByColumnValueFilters = (rows, columnValueFilters, negatedColumns) =>
        Ren.RowObjectFilter.filterRowsByColumnValueFilters(rows, columnValueFilters, negatedColumns);

    const filterRowsByRowFilterPredicates = (rows, predicates, paras) =>
        Ren.RowObjectFilter.filterRowsByRowFilterPredicates(rows, predicates, paras);

    /**
     * Gets the columns the rows must hold: the visualisation's own and those the row-level filter
     * passes read, in column order. Null, for every column, where the visualisation needs them all.
     */
    const getNeededColumnIndexes = (
        tabularData, requiredColumnIndexes, columnValueFilters, groupingFilters, predicates
    ) => {

        if (!requiredColumnIndexes) return null;

        const columnResolver = tabularData.columnResolver;
        const columnIndexes = new Set(requiredColumnIndexes);

        const addColumn = (column) => {

            const columnIndex = columnResolver.getColumnIndex(column);

            if (columnIndex != null) columnIndexes.add(columnIndex);
        };

        const addFilterColumns = (filters) => {

            for (const column in filters) addColumn(column);
        };

        // Only combination and compare predicates read columns from a row object.
        const addPredicateColumns = (rowFilterPredicates) => {

            if (!rowFilterPredicates) return;

            for (let i = 0; i < rowFilterPredicates.length; i++) {

                const predicate = rowFilterPredicates[i];

                if (predicate.column != null) addColumn(predicate.column);

                const columns = predicate.columns;

                if (!Array.isArray(columns)) continue;

                for (let c = 0; c < columns.length; c++) addColumn(columns[c]);
            }
        };

        addFilterColumns(columnValueFilters);
        addPredicateColumns(predicates);

        if (groupingFilters) {

            for (let i = 0; i < groupingFilters.length; i++) {

                addFilterColumns(groupingFilters[i].columnValueFilters);
                addPredicateColumns(groupingFilters[i].rowFilterPredicates);
            }
        }

        return Array.from(columnIndexes).sort((a, b) => a - b);
    };

    /**
     * Gets a value indicating whether rows built with one sorted set of columns hold every column
     * of another.  Null stands for every column.
     */
    const coversColumns = (builtColumnIndexes, neededColumnIndexes) => {

        if (!builtColumnIndexes) return true;
        if (!neededColumnIndexes) return false;

        let builtIndex = 0;

        for (let i = 0; i < neededColumnIndexes.length; i++) {

            while (builtIndex < builtColumnIndexes.length &&
                builtColumnIndexes[builtIndex] < neededColumnIndexes[i]) {

                builtIndex++;
            }

            if (builtColumnIndexes[builtIndex] !== neededColumnIndexes[i]) return false;
        }

        return true;
    };

    const unionColumns = (columnIndexes, otherColumnIndexes) => {

        if (!columnIndexes || !otherColumnIndexes) return null;

        const union = new Set(columnIndexes);

        for (let i = 0; i < otherColumnIndexes.length; i++) union.add(otherColumnIndexes[i]);

        return Array.from(union).sort((a, b) => a - b);
    };

    const getRowsCache = (tabularData) => {

        let rowsCache = _rowsCacheByTabularData.get(tabularData);

        if (!rowsCache) {

            rowsCache = new Map();
            _rowsCacheByTabularData.set(tabularData, rowsCache);
        }

        return rowsCache;
    };

    /**
     * Gets the materialised rows of a range as { rows, columnIndexes }, holding at least the needed
     * columns.  knownRows, rows of the range already to hand, are used where they hold enough.
     *
     * Shared rows are rebuilt with the union of the columns they held and the columns needed, so
     * the visualisations reading them converge on one array rather than each keeping its own.
     */
    const getRows = (
        tabularData, visualisation, dataGroupingSettings, rowsRange, neededColumnIndexes, knownRows
    ) => {

        const rowsCache = rowsRange.isShared ? getRowsCache(tabularData) : null;
        const rowsCacheKey = rowsRange.startRowIndex + "|" + rowsRange.rowCount;
        const cachedRows = rowsCache ? readCache(rowsCache, rowsCacheKey) : undefined;

        if (cachedRows && coversColumns(cachedRows.columnIndexes, neededColumnIndexes)) {
            return cachedRows;
        }

        if (knownRows && coversColumns(knownRows.columnIndexes, neededColumnIndexes)) {

            const isWider = !cachedRows ||
                coversColumns(knownRows.columnIndexes, cachedRows.columnIndexes);

            if (rowsCache && isWider) {
                writeCache(rowsCache, rowsCacheKey, knownRows, ROWS_CACHE_MAX_ENTRIES);
            }

            return knownRows;
        }

        const columnIndexes = cachedRows
            ? unionColumns(cachedRows.columnIndexes, neededColumnIndexes)
            : neededColumnIndexes;

        const rows = Ren.TabularDataAdapter_Array.getDataArray(
            tabularData,
            visualisation,
            dataGroupingSettings,
            false,
            false,
            rowsRange.startRowIndex,
            rowsRange.rowCount,
            false,
            columnIndexes
        );

        const builtRows = { rows, columnIndexes };

        if (rowsCache) writeCache(rowsCache, rowsCacheKey, builtRows, ROWS_CACHE_MAX_ENTRIES);

        return builtRows;
    };

    /**
     * Gets input data for a visualisation, applying all filters including group filters.
     * @param {number[]} requiredColumnIndexes - The sorted indexes of the only columns the
     *     visualisation reads, which the rows may then be limited to, or null for every column.
     * @param {string[]} unfilteredColumns - The columns whose filters, in the settings the
     *     visualisation takes its filters from, it is not filtered by, or null for none.
     * @returns {Object} { inputData, dataGroupingSettings }
     */
    const getInputData = (tabularData, visualisation, requiredColumnIndexes, unfilteredColumns) => {

        if (visualisation.isAdHoc) {

            const inputData = Ren.TabularDataAdapter_Array.getDataArray(
                tabularData,
                visualisation,
                null,
                false,
                false
            );

            return { inputData, dataGroupingSettings: null };
        }
        else {

            // A child visualisation uses its source's GUID to get the source grid's current
            // settings, not stale ones from another visualisation sharing the settings group.
            const sourceVisualisationGuid = visualisation.sourceVisualisation?.visualisationGuid;

            const existingDataGroupingSettings =
                Ren.DataGroupingSettingsCollection.getDataGroupingSettingsTransformed(
                    visualisation.dataGroupingSettingsGroup,
                    tabularData,
                    sourceVisualisationGuid
                );

            // A second-to-last grouping purely by a date bin is stripped, so that date-aware
            // visualisations receive ungrouped rows and can apply their own date period.
            let settingsForApply = existingDataGroupingSettings;

            if (existingDataGroupingSettings) {

                const entries = existingDataGroupingSettings.groupings?.entries;

                if (entries && entries.length >= 2) {

                    const secondToLast = entries[entries.length - 2];
                    const gbi = secondToLast?.groupByColumnIndexes;

                    if (gbi && gbi.length === 1) {

                        const calcFns = secondToLast.groupByCalcFunctions;
                        const firstCalcFnName = calcFns && calcFns[0] && calcFns[0].name;
                        const isDateBinGrouping = typeof firstCalcFnName === "string" &&
                            firstCalcFnName.substring(0, 5) === "date-";

                        if (isDateBinGrouping) {

                            const newEntries = [];

                            for (let i = 0; i < entries.length; i++) {

                                if (i !== entries.length - 2) newEntries.push(entries[i]);
                            }

                            const newGroupings = {};

                            for (const key in existingDataGroupingSettings.groupings) {

                                newGroupings[key] = existingDataGroupingSettings.groupings[key];
                            }

                            newGroupings.entries = newEntries;
                            settingsForApply = {};

                            for (const key in existingDataGroupingSettings) {

                                settingsForApply[key] = existingDataGroupingSettings[key];
                            }

                            settingsForApply.groupings = newGroupings;
                        }
                    }
                }
            }

            // A distinct filterGroup syncs just its filters, so that e.g. a chart begotten from a
            // grid reflects the grid's filters without importing the rest of its settings.
            const filterGroup = visualisation.filterGroup || visualisation.dataGroupingSettingsGroup;
            const isFilterGroupDistinct =
                !!filterGroup && filterGroup !== visualisation.dataGroupingSettingsGroup;

            const unfilteredColumnSet = unfilteredColumns && unfilteredColumns.length
                ? new Set(unfilteredColumns)
                : null;

            const unfilteredColumnsKey = unfilteredColumnSet ? unfilteredColumns.join(",") : "";

            const ownFilterSet = settingsForApply?.dataRows?.filterSet;

            if (unfilteredColumnSet && !isFilterGroupDistinct && ownFilterSet) {

                const unfilteredFilterSet =
                    withoutColumnFilters(ownFilterSet, tabularData.Title, unfilteredColumnSet);

                if (unfilteredFilterSet !== ownFilterSet) {

                    settingsForApply = shallowCopy(settingsForApply);
                    settingsForApply.dataRows = shallowCopy(settingsForApply.dataRows);
                    settingsForApply.dataRows.filterSet = unfilteredFilterSet;
                }
            }

            let filterGroupSourceSignifier = "";

            // Overlaid onto the applied settings on the group-row path.
            let filterGroupFilterSet = null;

            // Applied as a row-level pass, as the chart's own minimal groupings cannot be relied on
            // to reduce rows through the grouping range.
            let filterGroupColumnValueFilters = null;

            let filterGroupNegatedColumns = null;

            let filterGroupRowFilterPredicates = null;

            // The filters on the source's grouping levels, one entry per level.  The source grid
            // hides the groups they exclude; this visualisation has no such groups, so filters the
            // rows behind them instead.
            let filterGroupGroupingFilters = null;

            if (isFilterGroupDistinct) {

                const filterGroupSource = Ren.DataGroupingSettingsCollection.getDataGroupingSettings(filterGroup);
                const sourceFilterSet = filterGroupSource?.dataRows?.filterSet;

                const syncedFilterSet = unfilteredColumnSet && sourceFilterSet
                    ? withoutColumnFilters(sourceFilterSet, tabularData.Title, unfilteredColumnSet)
                    : sourceFilterSet;

                // Taken even when unfiltered: clearing the last filter removes the filter set, and
                // a "" signifier would let the cache answer with the filtered result.
                filterGroupSourceSignifier = filterGroupSource?.signifier || "";

                const groupingFilters = filterGroupSource
                    ? Ren.DataGroupingSettings_Services_FilterAccessors
                        .getRowFilterableGroupingColumnValueFilters(filterGroupSource, tabularData)
                    : [];

                if (groupingFilters.length) {
                    filterGroupGroupingFilters = groupingFilters;
                }

                if (syncedFilterSet) {

                    filterGroupFilterSet = syncedFilterSet;

                    const tabFilters = syncedFilterSet[tabularData.Title];

                    if (tabFilters && tabFilters.columnValueFilters) {

                        filterGroupColumnValueFilters = tabFilters.columnValueFilters;
                        filterGroupNegatedColumns =
                            Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters);
                    }

                    const rowFilterPredicates = tabFilters?.rowFilter?.predicates;

                    if (Array.isArray(rowFilterPredicates) && rowFilterPredicates.length) {
                        filterGroupRowFilterPredicates = rowFilterPredicates;
                    }
                }
            }

            // On the data-row range path the applied groupings collapse to the outermost grouping,
            // so the materialised rows are raw data rows untouched by any filter, and the base can
            // be cached across filter module changes.  A group-row range carries filter-dependent
            // aggregates.
            const rangeEntries = settingsForApply?.groupings?.entries;
            const firstRangeEntry = rangeEntries && rangeEntries.length === 1 ? rangeEntries[0] : null;
            const firstRangeEntryGroupByLength = firstRangeEntry
                ? (firstRangeEntry.groupByColumnIndexes?.length ?? firstRangeEntry.groupByColumns?.length ?? 0)
                : 0;

            const willBeDataRowRange =
                !rangeEntries || rangeEntries.length === 0 ||
                (rangeEntries.length === 1 && firstRangeEntryGroupByLength === 0);

            const canReuseBaseAcrossFilters = isFilterGroupDistinct && willBeDataRowRange;

            // Only raw data rows, filtered as row objects, can be limited to the columns read.
            let neededColumnIndexes = canReuseBaseAcrossFilters
                ? getNeededColumnIndexes(
                    tabularData,
                    requiredColumnIndexes,
                    filterGroupColumnValueFilters,
                    filterGroupGroupingFilters,
                    filterGroupRowFilterPredicates
                )
                : null;

            // Overlaid so group aggregates reflect the filter module's filter.  The data-row path
            // skips this to keep its base filter-module-independent.
            if (filterGroupFilterSet && !canReuseBaseAcrossFilters) {

                // Only these objects and the filter set's containers are written to, so shallow
                // copies suffice; a deep clone would copy the value lists and drop functions.
                const overlaid = settingsForApply
                    ? shallowCopy(settingsForApply)
                    : { groupings: { entries: [] } };

                overlaid.dataRows = overlaid.dataRows ? shallowCopy(overlaid.dataRows) : {};
                overlaid.dataRows.filterSet = copyFilterSetForOverlay(filterGroupFilterSet);
                settingsForApply = overlaid;
            }

            // Includes the grouping columns' aggregation types, so changing one invalidates the
            // base.
            const groupingColumnsKey = existingDataGroupingSettings && existingDataGroupingSettings.groupings?.entries?.[0]?.columns
                ? JSON.stringify(existingDataGroupingSettings.groupings.entries[0].columns)
                : "";

            // Led by the data source URI so that removing a data source can drop its entries by
            // prefix.
            const baseCacheKey = (visualisation.dataSourceUri || "") + "|" +
                visualisation.dataGroupingSettingsGroup + "|" +
                (existingDataGroupingSettings ? existingDataGroupingSettings.signifier || "" : "__init__") + "|" +
                (sourceVisualisationGuid || "") + "|" +
                groupingColumnsKey;

            const cacheKey = baseCacheKey + "|" + filterGroupSourceSignifier + "|" +
                (neededColumnIndexes ? neededColumnIndexes.join(",") : "*") + "|" +
                unfilteredColumnsKey;

            const cachedResult = readCache(_resultCache, cacheKey);

            if (cachedResult) {

                return cachedResult;
            }

            let dataGroupingSettings;
            let inputData;
            let rows;
            let rowsRange;

            const cachedBase = canReuseBaseAcrossFilters
                ? readCache(_baseCache, baseCacheKey)
                : undefined;

            if (cachedBase) {

                // The filter module changed but the groupings did not.
                dataGroupingSettings = cachedBase.dataGroupingSettings;

                // Rebuilt where a newly needed column is missing, and swapped for shared rows since
                // widened by another visualisation, so the narrower ones can go.
                cachedBase.rows = getRows(
                    tabularData,
                    visualisation,
                    dataGroupingSettings,
                    cachedBase.rowsRange,
                    neededColumnIndexes,
                    cachedBase.rows
                );

                inputData = cachedBase.rows.rows;
            }
            else {

                dataGroupingSettings = Ren.DataGroupingSettingsFactory.createDataGroupingSettings(
                    tabularData,
                    visualisation,
                    null,
                    false
                );

                const dataGroupingSettingsApplyer = Ren.DataGroupingSettingsApplyer(
                    tabularData,
                    dataGroupingSettings
                );

                if (settingsForApply) {

                    dataGroupingSettingsApplyer.applyDataGroupingSettings(
                        settingsForApply
                    );
                }
                else {

                    Ren.DataGroupingSettingsInitialiser.initialiseDataGroupingSettings(
                        visualisation,
                        dataGroupingSettingsApplyer
                    );
                }

                const rowIndexRange =
                    dataGroupingSettings.sortFilterGroup.getRowIndexesInOutermostGrouping();

                const startRowIndex = rowIndexRange ? rowIndexRange.startRowIndex : 0;
                const rowCount = rowIndexRange ? rowIndexRange.rowCount : tabularData.DataRowCount;

                // Shareable between visualisations: unformatted over a raw data-row range, the call
                // reads nothing from the visualisation or its settings.
                const canShareRows = canReuseBaseAcrossFilters &&
                    startRowIndex + rowCount <= tabularData.DataRowCount;

                const appliedEntries = dataGroupingSettings.groupings?.entries;

                // A grouping filter below is read from the rows too, so they keep every column.
                if (!canShareRows || (appliedEntries && appliedEntries.length > 1)) {
                    neededColumnIndexes = null;
                }

                rowsRange = { startRowIndex, rowCount, isShared: canShareRows };

                rows = getRows(
                    tabularData,
                    visualisation,
                    dataGroupingSettings,
                    rowsRange,
                    neededColumnIndexes,
                    null
                );

                inputData = rows.rows;

                // The chart's own grouping filterSet is filter-module-independent, so is baked into
                // the base.
                if (dataGroupingSettings.groupings && dataGroupingSettings.groupings.entries && dataGroupingSettings.groupings.entries.length > 1) {

                    const groupings = dataGroupingSettings.groupings.entries;
                    const secondToLastGrouping = groupings[groupings.length - 2];

                    if (secondToLastGrouping && secondToLastGrouping.filterSet) {

                        const tabTitle = tabularData.Title;
                        const filterSet = secondToLastGrouping.filterSet;
                        const tabFilters = filterSet[tabTitle];

                        if (tabFilters && tabFilters.columnValueFilters) {

                            inputData = filterRowsByColumnValueFilters(
                                inputData,
                                tabFilters.columnValueFilters,
                                Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters)
                            );
                        }
                    }
                }

                // Confirms the pre-apply shape check, so a filter-dependent group-row base is never
                // cached.
                const isDataRowRange =
                    !dataGroupingSettings.groupings ||
                    !dataGroupingSettings.groupings.entries ||
                    dataGroupingSettings.groupings.entries.length === 1;

                if (canReuseBaseAcrossFilters && isDataRowRange) {

                    writeCache(_baseCache, baseCacheKey, { dataGroupingSettings, rows, rowsRange });
                }
            }

            // Producing a new array leaves the cached base's inputData unfiltered and reusable.
            let filteredInputData = inputData;

            const hasFilterGroupRowFiltering = !!filterGroupColumnValueFilters ||
                !!filterGroupGroupingFilters ||
                !!filterGroupRowFilterPredicates;

            if (hasFilterGroupRowFiltering) {

                // Visualisations sharing this filterGroup reach here with the same inputData array,
                // so the first to filter it serves the rest.
                const filteredRowsCacheKey =
                    filterGroup + "|" + filterGroupSourceSignifier + "|" + unfilteredColumnsKey;
                let filteredRowsCache = _filteredRowsCacheByInputData.get(inputData);
                const cachedFilteredRows = filteredRowsCache
                    ? readCache(filteredRowsCache, filteredRowsCacheKey)
                    : undefined;

                if (cachedFilteredRows) {

                    filteredInputData = cachedFilteredRows;
                }
                else {

                    if (filterGroupColumnValueFilters) {

                        filteredInputData = filterRowsByColumnValueFilters(
                            filteredInputData,
                            filterGroupColumnValueFilters,
                            filterGroupNegatedColumns
                        );
                    }

                    // One level at a time, so that two levels filtering the same column intersect.
                    // Binned and compare filters on group-by columns arrive as predicates.
                    if (filterGroupGroupingFilters) {

                        for (let i = 0; i < filterGroupGroupingFilters.length; i++) {

                            filteredInputData = filterRowsByColumnValueFilters(
                                filteredInputData,
                                filterGroupGroupingFilters[i].columnValueFilters,
                                filterGroupGroupingFilters[i].negatedColumns
                            );

                            const groupingPredicates =
                                filterGroupGroupingFilters[i].rowFilterPredicates;

                            if (groupingPredicates && groupingPredicates.length) {

                                filteredInputData = filterRowsByRowFilterPredicates(
                                    filteredInputData,
                                    groupingPredicates,
                                    Ren.ReportInputParameters.getInputParameters(
                                        visualisation.containingReport
                                    )
                                );
                            }
                        }
                    }

                    if (filterGroupRowFilterPredicates) {

                        filteredInputData = filterRowsByRowFilterPredicates(
                            filteredInputData,
                            filterGroupRowFilterPredicates,
                            Ren.ReportInputParameters.getInputParameters(
                                visualisation.containingReport
                            )
                        );
                    }

                    if (!filteredRowsCache) {

                        filteredRowsCache = new Map();
                        _filteredRowsCacheByInputData.set(inputData, filteredRowsCache);
                    }

                    writeCache(filteredRowsCache, filteredRowsCacheKey, filteredInputData);
                }
            }

            const result = { inputData: filteredInputData, dataGroupingSettings };
            writeCache(_resultCache, cacheKey, result);
            return result;
        }
    };

    /**
     * Drops a removed data source's entries, which would otherwise pin its rows for the life of the
     * page.  The weakly keyed caches need no such sweep.
     */
    const removeCachedDataSource = (dataSourceUri) => {

        const prefix = dataSourceUri + "|";

        const sweep = (cache) => {

            const keys = Array.from(cache.keys());

            for (let i = 0; i < keys.length; i++) {

                if (keys[i].startsWith(prefix)) cache.delete(keys[i]);
            }
        };

        sweep(_resultCache);
        sweep(_baseCache);
    };

    Ren.Messages.Events.dataSourceRemoved.handle((dataSourceUri) => {

        removeCachedDataSource(dataSourceUri);
    });

    return {
        getInputData
    };
})();
