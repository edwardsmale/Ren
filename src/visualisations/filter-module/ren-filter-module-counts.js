/**
 * Filter Module: the derived data grouping settings behind each item's option counts, values and
 * totals row.  Group-row options and hierarchies live in the -group-options and -hierarchy modules.
 */
Ren.FilterModule_Counts = (s) => {

    const {
        tabularData,
        visualisation,
        COUNT_COLUMN_HEADING,
        countColumnIndex,
        BOOLEAN_OPTIONS
    } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { binning, columnInfo, filterTarget, filtering, itemSettings } = s;

    const FilterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;
    const DerivedSettings = Ren.DerivedDataGroupingSettings;

    // Each item's derived settings group by its column and sum __Count.  Being derived, they never
    // disturb the grid or other visualisations.
    const countsSettingsByColumn = DerivedSettings.createCache(
        (columnIdOrHeading) => createCountsDataGroupingSettingsForColumn(columnIdOrHeading)
    );

    // Filtered by the item's own selection too, for a totals row over a selected subset.
    const selectedTotalSettingsByColumn = DerivedSettings.createCache(
        (columnIdOrHeading) => createSelectedTotalSettingsForColumn(columnIdOrHeading)
    );

    // Clears the hierarchy caches too, as the column may sit at any level of a hierarchy.
    const invalidateCountsForColumn = (columnIdOrHeading) => {

        countsSettingsByColumn.invalidate(columnIdOrHeading);
        selectedTotalSettingsByColumn.invalidate(columnIdOrHeading);
        hierarchy.invalidateCaches();
    };

    const dropAllSettingsCaches = () => {

        countsSettingsByColumn.invalidateAll();
        selectedTotalSettingsByColumn.invalidateAll();
        hierarchy.invalidateCaches();
    };

    // Called when the source grid's filter changes, as every count is computed against it.
    const invalidateAllCounts = () => {

        dropAllSettingsCaches();
    };

    // Each settings object holds a grouping over the whole dataset, so they are dropped once a
    // render has read its figures.  Nothing reads them after the render pass.
    const releaseSettingsBuiltForRender = () => {

        dropAllSettingsCaches();
    };

    // ===== Reading back the figures an earlier render worked out =====

    // Each result is small, so this only bounds a panel whose items are reconfigured repeatedly.
    // Least recently used goes first.
    const MAX_CACHED_ITEM_RESULTS = 48;

    // No column name, setting or filter value contains it, so a key's parts can't run together.
    const KEY_SEPARATOR = "\u0000";

    const itemResultsByKey = new Map();

    // The key doesn't describe the data, so new rows clear the cache.
    let itemResultsRowModels = null;

    // Gets a key naming everything a figure derives from: its kind, the item's columns and their
    // overrides, and its cross-filter.  That leaves out the item's own selection, so ticking a
    // value reads the item's own figures back.  extraKey is anything else, such as a selection.
    const getItemResultsKey = (kind, ownColumnIds, ownCombinationKey, extraKey) => {

        const parts = [kind];

        for (let i = 0; i < ownColumnIds.length; i++) {

            parts.push(ownColumnIds[i]);
            parts.push(JSON.stringify(s.columnOverrides[ownColumnIds[i]] ?? null));
        }

        const crossFilter =
            filtering.buildCrossFilterSetExcludingColumns(ownColumnIds, ownCombinationKey);

        parts.push(crossFilter ? JSON.stringify(crossFilter) : "");
        parts.push(extraKey ?? "");

        return parts.join(KEY_SEPARATOR);
    };

    // Gets a figure from the results cache, computing it only when absent.  The cached value itself
    // is returned, so callers must treat it as read-only.
    const getCachedItemResult = (kind, ownColumnIds, ownCombinationKey, extraKey, compute) => {

        if (itemResultsRowModels !== tabularData.RowModels) {

            itemResultsByKey.clear();
            itemResultsRowModels = tabularData.RowModels;
        }

        const key = getItemResultsKey(kind, ownColumnIds, ownCombinationKey, extraKey);

        if (itemResultsByKey.has(key)) {

            const cached = itemResultsByKey.get(key);

            // Reinserted to mark it most recently used.
            itemResultsByKey.delete(key);
            itemResultsByKey.set(key, cached);

            return cached;
        }

        const value = compute();

        itemResultsByKey.set(key, value);

        while (itemResultsByKey.size > MAX_CACHED_ITEM_RESULTS) {
            itemResultsByKey.delete(itemResultsByKey.keys().next().value);
        }

        return value;
    };

    // prepare applies the filters; entries and totalColumns give the groupings.
    const createDerivedSettings = (namePrefix, prepare, entries, totalColumns) =>
        DerivedSettings.create({
            tabularData,
            visualisation,
            sourceSettings: columnInfo.getSourceDataGroupingSettings(),
            namePrefix,
            prepare,
            entries,
            totalColumns
        });

    // Gets the totals grouping's columns: the value column, or row count, aggregated as the totals
    // row is configured.  Empty when that is "None".
    const buildTotalColumns = (valueColumnKey, totalAggregationColumnKey) => {

        const totalColumns = {};
        const totalAggregationType = itemSettings.getTotalAggregationType(totalAggregationColumnKey);

        if (totalAggregationType === "None") return totalColumns;

        const valueConfig = itemSettings.getValueConfig(valueColumnKey);

        const totalColumn = valueConfig.column && valueConfig.column !== COUNT_COLUMN_HEADING
            ? valueConfig.column
            : COUNT_COLUMN_HEADING;

        if (totalColumn !== COUNT_COLUMN_HEADING || countColumnIndex >= 0) {

            // Deduplicates, or orders, the rows as a data grid's totals row does, independently of
            // the per-option value aggregation.
            const entry = { aggregationType: totalAggregationType };
            const withRespectToColumn =
                itemSettings.getTotalAggregateWithRespectToColumn(totalAggregationColumnKey);

            if (withRespectToColumn) entry.aggregateWithRespectToColumn = withRespectToColumn;

            totalColumns[totalColumn] = entry;
        }

        return totalColumns;
    };

    // A hierarchy takes its total's value from the top column and its aggregation from the leaf,
    // where the item's settings are keyed.
    const buildHierarchyTotalColumns = (hierarchyColumns) =>
        buildTotalColumns(
            hierarchyColumns[0].columnIdOrHeading,
            hierarchyColumns[hierarchyColumns.length - 1].columnIdOrHeading
        );

    // Gets a level's aggregated columns: the __Count sum, which tells which values still have rows,
    // plus the "Sort by" and "Value column" columns.  Where those are the same column, the value
    // column's aggregation wins.
    const buildAggregatedColumns = (columnIdOrHeading) => {

        const columns = {};

        if (countColumnIndex >= 0) columns[COUNT_COLUMN_HEADING] = { aggregationType: "Sum" };

        const sortConfig = itemSettings.getSortConfig(columnIdOrHeading);

        if (sortConfig.column && sortConfig.column !== COUNT_COLUMN_HEADING) {
            columns[sortConfig.column] = { aggregationType: sortConfig.aggregationType };
        }

        const valueConfig = itemSettings.getValueConfig(columnIdOrHeading);

        if (valueConfig.column && valueConfig.column !== COUNT_COLUMN_HEADING) {

            const valueEntry = { aggregationType: valueConfig.aggregationType };

            if (valueConfig.withRespectToColumn) {
                valueEntry.aggregateWithRespectToColumn = valueConfig.withRespectToColumn;
            }

            columns[valueConfig.column] = valueEntry;
        }

        return columns;
    };

    // Gets the key of a binned item's own predicate chain where it filters the data rows, or null.
    const getOwnCombinationKey = (columnIdOrHeading) =>
        binning.filtersByPredicate(columnIdOrHeading)
            ? filtering.columnsKeyOf(binning.getBinnedChain(columnIdOrHeading))
            : null;

    const createCountsDataGroupingSettingsForColumn = (columnIdOrHeading) => {

        const columns = buildAggregatedColumns(columnIdOrHeading);

        // Declared explicitly, as the auto-appended outermost grouping carries no aggregation.
        const totalColumns = buildTotalColumns(columnIdOrHeading, columnIdOrHeading);

        // Recorded so buildOptions only prunes to present values when the page is cross-filtering.
        const prepare = (settings) => {

            settings._filterModuleCrossFiltered = filtering.applyCrossFilterToScratchSettings(
                settings,
                [columnIdOrHeading],
                getOwnCombinationKey(columnIdOrHeading)
            );
        };

        // A binned column groups by its bins, so each checkbox is still a group.
        const entry = { groupByColumns: [columnIdOrHeading], columns };
        const binningSpec = binning.getBinningSpec(columnIdOrHeading);

        if (binningSpec) entry.groupByCalcFunctions = [binningSpec];

        return createDerivedSettings("filter-module-counts", prepare, [entry], totalColumns);
    };

    const getCountsDataGroupingSettingsForColumn = (columnIdOrHeading) =>
        countsSettingsByColumn.get(columnIdOrHeading);

    // Gets a map from each group-by value (as a string) to a column's aggregated value, keyed by
    // bin where deriveValue is a binning function.
    const readAggregatedValuesByValue = (
        settings, groupByColumnIndex, aggregatedColumnIndex, deriveValue
    ) =>
        DerivedSettings.readAggregatedValuesByGroupValue(
            settings,
            tabularData,
            groupByColumnIndex,
            aggregatedColumnIndex,
            deriveValue
        );

    // Gets the binning function a column's group values are read through, or null if not binned.
    const binValueReader = (columnIdOrHeading) =>
        binning.hasBinning(columnIdOrHeading)
            ? (value) => binning.binValue(columnIdOrHeading, value)
            : null;

    // Orders options by value ("Default"), by an explicit "Sort by" column, or else by the
    // displayed value.  An enum's labels sort by their integers (see createValueSortKeyResolver).
    const sortOptions = (column, options, sortConfig, hasSortColumn) => {

        if (sortConfig.byValue) {

            const valueSortKey = columnInfo.createValueSortKeyResolver(column);

            // A binned option carries its own sort key, as its bin is a caption, not a value.
            Ren.ArrayUtils.sortAuto(
                options,
                (option) => option.valueSortKey ?? valueSortKey(option.value),
                sortConfig.descending
            );

            columnInfo.moveNullEntriesFirst(options, (option) => option.value);
            return;
        }

        if (hasSortColumn) {

            Ren.ArrayUtils.sortAuto(options, (option) => option.sortValue, sortConfig.descending);
            return;
        }

        Ren.ArrayUtils.sortAuto(
            options,
            (option) => option.aggregatedValue,
            sortConfig.descending
        );
    };

    // Gets a value indicating whether the "Sort" toggle would reorder options, sorting the unsorted
    // copy in place.  Sorted from the unsorted order, so ties fall as they would after toggling.
    const sortToggleReorders = (column, unsortedOptions, sortedOptions, hasSortColumn) => {

        const toggledSortConfig = itemSettings.getToggledSortConfig(column.columnIdOrHeading);

        sortOptions(column, unsortedOptions, toggledSortConfig, hasSortColumn);

        for (let i = 0; i < sortedOptions.length; i++) {
            if (unsortedOptions[i] !== sortedOptions[i]) return true;
        }

        return false;
    };

    // Sorts an item's options, flagging the array with whether the "Sort" toggle would reorder
    // them, as the toggle is only shown where it would.
    const sortOptionsAndFlagToggleEffect = (column, options, sortConfig, hasSortColumn) => {

        const unsortedOptions = options.slice();

        sortOptions(column, options, sortConfig, hasSortColumn);

        options.sortToggleChangesOrder =
            sortToggleReorders(column, unsortedOptions, options, hasSortColumn);
    };

    // A grouping level's options come from its group rows (see the -group-options module).
    const {
        countsGroupsForColumn,
        buildGroupOptions,
        getDistinctGroupValuesForColumnIndex,
        getGroupTotalDisplayValue
    } = Ren.FilterModule_Counts_GroupOptions(s, { sortOptionsAndFlagToggleEffect });

    // Builds an item's { value, baseText } options, uncached (see buildOptions).
    const buildFlatOptions = (column) => {

        let options;

        const readBinValue = binValueReader(column.columnIdOrHeading);

        const settings = getCountsDataGroupingSettingsForColumn(column.columnIdOrHeading);

        if (readBinValue) {

            // Read in sortable form, so the item filters on the bin shown but orders by the key
            // the binning function gave it.
            options = DerivedSettings
                .readGroupByValues(
                    settings,
                    tabularData,
                    column.columnIndex,
                    (value) => binning.binSortKey(column.columnIdOrHeading, value)
                )
                .map(sortKey => {

                    const value = Ren.TextUtils.stripSortPrefix(String(sortKey));

                    return {
                        value,
                        baseText: Ren.ValueDisplayLabel(value),
                        valueSortKey: String(sortKey)
                    };
                });
        }
        else if (column.isEnum) {

            options = Object.values(column.columnModel.EnumValues)
                .map(label => ({ value: label, baseText: label }));
        }
        else if (column.isBoolean) {

            options = BOOLEAN_OPTIONS.map(option => ({
                value: option.value,
                baseText: option.text
            }));
        }
        else {

            options = columnInfo.getDistinctValuesForColumn(column)
                .map(value => ({
                    value: String(value),
                    baseText: Ren.ValueDisplayLabel(value)
                }));
        }

        // Drops values with no rows left.  Groups are formed from every row, so a filtered-out
        // value reads as a zero count rather than being absent.
        if (settings._filterModuleCrossFiltered && countColumnIndex >= 0) {

            const countsByValue = readAggregatedValuesByValue(
                settings,
                column.columnIndex,
                countColumnIndex,
                readBinValue
            );

            const presentOptions = [];

            for (let i = 0; i < options.length; i++) {

                const count = countsByValue.get(String(options[i].value));
                if (count != null && Number(count) > 0) presentOptions.push(options[i]);
            }

            options = presentOptions;
        }

        const valueColumnIndex = columnInfo.getValueColumnIndex(column.columnIdOrHeading);
        const displayValuesByValue =
            readAggregatedValuesByValue(settings, column.columnIndex, valueColumnIndex, readBinValue);

        for (let i = 0; i < options.length; i++) {
            options[i].aggregatedValue = displayValuesByValue.get(String(options[i].value)) ?? 0;
        }

        const sortConfig = itemSettings.getSortConfig(column.columnIdOrHeading);

        // Read under a value sort too, for sortToggleChangesOrder.
        if (sortConfig.column) {

            const sortColumnIndex = tabularData.columnResolver.getColumnIndex(sortConfig.column);

            const sortValuesByValue = sortColumnIndex === valueColumnIndex
                ? displayValuesByValue
                : readAggregatedValuesByValue(
                    settings,
                    column.columnIndex,
                    sortColumnIndex,
                    readBinValue
                );

            for (let i = 0; i < options.length; i++) {
                options[i].sortValue = sortValuesByValue.get(String(options[i].value)) ?? 0;
            }
        }

        sortOptionsAndFlagToggleEffect(column, options, sortConfig, !!sortConfig.column);

        return options;
    };

    // Gets an item's options.  The array is the cached one, so must not be written to.
    const buildOptions = (column) => {

        if (filterTarget.isGroupingTarget) return buildGroupOptions(column);

        const columnIdOrHeading = column.columnIdOrHeading;

        return getCachedItemResult(
            "options",
            [columnIdOrHeading],
            getOwnCombinationKey(columnIdOrHeading),
            null,
            () => buildFlatOptions(column)
        );
    };

    // Totals-only settings filtered by the column's own selection as well, so the total covers
    // only the selected options.
    const createSelectedTotalSettingsForColumn = (columnIdOrHeading) => {

        const prepare = (settings) => {

            filtering.applyCrossFilterToScratchSettings(
                settings,
                [columnIdOrHeading],
                getOwnCombinationKey(columnIdOrHeading)
            );

            // Applied even for a group-level filter that wouldn't remove the rows, so the figure
            // reads as the total of what is ticked.
            const ownFilter = filtering.getColumnFilter(columnIdOrHeading);

            if (ownFilter == null) return;

            // A binned selection names bins, so is applied as its predicate.
            if (binning.hasBinning(columnIdOrHeading)) {

                const predicates =
                    FilterAccessors.getRowFilterPredicates(settings.dataRows, tabularData);

                predicates.push(
                    filtering.buildBinnedIncludePredicate(columnIdOrHeading, ownFilter)
                );

                FilterAccessors.setRowFilterPredicates(settings.dataRows, tabularData, predicates);
                return;
            }

            const columnValueFilters =
                FilterAccessors.getColumnValueFilters(settings.dataRows, tabularData);

            columnValueFilters[columnIdOrHeading] = ownFilter.slice();
            FilterAccessors.setColumnValueFilters(settings.dataRows, tabularData, columnValueFilters);
        };

        return createDerivedSettings(
            "filter-module-selected-total",
            prepare,
            [],
            buildTotalColumns(columnIdOrHeading, columnIdOrHeading)
        );
    };

    const getSelectedTotalSettingsForColumn = (columnIdOrHeading) =>
        selectedTotalSettingsByColumn.get(columnIdOrHeading);

    // Gets the summary stats of a settings' grand-total group, computing only those the format
    // functions read.
    const getTotalsGroupSummaryStats = (settings, valueColumnIndex, formatFunctions) => {

        const totalsGrouping = DerivedSettings.getTotalsGrouping(settings);
        if (!totalsGrouping) return null;

        settings.summaryStats.populateStatsUsedByFunctions(
            formatFunctions,
            valueColumnIndex,
            totalsGrouping
        );

        return totalsGrouping.firstGroup()?.summaryStats ?? null;
    };

    // Gets the stats a "Show as" format is relative to: the grand-total group's, which serve as
    // both group and overall stats.  Null when there is no value format or value column.
    const readValueSummaryStats = (columnIdOrHeading, getSettings) => {

        const formatFunctions = columnInfo.getValueFormatFunctions(columnIdOrHeading);
        if (!formatFunctions) return null;

        const valueColumnIndex = columnInfo.getValueColumnIndex(columnIdOrHeading);
        if (valueColumnIndex == null || valueColumnIndex < 0) return null;

        const stats = getTotalsGroupSummaryStats(getSettings(), valueColumnIndex, formatFunctions);

        return stats ? { group: stats, overall: stats } : null;
    };

    // Gets a flat item's value summary stats from its counts grouping.
    const getValueSummaryStats = (columnIdOrHeading) => {

        // A group-sourced item has no grouping of its own, so no stats to state a value against.
        if (filterTarget.isGroupingTarget) return null;

        return getCachedItemResult(
            "value-summary-stats",
            [columnIdOrHeading],
            getOwnCombinationKey(columnIdOrHeading),
            null,
            () => readValueSummaryStats(
                columnIdOrHeading,
                () => getCountsDataGroupingSettingsForColumn(columnIdOrHeading)
            )
        );
    };

    const getTotalSettingsForColumn = (columnIdOrHeading) =>
        filtering.getColumnFilter(columnIdOrHeading) == null
            ? getCountsDataGroupingSettingsForColumn(columnIdOrHeading)
            : getSelectedTotalSettingsForColumn(columnIdOrHeading);

    // Reads a totals-row figure, or null when the totals row is "None" or has no value column, in
    // which case getSettings is never called.
    const readTotalDisplayValue = (valueColumnKey, totalAggregationColumnKey, getSettings) => {

        if (itemSettings.getTotalAggregationType(totalAggregationColumnKey) === "None") return null;

        const valueColumnIndex = columnInfo.getValueColumnIndex(valueColumnKey);
        if (valueColumnIndex == null || valueColumnIndex < 0) return null;

        return DerivedSettings.readTotalValue(getSettings(), tabularData, valueColumnIndex);
    };

    // Aggregations whose total over a subset can be added up from the options' own figures.
    const ADDITIVE_AGGREGATION_TYPES = { Sum: true, Count: true };

    // Gets the aggregation an item's figures carry: its value column's, or Sum of the row count.
    const getEffectiveValueAggregationType = (columnIdOrHeading) => {

        const valueConfig = itemSettings.getValueConfig(columnIdOrHeading);

        return valueConfig.column && valueConfig.column !== COUNT_COLUMN_HEADING
            ? valueConfig.aggregationType
            : "Sum";
    };

    // Gets a value indicating whether a totals row can be added up from the item's figures: the
    // same column, aggregated the same additive way, with no deduplication to count a value twice.
    // figureColumnKey is where the figures and totals-row settings are keyed.
    const canAddUpTotalFromFigures = (valueColumnKey, figureColumnKey) => {

        const totalAggregationType = itemSettings.getTotalAggregationType(figureColumnKey);

        if (!ADDITIVE_AGGREGATION_TYPES[totalAggregationType]) return false;

        const valueColumnIndex = columnInfo.getValueColumnIndex(valueColumnKey);

        if (valueColumnIndex == null || valueColumnIndex < 0) return false;

        if (columnInfo.getValueColumnIndex(figureColumnKey) !== valueColumnIndex) return false;

        if (getEffectiveValueAggregationType(figureColumnKey) !== totalAggregationType) {
            return false;
        }

        if (itemSettings.getValueConfig(figureColumnKey).withRespectToColumn) return false;

        return !itemSettings.getTotalAggregateWithRespectToColumn(figureColumnKey);
    };

    // Adds up a selected subset's total from its options' figures, saving a second grouping of the
    // dataset, or returns null where the aggregation doesn't add up.
    const addUpSelectedTotalFromOptions = (column, ownFilter) => {

        if (!canAddUpTotalFromFigures(column.columnIdOrHeading, column.columnIdOrHeading)) {
            return null;
        }

        // A set, so a column with thousands of options doesn't scan the selection once per option.
        const selectedValues = new Set();

        for (let i = 0; i < ownFilter.length; i++) selectedValues.add(String(ownFilter[i]));

        const options = buildOptions(column);

        let total = 0;

        for (let i = 0; i < options.length; i++) {

            if (!selectedValues.has(String(options[i].value))) continue;

            const value = Number(options[i].aggregatedValue);

            // A text figure (Concatenate, DistinctValues) can't be added up.
            if (!Number.isFinite(value)) return null;

            total += value;
        }

        return total;
    };

    // Gets a flat item's totals-row figure, adding up the selected options where it can and
    // otherwise recomputing it over their rows.
    const getTotalDisplayValue = (column) => {

        if (filterTarget.isGroupingTarget) return getGroupTotalDisplayValue(column);

        const columnIdOrHeading = column.columnIdOrHeading;
        const ownFilter = filtering.getColumnFilter(columnIdOrHeading);

        // Keyed on the item's own selection, as the total is the one figure its own ticks change.
        return getCachedItemResult(
            "total",
            [columnIdOrHeading],
            getOwnCombinationKey(columnIdOrHeading),
            JSON.stringify(ownFilter ?? null),
            () => {

                const addedUp = ownFilter == null
                    ? null
                    : addUpSelectedTotalFromOptions(column, ownFilter);

                if (addedUp !== null) return addedUp;

                return readTotalDisplayValue(
                    columnIdOrHeading,
                    columnIdOrHeading,
                    () => getTotalSettingsForColumn(columnIdOrHeading)
                );
            }
        );
    };

    // The grouping hierarchy an item's values sit in, built on the machinery above.
    const hierarchy = Ren.FilterModule_Counts_Hierarchy(s, {
        createDerivedSettings,
        buildAggregatedColumns,
        buildHierarchyTotalColumns,
        readTotalDisplayValue,
        readValueSummaryStats,
        getCachedItemResult,
        canAddUpTotalFromFigures,
        sortToggleReorders
    });

    const {
        getHierarchyColumns,
        getAncestorColumnsForLeaf,
        getHierarchyTotalDisplayValue,
        getHierarchyValueSummaryStats,
        buildHierarchyTree
    } = hierarchy;

    return {
        invalidateCountsForColumn,
        invalidateAllCounts,
        releaseSettingsBuiltForRender,
        countsGroupsForColumn,
        buildOptions,
        getDistinctGroupValuesForColumnIndex,
        getValueSummaryStats,
        getHierarchyValueSummaryStats,
        getTotalDisplayValue,
        getHierarchyTotalDisplayValue,
        getHierarchyColumns,
        getAncestorColumnsForLeaf,
        buildHierarchyTree
    };
};
