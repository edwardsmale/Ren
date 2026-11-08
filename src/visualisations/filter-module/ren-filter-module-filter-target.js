/**
 * Filter Module: which of the source grid's filters the module's checkboxes drive - the data rows
 * by default, or one grouping level named by the columns it groups by, since entry indexes shift
 * as groupings are reordered:
 *
 *     visualisation.filterTarget = { level: "grouping", groupByColumns: ["Category"] }
 *
 * A group-level filter decides which of that level's groups are shown, the rows behind a hidden
 * group still counting towards its parents.  It takes column value filters and compare filters,
 * but not hierarchical (combination) items.
 */
Ren.FilterModule_FilterTarget = (s) => {

    const { tabularData, visualisation } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { columnInfo } = s;

    const filterTarget = visualisation.filterTarget ?? null;

    const isGroupingTarget = filterTarget?.level === "grouping";

    // A column that doesn't resolve is dropped, so a level naming one that has gone matches no
    // grouping and the module shows nothing.
    const targetGroupByColumnIndexes = [];

    if (isGroupingTarget) {

        const groupByColumns = filterTarget.groupByColumns ?? [];

        for (let i = 0; i < groupByColumns.length; i++) {

            const columnIndex = tabularData.columnResolver.getColumnIndex(groupByColumns[i]);

            if (columnIndex !== null && columnIndex !== undefined) {
                targetGroupByColumnIndexes.push(columnIndex);
            }
        }
    }

    // Gets a grouping's own group-by columns, the ones it adds over its parent.  Each entry's are
    // cumulative, so a level is the difference between its own list and the next one out.
    const getOwnGroupByColumnIndexes = (entries, entryIndex) => {

        const own = [];
        const columnIndexes = entries[entryIndex].groupByColumnIndexes ?? [];
        const parentColumnIndexes = entries[entryIndex + 1]?.groupByColumnIndexes ?? [];
        const parentColumnIndexSet = new Set(parentColumnIndexes);

        for (let i = 0; i < columnIndexes.length; i++) {

            if (!parentColumnIndexSet.has(columnIndexes[i])) own.push(columnIndexes[i]);
        }

        return own;
    };

    const columnIndexesMatchTarget = (columnIndexes) => {

        if (columnIndexes.length !== targetGroupByColumnIndexes.length) return false;

        for (let i = 0; i < targetGroupByColumnIndexes.length; i++) {

            if (columnIndexes.indexOf(targetGroupByColumnIndexes[i]) === -1) return false;
        }

        return true;
    };

    // Gets the grouping entry the target names, or null where no level groups by exactly those
    // columns.  Resolved afresh each time, as applying a filter rebuilds the grouping objects.
    const getTargetGrouping = () => {

        if (!isGroupingTarget) return null;

        const settings = columnInfo.getSourceDataGroupingSettings();
        const entries = settings?.groupings?.entries;

        if (!entries) return null;

        for (let i = 0; i < entries.length; i++) {

            if (columnIndexesMatchTarget(getOwnGroupByColumnIndexes(entries, i))) return entries[i];
        }

        return null;
    };

    // Gets the object holding the filter set the module reads and writes, or null.
    const getFilterSetParent = () => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return null;

        return isGroupingTarget ? getTargetGrouping() : settings.dataRows;
    };

    // Gets a filter set's column value filters without creating anything, unlike the accessors.
    const getColumnValueFilters = (filterSetParent) =>
        filterSetParent?.filterSet?.[tabularData.Title]?.columnValueFilters ?? null;

    const getRowFilterPredicates = (filterSetParent) =>
        filterSetParent?.filterSet?.[tabularData.Title]?.rowFilter?.predicates ?? null;

    // The columns whose group rows at the target level hold a value.  Read from the groups rather
    // than the settings, as a column's aggregation type can come from several layers of defaults.
    let filterableColumnIndexes = null;

    const findFilterableColumnIndexes = (grouping) => {

        const columnIndexes = new Set(grouping.groupByColumnIndexes ?? []);
        const columnCount = tabularData.ColumnModels.length;

        // Once every column is accounted for, the remaining groups have nothing left to tell us.
        grouping.groups().forEach((group) => {

            if (columnIndexes.size === columnCount) return;

            for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

                if (columnIndexes.has(columnIndex)) continue;

                const value = group.groupValues.get(group.position, columnIndex);

                if (value !== "" && value !== null && value !== undefined) {
                    columnIndexes.add(columnIndex);
                }
            }
        });

        return columnIndexes;
    };

    // Gets a value indicating whether a column can be filtered at the target level.
    const isColumnFilterable = (columnIndex, columnIdOrHeading) => {

        if (!isGroupingTarget) return true;

        const grouping = getTargetGrouping();
        if (!grouping) return false;

        filterableColumnIndexes ??= findFilterableColumnIndexes(grouping);

        if (filterableColumnIndexes.has(columnIndex)) return true;

        // Shown whatever it is, so a filter in effect always has an item to clear it from.  A
        // compare filter counts, and is the usual case here: it states an aggregated figure, which
        // is a column the level groups no rows by.
        if (getColumnValueFilters(grouping)?.[columnIdOrHeading]) return true;

        return Ren.FilterCompareOperators.getComparePredicatesForColumn(
            getRowFilterPredicates(grouping),
            columnIdOrHeading
        ).length > 0;
    };

    // ===== Writing =====
    //
    // Each write goes through the source settings' sortFilterGroup, so it is applied and announced
    // as one made in the grid would be.

    const setColumnFilterValues = (columnIdOrHeading, filterValues) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return;

        if (!isGroupingTarget) {

            settings.sortFilterGroup.setAllFilter(columnIdOrHeading, filterValues);
            return;
        }

        const grouping = getTargetGrouping();
        if (!grouping) return;

        settings.sortFilterGroup.setGroupingColumnFilter(grouping, columnIdOrHeading, filterValues);
    };

    const removeColumnFilter = (columnIdOrHeading) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return;

        if (!isGroupingTarget) {

            settings.sortFilterGroup.removeColumnFilter(columnIdOrHeading);
            return;
        }

        const grouping = getTargetGrouping();
        if (!grouping) return;

        settings.sortFilterGroup.removeGroupingColumnFilter(grouping, columnIdOrHeading);
    };

    const toggleColumnFilterValue = (columnIdOrHeading, filterValue) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return;

        if (!isGroupingTarget) {

            settings.sortFilterGroup.toggleColumnFilter(columnIdOrHeading, filterValue);
            return;
        }

        const grouping = getTargetGrouping();
        if (!grouping) return;

        settings.sortFilterGroup.toggleGroupingColumnFilter(grouping, columnIdOrHeading, filterValue);
    };

    // ===== Filters included when saving =====
    //
    // Marks a column's filter as one the report itself states, rather than one somebody set while
    // reading it.  Only the former is written to the settings file.

    const isIncludedWhenSavingColumn = (columnIdOrHeading) => {

        const filterSetParent = getFilterSetParent();
        if (!filterSetParent) return false;

        return Ren.DataGroupingSettings_Services_FilterAccessors.isIncludedWhenSavingColumn(
            filterSetParent,
            tabularData,
            columnIdOrHeading
        );
    };

    const setIncludedWhenSavingColumn = (columnIdOrHeading, isIncluded) => {

        const filterSetParent = getFilterSetParent();
        if (!filterSetParent) return;

        Ren.DataGroupingSettings_Services_FilterAccessors.setIncludedWhenSavingColumn(
            filterSetParent,
            tabularData,
            columnIdOrHeading,
            isIncluded
        );
    };

    // ===== Negative filters =====
    //
    // Marks a column's filter as naming the values to leave out.  The module works in inclusion
    // terms throughout, so the flip is made as the filter is read and written; this is only the
    // mark.

    const isNegatedFilterColumn = (columnIdOrHeading) => {

        const filterSetParent = getFilterSetParent();
        if (!filterSetParent) return false;

        return Ren.FilterNegation.isNegatedColumn(
            filterSetParent,
            tabularData,
            columnIdOrHeading
        );
    };

    // Written through the sortFilterGroup, as flipping the mark changes which rows the same value
    // list keeps.
    const setNegatedFilterColumn = (columnIdOrHeading, isNegated) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return;

        if (!isGroupingTarget) {

            settings.sortFilterGroup.setColumnFilterNegated(columnIdOrHeading, isNegated);
            return;
        }

        const grouping = getTargetGrouping();
        if (!grouping) return;

        settings.sortFilterGroup.setGroupingColumnFilterNegated(
            grouping,
            columnIdOrHeading,
            isNegated
        );
    };

    // ===== Compare filters =====
    //
    // Held as "compare" predicates on the same filter set the column value filters go to.

    const getPredicates = () => {

        const filterSetParent = getFilterSetParent();
        if (!filterSetParent) return [];

        return Ren.DataGroupingSettings_Services_FilterAccessors.getRowFilterPredicates(
            filterSetParent,
            tabularData
        );
    };

    const setPredicates = (predicates) => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return;

        if (!isGroupingTarget) {

            settings.sortFilterGroup.setRowFilterPredicates(predicates);
            return;
        }

        const grouping = getTargetGrouping();
        if (!grouping) return;

        settings.sortFilterGroup.setGroupingRowFilterPredicates(grouping, predicates);
    };

    // Gets a signature of every filter that can change what the module shows.  The grouping levels
    // are listed in their own right, so a grouping and a data-row filter never read as the same.
    const getFilterSignature = () => {

        const settings = columnInfo.getSourceDataGroupingSettings();
        if (!settings) return "";

        const dataRowsTabFilters = settings.dataRows?.filterSet?.[tabularData.Title] ?? null;

        const entries = settings.groupings?.entries ?? [];
        const groupingColumnValueFilters = [];
        const groupingPredicates = [];

        for (let i = 0; i < entries.length; i++) {

            groupingColumnValueFilters.push(getColumnValueFilters(entries[i]));
            groupingPredicates.push(
                entries[i]?.filterSet?.[tabularData.Title]?.rowFilter?.predicates ?? null
            );
        }

        const signature = {
            columnValueFilters: dataRowsTabFilters?.columnValueFilters ?? null,
            predicates: dataRowsTabFilters?.rowFilter?.predicates ?? null,
            // The same value list means the opposite filter once negated.
            negatedColumns: dataRowsTabFilters?.negatedColumns ?? null,
            groupingColumnValueFilters,
            groupingPredicates
        };

        return JSON.stringify(signature);
    };

    return {
        isGroupingTarget,
        supportsRowPredicates: !isGroupingTarget,
        supportsCompareFilters: true,
        getTargetGrouping,
        getFilterSetParent,
        getPredicates,
        setPredicates,
        isColumnFilterable,
        setColumnFilterValues,
        removeColumnFilter,
        toggleColumnFilterValue,
        isIncludedWhenSavingColumn,
        setIncludedWhenSavingColumn,
        isNegatedFilterColumn,
        setNegatedFilterColumn,
        getFilterSignature
    };
};
