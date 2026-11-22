/**
 * Updates the groupings based on dataGroupingSettings.groupings.
 */
Ren.GroupingsAdder = (tabularData, dataGroupingSettings, groupingFactory) => {

    const createGrouping = Ren.GroupingsAdder_CreateGrouping(groupingFactory, tabularData);

    const createGroupMatchesOuterFilter = Ren.GroupingsAdder_GroupMatchesOuterFilter(tabularData);

    const applyOuterFilterToSecondToLastGrouping = Ren.GroupingsAdder_ApplyOuterFilterToSecondToLastGrouping(
        tabularData,
        dataGroupingSettings,
        createGroupMatchesOuterFilter
    );

    const setColumnValueFormats = Ren.GroupingsAdder_SetColumnValueFormats(
        tabularData,
        dataGroupingSettings
    );

    const populateGroupings = Ren.GroupingsAdder_PopulateGroupings(
        tabularData,
        dataGroupingSettings,
        setColumnValueFormats,
        applyOuterFilterToSecondToLastGrouping,
        createGrouping
    );

    const { addGrouping, addGroupings } = Ren.GroupingsAdder_AddGrouping(
        dataGroupingSettings,
        populateGroupings
    );

    // Marks again which of a grouping's groups its own column value filters exclude, after those
    // filters change without the groupings being rebuilt.  Only the second-to-last grouping marks
    // them.
    const reapplyOuterFilter = (grouping) => {

        const entries = dataGroupingSettings.groupings.entries;
        const groupingIndex = entries.indexOf(grouping);

        if (groupingIndex < 0 || groupingIndex !== entries.length - 2) return;

        grouping.groups().forEach(group => {

            delete group.excludedByOuterFilter;
        });

        applyOuterFilterToSecondToLastGrouping(grouping, entries.length, groupingIndex);
    };

    return {
        addGrouping,
        addGroupings,
        populateGroupings,
        reapplyOuterFilter
    };
};
