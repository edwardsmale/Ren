/**
 * Filter Module: per-column settings held in visualisation.columnOverrides and saved with the
 * report settings, keyed by the column's identifier.  Only non-default values are stored, and empty
 * entries are pruned, so an untouched module adds nothing to the saved settings.
 */
Ren.FilterModule_Settings = (s) => {

    const { columnOverrides } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { columnInfo, counts, filterTarget, filtering, view } = s;

    const getOrCreateColumnOverride = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading] ?? (columnOverrides[columnIdOrHeading] = {});

    const pruneColumnOverride = (columnIdOrHeading) => {

        const entry = columnOverrides[columnIdOrHeading];
        if (!entry) return;

        if (entry.ValueOverrides && Ren.ObjectUtils.isEmptyObject(entry.ValueOverrides)) {
            delete entry.ValueOverrides;
        }

        if (Array.isArray(entry.parentGroupings) && entry.parentGroupings.length === 0) {
            delete entry.parentGroupings;
        }

        if (Ren.ObjectUtils.isEmptyObject(entry)) delete columnOverrides[columnIdOrHeading];
    };

    // Stores a setting only where it differs from its default, so untouched columns save nothing.
    const storeColumnSetting = (columnIdOrHeading, propertyName, value, defaultValue) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);

        if (value === defaultValue) {
            delete entry[propertyName];
        }
        else {

            entry[propertyName] = value;
        }

        pruneColumnOverride(columnIdOrHeading);
    };

    const setColumnFlag = (columnIdOrHeading, propertyName, isOn, defaultValue) => {

        storeColumnSetting(columnIdOrHeading, propertyName, !!isOn, defaultValue);
        view.render();
    };

    // For settings the item's counts are aggregated by, which are invalidated.
    const setCountedColumnSetting = (columnIdOrHeading, propertyName, value, defaultValue) => {

        storeColumnSetting(columnIdOrHeading, propertyName, value, defaultValue);
        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    // Gets a value indicating whether selecting one of a column's values clears any others.
    const isSingleSelect = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.singleSelect === true;

    // Gets a value indicating whether the single-select toggle strip is shown.  Hidden by default.
    const showSingleSelectToggle = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showSingleSelectToggle === true;

    // Gets a value indicating whether the "Sort" toggle is shown.  Hidden by default.
    const showSortToggle = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showSortToggle === true;

    // Gets a value indicating whether each checkbox caption is followed by its total.
    const showOptionTotals = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showOptionTotals !== false;

    // Gets a value indicating whether the "All" checkbox is shown.
    const showAllCheckbox = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showAllCheckbox !== false;

    // Gets a value indicating whether a column's value checkboxes are shown.  Hiding them leaves
    // an item filtered by its compare filter alone.
    const showValueCheckboxes = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showValueCheckboxes !== false;

    // Gets a value indicating whether compare filters are offered at all, whatever a settings file
    // asks for.
    const compareFiltersAvailable = () =>
        Ren.CompareFilterControl.isEnabled() && filterTarget.supportsCompareFilters;

    // Gets the slots of a column's compare filters, grouped so that slots within a group are ORed
    // and the groups are ANDed: [[0], [1, 2]] reads "filter 0, and either filter 1 or filter 2".
    // A single filter in slot 0 is stored as the older showCompareFilter flag, so older settings
    // files read back unchanged.
    const getCompareFilterGroups = (columnIdOrHeading) => {

        if (!compareFiltersAvailable()) return [];

        const entry = columnOverrides[columnIdOrHeading];
        const stored = entry?.compareFilterSlots;

        if (!Array.isArray(stored)) return entry?.showCompareFilter === true ? [[0]] : [];

        const groups = [];

        for (let i = 0; i < stored.length; i++) {

            groups.push(Array.isArray(stored[i]) ? stored[i].slice() : [stored[i]]);
        }

        return groups;
    };

    // Gets every slot a column's compare filters occupy, in the order they are drawn.
    const getCompareFilterSlots = (columnIdOrHeading) => {

        const groups = getCompareFilterGroups(columnIdOrHeading);
        const slots = [];

        for (let i = 0; i < groups.length; i++) {

            for (let j = 0; j < groups[i].length; j++) slots.push(groups[i][j]);
        }

        return slots;
    };

    // Gets a value indicating whether the column shows any compare-filter strip.
    const showCompareFilter = (columnIdOrHeading) =>
        getCompareFilterSlots(columnIdOrHeading).length > 0;

    // Gets a value indicating whether the "+binning function" link is offered.  Hidden by default;
    // a binning function already in effect is stated regardless.
    const showBinningFunctionLink = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showBinningFunctionLink === true;

    // Gets a value indicating whether the item's totals row is shown.
    const showTotal = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showTotal !== false;

    // Gets a value indicating whether the item's border is shown.
    const showBorder = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showBorder !== false;

    // Gets a value indicating whether the item's heading is shown in bold.
    const showHeadingInBold = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showHeadingInBold !== false;

    // Gets how a hierarchy's tree is expanded when first shown, keyed on its leaf column (see
    // INITIAL_EXPANSION_OPTIONS).
    const getInitialExpansion = (leafColumnIdOrHeading) =>
        columnOverrides[leafColumnIdOrHeading]?.initialExpansion ?? "None";

    // Applied straight away, replacing whatever the user has expanded or collapsed.
    const setInitialExpansion = (leafColumnIdOrHeading, initialExpansion) => {

        storeColumnSetting(leafColumnIdOrHeading, "initialExpansion", initialExpansion, "None");
        s.initialExpansionAppliedLeaves.delete(leafColumnIdOrHeading);
        view.render();
    };

    // Gets how a Boolean column's item is shown as a single checkbox, or "Off" (see
    // SHOW_AS_CHECKBOX_OPTIONS).
    const getShowAsCheckbox = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.showAsCheckbox ?? "Off";

    const setShowAsCheckbox = (columnIdOrHeading, showAsCheckbox) => {

        storeColumnSetting(columnIdOrHeading, "showAsCheckbox", showAsCheckbox, "Off");
        view.render();
    };

    // Gets a value indicating whether a column is shown; none is until explicitly included.
    const isColumnIncluded = (column) =>
        columnOverrides[column.columnIdOrHeading]?.included === true;

    // Excluding a column also drops a filter selecting all its values, and its compare filters, as
    // either would otherwise be left with no control to clear it from.
    const setColumnIncluded = (column, include) => {

        if (!include) {

            filtering.clearColumnFilterIfNotRestricting(
                column.columnIdOrHeading,
                () => counts.buildOptions(column)
            );

            filtering.clearComparePredicatesForColumn(column.columnIdOrHeading);
        }

        const entry = getOrCreateColumnOverride(column.columnIdOrHeading);

        if (include) {

            entry.included = true;

            columnInfo.initialiseLabelFunctionsFromSourceColumn(column, entry);
            columnInfo.initialiseNaturalOrderSortForColumn(column, entry);

            s.visualisation.onColumnIncluded?.(column.columnIdOrHeading);
        }
        else {

            delete entry.included;
        }

        pruneColumnOverride(column.columnIdOrHeading);
        view.render();
    };

    const toggleColumnInclusion = (column) => setColumnIncluded(column, !isColumnIncluded(column));

    const setSingleSelect = (columnIdOrHeading, isSingle) =>
        setColumnFlag(columnIdOrHeading, "singleSelect", isSingle, false);

    const toggleSingleSelect = (columnIdOrHeading) =>
        setSingleSelect(columnIdOrHeading, !isSingleSelect(columnIdOrHeading));

    const setShowSingleSelectToggle = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showSingleSelectToggle", isShown, false);

    const toggleShowSingleSelectToggle = (columnIdOrHeading) =>
        setShowSingleSelectToggle(columnIdOrHeading, !showSingleSelectToggle(columnIdOrHeading));

    const setShowSortToggle = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showSortToggle", isShown, false);

    const toggleShowSortToggle = (columnIdOrHeading) =>
        setShowSortToggle(columnIdOrHeading, !showSortToggle(columnIdOrHeading));

    const setShowOptionTotals = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showOptionTotals", isShown, true);

    const toggleShowOptionTotals = (columnIdOrHeading) =>
        setShowOptionTotals(columnIdOrHeading, !showOptionTotals(columnIdOrHeading));

    const setShowAllCheckbox = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showAllCheckbox", isShown, true);

    const toggleShowAllCheckbox = (columnIdOrHeading) =>
        setShowAllCheckbox(columnIdOrHeading, !showAllCheckbox(columnIdOrHeading));

    const setShowValueCheckboxes = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showValueCheckboxes", isShown, true);

    const toggleShowValueCheckboxes = (columnIdOrHeading) =>
        setShowValueCheckboxes(columnIdOrHeading, !showValueCheckboxes(columnIdOrHeading));

    const setShowBinningFunctionLink = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showBinningFunctionLink", isShown, false);

    const toggleShowBinningFunctionLink = (columnIdOrHeading) =>
        setShowBinningFunctionLink(columnIdOrHeading, !showBinningFunctionLink(columnIdOrHeading));

    // Gets the dragged width in pixels shared by a column's compare-filter value boxes, or null for
    // the stylesheet's width.
    const getCompareFilterValueWidth = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.compareFilterValueWidth ?? null;

    // No re-render, as the drag has already widened the boxes.
    const setCompareFilterValueWidth = (columnIdOrHeading, widthPx) =>
        storeColumnSetting(columnIdOrHeading, "compareFilterValueWidth", widthPx || null, null);

    // Gets the width in pixels an item has been dragged to, or null for its content's width.
    const getItemWidth = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.itemWidth ?? null;

    // No re-render, as the drag has already sized the item.
    const setItemWidth = (columnIdOrHeading, widthPx) =>
        storeColumnSetting(columnIdOrHeading, "itemWidth", widthPx || null, null);

    // A group of one is written as its bare slot number (see getCompareFilterGroups).
    const setCompareFilterGroups = (columnIdOrHeading, groups) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);

        delete entry.showCompareFilter;
        delete entry.compareFilterSlots;

        const stored = [];

        for (let i = 0; i < groups.length; i++) {

            stored.push(groups[i].length === 1 ? groups[i][0] : groups[i].slice());
        }

        if (stored.length === 1 && stored[0] === 0) {
            entry.showCompareFilter = true;
        }
        else if (stored.length > 0) {

            entry.compareFilterSlots = stored;
        }

        pruneColumnOverride(columnIdOrHeading);
        view.render();
    };

    // Hiding withdraws the filters too, which would otherwise be left in effect but invisible.
    const setShowCompareFilter = (columnIdOrHeading, isShown) => {

        if (!isShown) filtering.clearComparePredicatesForColumn(columnIdOrHeading);

        setCompareFilterGroups(columnIdOrHeading, isShown ? [[0]] : []);
    };

    const toggleShowCompareFilter = (columnIdOrHeading) =>
        setShowCompareFilter(columnIdOrHeading, !showCompareFilter(columnIdOrHeading));

    // Gets the lowest slot neither shown nor carrying a predicate, so a new compare filter starts
    // empty.
    const nextFreeCompareSlot = (columnIdOrHeading) =>
        Ren.FilterCompareOperators.getNextFreeSlot(
            getCompareFilterSlots(columnIdOrHeading)
                .concat(filtering.getUsedCompareSlotsForColumn(columnIdOrHeading))
        );

    // Adds a compare filter ANDed with the column's existing ones.
    const addCompareFilter = (columnIdOrHeading) => {

        const groups = getCompareFilterGroups(columnIdOrHeading);
        const newSlot = nextFreeCompareSlot(columnIdOrHeading);

        groups.push([newSlot]);

        view.focusCompareFilterOnNextRender(columnIdOrHeading, newSlot);

        setCompareFilterGroups(columnIdOrHeading, groups);
    };

    // Adds a compare filter ORed with the one in the given slot.
    const addOrCompareFilter = (columnIdOrHeading, slot) => {

        const groups = getCompareFilterGroups(columnIdOrHeading);
        const newSlot = nextFreeCompareSlot(columnIdOrHeading);

        for (let i = 0; i < groups.length; i++) {

            const position = groups[i].indexOf(slot);

            if (position !== -1) groups[i].splice(position + 1, 0, newSlot);
        }

        view.focusCompareFilterOnNextRender(columnIdOrHeading, newSlot);

        setCompareFilterGroups(columnIdOrHeading, groups);
    };

    // The caller withdraws the slot's predicate, as only it knows which column that is written
    // against.
    const removeCompareFilterSlot = (columnIdOrHeading, slot) => {

        const groups = getCompareFilterGroups(columnIdOrHeading);
        const remainingGroups = [];

        for (let i = 0; i < groups.length; i++) {

            const remaining = groups[i].filter((entry) => entry !== slot);

            if (remaining.length === 0) continue;

            // A group is named by its leading slot, so the remaining filters must be renamed or
            // they would be ANDed from here on.
            if (groups[i][0] === slot) filtering.renameCompareOrGroup(columnIdOrHeading, remaining);

            remainingGroups.push(remaining);
        }

        setCompareFilterGroups(columnIdOrHeading, remainingGroups);
    };

    const setShowTotal = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showTotal", isShown, true);

    const toggleShowTotal = (columnIdOrHeading) =>
        setShowTotal(columnIdOrHeading, !showTotal(columnIdOrHeading));

    const setShowBorder = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showBorder", isShown, true);

    const toggleShowBorder = (columnIdOrHeading) =>
        setShowBorder(columnIdOrHeading, !showBorder(columnIdOrHeading));

    const setShowHeadingInBold = (columnIdOrHeading, isShown) =>
        setColumnFlag(columnIdOrHeading, "showHeadingInBold", isShown, true);

    const toggleShowHeadingInBold = (columnIdOrHeading) =>
        setShowHeadingInBold(columnIdOrHeading, !showHeadingInBold(columnIdOrHeading));

    // Gets a value indicating whether the "Right-click to add filters" hint is always shown, with
    // no setting to hide it, as in the Edit Groupings window.
    const isRightClickHintAlwaysShown = () => s.visualisation.rightClickHintAlwaysShown === true;

    // Gets a value indicating whether the "Right-click to add filters" hint is shown.  A
    // module-level setting, so stored on the visualisation itself.
    const showRightClickHint = () =>
        isRightClickHintAlwaysShown() || s.visualisation.showRightClickHint !== false;

    const setShowRightClickHint = (isShown) => {

        if (isShown) {
            delete s.visualisation.showRightClickHint;
        }
        else {

            s.visualisation.showRightClickHint = false;
        }

        view.render();
    };

    const toggleShowRightClickHint = () => setShowRightClickHint(!showRightClickHint());

    // Gets a value indicating whether the items are stacked top to bottom, wrapping into further
    // columns, rather than laid side by side and wrapping into further rows.  A module-level
    // setting, so stored on the visualisation itself.
    const isColumnFlow = () => s.visualisation.itemFlow === "Columns";

    const setColumnFlow = (isOn) => {

        if (isOn) {
            s.visualisation.itemFlow = "Columns";
        }
        else {

            delete s.visualisation.itemFlow;
        }

        view.render();
    };

    const toggleColumnFlow = () => setColumnFlow(!isColumnFlow());

    // Gets a value indicating whether a level sorts by its own value when nothing is chosen.  True
    // for derived date period levels, which read chronologically rather than by size.
    const sortsByValueByDefault = (columnIdOrHeading) =>
        columnInfo.getLevelCalcFunction(columnIdOrHeading) !== null;

    // Where the value sort is the level's default, the flag is written as false, as deleting it
    // would fall back to that default.
    const clearSortByValue = (entry, columnIdOrHeading) => {

        if (sortsByValueByDefault(columnIdOrHeading)) {
            entry.sortByValue = false;
        }
        else {

            delete entry.sortByValue;
        }
    };

    const buildSortConfig = (entry, byValue) => {

        // Each sort mode keeps its own direction, so toggling between them never carries one over.
        const descending = byValue
            ? entry?.sortValueDescending === true
            : entry?.sortDescending ?? true;

        return {
            column: entry?.sortColumn ?? null,
            aggregationType: entry?.sortAggregationType ?? null,
            descending,
            byValue
        };
    };

    // Gets a column's option sort: the aggregated column, aggregation type and direction.  Defaults
    // to the count, descending.
    const getSortConfig = (columnIdOrHeading) => {

        const entry = columnOverrides[columnIdOrHeading];

        const byValue = entry?.sortByValue === undefined
            ? sortsByValueByDefault(columnIdOrHeading)
            : entry.sortByValue === true;

        return buildSortConfig(entry, byValue);
    };

    // Gets the sort the "Sort" toggle would switch a column's options to.
    const getToggledSortConfig = (columnIdOrHeading) =>
        buildSortConfig(
            columnOverrides[columnIdOrHeading],
            !getSortConfig(columnIdOrHeading).byValue
        );

    // Gets a value indicating whether a column's options are sorted by exactly this aggregation.
    const isSortedBy = (columnIdOrHeading, sortColumn, aggregationType, descending) => {

        const config = getSortConfig(columnIdOrHeading);

        return !config.byValue
            && config.column === sortColumn
            && config.aggregationType === aggregationType
            && config.descending === descending;
    };

    // Gets a value indicating whether a column's options are sorted by their own value.
    const isSortedByValue = (columnIdOrHeading) => getSortConfig(columnIdOrHeading).byValue;

    // The sort column is part of the item's grouping, so its counts are invalidated.
    const setSortBy = (columnIdOrHeading, sortColumn, aggregationType, descending) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);

        entry.sortColumn = sortColumn;
        entry.sortAggregationType = aggregationType;
        entry.sortDescending = descending;
        clearSortByValue(entry, columnIdOrHeading);

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    // Leaves any aggregated sort stored, so toggling "Sort" back on restores it.
    const setSortByValue = (columnIdOrHeading) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);

        entry.sortByValue = true;

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    const setSortByAggregation = (columnIdOrHeading) => {

        const entry = columnOverrides[columnIdOrHeading];
        if (!entry && !sortsByValueByDefault(columnIdOrHeading)) return;

        clearSortByValue(getOrCreateColumnOverride(columnIdOrHeading), columnIdOrHeading);

        pruneColumnOverride(columnIdOrHeading);
        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    const toggleSortMode = (columnIdOrHeading) => {

        if (isSortedByValue(columnIdOrHeading)) {
            setSortByAggregation(columnIdOrHeading);
        }
        else {

            setSortByValue(columnIdOrHeading);
        }
    };

    // Flips the direction of the active sort mode only.
    const flipSortOrder = (columnIdOrHeading) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);
        const newDescending = !getSortConfig(columnIdOrHeading).descending;

        if (isSortedByValue(columnIdOrHeading)) {
            entry.sortValueDescending = newDescending;
        }
        else {

            entry.sortDescending = newDescending;
        }

        view.render();
    };

    // Gets the value column and aggregation shown for a column's options.  Defaults to a row count.
    const getValueConfig = (columnIdOrHeading) => {

        const entry = columnOverrides[columnIdOrHeading];

        return {
            column: entry?.valueColumn ?? null,
            aggregationType: entry?.valueAggregationType ?? null,
            withRespectToColumn: entry?.valueAggregateWithRespectToColumn ?? null
        };
    };

    // Gets a value indicating whether a column's value is taken from the given column.  With none
    // chosen that is the row count, except at a grouping level, which counts groups instead.
    const isValueColumn = (columnIdOrHeading, valueColumn) => {

        const config = getValueConfig(columnIdOrHeading);

        if (config.column === null) {

            return !filterTarget.isGroupingTarget && valueColumn === s.COUNT_COLUMN_HEADING;
        }

        return config.column === valueColumn;
    };

    // Gets the aggregation applied to a column's value column.
    const getValueAggregationType = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.valueAggregationType ?? "Sum";

    // Gets a value indicating whether a column's options use the given aggregation.
    const isValueAggregationType = (columnIdOrHeading, aggregationType) =>
        getValueAggregationType(columnIdOrHeading) === aggregationType;

    const setValueAggregationType = (columnIdOrHeading, aggregationType) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);

        entry.valueAggregationType = aggregationType;

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    // Gets the column a column's value aggregation is made with respect to, or null for none.
    const getValueAggregateWithRespectToColumn = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.valueAggregateWithRespectToColumn ?? null;

    // Gets a value indicating whether a column's value aggregation is made with respect to the
    // given column.
    const isValueAggregateWithRespectToColumn = (columnIdOrHeading, withRespectToColumn) =>
        getValueAggregateWithRespectToColumn(columnIdOrHeading) === withRespectToColumn;

    const setValueAggregateWithRespectToColumn = (columnIdOrHeading, withRespectToColumn) =>
        setCountedColumnSetting(
            columnIdOrHeading,
            "valueAggregateWithRespectToColumn",
            withRespectToColumn,
            null
        );

    // Gets a value indicating whether a column's value is the count of the groups behind it.
    const isValueGroupCount = (columnIdOrHeading) => counts.countsGroupsForColumn(columnIdOrHeading);

    const setValueToGroupCount = (columnIdOrHeading) => {

        const entry = columnOverrides[columnIdOrHeading];

        if (entry) {

            delete entry.valueColumn;
            delete entry.valueAggregationType;
            delete entry.valueAggregateWithRespectToColumn;

            pruneColumnOverride(columnIdOrHeading);
        }

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    // The chosen aggregation carries over to the new value column.
    const setValueColumn = (columnIdOrHeading, valueColumn) => {

        const entry = getOrCreateColumnOverride(columnIdOrHeading);

        entry.valueColumn = valueColumn;
        entry.valueAggregationType = getValueAggregationType(columnIdOrHeading);

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    // Gets the aggregation of an item's totals row, independent of the options' value aggregation.
    // "None" hides the row.
    const getTotalAggregationType = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.totalAggregationType ?? "Sum";

    // Gets a value indicating whether the totals row uses the given aggregation.
    const isTotalAggregationType = (columnIdOrHeading, aggregationType) =>
        getTotalAggregationType(columnIdOrHeading) === aggregationType;

    const setTotalAggregationType = (columnIdOrHeading, aggregationType) =>
        setCountedColumnSetting(columnIdOrHeading, "totalAggregationType", aggregationType, "Sum");

    // Gets the column the totals row's aggregation is made with respect to, or null for none.
    const getTotalAggregateWithRespectToColumn = (columnIdOrHeading) =>
        columnOverrides[columnIdOrHeading]?.totalAggregateWithRespectToColumn ?? null;

    // Gets a value indicating whether the totals row's aggregation is made with respect to the
    // given column.
    const isTotalAggregateWithRespectToColumn = (columnIdOrHeading, withRespectToColumn) =>
        getTotalAggregateWithRespectToColumn(columnIdOrHeading) === withRespectToColumn;

    const setTotalAggregateWithRespectToColumn = (columnIdOrHeading, withRespectToColumn) =>
        setCountedColumnSetting(
            columnIdOrHeading,
            "totalAggregateWithRespectToColumn",
            withRespectToColumn,
            null
        );

    // Gets the caption of an item's totals row: "Total" for a sum, else the aggregation's label.
    const getTotalRowLabel = (columnIdOrHeading) => {

        const aggregationType = getTotalAggregationType(columnIdOrHeading);

        if (aggregationType === "Sum") return "Total";

        return s.AGGREGATION_TITLE_LABELS[aggregationType] ?? aggregationType;
    };

    return {
        getOrCreateColumnOverride,
        pruneColumnOverride,
        isSingleSelect,
        showSingleSelectToggle,
        showSortToggle,
        showOptionTotals,
        showAllCheckbox,
        showValueCheckboxes,
        compareFiltersAvailable,
        showCompareFilter,
        showBinningFunctionLink,
        getCompareFilterSlots,
        getCompareFilterGroups,
        getCompareFilterValueWidth,
        setCompareFilterValueWidth,
        getItemWidth,
        setItemWidth,
        isColumnIncluded,
        setColumnIncluded,
        toggleColumnInclusion,
        setSingleSelect,
        toggleSingleSelect,
        setShowSingleSelectToggle,
        toggleShowSingleSelectToggle,
        setShowSortToggle,
        toggleShowSortToggle,
        setShowOptionTotals,
        toggleShowOptionTotals,
        setShowAllCheckbox,
        toggleShowAllCheckbox,
        setShowValueCheckboxes,
        toggleShowValueCheckboxes,
        setShowBinningFunctionLink,
        toggleShowBinningFunctionLink,
        setShowCompareFilter,
        toggleShowCompareFilter,
        addCompareFilter,
        addOrCompareFilter,
        removeCompareFilterSlot,
        showTotal,
        setShowTotal,
        toggleShowTotal,
        showBorder,
        setShowBorder,
        toggleShowBorder,
        showHeadingInBold,
        setShowHeadingInBold,
        toggleShowHeadingInBold,
        getInitialExpansion,
        setInitialExpansion,
        getShowAsCheckbox,
        setShowAsCheckbox,
        isRightClickHintAlwaysShown,
        showRightClickHint,
        setShowRightClickHint,
        toggleShowRightClickHint,
        isColumnFlow,
        setColumnFlow,
        toggleColumnFlow,
        getSortConfig,
        getToggledSortConfig,
        isSortedBy,
        isSortedByValue,
        setSortBy,
        toggleSortMode,
        flipSortOrder,
        getValueConfig,
        isValueColumn,
        setValueColumn,
        getValueAggregationType,
        isValueAggregationType,
        setValueAggregationType,
        getValueAggregateWithRespectToColumn,
        isValueAggregateWithRespectToColumn,
        setValueAggregateWithRespectToColumn,
        isValueGroupCount,
        setValueToGroupCount,
        getTotalAggregationType,
        isTotalAggregationType,
        setTotalAggregationType,
        getTotalAggregateWithRespectToColumn,
        isTotalAggregateWithRespectToColumn,
        setTotalAggregateWithRespectToColumn,
        getTotalRowLabel
    };
};
