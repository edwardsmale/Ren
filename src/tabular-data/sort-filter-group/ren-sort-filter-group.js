/**
 * Provides sorting, filtering, and grouping functionality for a specific tabular data and
 * data grouping settings.
 */
Ren.SortFilterGroup = (tabularData, dataGroupingSettings, expandedGroups, groupingsAdder) => {

    const FilterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;

    const applyer = Ren.SortFilterGroup_Applyer(
        tabularData,
        dataGroupingSettings,
        expandedGroups
    );

    const onChanged = callback => { applyer.onChanged(callback); };

    // Makes some change to the dataGroupingSettings, maintaining the expanded groups.
    const withExpandedGroupsRestored = action => {

        action();
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Recreates the groupings to account for any changes in filtering.
     */
    const recreateGroupings = () => {

        const groupingsClone = Ren.ObjectUtils.clone(dataGroupingSettings.groupings);
        dataGroupingSettings.repopulateGroupings();
        setGroupingSortOrders(groupingsClone);
    };

    // Utility for filter-related actions.
    const handleFilterAction = filterAction => {

        withExpandedGroupsRestored(() => {

            filterAction();
            recreateGroupings();
        });
    };

    /**
     * The same for a group-level filter action, which additionally announces the filter change,
     * since the group-level accessors below write the grouping entry directly rather than through
     * dataGroupingSettings' own setters.  notifyFilterChanged is used because
     * withExpandedGroupsRestored has already fired the settings-changed event.
     *
     * A group filter only hides group rows, so the groupings aren't rebuilt for it: the applyer
     * reads the filter afresh on each pass.  Legacy settings with an outerFilterSet are the
     * exception, as there the groups the filter excludes are left out of the totals too.
     */
    const handleGroupingFilterAction = (grouping, filterAction) => {

        if (dataGroupingSettings.outerFilterSet) {
            handleFilterAction(filterAction);
        }
        else {

            withExpandedGroupsRestored(() => {

                filterAction();
                groupingsAdder.reapplyOuterFilter(grouping);
            });
        }

        dataGroupingSettings.notifyFilterChanged();
    };

    /**
     * Rebuilds groupings after outerFilterSet has been updated directly on dataGroupingSettings.
     * This re-applies the outer filter and updates row positions without changing data-row filters.
     */
    const applyOuterFilterSet = () => {

        withExpandedGroupsRestored(() => {

            recreateGroupings();
        });
    };

    const getRowIndexesInOutermostGrouping = () => {

        const entries = dataGroupingSettings.groupings.entries;

        if (entries.length === 0) {

            console.warn("No groupings exist in the dataGroupingSettings.");
            return null;
        }
        else if (entries.length === 1) {

            return {
                startRowIndex: 0,
                endRowIndex: tabularData.DataRowCount - 1,
                rowCount: tabularData.DataRowCount
            };
        }
        else {

            const outermostGroup = dataGroupingSettings.groupings.firstGroupOfOutermostGrouping();
            const secondToLastGroup = dataGroupingSettings.groupings.secondToLastGroup();

            // A grouping with no groups in it is what filtering everything out leaves behind, so
            // there is no range of rows to give back.
            if (!outermostGroup || !secondToLastGroup) return null;

            const endRowIndex = outermostGroup.groupRowIndex;
            const startRowIndex = secondToLastGroup.groupRowIndex;
            const rowCount = endRowIndex - startRowIndex + 1;

            return {
                startRowIndex,
                endRowIndex,
                rowCount
            };
        }
    };

    /**
     * Checks if all non-empty values in a column follow the "Qn yyyy" format.  If all are empty,
     * returns false.
     */
    const isQuarterFormatColumn = (columnIndex) => {

        const rowModels = tabularData.RowModels;
        const quarterPattern = /^Q(\d)\s(\d{4})$/;

        const isEmpty = (compressedValue) =>
            compressedValue === null || compressedValue === undefined || compressedValue === "";

        let anyQuarters = false;

        for (let i = 0; i < rowModels.length; i++) {

            const compressedValue = rowModels[i].CV[columnIndex];

            if (isEmpty(compressedValue)) continue;

            const value = tabularData.CompressionDictionary
                .decompressValue(compressedValue, columnIndex)?.toString() ?? "";

            const isQuarter = quarterPattern.test(value);

            if (value && !isQuarter) return false;

            if (isQuarter) anyQuarters = true;
        }

        return anyQuarters;
    };

    // The grouping that owns the given row as one of its group rows, and so is the one stating the
    // sort order for it.  Null where the row is a data row rather than any grouping's group row.
    const findGroupingOwningRow = (rowIndex) => {

        const entries = dataGroupingSettings.groupings.entries;

        for (let i = 0; i < entries.length; i++) {

            if (entries[i].getGroupWithRowIndex(rowIndex)) return entries[i];
        }

        return null;
    };

    // A single-column sort from a header click replaces the whole chain, so any editor-set "then
    // by" tie-break levels are cleared with it (mirrors grouping.setSortOrder, which takes no
    // thenBy).
    const setDataRowsSortOrder = (columnIndex, descending, sortCalcFunction) => {

        const sortOrder = dataGroupingSettings.dataRows.sortOrder;

        sortOrder.columnIndex = columnIndex;
        sortOrder.isDescending = descending;
        sortOrder.sortCalcFunction = sortCalcFunction ?? null;
        sortOrder.thenBy = null;

        delete sortOrder._compiledSortCalcFunctions;
    };

    const applySettingsAndAnnounceChange = () => {

        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    const sortWithCalcFunction = (columnIndex, rowIndex, descending, sortCalcFunction) => {

        if (rowIndex !== -1) {

            const owningGrouping = findGroupingOwningRow(rowIndex);

            if (owningGrouping) {
                owningGrouping.setSortOrder(columnIndex, descending, sortCalcFunction);
            }
            else {

                setDataRowsSortOrder(columnIndex, descending, sortCalcFunction);
            }
        }
        else {

            // No row to sort within: the whole grid sorts the one way, every grouping level and the
            // data rows alike.
            const entries = dataGroupingSettings.groupings.entries;

            for (let i = 0; i < entries.length; i++) {

                entries[i].setSortOrder(columnIndex, descending, sortCalcFunction);
            }

            setDataRowsSortOrder(columnIndex, descending, sortCalcFunction);
        }

        applySettingsAndAnnounceChange();
    };

    // A column holding nothing but "Qn yyyy" values reads as quarters rather than as text, so it
    // sorts by the quarter each value names.
    const getQuarterSortCalcFunction = (columnIndex) =>
        isQuarterFormatColumn(columnIndex) ? { name: "quarter-order" } : null;

    const sort = (columnIndex, rowIndex, descending) => sortWithCalcFunction(
        columnIndex,
        rowIndex,
        descending,
        getQuarterSortCalcFunction(columnIndex)
    );

    /**
     * Gets filter values as the strings filters hold.  A numeric column's NULL cell value is null,
     * which filters as the sentinel; a lone one is kept as a value rather than read as no values.
     */
    const toFilterValues = (values) =>
        (values == null ? [null] : Ren.ArrayUtils.ensureArray(values))
            .map(v => v == null ? Ren.NullSentinel : v.toString());

    const filter = (columnIdOrHeading, filterValues) => {

        filterValues = toFilterValues(filterValues);

        handleFilterAction(() => {

            // The values are the ones to keep, so a negative filter on the column becomes positive.
            FilterAccessors.setNegatedFilterColumn(
                dataGroupingSettings.dataRows,
                tabularData,
                columnIdOrHeading,
                false
            );

            dataGroupingSettings.setColumnFilter(columnIdOrHeading, filterValues);
        });
    };

    /**
     * Leaves values out of a column: taken off the values a positive filter keeps, or else added to
     * its negative filter (see Ren.FilterNegation).
     */
    const excludeValues = (columnIdOrHeading, excludedValues) => {

        excludedValues = toFilterValues(excludedValues);

        handleFilterAction(
            () => dataGroupingSettings.excludeColumnFilterValues(columnIdOrHeading, excludedValues)
        );
    };

    const unfilter = () => {

        handleFilterAction(() => dataGroupingSettings.removeFilter());
    };

    const toggleColumnFilter = (columnIdOrHeading, filterValue) => {

        handleFilterAction(() => dataGroupingSettings.toggleColumnFilter(columnIdOrHeading, filterValue));
    };

    const removeColumnFilter = columnIdOrHeading => {

        handleFilterAction(() => dataGroupingSettings.removeColumnFilter(columnIdOrHeading));
    };

    const removeAllColumnFilters = () => {

        handleFilterAction(() => dataGroupingSettings.removeAllColumnFilters());
    };

    const setAllFilter = (columnIdOrHeading, newFilter) => {

        handleFilterAction(() => dataGroupingSettings.setAllFilter(columnIdOrHeading, newFilter));
    };

    const setRowFilterPredicates = (predicates) => {

        handleFilterAction(() => dataGroupingSettings.setRowFilterPredicates(predicates));
    };

    /**
     * Marks (or unmarks) a data-row column filter as naming the values to leave out rather than the
     * only values to keep (see Ren.FilterNegation).  Applied and announced as any other filter
     * change, since flipping the mark changes which rows the same value list keeps.
     */
    const setColumnFilterNegated = (columnIdOrHeading, isNegated) => {

        handleFilterAction(
            () => dataGroupingSettings.setColumnFilterNegated(columnIdOrHeading, isNegated)
        );
    };

    // ===== Group-level column value filters =====
    //
    // A grouping entry can carry filters of its own, which decide which of that level's groups are
    // shown.  Unlike a data-row filter, which removes rows before anything is aggregated, a group
    // filter only hides group rows: the rows behind a hidden group still count towards its parents
    // and the totals row.
    //
    // Each of these takes the grouping entry itself rather than its position, since entry indexes
    // shift as groupings are added, removed and reordered.

    const setGroupingColumnFilter = (grouping, columnIdOrHeading, filterValues) => {

        handleGroupingFilterAction(grouping, () => FilterAccessors.setColumnFilterForColumn(
            grouping,
            tabularData,
            columnIdOrHeading,
            Ren.ArrayUtils.ensureArray(filterValues)
        ));
    };

    const removeGroupingColumnFilter = (grouping, columnIdOrHeading) => {

        handleGroupingFilterAction(grouping, () => FilterAccessors.clearColumnFilterForColumn(
            grouping,
            tabularData,
            columnIdOrHeading
        ));
    };

    const toggleGroupingColumnFilter = (grouping, columnIdOrHeading, filterValue) => {

        handleGroupingFilterAction(grouping, () => FilterAccessors.toggleColumnFilterValue(
            grouping,
            tabularData,
            columnIdOrHeading,
            filterValue
        ));
    };

    /**
     * The group-level counterpart of setRowFilterPredicates: the row-filter predicates one grouping
     * level carries, which are matched against its group rows rather than against the data rows.
     */
    const setGroupingRowFilterPredicates = (grouping, predicates) => {

        handleGroupingFilterAction(grouping, () => FilterAccessors.setRowFilterPredicates(
            grouping,
            tabularData,
            predicates
        ));
    };

    /**
     * The group-level counterpart of setColumnFilterNegated: marks (or unmarks) one grouping
     * level's filter on a column as naming the values whose groups are hidden rather than the only
     * ones shown.
     */
    const setGroupingColumnFilterNegated = (grouping, columnIdOrHeading, isNegated) => {

        handleGroupingFilterAction(grouping, () => FilterAccessors.setNegatedFilterColumn(
            grouping,
            tabularData,
            columnIdOrHeading,
            isNegated
        ));
    };

    /**
     * The group-level counterpart of removeColumnFilter: takes one grouping level's value filter
     * and compare filters on a column off it, leaving the other levels' filters alone.
     */
    const clearGroupingColumnFilter = (grouping, columnIdOrHeading) => {

        handleGroupingFilterAction(grouping, () => {

            FilterAccessors.clearColumnFilterForColumn(grouping, tabularData, columnIdOrHeading);

            const predicates = FilterAccessors.getRowFilterPredicates(grouping, tabularData);

            const remainingPredicates = Ren.FilterCompareOperators
                .removeComparePredicatesForColumn(predicates, columnIdOrHeading);

            if (remainingPredicates.length !== predicates.length) {

                FilterAccessors.setRowFilterPredicates(
                    grouping,
                    tabularData,
                    remainingPredicates
                );
            }
        });
    };

    /**
     * The group-level counterpart of filter: shows only one grouping level's groups holding the
     * given values in a column.
     */
    const filterGrouping = (grouping, columnIdOrHeading, filterValues) => {

        handleGroupingFilterAction(grouping, () => {

            // The values are the ones to keep, so a negative filter on the column becomes positive.
            FilterAccessors.setNegatedFilterColumn(grouping, tabularData, columnIdOrHeading, false);

            FilterAccessors.setColumnFilterForColumn(
                grouping,
                tabularData,
                columnIdOrHeading,
                toFilterValues(filterValues)
            );
        });
    };

    /**
     * The group-level counterpart of excludeValues: hides one grouping level's groups holding the
     * given values in a column.
     */
    const excludeGroupingValues = (grouping, columnIdOrHeading, excludedValues) => {

        handleGroupingFilterAction(grouping, () => FilterAccessors.excludeColumnFilterValues(
            grouping,
            tabularData,
            columnIdOrHeading,
            toFilterValues(excludedValues)
        ));
    };

    /**
     * Gets the sort order of each grouping, in grouping order. The objects are the live ones, which
     * outlive the groupings holding them.
     */
    const getSortOrders = () => {

        const entries = dataGroupingSettings.groupings.entries;
        const sortOrders = new Array(entries.length);

        for (let i = 0; i < entries.length; i++) {
            sortOrders[i] = entries[i].sortOrder;
        }

        return sortOrders;
    };

    /**
     * Puts sort orders taken by getSortOrders back onto the groupings now standing at those
     * positions.  A null entry leaves the grouping at that position as it is.
     */
    const restoreSortOrders = (sortOrders) => {

        const entriesToApply = new Array(sortOrders.length);

        for (let i = 0; i < sortOrders.length; i++) {
            entriesToApply[i] = { sortOrder: sortOrders[i] };
        }

        setGroupingSortOrders({ entries: entriesToApply });
    };

    /**
     * Sorts a newly added grouping's groups by the columns it groups by: the first group-by column
     * as the primary sort, any others as "then by" levels.  Each level takes the calc function a
     * header click on that column would sort by.
     */
    const setSortOrderToGroupByColumns = (columnIndexes, position) => {

        if (!columnIndexes || columnIndexes.length === 0) return;

        const grouping = dataGroupingSettings.groupings.entries[position];

        if (!grouping) return;

        const thenBy = [];

        for (let i = 1; i < columnIndexes.length; i++) {

            thenBy.push({
                columnIndex: columnIndexes[i],
                isDescending: false,
                sortCalcFunction: getQuarterSortCalcFunction(columnIndexes[i])
            });
        }

        grouping.setSortOrder(
            columnIndexes[0],
            false,
            getQuarterSortCalcFunction(columnIndexes[0]),
            thenBy
        );
    };

    /**
     * Core implementation for adding a grouping: guards against duplicates, sorts the new grouping
     * by the columns it groups by, restores expanded groups afterwards, and fires the
     * groupingsChanged event.  Pass options.sortByGroupByColumns as false to leave the new grouping
     * unsorted.
     */
    const _addGroupingCore = (columnIndexes, columns, groupByCalcFunctions, options) => {

        if (dataGroupingSettings.groupings.groupingAlreadyExists(columnIndexes)) return;
        withExpandedGroupsRestored(() => {

            const numGroupingsBefore = dataGroupingSettings.groupings.numGroupings();
            const bestPosition = Math.max(numGroupingsBefore - 1, 0);

            // Adding a grouping rebuilds every grouping from scratch, so the sort orders the
            // existing ones were carrying are noted here and put back afterwards.
            const previousSortOrders = getSortOrders();

            groupingsAdder.addGrouping(columnIndexes, columns, bestPosition, groupByCalcFunctions);

            if (dataGroupingSettings.groupings.numGroupings() > numGroupingsBefore) {

                // The grouping went in at bestPosition, so every level from there on has moved
                // down one; the new level has no sort order of its own to restore.
                previousSortOrders.splice(bestPosition, 0, null);
            }

            restoreSortOrders(previousSortOrders);

            if (options?.sortByGroupByColumns !== false) {
                setSortOrderToGroupByColumns(columnIndexes, bestPosition);
            }
        });

        Ren.Messages.Events.groupingsChanged.notify(
            tabularData.tabularDataGuid,
            dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.containingReportGuid
        );
    };

    const addGrouping = (columnIndexes, options) =>
        _addGroupingCore(columnIndexes, null, null, options);

    const addGroupingWithCalcFunctions = (columnIndexes, groupByCalcFunctions, options) =>
        _addGroupingCore(columnIndexes, null, groupByCalcFunctions, options);

    const addGroupingWithCalcFunctionsAndColumns =
        (columnIndexes, groupByCalcFunctions, columns, options) =>
            _addGroupingCore(columnIndexes, columns, groupByCalcFunctions, options);

    const replaceGrouping = columnIndexes => {

        removeAllGroupingsExceptOutermost();
        addGrouping(columnIndexes);
    };

    const replaceGroupingWithCalcFunctions = (columnIndexes, groupByCalcFunctions) => {

        removeAllGroupingsExceptOutermost();
        addGroupingWithCalcFunctions(columnIndexes, groupByCalcFunctions);
    };

    const replaceGroupingWithCalcFunctionsAndColumns = (columnIndexes, groupByCalcFunctions, columns) => {

        removeAllGroupingsExceptOutermost();
        addGroupingWithCalcFunctionsAndColumns(columnIndexes, groupByCalcFunctions, columns);
    };

    /**
     * Core implementation for changing a grouping's calc functions or columns: rebuilds all
     * groupings in place, applies the change only to the matching entry (identified by
     * columnIndexes), then restores expanded groups and fires groupingsChanged.
     *
     * @param {Function} resolveColumns - Called per grouping entry; returns the columns object for
     *   that entry.  Receives (entry, isTargetGrouping).
     */
    const _changeGroupingCore = (columnIndexes, groupByCalcFunctions, resolveColumns) => {

        withExpandedGroupsRestored(() => {

            const entries = dataGroupingSettings.groupings.entries;
            const groupingsClone = [];

            for (let i = 0; i < entries.length; i++) {

                const entry = entries[i];
                const isTargetGrouping = entry.groupByColumnIndexes.length === columnIndexes.length &&
                    entry.groupByColumnIndexes.every((index, j) => index === columnIndexes[j]);

                groupingsClone.push(Ren.GroupingsAdder_copyGroupingFlags(entry, {
                    groupByColumnIndexes: entry.groupByColumnIndexes,
                    columns: resolveColumns(entry, isTargetGrouping),
                    groupByCalcFunctions: isTargetGrouping ? groupByCalcFunctions : entry.groupByCalcFunctions,
                    filterSet: entry.filterSet,
                    sortOrder: entry.sortOrder
                }));
            }

            groupingsAdder.populateGroupings(groupingsClone);
            setGroupingSortOrders({ entries: groupingsClone });
        });

        Ren.Messages.Events.groupingsChanged.notify(
            tabularData.tabularDataGuid,
            dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.containingReportGuid
        );
    };

    const changeGroupingCalcFunctions = (columnIndexes, groupByCalcFunctions) => {

        _changeGroupingCore(columnIndexes, groupByCalcFunctions, (entry) => entry.columns);
    };

    const changeGroupingCalcFunctionsAndColumns = (columnIndexes, groupByCalcFunctions, columns) => {

        _changeGroupingCore(columnIndexes, groupByCalcFunctions, (entry, isTarget) => isTarget ? columns : entry.columns);
    };

    /**
     * Changes a binning function on an existing grouping while preserving the original un-binned
     * values.  Clears cached transformed data to force fresh calculation from original sources.
     */
    const changeBinningFunction = (columnIndexes, groupByCalcFunctions, columns) => {

        // Clear cached transformed data columns, so the new binning function is applied to the
        // original un-binned values.
        dataGroupingSettings.transformedDataColumns = null;

        // Use standard change mechanism to recreate groupings with fresh calculations
        _changeGroupingCore(columnIndexes, groupByCalcFunctions, (entry, isTarget) => isTarget ? columns : entry.columns);
    };

    const removeAllGroupings = () => {

        dataGroupingSettings.groupings.entries.length = 0;
    };

    const removeAllGroupingsExceptOutermost = () => {

        const entries = dataGroupingSettings.groupings.entries;
        const outermostGrouping = entries[entries.length - 1];
        removeAllGroupings();
        groupingsAdder.addGrouping([], outermostGrouping.columns);

        dataGroupingSettings.revertDataRowsBlankFormatFunctions();
        Ren.ObjectUtils.deleteAllEmptyObjects(dataGroupingSettings.dataRows.columns);
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();

        Ren.Messages.Events.groupingsChanged.notify(
            tabularData.tabularDataGuid,
            dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.containingReportGuid
        );
    };

    const getGroupByColumnKeys = (grouping) => {

        const columnIndexes = grouping.groupByColumnIndexes || [];
        const columnKeys = new Array(columnIndexes.length);

        for (let i = 0; i < columnIndexes.length; i++) {
            columnKeys[i] = tabularData.columnResolver.getColumnIdOrHeading(columnIndexes[i]);
        }

        return columnKeys;
    };

    const resetBlankFormatsOfRemovedGroupByColumns = (entries, groupingIndex, removedGrouping) => {

        Ren.DataGroupingSettingsEditorColumnMutations.resetBlankFormatsOfRemovedGroupByColumns(
            entries,
            dataGroupingSettings.dataRows,
            groupingIndex,
            getGroupByColumnKeys(removedGrouping),
            getGroupByColumnKeys
        );
    };

    const removeGroupingAtIndex = (groupingIndex) => {

        const entries = dataGroupingSettings.groupings.entries;

        if (groupingIndex >= 0 && groupingIndex < entries.length) {

            withExpandedGroupsRestored(() => {

                const [removedGrouping] = entries.splice(groupingIndex, 1);

                resetBlankFormatsOfRemovedGroupByColumns(entries, groupingIndex, removedGrouping);
                recreateGroupings();
            });

            Ren.Messages.Events.groupingsChanged.notify(
                tabularData.tabularDataGuid,
                dataGroupingSettings.dataGroupingSettingsGroup,
                dataGroupingSettings.containingReportGuid
            );
        }
    };

    const setGroupExpandedState = (group, expand) => {

        if (!group) return;
        const grouping = dataGroupingSettings.groupings.getGroupingForGroup(group);

        if (expand) {

            Ren.DataGrid_ExpandCollapse.expandGroup(tabularData, expandedGroups, grouping, group);
        }
        else {

            Ren.DataGrid_ExpandCollapse.collapseGroup(tabularData, expandedGroups, grouping, group);
        }
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    const expandGroup = group => setGroupExpandedState(group, true);
    const collapseGroup = group => setGroupExpandedState(group, false);

    /**
     * Recursively expands all contained groups of the specified group.
     */
    const expandAllContainedGroups = (group, depth = 100) => {

        if (depth <= 0) return;
        const containedGrouping = dataGroupingSettings.groupings.getContainedGrouping(group);

        // Nothing beneath a grouping preventing expansion can be shown.
        if (containedGrouping?.preventExpansion) return;

        group.containedGroups.forEach(containedGroup => {

            Ren.DataGrid_ExpandCollapse.expandGroup(tabularData, expandedGroups, containedGrouping, containedGroup);
            expandAllContainedGroups(containedGroup, depth - 1);
        });
    };

    /**
     * Expands the specified group and all its contained groups.
     */
    const expandGroupFully = group => {

        if (!group) return;
        const grouping = dataGroupingSettings.groupings.getGroupingForGroup(group);
        Ren.DataGrid_ExpandCollapse.expandGroup(tabularData, expandedGroups, grouping, group);
        expandAllContainedGroups(group);
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Recursively collapses all contained groups of the specified group.
     */
    const collapseAllContainedGroups = group => {

        if (!group) return;
        const containedGrouping = dataGroupingSettings.groupings.getContainedGrouping(group);
        group.containedGroups.forEach(containedGroup => {

            Ren.DataGrid_ExpandCollapse.collapseGroup(tabularData, expandedGroups, containedGrouping, containedGroup);
            collapseAllContainedGroups(containedGroup);
        });
    };

    /**
     * Collapses the specified group and all its contained groups.
     */
    const collapseGroupFully = group => {

        if (!group) return;
        const grouping = dataGroupingSettings.groupings.getGroupingForGroup(group);
        Ren.DataGrid_ExpandCollapse.collapseGroup(tabularData, expandedGroups, grouping, group);
        collapseAllContainedGroups(group);
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Expands or collapses every group in the given group's grouping, leaving other levels as
     * they are.
     */
    const setGroupingLevelExpandedState = (group, expand) => {

        if (!group) return;
        const grouping = dataGroupingSettings.groupings.getGroupingForGroup(group);

        if (!grouping || grouping.isOutermostGrouping) return;

        const setExpandedState = expand
            ? Ren.DataGrid_ExpandCollapse.expandGroup
            : Ren.DataGrid_ExpandCollapse.collapseGroup;

        grouping.groups().forEach(levelGroup => {

            setExpandedState(tabularData, expandedGroups, grouping, levelGroup);
        });
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    const expandGroupingLevel = group => setGroupingLevelExpandedState(group, true);
    const collapseGroupingLevel = group => setGroupingLevelExpandedState(group, false);

    /**
     * Collapses every group in any grouping preventing expansion and in the groupings within it,
     * whose groups it would otherwise leave expanded but hidden.
     */
    const collapseGroupsPreventedFromExpanding = () => {

        if (!expandedGroups.size) return;

        const entries = dataGroupingSettings.groupings.entries;
        const collapseGroup = Ren.DataGrid_ExpandCollapse.collapseGroup;

        // Entries run innermost-first, so this is up to the outermost grouping preventing it.
        let lastIndexToCollapse = -1;

        for (let i = 0; i < entries.length; i++) {

            if (entries[i].preventExpansion && !entries[i].isOutermostGrouping) {
                lastIndexToCollapse = i;
            }
        }

        for (let i = 0; i <= lastIndexToCollapse; i++) {

            const grouping = entries[i];

            grouping.groups().forEach(group => {

                collapseGroup(tabularData, expandedGroups, grouping, group);
            });
        }
    };

    const setGroupingExpansionPrevented = (grouping, prevent) => {

        if (!grouping || grouping.isOutermostGrouping) return;

        if (prevent) {

            grouping.preventExpansion = true;
            collapseGroupsPreventedFromExpanding();
        }
        else {

            delete grouping.preventExpansion;
        }

        applySettingsAndAnnounceChange();
    };

    /**
     * Collapses all groups.
     */
    const collapseAllGroups = () => {

        expandedGroups.clear();
        applyer.applySettings();
        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Shows the page at the given index, of the second-to-last grouping's groups or, without
     * groupings, the data rows.  Paging belongs to this grid alone, so no settings changed event
     * is fired for it.
     */
    const setPageIndex = pageIndex => {

        dataGroupingSettings.paging.pageIndex = pageIndex;
        applyer.applySettings();
    };

    /**
     * Sets the number of groups or data rows shown per page, returning to the first page.  A size
     * of null or 0 turns paging off.
     */
    const setPageSize = pageSize => {

        dataGroupingSettings.paging.pageSize = pageSize > 0 ? pageSize : null;
        dataGroupingSettings.paging.pageIndex = 0;
        applyer.applySettings();
    };

    /**
     * Sets where the totals row shows, which places the rows again, as the totals row takes a row.
     */
    const setTotalsRowPosition = position => {

        dataGroupingSettings.totalsRow.position = position;
        applySettingsAndAnnounceChange();
    };

    /**
     * Appends an outermost grouping if none exists.
     */
    const appendOutermostGroupingIfNoneExists = groupings => {

        const lastGrouping = Ren.ArrayUtils.last(groupings.entries);
        const hasOutermostGrouping = lastGrouping?.groupByColumns?.length === 0;

        if (!hasOutermostGrouping) {

            const outermostGrouping = {
                groupByColumns: [],
                columns: {}
            };
            groupings.entries.push(outermostGrouping);
        }
    };

    /**
     * Ensures that each column's valueFormatFunction is an array.
     */
    const ensureColumnValueFormatFunctionsAreArrays = groupingsToApply => {

        for (let i = 0, len = groupingsToApply.entries.length; i < len; i++) {

            const grouping = groupingsToApply.entries[i];
            if (!grouping.columns) continue;

            for (const columnId in grouping.columns) {
                grouping.columns[columnId].valueFormatFunction = Ren.ArrayUtils.ensureArray(grouping.columns[columnId].valueFormatFunction);
            }
        }
    };

    /**
     * Restores the calculated grouping properties removed by the transformer/serializer.
     */
    const restoreGroupingPropertiesRemovedByTransformer = groupingsToApply => {

        const entries = groupingsToApply.entries;

        for (let i = 0, len = entries.length; i < len; i++) {

            const groupingToApply = entries[i];
            groupingToApply.isOutermostGrouping = i === len - 1;
            groupingToApply.groupingIndex = i;
            groupingToApply.childGroupingIndex = i === 0 ? null : i - 1;
            groupingToApply.parentGroupingIndex = i === i + 1;
            groupingToApply.columns ??= {};
            groupingToApply.groupByColumns ??= [];

            for (const columnIdOrHeading in groupingToApply.columns) {

                const column = groupingToApply.columns[columnIdOrHeading];

                if (typeof column.aggregationType === "string") {
                    column.aggregationType = Ren.AggregationTypeEnum[column.aggregationType];
                }
            }
        }

        // Reinsert group by columns stripped by the transformer: iterate in reverse so that each
        // grouping is rebuilt using the already-restored next grouping, keeping
        // groupByCalcFunctions in sync at the same indices.
        for (let i = entries.length - 2; i >= 0; i--) {

            const grouping = entries[i];
            const nextGrouping = entries[i + 1];
            const nextGroupByColumns = nextGrouping.groupByColumns;

            if (!nextGroupByColumns || !nextGroupByColumns.length) continue;

            const currentGroupByColumns = grouping.groupByColumns;
            const nextCalcFunctions = nextGrouping.groupByCalcFunctions;
            const currentCalcFunctions = grouping.groupByCalcFunctions;
            const columnsToInsert = [];
            const calcFunctionsToInsert = [];

            for (let j = 0; j < nextGroupByColumns.length; j++) {

                if (!currentGroupByColumns.includes(nextGroupByColumns[j])) {

                    columnsToInsert.push(nextGroupByColumns[j]);

                    // Always push a value (null if no calc function) so calcFunctionsToInsert
                    // stays the same length as columnsToInsert and maps to the right column.
                    calcFunctionsToInsert.push(nextCalcFunctions ? nextCalcFunctions[j] : null);
                }
            }

            if (columnsToInsert.length > 0) {

                const newGroupByColumns = new Array(columnsToInsert.length + currentGroupByColumns.length);
                for (let k = 0; k < columnsToInsert.length; k++) newGroupByColumns[k] = columnsToInsert[k];
                for (let k = 0; k < currentGroupByColumns.length; k++) newGroupByColumns[columnsToInsert.length + k] = currentGroupByColumns[k];
                grouping.groupByColumns = newGroupByColumns;

                const fallbackCalcFunctions = currentCalcFunctions || new Array(currentGroupByColumns.length).fill(null);
                const mergedCalcFunctions = new Array(calcFunctionsToInsert.length + fallbackCalcFunctions.length);
                for (let k = 0; k < calcFunctionsToInsert.length; k++) mergedCalcFunctions[k] = calcFunctionsToInsert[k];
                for (let k = 0; k < fallbackCalcFunctions.length; k++) mergedCalcFunctions[calcFunctionsToInsert.length + k] = fallbackCalcFunctions[k];

                if (mergedCalcFunctions.some(f => f != null)) {
                    grouping.groupByCalcFunctions = mergedCalcFunctions;
                }
            }
        }
    };

    /**
     * Applies the provided groupings to the data, replacing any existing groupings.
     */
    const applyGroupings = groupingsToApply => {

        restoreGroupingPropertiesRemovedByTransformer(groupingsToApply);
        removeAllGroupings();
        appendOutermostGroupingIfNoneExists(groupingsToApply);
        ensureColumnValueFormatFunctionsAreArrays(groupingsToApply);

        const groupingsToAdd = [];

        for (let i = groupingsToApply.entries.length - 1; i >= 0; i--) {

            const grouping = groupingsToApply.entries[i];

            const groupByColumnIndexes =
                tabularData.columnResolver.getColumnIndexes(grouping.groupByColumns);

            const validGroupByColumnIndexes = groupByColumnIndexes.filter(index => index !== null);

            if (validGroupByColumnIndexes.length === 0 && grouping.groupByColumns.length > 0) {

                console.warn("Skipping grouping - no valid columns found:", grouping.groupByColumns);
                continue;
            }

            groupingsToAdd.push({
                groupByColumnIndexes: validGroupByColumnIndexes,
                columns: grouping.columns,
                groupByCalcFunctions: grouping.groupByCalcFunctions
            });
        }

        groupingsAdder.addGroupings(groupingsToAdd);

        // Apply filterSet to the created groupings
        const entries = dataGroupingSettings.groupings.entries;

        for (let i = 0; i < entries.length && i < groupingsToApply.entries.length; i++) {

            if (groupingsToApply.entries[i].filterSet) {
                entries[i].filterSet = groupingsToApply.entries[i].filterSet;
            }

            Ren.GroupingsAdder_copyGroupingFlags(groupingsToApply.entries[i], entries[i]);
        }

        // Turning the setting on from the Edit Groupings window arrives this way.
        collapseGroupsPreventedFromExpanding();

        setGroupingSortOrders(groupingsToApply);

        const sortedEntries = dataGroupingSettings.groupings.entries;

        for (let i = 0; i < sortedEntries.length; i++) {

            const grouping = sortedEntries[i];

            if (!grouping.expandInitially || grouping.isOutermostGrouping) continue;

            grouping.groups().forEach(group => {

                Ren.DataGrid_ExpandCollapse.expandGroup(tabularData, expandedGroups, grouping, group);
            });
        }

        applyer.applySettings();
    };

    /**
     * Sets the sort orders of the current groupings to match those in the provided groupings.
     * Ignores any sort orders that refer to columns that do not exist.
     */
    const setGroupingSortOrders = groupingsToApply => {

        const entries = dataGroupingSettings.groupings.entries;

        for (let i = 0, len = entries.length; i < len; i++) {

            const groupingToApply = groupingsToApply.entries[i];

            // Nothing to apply where the provided groupings have none at this position, or one
            // stating no sort order.
            if (!groupingToApply?.sortOrder) continue;

            const sortColumnIndex = groupingToApply.sortOrder.columnIndex ??
                tabularData.columnResolver.getColumnIndex(groupingToApply.sortOrder.column);
            if (sortColumnIndex === null) continue;
            const grouping = entries[i];
            grouping.setSortOrder(
                sortColumnIndex,
                groupingToApply.sortOrder.isDescending,
                groupingToApply.sortOrder.sortCalcFunction,
                Ren.SortOrderResolver.resolveThenBySortLevels(
                    tabularData.columnResolver,
                    groupingToApply.sortOrder.thenBy
                )
            );
        }
    };

    return {
        addGrouping,
        addGroupingWithCalcFunctions,
        addGroupingWithCalcFunctionsAndColumns,
        applyGroupings,
        applyOuterFilterSet,
        changeBinningFunction,
        changeGroupingCalcFunctions,
        changeGroupingCalcFunctionsAndColumns,
        collapseAllGroups,
        collapseGroup,
        collapseGroupFully,
        collapseGroupingLevel,
        expandGroup,
        expandGroupFully,
        clearGroupingColumnFilter,
        expandGroupingLevel,
        excludeGroupingValues,
        excludeValues,
        filter,
        filterGrouping,
        getRowIndexesInOutermostGrouping,
        onChanged,
        removeAllColumnFilters,
        removeAllGroupingsExceptOutermost,
        removeColumnFilter,
        removeGroupingAtIndex,
        removeGroupingColumnFilter,
        replaceGrouping,
        replaceGroupingWithCalcFunctions,
        replaceGroupingWithCalcFunctionsAndColumns,
        setAllFilter,
        setGroupingColumnFilter,
        setGroupingExpansionPrevented,
        setGroupingRowFilterPredicates,
        setRowFilterPredicates,
        setColumnFilterNegated,
        setPageIndex,
        setPageSize,
        setTotalsRowPosition,
        sort,
        sortWithCalcFunction,
        toggleColumnFilter,
        toggleGroupingColumnFilter,
        setGroupingColumnFilterNegated,
        unfilter
    };
};
