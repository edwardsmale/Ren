/**
 * Services related to checking for the existence of filters.
 */
Ren.DataGroupingSettings_Services_HasFilter = (() => {

    // Distinct filter values per distinct-CV array, a safe WeakMap key as it lives as long as the
    // tabularData.  Re-decompressing per call dominated render on high-cardinality columns.
    const distinctFilterValueSetCache = new WeakMap();

    const getDistinctFilterValueSet = (tabularData, columnIndex) => {

        const distinctCVs = tabularData.getDistinctColumnCV(columnIndex);

        let distinctSet = distinctFilterValueSetCache.get(distinctCVs);

        if (distinctSet) return distinctSet;

        distinctSet = new Set();
        const compressionDictionary = tabularData.CompressionDictionary;

        for (let i = 0; i < distinctCVs.length; i++) {

            const decompressed = compressionDictionary.decompressValue(distinctCVs[i], columnIndex);
            // Filter sets hold NULL as the sentinel, else an "all values" filter reads as active.
            distinctSet.add(decompressed == null ? Ren.NullSentinel : decompressed.toString());
        }

        distinctFilterValueSetCache.set(distinctCVs, distinctSet);

        return distinctSet;
    };

    // Each distinct value's ordinal, and a stamp per ordinal naming the walk that last reached it,
    // held so that the frequently-run contains-all walk allocates nothing.
    const walkScratchCache = new WeakMap();

    const getWalkScratch = (distinctSet) => {

        let scratch = walkScratchCache.get(distinctSet);

        if (scratch) return scratch;

        const ordinals = new Map();

        distinctSet.forEach((value) => ordinals.set(value, ordinals.size));

        scratch = { ordinals, stamps: new Int32Array(ordinals.size), generation: 0 };
        walkScratchCache.set(distinctSet, scratch);

        return scratch;
    };

    /**
     * Returns a value indicating whether the specified column value filter contains all the values
     * in the data.
     */
    const columnValueFilterContainsAllDataValues = (tabularData, columnValueFilters, columnIdOrHeading) => {

        if (!tabularData?.columnResolver?.getColumnIndex) return false;

        const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

        if (columnIndex === null) return false;

        const filterValues = columnValueFilters[columnIdOrHeading];

        if (!filterValues) return false;

        const distinctSet = getDistinctFilterValueSet(tabularData, columnIndex);

        if (filterValues.length < distinctSet.size) return false;

        // Stamping this walk's number against each value's ordinal stops duplicate filter values
        // inflating the count without allocating a Set, which was most of the cost.
        const scratch = getWalkScratch(distinctSet);
        const ordinals = scratch.ordinals;
        const stamps = scratch.stamps;
        const generation = ++scratch.generation;

        let matched = 0;

        for (let i = 0; i < filterValues.length; i++) {

            const ordinal = ordinals.get(filterValues[i]);

            if (ordinal === undefined || stamps[ordinal] === generation) continue;

            stamps[ordinal] = generation;

            if (++matched === ordinals.size) return true;
        }

        return matched === ordinals.size;
    };

    /**
     * Gets a value indicating whether a column's value filter actually restricts anything.  A
     * positive filter listing every value is no filter, and neither is a negated one listing none.
     */
    const isColumnValueFilterActive = (
        tabularData, columnValueFilters, columnIdOrHeading, isNegated
    ) => {

        const filterValues = columnValueFilters[columnIdOrHeading];

        if (!filterValues) return false;

        if (isNegated) return filterValues.length > 0;

        return !columnValueFilterContainsAllDataValues(
            tabularData,
            columnValueFilters,
            columnIdOrHeading
        );
    };

    /**
     * Returns the number of columns that have a column value filter applied.
     */
    const countActiveColumnFilters = (tabularData, dataGroupingSettings) => {

        const columnValueFilters =
            Ren.DataGroupingSettings_Services_FilterAccessors.getColumnValueFilters(
                dataGroupingSettings.dataRows,
                tabularData
            );

        if (!columnValueFilters) return 0;

        const negatedColumns = Ren.FilterNegation.getNegatedColumnSet(
            dataGroupingSettings.dataRows,
            tabularData
        );

        let filterCount = 0;

        for (const columnIdOrHeading in columnValueFilters) {

            if (!columnValueFilters[columnIdOrHeading]) continue;

            if (isColumnValueFilterActive(
                tabularData,
                columnValueFilters,
                columnIdOrHeading,
                negatedColumns.has(columnIdOrHeading)
            )) {

                filterCount++;
            }
        }

        return filterCount;
    };

    /**
     * Returns a value indicating whether any row-filter predicates (combination filters, filter
     * functions) are applied at the data row level.
     */
    const hasRowFilterPredicates = (tabularData, dataGroupingSettings) => {

        return Ren.DataGroupingSettings_Services_FilterAccessors.getRowFilterPredicates(
            dataGroupingSettings.dataRows,
            tabularData
        ).length > 0;
    };

    /**
     * Returns a value indicating whether any column value filters or row-filter predicates are
     * applied, so that settings carrying only predicates still take effect.
     */
    const hasFilter = (tabularData, dataGroupingSettings) => {

        return countActiveColumnFilters(tabularData, dataGroupingSettings) > 0
            || hasRowFilterPredicates(tabularData, dataGroupingSettings);
    };

    /**
     * Returns a value indicating whether multiple columns have column value filters.
     */
    const hasMultipleColumnFilters = (tabularData, dataGroupingSettings) => {

        return countActiveColumnFilters(tabularData, dataGroupingSettings) > 1;
    };

    /**
     * Returns a value indicating whether the specified column carries a compare filter in the
     * specified filter set parent.
     */
    const hasCompareFilter = (tabularData, filterSetParent, columnIdOrHeading) => {

        if (!filterSetParent) return false;

        const predicates = Ren.DataGroupingSettings_Services_FilterAccessors.getRowFilterPredicates(
            filterSetParent,
            tabularData
        );

        return Ren.FilterCompareOperators
            .getComparePredicatesForColumn(predicates, columnIdOrHeading).length > 0;
    };

    /**
     * Returns a value indicating whether the specified column has a column value filter or a
     * compare filter applied.
     */
    const hasColumnFilter = (tabularData, dataGroupingSettings, columnIdOrHeading) => {

        const filterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;

        if (hasCompareFilter(tabularData, dataGroupingSettings.dataRows, columnIdOrHeading)) {

            return true;
        }

        const dataRowsColumnValueFilters = filterAccessors.getColumnValueFilters(
            dataGroupingSettings.dataRows,
            tabularData
        );

        if (isColumnValueFilterActive(
            tabularData,
            dataRowsColumnValueFilters,
            columnIdOrHeading,
            Ren.FilterNegation.isNegatedColumn(
                dataGroupingSettings.dataRows,
                tabularData,
                columnIdOrHeading
            )
        )) {

            return true;
        }

        // Group-rows tab filters are stored on the second-to-last grouping.
        try {

            const secondToLastGrouping = dataGroupingSettings.groupings?.secondToLastGrouping?.();

            if (secondToLastGrouping && secondToLastGrouping.filterSet) {

                const tabFilter = secondToLastGrouping.filterSet[tabularData.Title];
                const groupingColumnValueFilters = tabFilter?.columnValueFilters;

                if (groupingColumnValueFilters && isColumnValueFilterActive(
                    tabularData,
                    groupingColumnValueFilters,
                    columnIdOrHeading,
                    Ren.FilterNegation.isNegatedColumn(
                        secondToLastGrouping,
                        tabularData,
                        columnIdOrHeading
                    )
                )) {

                    return true;
                }
            }
        }
        catch (e) {

            // Defensive: ignore and fall through.
        }

        return false;
    };

    /**
     * Gets a value indicating whether one grouping level has a column value filter or a compare
     * filter on the specified column.
     */
    const hasGroupingColumnFilter = (tabularData, grouping, columnIdOrHeading) => {

        if (hasCompareFilter(tabularData, grouping, columnIdOrHeading)) return true;

        const columnValueFilters = grouping?.filterSet?.[tabularData.Title]?.columnValueFilters;

        return !!columnValueFilters && isColumnValueFilterActive(
            tabularData,
            columnValueFilters,
            columnIdOrHeading,
            Ren.FilterNegation.isNegatedColumn(grouping, tabularData, columnIdOrHeading)
        );
    };

    return {
        columnValueFilterContainsAllDataValues,
        getDistinctFilterValueSet,
        isColumnValueFilterActive,
        hasFilter,
        hasRowFilterPredicates,
        hasMultipleColumnFilters,
        hasColumnFilter,
        hasGroupingColumnFilter,
        hasCompareFilter
    };
})();
