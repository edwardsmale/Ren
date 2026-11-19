/**
 * Filter Module: building an item into a hierarchy under other columns or date periods, and the
 * menu items that group, invert and ungroup it.
 */
Ren.FilterModule_Grouping = (s) => {

    const { columnOverrides } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const { columnInfo, filterTarget, itemSettings, reorder, view } = s;

    // Gets the level keys of a leaf column's parent groupings, in order.
    const parentGroupingLevelKeys = (leafColumnIdOrHeading) => {

        const parents = columnOverrides[leafColumnIdOrHeading]?.parentGroupings;

        if (!Array.isArray(parents)) return [];

        return parents.map((entry) => columnInfo.getLevelKey(
            columnInfo.getEntryColumnIdOrHeading(entry),
            columnInfo.getEntryCalcFunction(entry)
        ));
    };

    // Gets a value indicating whether a level is a parent grouping of a leaf column.
    const isParentGrouping = (leafColumnIdOrHeading, levelKey) =>
        parentGroupingLevelKeys(leafColumnIdOrHeading).includes(levelKey);

    // A new parent becomes the outermost level, so repeated grouping builds the hierarchy outward.
    const toggleParentGrouping = (leafColumnIdOrHeading, parentGrouping) => {

        const entry = itemSettings.getOrCreateColumnOverride(leafColumnIdOrHeading);
        const parents = entry.parentGroupings ?? (entry.parentGroupings = []);

        const levelKey = columnInfo.getLevelKey(
            columnInfo.getEntryColumnIdOrHeading(parentGrouping),
            columnInfo.getEntryCalcFunction(parentGrouping)
        );

        const index = parentGroupingLevelKeys(leafColumnIdOrHeading).indexOf(levelKey);

        if (index >= 0) {
            parents.splice(index, 1);
        }
        else {

            parents.unshift(parentGrouping);

            // The parent stops being an item of its own, so the merged item inherits its place.
            // A derived level was never an item, so has no place to carry.
            if (typeof parentGrouping === "string") {
                reorder.retargetOrderKey(parentGrouping, leafColumnIdOrHeading);
            }
        }

        itemSettings.pruneColumnOverride(leafColumnIdOrHeading);
        view.render();
    };

    // Gets the Ren.DatePeriodEnum of a date column's values, or null.  The values are already
    // scanned for the checkboxes, so this costs only the parse.
    const detectDatePeriodForColumn = (column) => {

        const values = columnInfo.getDistinctValuesForColumn(column);
        const dates = [];

        for (let i = 0; i < values.length; i++) {

            const date = Ren.DateUtils.parseDateTimeUniversal(values[i]);
            if (date) dates.push(date);
        }

        return dates.length === 0 ? null : Ren.DatePeriodDetector.detectDatePeriod(dates).datePeriod;
    };

    // Only periods coarser than the values are offered, as a value can't nest under itself.  With
    // no granularity detected, every period is offered, as the grid's grouping menu does.
    const buildDatePeriodSubmenuItems = (leafColumnIdOrHeading) => {

        const column = columnInfo.findEligibleColumn(leafColumnIdOrHeading);
        const columnModel = column?.columnModel;

        if (!columnModel || !Ren.SpreadsheetColumnFormatEnum.IsDate(columnModel.ColumnFormat)) {
            return [];
        }

        const isDateTimeColumn = columnModel.ColumnType === "Date/Time";
        const detectedPeriod = detectDatePeriodForColumn(column);
        const options = Ren.GroupingMenuConstants.dateGroupingOptions;
        const items = [];

        for (let i = 0; i < options.length; i++) {

            const option = options[i];

            if (option.dateTimeOnly && !isDateTimeColumn) continue;

            // "Day of Week" and the like bin values rather than containing them.
            const optionPeriod = Ren.DatePeriodDetector.getPeriodForCalcFunction(option.calcFunction);
            if (optionPeriod === undefined) continue;

            const isCoarserThanValues = detectedPeriod === null
                || optionPeriod > detectedPeriod
                || (isDateTimeColumn && optionPeriod === Ren.DatePeriodEnum.Day);

            if (!isCoarserThanValues) continue;

            const parentGrouping = {
                column: column.columnIdOrHeading,
                calcFunction: option.calcFunction
            };

            const levelKey = columnInfo.getLevelKey(column.columnIdOrHeading, option.calcFunction);

            items.push({
                text: option.text,
                ticked: () => isParentGrouping(leafColumnIdOrHeading, levelKey),
                id: "filter-module-group-by-" + option.id,
                action: () => toggleParentGrouping(leafColumnIdOrHeading, parentGrouping)
            });
        }

        return items;
    };

    const buildGroupBySubmenuItems = (leafColumnIdOrHeading) => {

        const items = buildDatePeriodSubmenuItems(leafColumnIdOrHeading);
        const eligibleColumns = s.eligibleColumns;
        const columnItems = [];

        for (let i = 0; i < eligibleColumns.length; i++) {

            const column = eligibleColumns[i];
            if (column.columnIdOrHeading === leafColumnIdOrHeading) continue;

            columnItems.push({
                text: () => columnInfo.resolveHeading(column),
                ticked: () => isParentGrouping(leafColumnIdOrHeading, column.columnIdOrHeading),
                id: "filter-module-group-by-" + column.columnIndex,
                action: () => toggleParentGrouping(leafColumnIdOrHeading, column.columnIdOrHeading)
            });
        }

        if (items.length > 0 && columnItems.length > 0) items.push(Ren.MENU_SEPARATOR);

        return items.concat(columnItems);
    };

    // Gets the "Group by" menu item.  Every node of a hierarchy targets the same leaf.
    const getGroupByMenuItem = (submenuItems) => ({
        section: "Values",
        text: "Group by",
        id: "filter-module-group-by",
        submenu: submenuItems
    });

    const ungroup = (leafColumnIdOrHeading) => {

        const entry = itemSettings.getOrCreateColumnOverride(leafColumnIdOrHeading);
        entry.parentGroupings = [];

        itemSettings.pruneColumnOverride(leafColumnIdOrHeading);
        view.render();
    };

    // Gets a value indicating whether a leaf has parent groupings for "Ungroup" to undo.
    const hasManualParentGroupings = (leafColumnIdOrHeading) => {

        const parents = columnOverrides[leafColumnIdOrHeading]?.parentGroupings;
        return Array.isArray(parents) && parents.length > 0;
    };

    // Gets a value indicating whether any of a leaf's parent groupings is a derived level.
    const hasDerivedParentGroupings = (leafColumnIdOrHeading) => {

        const parents = columnOverrides[leafColumnIdOrHeading]?.parentGroupings;

        if (!Array.isArray(parents)) return false;

        for (let i = 0; i < parents.length; i++) {

            if (columnInfo.getEntryCalcFunction(parents[i])) return true;
        }

        return false;
    };

    const getUngroupMenuItem = (leafColumnIdOrHeading) => ({
        text: "Ungroup",
        id: "filter-module-ungroup",
        action: () => ungroup(leafColumnIdOrHeading)
    });

    // Reverses a manually-grouped hierarchy, so its outermost ancestor becomes the leaf.  Only the
    // "parentGroupings" and "included" overrides move; the rest stay with their own column.
    const invertGrouping = (leafColumnIdOrHeading) => {

        const parents = columnOverrides[leafColumnIdOrHeading]?.parentGroupings;
        if (!Array.isArray(parents) || parents.length === 0) return;

        const chain = parents.concat([leafColumnIdOrHeading]);
        const reversedChain = chain.slice().reverse();

        const newLeafColumnIdOrHeading = reversedChain[reversedChain.length - 1];
        const newParentGroupings = reversedChain.slice(0, reversedChain.length - 1);

        // Carries the saved-order slot to the new key, so the item keeps its place.
        reorder.retargetOrderKey(leafColumnIdOrHeading, newLeafColumnIdOrHeading);

        delete itemSettings.getOrCreateColumnOverride(leafColumnIdOrHeading).parentGroupings;
        itemSettings.pruneColumnOverride(leafColumnIdOrHeading);

        itemSettings.getOrCreateColumnOverride(newLeafColumnIdOrHeading).parentGroupings =
            newParentGroupings;

        const oldLeafColumn = columnInfo.findEligibleColumn(leafColumnIdOrHeading);
        const newLeafColumn = columnInfo.findEligibleColumn(newLeafColumnIdOrHeading);

        if (oldLeafColumn) itemSettings.setColumnIncluded(oldLeafColumn, false);
        if (newLeafColumn) itemSettings.setColumnIncluded(newLeafColumn, true);

        view.render();
    };

    const getInvertGroupingMenuItem = (leafColumnIdOrHeading) => ({
        text: "Invert grouping",
        id: "filter-module-invert-grouping",
        action: () => invertGrouping(leafColumnIdOrHeading)
    });

    // Gets the "Group by" item ending the "Values" section, with "Invert grouping" and "Ungroup"
    // at the foot of its submenu, or none.  None is offered on a grouping level, as a hierarchy
    // filters on value combinations, which a grouping level doesn't honour.
    const getGroupingMenuItems = (item) => {

        if (filterTarget.isGroupingTarget) return [];

        const leafColumnIdOrHeading = columnInfo.getLeafColumnIdOrHeading(item);
        const submenuItems = buildGroupBySubmenuItems(leafColumnIdOrHeading);
        const groupingItems = [];

        // Offered whenever there are parent groupings to undo, even if no more can be added.
        if (hasManualParentGroupings(leafColumnIdOrHeading)) {

            // A derived level can't become the leaf, as its values come from the column beneath.
            if (!hasDerivedParentGroupings(leafColumnIdOrHeading)) {
                groupingItems.push(getInvertGroupingMenuItem(leafColumnIdOrHeading));
            }

            groupingItems.push(getUngroupMenuItem(leafColumnIdOrHeading));
        }

        if (submenuItems.length > 0 && groupingItems.length > 0) submenuItems.push(Ren.MENU_SEPARATOR);

        const allItems = submenuItems.concat(groupingItems);

        return allItems.length > 0 ? [getGroupByMenuItem(allItems)] : [];
    };

    return {
        getGroupingMenuItems
    };
};
