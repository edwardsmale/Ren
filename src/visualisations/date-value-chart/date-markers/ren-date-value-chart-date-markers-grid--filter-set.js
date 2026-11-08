/**
 * Moves a date marker filter between a chart and its dates grid (see
 * ren-date-value-chart-date-markers-grid.js): capturing what the grid is filtered by, writing it
 * onto the chart, and initialising a newly opened grid from what the chart was saved with.
 */
Ren.DateValueChart_DateMarkersGrid_FilterSet = (() => {

    const getFilterSet = (visualisation) =>
        Ren.DateValueChart_DateMarkers.getConfig(visualisation)?.filterSet ?? null;

    /**
     * Gets a value indicating whether the chart's markers are currently filtered at all.
     */
    const hasFilter = (visualisation) => {

        const filterSet = getFilterSet(visualisation);

        if (!filterSet) return false;

        for (const dataTabTitle in filterSet) {

            const tabFilters = filterSet[dataTabTitle];
            const predicates = tabFilters?.rowFilter?.predicates;

            if (predicates?.length) return true;

            const columnValueFilters = tabFilters?.columnValueFilters;

            if (!columnValueFilters) continue;

            for (const columnIdOrHeading in columnValueFilters) {

                if (columnValueFilters[columnIdOrHeading]) return true;
            }
        }

        return false;
    };

    /**
     * Writes a filter set onto the chart and redraws it, saving it with the chart's other settings.
     */
    const setFilterSet = (visualisation, props, filterSet) => {

        const config = Ren.DateValueChart_DateMarkers.getConfig(visualisation);

        if (!config) return;

        // The configuration could have arrived as a JSON string (an element attribute) or as the
        // dataSourceUri shorthand, so what getConfig returns is written back as the object form -
        // which is what is saved, and what the filter now belongs to.
        config.filterSet = filterSet;
        visualisation.dateMarkers = config;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props?.redrawChart);
    };

    /**
     * Clears the date marker filter.
     */
    const clearFilter = (visualisation, props) => {

        const gridId = Ren.DateValueChart_DateMarkersGrid_Context.getGridId(
            Ren.DateValueChart_DateMarkersGrid_Context.getGridSettingsGroup(visualisation)
        );

        const settings = Ren.DateValueChart_DateMarkersGrid_Context.getGridSettings(gridId);

        if (settings) settings.sortFilterGroup.unfilter();

        setFilterSet(visualisation, props, null);
    };

    /**
     * Creates a plain filter set copy from settings.  Returns null when nothing is filtered.
     */
    const captureFilterSet = (settings) => {

        const sourceFilterSetByTab = settings?.dataRows?.filterSet;

        if (!sourceFilterSetByTab) return null;

        const capturedFilterSetByTab = {};
        let hasAnyFilter = false;

        for (const dataTabTitle in sourceFilterSetByTab) {

            const sourceTabFilters = sourceFilterSetByTab[dataTabTitle];
            const sourceColumnFiltersByColumn = sourceTabFilters?.columnValueFilters;
            const copiedColumnFiltersByColumn = {};
            const copiedNegatedColumns = [];

            const negatedColumnSet = new Set(Array.isArray(sourceTabFilters?.negatedColumns)
                ? sourceTabFilters.negatedColumns
                : []);

            for (const columnIdOrHeading in sourceColumnFiltersByColumn) {

                const sourceFilterValues = sourceColumnFiltersByColumn[columnIdOrHeading];

                if (!sourceFilterValues) continue;

                copiedColumnFiltersByColumn[columnIdOrHeading] = sourceFilterValues.slice();

                if (negatedColumnSet.has(columnIdOrHeading)) {
                    copiedNegatedColumns.push(columnIdOrHeading);
                }

                hasAnyFilter = true;
            }

            const capturedTabFilters = { columnValueFilters: copiedColumnFiltersByColumn };

            if (copiedNegatedColumns.length) {
                capturedTabFilters.negatedColumns = copiedNegatedColumns;
            }

            const sourceRowPredicates = sourceTabFilters?.rowFilter?.predicates;

            if (Array.isArray(sourceRowPredicates) && sourceRowPredicates.length) {

                capturedTabFilters.rowFilter = { predicates: sourceRowPredicates.slice() };
                hasAnyFilter = true;
            }

            capturedFilterSetByTab[dataTabTitle] = capturedTabFilters;
        }

        return hasAnyFilter ? capturedFilterSetByTab : null;
    };

    /**
     * Initialises a new grid with the chart's saved marker filters.
     */
    const initialiseFilter = (settings, tabularData, filterSet) => {

        const savedTabFilters = filterSet?.[tabularData.Title];

        if (!savedTabFilters) return;

        const existingTabFilters = settings.dataRows?.filterSet?.[tabularData.Title];
        const existingColumnFilters = existingTabFilters?.columnValueFilters;

        if (existingColumnFilters && Object.keys(existingColumnFilters).length) return;
        if (existingTabFilters?.rowFilter?.predicates?.length) return;

        // Apply row predicates first to avoid an intermediate regroup.
        const savedRowPredicates = savedTabFilters.rowFilter?.predicates;

        if (Array.isArray(savedRowPredicates) && savedRowPredicates.length) {
            settings.sortFilterGroup.setRowFilterPredicates(savedRowPredicates.slice());
        }

        const savedColumnFilters = savedTabFilters.columnValueFilters;

        if (!savedColumnFilters) return;

        const negatedColumnSet = new Set(savedTabFilters.negatedColumns ?? []);

        for (const columnIdOrHeading in savedColumnFilters) {

            const selectedValues = savedColumnFilters[columnIdOrHeading];

            if (!Array.isArray(selectedValues)) continue;

            if (negatedColumnSet.has(columnIdOrHeading)) {
                settings.sortFilterGroup.setColumnFilterNegated(columnIdOrHeading, true);
            }

            settings.sortFilterGroup.setAllFilter(columnIdOrHeading, selectedValues);
        }
    };

    return {
        getFilterSet,
        hasFilter,
        setFilterSet,
        clearFilter,
        captureFilterSet,
        initialiseFilter
    };
})();
