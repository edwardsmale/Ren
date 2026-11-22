Ren.GroupingsAdder_ApplyOuterFilterToSecondToLastGrouping = function (tabularData, dataGroupingSettings, createGroupMatchesOuterFilter) {

    return function applyOuterFilterToSecondToLastGrouping(grouping, groupCount, groupingIndex) {

        // Apply any filterSet stored on the grouping itself (second-to-last grouping).
        // This replaces the previous use of dataGroupingSettings.outerFilterSet.
        if (groupingIndex !== groupCount - 2) return;

        const tabTitle = tabularData.Title;

        let tabFilters = grouping.filterSet?.[tabTitle];
        let filterColumns = tabFilters?.columnValueFilters;

        // If no filterSet exists on the grouping, but an initial outerFilterSet was
        // provided (from older settings), apply that to the grouping so the filters
        // are respected during initial population.
        if (!filterColumns && dataGroupingSettings._initialOuterFilterSet) {

            const initialTabFilter = dataGroupingSettings._initialOuterFilterSet[tabTitle];
            const initialFilterColumns = initialTabFilter?.columnValueFilters;

            if (initialFilterColumns) {

                // Transfer the initial outerFilterSet onto the grouping's filterSet so
                // subsequent code reads the filter from the grouping.
                grouping.filterSet = dataGroupingSettings._initialOuterFilterSet;
                // Remove the temporary initial marker so it's not applied again.
                delete dataGroupingSettings._initialOuterFilterSet;

                tabFilters = grouping.filterSet?.[tabTitle];
                filterColumns = tabFilters?.columnValueFilters;
            }
        }

        if (!filterColumns) return;

        const negatedColumns =
            Ren.FilterNegation.getNegatedColumnSetFromTabFilters(tabFilters);

        const groupMatchesOuterFilter =
            createGroupMatchesOuterFilter(filterColumns, negatedColumns);

        grouping.groups().forEach(group => {

            if (!groupMatchesOuterFilter(group)) {
                group.excludedByOuterFilter = true;
            }
        });
    };
};
