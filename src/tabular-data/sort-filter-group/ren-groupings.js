/**
 * Represents a collection of groupings.
 */
Ren.Groupings = () => {

    const entries = [];

    /**
     * Adds a grouping to the collection.
     */
    const add = (grouping) => {

        entries.push(grouping);
    };

    /**
     * Clears the collection of groupings.
     */
    const clear = () => {

        entries.length = 0;
    };

    /**
     * Gets a value indicating whether any groupings exist.
     */
    const hasGroupings = () => entries.length > 0;

    /**
     * Gets the number of groupings, excluding the outermost grouping.
     */
    const numGroupings = () => entries.length - 1;

    /**
     * Gets the last grouping in the array, which is usually the outermost grouping, but might not
     * be in intermediate states whilst groups are being created.
     */
    const lastGrouping = () => Ren.ArrayUtils.last(entries);

    /**
     * Gets the first group of the outermost grouping (i.e. the last grouping).
     */
    const firstGroupOfOutermostGrouping = () => lastGrouping()?.firstGroup();

    /**
     * Gets the second-to-last grouping in the array.
     */
    const secondToLastGrouping = () => entries[entries.length - 2];

    /**
     * Gets the first group of the second-to-last grouping in the array.
     */
    const secondToLastGroup = () => secondToLastGrouping()?.firstGroup();

    /**
     * Gets the innermost grouping, which is the one which has the most group-by columns.
     */
    const innermostGrouping = () => Ren.ArrayUtils.first(entries);

    /**
     * Returns a value indicating whether a grouping already exists for the specified column
     * indexes.
     */
    const groupingAlreadyExists = (columnIndexes) => {

        columnIndexes = Ren.ArrayUtils.ensureArray(columnIndexes);

        const existingGroupByColumnIndexes = innermostGrouping()?.groupByColumnIndexes;

        if (!existingGroupByColumnIndexes?.length) return false;

        return columnIndexes.every(columnIndex =>
            existingGroupByColumnIndexes.includes(columnIndex)
        );
    };

    /**
     * Finds and returns the grouping with the specified column indexes, or null if not found.
     */
    const getGroupingByColumnIndexes = (columnIndexes) => {

        if (!columnIndexes || !columnIndexes.length) return null;

        const columnIndexesKey = columnIndexes.join(",");

        return entries.find(g =>
            g.groupByColumnIndexes &&
            g.groupByColumnIndexes.join(",") === columnIndexesKey
        ) || null;
    };

    /**
     * Gets the grouping settings for the given group.
     */
    const getGroupingForGroup = (group) => {

        if (!group) return null;

        return getGroupingWithRowIndex(group.groupRowIndex);
    };

    /**
     * Gets the grouping settings for the grouping of the given group's contained groups.
     */
    const getContainedGrouping = (group) => {

        const grouping = getGroupingForGroup(group);

        if (!grouping) return null;

        return entries[grouping.childGroupingIndex] || null;
    };

    /**
     * Gets the totals row grouping, which is the outermost grouping (which is the last grouping).
     */
    const totalsRowGrouping = () => Ren.ArrayUtils.last(entries);

    /**
     * Gets the totals row group; the single group row belonging to the outermost grouping (which
     * is the last grouping).
     *
     * Undefined where there are no groupings, which happens in intermediate states during group
     * creation.
     */
    const totalsRowGroup = () => Ren.ArrayUtils.last(entries)?.firstGroup();

    /**
     * Gets the row index of the totals row; the single group row belonging to the outermost
     * grouping (which is the last grouping).
     *
     * If no totals row exists, -1 is returned.
     */
    const totalsRowIndex = () => {

        if (!entries.length) return -1; // The case during an intermediate state when groups are
                                        // being created.

        const firstGroup = Ren.ArrayUtils.last(entries).firstGroup();

        if (!firstGroup) return -1; // If there are no rows in the data.

        return firstGroup.groupRowIndex;
    };

    /**
     * Gets the group whose output row has the given row index.
     */
    const getGroupWithRowIndex = (rowIndex) => {

        const n = entries.length;

        for (let i = 0; i < n; i++) {

            const group = entries[i].getGroupWithRowIndex(rowIndex);

            if (group) return group;
        }

        return null;
    };

    /**
     * Gets the group that contains the specified row.
     */
    const getGroupContainingRow = (rowIndex) => {

        const n = entries.length;

        for (let i = 0; i < n; i++) {

            const group = entries[i].getGroupContainingRow(rowIndex);

            if (group) return group;
        }

        return null;
    };

    /**
     * Gets the grouping object for the group whose output row has the given row index.
     */
    const getGroupingWithRowIndex = (rowIndex) => {

        const n = entries.length;

        for (let i = 0; i < n; i++) {

            const grouping = entries[i];

            const group = grouping.getGroupWithRowIndex(rowIndex);

            if (group) return grouping;
        }

        return null;
    };

    /**
     * Gets the grouping that contains the specified row.
     */
    const getGroupingThatContainsRow = (rowIndex) => {

        const n = entries.length;

        for (let i = 0; i < n; i++) {

            const grouping = entries[i];
            const group = grouping.getGroupWithRowIndex(rowIndex);

            if (group) {

                // The specified row is a group row.  Return the grouping that contains it.
                const parentGroupingIndex = grouping.parentGroupingIndex;
                return entries[parentGroupingIndex];
            }
        }

        // The specified row is a data row.  Return the leaf-level grouping.
        return entries[0];
    };

    /**
     * Gets the grouping that contains the uppermost row in the data.
     */
    const getGroupingOfUppermostRow = (dataGroupingSettings) => {

        const rowIndex = dataGroupingSettings.getRowIndex(1);

        return getGroupingWithRowIndex(rowIndex);
    };

    /**
     * Gets the parent grouping of the specified grouping.
     */
    const getParentGrouping = (grouping) => {

        const parentGroupingIndex = grouping.parentGroupingIndex;

        return parentGroupingIndex === -1 ? null : entries[parentGroupingIndex];
    };

    return {
        add,
        clear,
        entries,
        firstGroupOfOutermostGrouping,
        getGroupContainingRow,
        getGroupingByColumnIndexes,
        getGroupingOfUppermostRow,
        getGroupingThatContainsRow,
        getGroupingWithRowIndex,
        getGroupWithRowIndex,
        getContainedGrouping,
        getGroupingForGroup,
        getParentGrouping,
        groupingAlreadyExists,
        hasGroupings,
        innermostGrouping,
        lastGrouping,
        numGroupings,
        secondToLastGrouping,
        secondToLastGroup,
        totalsRowGroup,
        totalsRowGrouping,
        totalsRowIndex
    };
};
