/**
 * Provides accessor methods for working with filter sets in DataGroupingSettings objects.
 */
Ren.DataGroupingSettings_Services_FilterAccessors = (() => {

    /**
     * Creates whatever of the filterSet, the data tab's entry in it and that entry's
     * columnValueFilters and rowFilter is not there already.
     * @param {object} filterSetParent Either dataRows or a grouping.
     */
    const ensureTabFiltersExist = (filterSetParent, tabularData) => {

        const dataTabTitle = tabularData.Title;

        filterSetParent.filterSet ??= {};

        if (filterSetParent.filterSet[dataTabTitle] === undefined) {
            filterSetParent.filterSet[dataTabTitle] = {};
        }

        const tabFilters = filterSetParent.filterSet[dataTabTitle];

        tabFilters.columnValueFilters ??= {};
        tabFilters.rowFilter ??= {};
    };

    const tabFiltersExist = (filterSetParent, tabularData) => {

        return !!filterSetParent?.filterSet?.[tabularData.Title];
    };

    const cleanupTabFiltersIfEmpty = (filterSetParent, tabularData) => {

        const tabFilters = filterSetParent.filterSet?.[tabularData.Title];

        if (!tabFilters) return;

        // Both kinds of mark outlive the filters they describe, so an entry holding nothing but
        // marks is kept: clearing a filter must not throw away the mark for the next one.
        if (tabFilters.includedWhenSavingColumns?.length) return;

        if (tabFilters.negatedColumns?.length) return;

        if (Ren.ObjectUtils.isEmptyObject(tabFilters.columnValueFilters) &&
            Ren.ObjectUtils.isEmptyObject(tabFilters.rowFilter)) {

            delete filterSetParent.filterSet[tabularData.Title];

            if (Ren.ObjectUtils.isEmptyObject(filterSetParent.filterSet)) {
                delete filterSetParent.filterSet;
            }
        }
    };

    /**
     * All the tab titles a filterSetParent holds filters for.
     * @returns {string[]}
     */
    const getAllTabTitles = (filterSetParent) => {

        if (!filterSetParent?.filterSet) return [];

        return Object.keys(filterSetParent.filterSet);
    };

    /**
     * Gets the array containing all the column filters for the specified data tab's filter set.
     */
    const getColumnValueFilters = (filterSetParent, tabularData) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        return filterSetParent.filterSet[tabularData.Title].columnValueFilters;
    };

    /**
     * Sets the array containing all the column filters for the specified data tab's filter set.
     */
    const setColumnValueFilters = (filterSetParent, tabularData, columnValueFilters) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        filterSetParent.filterSet[tabularData.Title].columnValueFilters = columnValueFilters;
    };

    /**
     * Clears all column value filters for the specified data tab's filter set.
     */
    const clearColumnValueFilters = (filterSetParent, tabularData) => {

        if (!tabFiltersExist(filterSetParent, tabularData)) return;

        Ren.ObjectUtils.recursivelyRemoveAllProperties(
            filterSetParent.filterSet[tabularData.Title].columnValueFilters
        );

        cleanupTabFiltersIfEmpty(filterSetParent, tabularData);
    };

    /**
     * Gets the array of filter values for the specified column in the specified data tab's filter 
     * set.
     */
    const getColumnFilterForColumn = (filterSetParent, tabularData, columnIdOrHeading) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        const columnValueFilters = filterSetParent.filterSet[tabularData.Title].columnValueFilters;

        return columnValueFilters[columnIdOrHeading];
    };

    /**
     * Sets the array of filter values for the specified column in the specified data tab's filter
     * set.  Converts all values to strings.
     */
    const setColumnFilterForColumn = (filterSetParent, tabularData, columnIdOrHeading, filterValues) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        const columnValueFilters = filterSetParent.filterSet[tabularData.Title].columnValueFilters;

        columnValueFilters[columnIdOrHeading] = filterValues.map(v => v?.toString() ?? "");
    };

    /**
     * Clears the filter for the specified column in the specified data tab's filter set.
     */
    const clearColumnFilterForColumn = (filterSetParent, tabularData, columnIdOrHeading) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        const columnValueFilters = getColumnValueFilters(filterSetParent, tabularData);

        delete columnValueFilters[columnIdOrHeading];

        cleanupTabFiltersIfEmpty(filterSetParent, tabularData);
    };

    /**
     * Gets the data tab's row-filter predicates - combination filters and filter functions held
     * alongside the column value filters - or an empty array where it has none.
     */
    const getRowFilterPredicates = (filterSetParent, tabularData) => {

        const predicates = filterSetParent?.filterSet?.[tabularData.Title]?.rowFilter?.predicates;

        return Array.isArray(predicates) ? predicates : [];
    };

    /**
     * Sets the row-filter predicate list for the specified data tab's filter set.  An empty list
     * removes the predicates, and the whole tab entry when no column filter remains.
     */
    const setRowFilterPredicates = (filterSetParent, tabularData, predicates) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        const rowFilter = filterSetParent.filterSet[tabularData.Title].rowFilter;

        if (predicates && predicates.length > 0) {
            rowFilter.predicates = predicates;
        }
        else {

            delete rowFilter.predicates;
        }

        cleanupTabFiltersIfEmpty(filterSetParent, tabularData);
    };

    /**
     * Clears the row-filter predicates for the specified data tab's filter set.
     */
    const clearRowFilterPredicates = (filterSetParent, tabularData) => {

        if (!tabFiltersExist(filterSetParent, tabularData)) return;

        const rowFilter = filterSetParent.filterSet[tabularData.Title].rowFilter;

        if (rowFilter) {
            delete rowFilter.predicates;
        }

        cleanupTabFiltersIfEmpty(filterSetParent, tabularData);
    };

    /**
     * Gets the columns whose filters in the specified data tab's filter set belong to the report
     * itself, marked as such by a report author ("Include when saving settings" on a filter module
     * item).  Only a marked column's filter is written to the settings file; every other filter is
     * somebody exploring the report.
     *
     * The marks sit beside the filters they describe, on the same filter set parent, so they can
     * equally be written by hand, and so a filter module pointed at a grouping level marks that
     * level's filters rather than the data rows'.
     */
    const getIncludedWhenSavingColumns = (filterSetParent, tabularData) => {

        const includedColumns =
            filterSetParent?.filterSet?.[tabularData.Title]?.includedWhenSavingColumns;

        return Array.isArray(includedColumns) ? includedColumns : [];
    };

    /**
     * Gets a value indicating whether the specified column's filter in the specified data tab's
     * filter set is marked to be included when the settings are saved.
     */
    const isIncludedWhenSavingColumn = (filterSetParent, tabularData, columnIdOrHeading) =>
        getIncludedWhenSavingColumns(filterSetParent, tabularData)
            .indexOf(columnIdOrHeading) !== -1;

    /**
     * Replaces the list of columns marked to be included when saving for the specified data tab's
     * filter set.  An empty list removes the marks altogether.
     */
    const setIncludedWhenSavingColumns = (filterSetParent, tabularData, includedColumns) => {

        if (!includedColumns.length && !tabFiltersExist(filterSetParent, tabularData)) return;

        ensureTabFiltersExist(filterSetParent, tabularData);

        const tabFilters = filterSetParent.filterSet[tabularData.Title];

        if (includedColumns.length) {
            tabFilters.includedWhenSavingColumns = includedColumns;
        }
        else {

            delete tabFilters.includedWhenSavingColumns;
        }

        cleanupTabFiltersIfEmpty(filterSetParent, tabularData);
    };

    /**
     * Marks (or unmarks) the specified column's filter in the specified data tab's filter set to be
     * included when the settings are saved.
     */
    const setIncludedWhenSavingColumn = (
        filterSetParent,
        tabularData,
        columnIdOrHeading,
        isIncluded
    ) => {

        const includedColumns = getIncludedWhenSavingColumns(filterSetParent, tabularData).slice();
        const columnIndex = includedColumns.indexOf(columnIdOrHeading);

        if (isIncluded) {

            if (columnIndex !== -1) return;

            includedColumns.push(columnIdOrHeading);
        }
        else {

            if (columnIndex === -1) return;

            includedColumns.splice(columnIndex, 1);
        }

        setIncludedWhenSavingColumns(filterSetParent, tabularData, includedColumns);
    };

    /**
     * Gets the columns whose filters in the specified data tab's filter set are negative: their
     * listed values are the ones to leave OUT, rather than the only ones to keep.  A positive
     * filter freezes a report around the values that existed when it was written, whereas a
     * negative one shows anything the data source gains afterwards.
     *
     * An empty (or absent) value list on a negated column excludes nothing, and so is no filter at
     * all - the mirror image of an empty positive list, which shows nothing.
     */
    const getNegatedFilterColumns = (filterSetParent, tabularData) => {

        const negatedColumns = filterSetParent?.filterSet?.[tabularData.Title]?.negatedColumns;

        return Array.isArray(negatedColumns) ? negatedColumns : [];
    };

    /**
     * Gets a value indicating whether the specified column's filter in the specified data tab's
     * filter set names the values to leave out rather than the values to keep.
     */
    const isNegatedFilterColumn = (filterSetParent, tabularData, columnIdOrHeading) =>
        getNegatedFilterColumns(filterSetParent, tabularData).indexOf(columnIdOrHeading) !== -1;

    /**
     * Replaces the list of columns whose filters are negative for the specified data tab's filter
     * set.  An empty list removes the marks altogether.
     */
    const setNegatedFilterColumns = (filterSetParent, tabularData, negatedColumns) => {

        if (!negatedColumns.length && !tabFiltersExist(filterSetParent, tabularData)) return;

        ensureTabFiltersExist(filterSetParent, tabularData);

        const tabFilters = filterSetParent.filterSet[tabularData.Title];

        if (negatedColumns.length) {
            tabFilters.negatedColumns = negatedColumns;
        }
        else {

            delete tabFilters.negatedColumns;
        }

        cleanupTabFiltersIfEmpty(filterSetParent, tabularData);
    };

    /**
     * Marks (or unmarks) the specified column's filter in the specified data tab's filter set as
     * naming the values to leave out rather than the values to keep.
     */
    const setNegatedFilterColumn = (filterSetParent, tabularData, columnIdOrHeading, isNegated) => {

        const negatedColumns = getNegatedFilterColumns(filterSetParent, tabularData).slice();
        const columnIndex = negatedColumns.indexOf(columnIdOrHeading);

        if (isNegated) {

            if (columnIndex !== -1) return;

            negatedColumns.push(columnIdOrHeading);
        }
        else {

            if (columnIndex === -1) return;

            negatedColumns.splice(columnIndex, 1);
        }

        setNegatedFilterColumns(filterSetParent, tabularData, negatedColumns);
    };

    /**
     * Leaves values out of a column in the specified data tab's filter set.  A positive filter on
     * the column loses them from the values it keeps; otherwise they are added to the column's
     * negative filter.
     */
    const excludeColumnFilterValues = (
        filterSetParent,
        tabularData,
        columnIdOrHeading,
        excludedValues
    ) => {

        const isNegated = isNegatedFilterColumn(filterSetParent, tabularData, columnIdOrHeading);

        const existingValues =
            getColumnFilterForColumn(filterSetParent, tabularData, columnIdOrHeading);

        const filterValues = [];

        if (!isNegated && Array.isArray(existingValues)) {

            const excludedValueSet = new Set();

            for (let i = 0; i < excludedValues.length; i++) {
                excludedValueSet.add(excludedValues[i]?.toString() ?? Ren.NullSentinel);
            }

            for (let i = 0; i < existingValues.length; i++) {

                if (!excludedValueSet.has(existingValues[i])) filterValues.push(existingValues[i]);
            }

            setColumnFilterForColumn(filterSetParent, tabularData, columnIdOrHeading, filterValues);
            return;
        }

        for (let i = 0; i < (existingValues?.length ?? 0); i++) {
            filterValues.push(existingValues[i]);
        }

        for (let i = 0; i < excludedValues.length; i++) {

            // A numeric column's NULL is a null value, which filters as the sentinel.
            const excludedValue = excludedValues[i]?.toString() ?? Ren.NullSentinel;

            if (filterValues.indexOf(excludedValue) === -1) filterValues.push(excludedValue);
        }

        setColumnFilterForColumn(filterSetParent, tabularData, columnIdOrHeading, filterValues);
        setNegatedFilterColumn(filterSetParent, tabularData, columnIdOrHeading, true);
    };

    /**
     * Toggles the presence of a filter value for the specified column in the specified data tab's
     * filter set.
     */
    const toggleColumnFilterValue = (filterSetParent, tabularData, columnIdOrHeading, filterValue) => {

        ensureTabFiltersExist(filterSetParent, tabularData);

        const columnValueFilters = filterSetParent.filterSet[tabularData.Title].columnValueFilters;

        columnValueFilters[columnIdOrHeading] ??= [];

        const filterValues = columnValueFilters[columnIdOrHeading];

        const valueIndex = filterValues.indexOf(filterValue);

        if (valueIndex === -1) {
            filterValues.push(filterValue);
        }
        else {

            filterValues.splice(valueIndex, 1);
        }
    };

    /**
     * Gets the calc function a grouping level puts one of its group-by columns' values through
     * before grouping by them - its binning function - or null where the column isn't one of that
     * level's group-by columns, or is grouped by its raw value.
     */
    const getGroupByCalcFunction = (grouping, tabularData, columnIdOrHeading) => {

        const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

        if (columnIndex === null || columnIndex === undefined) return null;

        const positionInGroupBy = (grouping.groupByColumnIndexes ?? []).indexOf(columnIndex);

        if (positionInGroupBy === -1) return null;

        return grouping.groupByCalcFunctions?.[positionInGroupBy] ?? null;
    };

    /**
     * Gets a value indicating whether a grouping level's filter on a column can be read as a
     * statement about rows, by comparing the values the filter names against the rows' own.  Only
     * an unbinned group-by column can: every other column holds an aggregated figure no row holds,
     * and a binned one holds its bin, which is read as a predicate instead (see
     * buildBinnedGroupByFilterPredicate).
     */
    const isRowFilterableGroupByColumn = (grouping, tabularData, columnIdOrHeading) => {

        const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

        if (columnIndex === null || columnIndex === undefined) return false;

        const positionInGroupBy = (grouping.groupByColumnIndexes ?? []).indexOf(columnIndex);

        if (positionInGroupBy === -1) return false;

        return !grouping.groupByCalcFunctions?.[positionInGroupBy];
    };

    /**
     * Builds a grouping level's filter on a binned group-by column as the row-level filter it
     * means: a combination predicate over that one column carrying the level's own binning
     * function, so a row is kept when its value bins to one of the values the filter names (or,
     * for a negative filter, when it does not).
     *
     * The values are stated as they read rather than as they sort, since that is how a predicate
     * derives a row's value; a binning function that has to order its bins writes each of them as
     * "<sort key>¬<display text>", and the group values a filter names carry that prefix.
     */
    const buildBinnedGroupByFilterPredicate = (
        columnIdOrHeading,
        calcFunction,
        filterValues,
        isNegated
    ) => {

        const tuples = [];

        for (let i = 0; i < filterValues.length; i++) {

            const filterValue = filterValues[i];

            tuples.push([
                Ren.TextUtils.stripSortPrefix(
                    filterValue === null || filterValue === undefined ? "" : String(filterValue)
                )
            ]);
        }

        return {
            type: isNegated ? "excludeCombinations" : "includeCombinations",
            columns: [columnIdOrHeading],
            calcFunctions: [calcFunction],
            tuples
        };
    };

    /**
     * Gets a value indicating whether a grouping level's compare filter - an Excel-style comparison
     * it holds as a "compare" row-filter predicate - can be read as a statement about rows.  Only
     * one on a group-by column can: on any other column it tests an aggregated figure no row holds.
     *
     * The ranking operators (top / bottom N) rank the level's groups against one another, and the
     * custom function operator is handed a whole group row to test, so neither carries down to a
     * single data row whatever column it names.
     */
    const isRowFilterableComparePredicate = (grouping, tabularData, predicate) => {

        if (predicate?.type !== "compare") return false;

        const columnIndex = tabularData.columnResolver.getColumnIndex(predicate.column);

        if (columnIndex === null || columnIndex === undefined) return false;

        if ((grouping.groupByColumnIndexes ?? []).indexOf(columnIndex) === -1) return false;

        const operator = Ren.FilterCompareOperators.getOperator(predicate.operator);

        return !!operator && !operator.needsScan && !operator.needsRow;
    };

    // A compare predicate's OR group is named by its column and its slot, so a translated filter
    // landing in a slot a data-row filter on the same column already occupies would be ORed with
    // it rather than ANDed.  Translated filters get slots of their own, clear of the UI's.
    const TRANSLATED_COMPARE_SLOT_BASE = 1000000;

    const createTranslatedCompareSlotAllocator = () => {

        let nextSlot = TRANSLATED_COMPARE_SLOT_BASE;

        return () => nextSlot++;
    };

    /**
     * Builds a grouping level's compare filter on a group-by column as the row-level filter it
     * means: the same comparison, made against the value the row holds - or, where the level bins
     * that column, against the bin the row falls in.  A filter from the "Filter groups..." popup
     * already carries a binning function of its own, deriving its value from a raw value rather
     * than from a group's, so that one is left as it is.
     *
     * @param {number} slot The slot the translated filter occupies.
     * @param {number} orGroupLead The slot naming the OR group it belongs to, or null for a filter
     *     that leads its own group.
     */
    const buildGroupByComparePredicate = (grouping, tabularData, predicate, slot, orGroupLead) => {

        const translated = Ren.ObjectUtils.cloneDeep(predicate);

        if (!translated.calcFunction) {

            const calcFunction = getGroupByCalcFunction(grouping, tabularData, predicate.column);

            if (calcFunction) translated.calcFunction = calcFunction;
        }

        translated.slot = slot;

        if (orGroupLead === null) {
            delete translated.orGroup;
        }
        else {

            translated.orGroup = orGroupLead;
        }

        return translated;
    };

    /**
     * Gets the compare filters a grouping level holds that can be honoured as row-level filters,
     * each as the predicate it means against the data rows.
     *
     * An OR group is taken or left whole: dropping one member that no row can answer would narrow
     * the group to the rest rather than leave it alone.  A translated group's members are
     * renumbered together, so they stay ORed with one another and with nothing else.
     */
    const getRowFilterableGroupingComparePredicates = (grouping, tabularData, allocateSlot) => {

        const predicates = grouping.filterSet?.[tabularData.Title]?.rowFilter?.predicates;

        if (!Array.isArray(predicates)) return [];

        // Kept in the order they are held, so the translated list reads the way the level does.
        const orGroupKeys = [];
        const predicatesByOrGroupKey = new Map();
        const isRowFilterableByOrGroupKey = new Map();

        for (let i = 0; i < predicates.length; i++) {

            const predicate = predicates[i];

            if (predicate?.type !== "compare") continue;

            const orGroupKey =
                predicate.column + "|" + Ren.FilterCompareOperators.orGroupLeadOf(predicate);

            if (!predicatesByOrGroupKey.has(orGroupKey)) {

                orGroupKeys.push(orGroupKey);
                predicatesByOrGroupKey.set(orGroupKey, []);
                isRowFilterableByOrGroupKey.set(orGroupKey, true);
            }

            predicatesByOrGroupKey.get(orGroupKey).push(predicate);

            if (!isRowFilterableComparePredicate(grouping, tabularData, predicate)) {
                isRowFilterableByOrGroupKey.set(orGroupKey, false);
            }
        }

        const rowFilterablePredicates = [];

        for (let i = 0; i < orGroupKeys.length; i++) {

            if (!isRowFilterableByOrGroupKey.get(orGroupKeys[i])) continue;

            const orGroupPredicates = predicatesByOrGroupKey.get(orGroupKeys[i]);
            const leadSlot = allocateSlot();

            for (let j = 0; j < orGroupPredicates.length; j++) {

                rowFilterablePredicates.push(buildGroupByComparePredicate(
                    grouping,
                    tabularData,
                    orGroupPredicates[j],
                    j === 0 ? leadSlot : allocateSlot(),
                    j === 0 ? null : leadSlot
                ));
            }
        }

        return rowFilterablePredicates;
    };

    /**
     * Gets the column value filters held by the settings' grouping levels that can be honoured as a
     * row-level filter, as one { grouping, columnValueFilters, negatedColumns, rowFilterPredicates
     * } entry per level that has any.  The grouping itself is carried so that one level's filters
     * can be told from the rest.
     *
     * Filters on a binned group-by column, and compare filters on any group-by column, cannot be
     * matched against a row's own value, so they arrive in rowFilterPredicates instead, ANDed with
     * the column value filters as they are on the level itself.
     *
     * A grid honours a grouping level's filter by hiding groups.  A visualisation with groupings of
     * its own has no such group to hide, and neither has a filter module counting the values that
     * still exist, so both read the filter as the rows it names.  Per level rather than merged, so
     * that two levels filtering the same column intersect rather than replace one another.
     *
     * @param {object} dataGroupingSettings The live settings whose groupings are read.
     */
    const getRowFilterableGroupingColumnValueFilters = (dataGroupingSettings, tabularData) => {

        const entries = dataGroupingSettings?.groupings?.entries ?? [];
        const filtersPerGrouping = [];
        const allocateCompareSlot = createTranslatedCompareSlotAllocator();

        for (let i = 0; i < entries.length; i++) {

            const grouping = entries[i];
            const tabFilters = grouping.filterSet?.[tabularData.Title];

            if (!tabFilters) continue;

            const columnValueFilters = tabFilters.columnValueFilters ?? {};

            const negatedColumns =
                Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters);

            const rowFilterableFilters = {};
            const rowFilterableNegatedColumns = new Set();
            const rowFilterPredicates = getRowFilterableGroupingComparePredicates(
                grouping,
                tabularData,
                allocateCompareSlot
            );

            let anyRowFilterable = false;

            for (const columnIdOrHeading in columnValueFilters) {

                const filterValues = columnValueFilters[columnIdOrHeading];

                if (!Array.isArray(filterValues)) continue;

                const isNegated = negatedColumns.has(columnIdOrHeading);

                if (isRowFilterableGroupByColumn(grouping, tabularData, columnIdOrHeading)) {

                    rowFilterableFilters[columnIdOrHeading] = filterValues;

                    if (isNegated) rowFilterableNegatedColumns.add(columnIdOrHeading);

                    anyRowFilterable = true;
                    continue;
                }

                // A binned group-by column: the filter names bins the rows fall in rather than
                // hold, so it is read as a predicate deriving each row's bin.
                const calcFunction =
                    getGroupByCalcFunction(grouping, tabularData, columnIdOrHeading);

                if (!calcFunction) continue;

                rowFilterPredicates.push(buildBinnedGroupByFilterPredicate(
                    columnIdOrHeading,
                    calcFunction,
                    filterValues,
                    isNegated
                ));
            }

            if (anyRowFilterable || rowFilterPredicates.length) {

                filtersPerGrouping.push({
                    grouping,
                    columnValueFilters: rowFilterableFilters,
                    negatedColumns: rowFilterableNegatedColumns,
                    rowFilterPredicates
                });
            }
        }

        return filtersPerGrouping;
    };

    return {
        ensureTabFiltersExist,
        tabFiltersExist,
        getAllTabTitles,
        getColumnValueFilters,
        setColumnValueFilters,
        clearColumnValueFilters,
        getColumnFilterForColumn,
        setColumnFilterForColumn,
        clearColumnFilterForColumn,
        getRowFilterPredicates,
        setRowFilterPredicates,
        clearRowFilterPredicates,
        getIncludedWhenSavingColumns,
        isIncludedWhenSavingColumn,
        setIncludedWhenSavingColumns,
        setIncludedWhenSavingColumn,
        getNegatedFilterColumns,
        isNegatedFilterColumn,
        setNegatedFilterColumns,
        setNegatedFilterColumn,
        excludeColumnFilterValues,
        toggleColumnFilterValue,
        isRowFilterableGroupByColumn,
        getRowFilterableGroupingColumnValueFilters
    };
})();
