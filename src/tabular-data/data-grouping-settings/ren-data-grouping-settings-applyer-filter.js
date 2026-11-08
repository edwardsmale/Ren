/**
 * Applies the filter settings from an input filter set to another filter set.
 */
Ren.DataGroupingSettingsApplyer_Filter = (() => {

    /**
     * Applies filters from source to target filter set parent.
     *
     * A 'filter set parent' comes from a data grouping settings object; either its dataRows object
     * or a grouping.
     */
    const applyFilter = (inputFilterSetParent, targetFilterSetParent) => {

        const accessors = Ren.DataGroupingSettings_Services_FilterAccessors;

        const sourceDataTabTitles = inputFilterSetParent
            ? accessors.getAllTabTitles(inputFilterSetParent)
            : [];

        const targetDataTabTitles = accessors.getAllTabTitles(targetFilterSetParent);

        // Use a Set for fast lookup.
        const sourceTabSet = new Set(sourceDataTabTitles);

        // Reuse this object to avoid repeated allocations.
        const stubTabularData = { Title: null };

        // Remove filters from target that are not in source.
        for (let i = 0, len = targetDataTabTitles.length; i < len; i++) {

            const dataTabTitle = targetDataTabTitles[i];

            if (!sourceTabSet.has(dataTabTitle)) {

                stubTabularData.Title = dataTabTitle;

                accessors.clearColumnValueFilters(targetFilterSetParent, stubTabularData);
                accessors.clearRowFilterPredicates(targetFilterSetParent, stubTabularData);
            }
        }

        if (!inputFilterSetParent) return;

        // Copy filters from source to target
        for (let i = 0, len = sourceDataTabTitles.length; i < len; i++) {

            const dataTabTitle = sourceDataTabTitles[i];
            stubTabularData.Title = dataTabTitle;

            accessors.ensureTabFiltersExist(targetFilterSetParent, stubTabularData);

            const sourceColumnValueFilters = accessors.getColumnValueFilters(inputFilterSetParent, stubTabularData);

            // Only clone if there are filters to set
            const hasSourceFilters = !Ren.ObjectUtils.isEmptyObject(sourceColumnValueFilters);

            accessors.setColumnValueFilters(
                targetFilterSetParent,
                stubTabularData,
                hasSourceFilters ? Ren.ObjectUtils.cloneDeep(sourceColumnValueFilters) : {}
            );

            // The marks saying which of those filters name their exclusions rather than their
            // inclusions are carried with them: the same values mean the opposite filter without
            // them, so a filter applied from a settings file has to arrive meaning what it said
            // (see Ren.FilterNegation).
            accessors.setNegatedFilterColumns(
                targetFilterSetParent,
                stubTabularData,
                accessors.getNegatedFilterColumns(inputFilterSetParent, stubTabularData).slice()
            );

            // Carry the row-filter predicates (combination filters, filter functions) across too,
            // so a settings object holding only predicates still propagates and survives
            // re-application.  Only touched when predicates are actually involved, so the common
            // no-predicate case is left exactly as before.
            const sourceRowFilterPredicates =
                accessors.getRowFilterPredicates(inputFilterSetParent, stubTabularData);

            if (sourceRowFilterPredicates.length) {

                accessors.setRowFilterPredicates(
                    targetFilterSetParent,
                    stubTabularData,
                    Ren.ObjectUtils.cloneDeep(sourceRowFilterPredicates)
                );
            }
            else if (accessors.getRowFilterPredicates(targetFilterSetParent, stubTabularData).length) {

                accessors.clearRowFilterPredicates(targetFilterSetParent, stubTabularData);
            }

            // The marks saying which filters are to be saved with the report are deliberately left
            // alone.  A mark describes the page rather than the settings (see
            // Ren.ReportSettings_IncludedFilters), and settings are applied for all sorts of
            // reasons besides a load - a data reload, a variation, one grid of a set following
            // another - so carrying them here would clear a mark every time any of those happened,
            // the settings being applied never having one to carry.  Loading is where marks are
            // cleared, by the load itself (see clearPageFilterMarks).
        }
    };

    return {
        applyFilter
    };
})();
