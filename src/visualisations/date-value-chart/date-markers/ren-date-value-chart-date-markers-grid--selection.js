/**
 * Which dates a dates grid keeps, and the ticking and unticking of them (see
 * ren-date-value-chart-date-markers-grid.js).
 *
 * Two questions are asked of every date, and they are not the same one: whether the date column's
 * own filter keeps it, which is what its box is ticked by, and whether some other column's filter
 * leaves it out, which is what its box is disabled by.
 */
Ren.DateValueChart_DateMarkersGrid_Selection = (() => {

    /**
     * Gets a grid's tick boxes as a selection over its date column: the dates it currently keeps,
     * stated as the dates shown whichever way round the filter is stored, and written back the same
     * way.  Changes are written as any other filter change is, so the chart's markers, the grid's
     * tick boxes and any filter module on the column stay in step.
     */
    const getDateSelection = (gridId) => {

        const settings = Ren.DateValueChart_DateMarkersGrid_Context.getGridSettings(gridId);
        const gridContext = Ren.DateValueChart_DateMarkersGrid_Context.getGridContext(gridId);

        if (!settings || !gridContext) return null;

        const dateColumn = gridContext.dateColumn;

        return Ren.ColumnValueSelection.create({
            tabularData: gridContext.tabularData,
            columnIdOrHeading: dateColumn,
            isNegated: () => Ren.FilterNegation
                .getNegatedColumnSetFromTabFilters(
                    Ren.DateValueChart_DateMarkersGrid_Context.getTabFilters(gridId)
                )
                .has(dateColumn),
            readStoredValues: () => Ren.DateValueChart_DateMarkersGrid_Context
                .getTabFilters(gridId)?.columnValueFilters?.[dateColumn] ?? null,
            writeStoredValues: (values) => settings.sortFilterGroup.setAllFilter(dateColumn, values),
            removeFilter: () => settings.sortFilterGroup.removeColumnFilter(dateColumn),

            // The dates the grid was drawn from, for stating "every date but this one" when the
            // first box is unticked.  A grid whose dates were never recorded is then left alone
            // rather than filtered down to nothing.
            getAllValues: () => Ren.DateValueChart_DateMarkersGrid_Context.getMarkerValues(gridId)
        });
    };

    /**
     * Gets the dates a grid's date column filter currently keeps, whichever way round it is
     * stored, or null where the column carries no filter and so every date is kept.
     */
    const getShownDates = (gridId) => getDateSelection(gridId)?.getShownValues() ?? null;

    // The dates a grid's other columns' filters keep, by the grid they were worked out for, or null
    // for a grid whose other columns are not filtered.  Held only for one pass of drawing.
    const filteredValuesByGridId = new Map();

    /**
     * Gets a grid's filters as a filter set, less the date column's own value filter, or null where
     * nothing else is filtered.  A compare filter on the date column is kept.
     */
    const getOtherColumnsFilterSet = (settings, dateColumn) => {

        const filterSet = Ren.DateValueChart_DateMarkersGrid_FilterSet.captureFilterSet(settings);

        if (!filterSet) return null;

        let hasOtherFilter = false;

        for (const dataTabTitle in filterSet) {

            const tabFilters = filterSet[dataTabTitle];
            const columnValueFilters = tabFilters.columnValueFilters;

            delete columnValueFilters[dateColumn];

            if (Object.keys(columnValueFilters).length) hasOtherFilter = true;
            if (tabFilters.rowFilter?.predicates?.length) hasOtherFilter = true;
        }

        return hasOtherFilter ? filterSet : null;
    };

    /**
     * The dates a grid still lists once every filter but the date column's own is applied, or null
     * where nothing else is filtered and so every date is left tickable.  Worked out from the
     * filter rather than from the rows the grid is showing, since the grid shows every row.
     */
    const computeFilteredValues = (gridId) => {

        const settings = Ren.DateValueChart_DateMarkersGrid_Context.getGridSettings(gridId);
        const gridContext = Ren.DateValueChart_DateMarkersGrid_Context.getGridContext(gridId);

        if (!settings || !gridContext) return null;

        const filterSet = getOtherColumnsFilterSet(settings, gridContext.dateColumn);

        if (!filterSet) return null;

        const keptRows = Ren.DateValueChart_DateMarkers.applyFilterSet(
            { filterSet },
            gridContext.tabularData,
            gridContext.rows
        );

        const keptValues = new Set();

        for (let i = 0; i < keptRows.length; i++) {

            keptValues.add(Ren.DateValueChart_DateMarkersGrid_Context
                .toDateValue(keptRows[i][gridContext.dateColumn]));
        }

        return keptValues;
    };

    const getFilteredValues = (gridId) => {

        if (filteredValuesByGridId.has(gridId)) return filteredValuesByGridId.get(gridId);

        const filteredValues = computeFilteredValues(gridId);

        filteredValuesByGridId.set(gridId, filteredValues);

        return filteredValues;
    };

    /**
     * Drops what was worked out for the last pass of drawing.
     */
    const forgetFilteredValues = (gridId) => filteredValuesByGridId.delete(gridId);

    /**
     * Gets a value indicating whether a grid's other filters leave a date out, in which case its
     * box is unticked and disabled.
     */
    const isDateFilteredOut = (gridId, value) => {

        const filteredValues = getFilteredValues(gridId);

        return !!filteredValues && !filteredValues.has(value);
    };

    /**
     * Gets a value indicating whether a grid's date column filter keeps a date, in which case its
     * box is ticked.  No filter on the column keeps every date.
     */
    const isDateShown = (gridId, value) =>
        Ren.ColumnValueSelection.isValueShown(getShownDates(gridId), value);

    /**
     * Ticks or unticks one date, leaving every other as it is.  With no filter on the column every
     * date is ticked, so unticking the first one states all the others.
     */
    const setDateShown = (gridId, value, isShown) => {

        if (isShown === isDateShown(gridId, value)) return;

        getDateSelection(gridId)?.toggle(value);
    };

    /**
     * Ticks or unticks every date a grid lists at once.  Ticking them all takes the filter off the
     * column, so a date the source gains later arrives ticked.  Unticking them all states a filter
     * that keeps no date.
     */
    const setAllDatesShown = (gridId, isShown) => getDateSelection(gridId)?.setAllShown(isShown);

    /**
     * Leaves a grid showing one date and no others.
     */
    const setOnlyDateShown = (gridId, value) => getDateSelection(gridId)?.showOnly(value);

    /**
     * Unticks one date straight on a chart's marker filter, for a chart whose dates grid is not
     * open to write it through.
     */
    const hideDateOnChart = (visualisation, props, value) => {

        const config = Ren.DateValueChart_DateMarkers.getConfig(visualisation);
        const tabularData = config ? Ren.DateValueChart_DateMarkers.getTabularData(config) : null;

        if (!tabularData) return;

        const markerData = Ren.DateValueChart_DateMarkers.getMarkerData(config, tabularData);
        const dateColumn = markerData.dateColumn;

        if (!dateColumn) return;

        // Copied rather than edited in place, so the filter is written through setFilterSet whole.
        const filterSet = Object.assign({}, config.filterSet);
        const tabFilters = Object.assign({}, filterSet[tabularData.Title]);

        tabFilters.columnValueFilters = Object.assign({}, tabFilters.columnValueFilters);
        filterSet[tabularData.Title] = tabFilters;

        const selection = Ren.ColumnValueSelection.create({
            tabularData,
            columnIdOrHeading: dateColumn,
            isNegated: () => (tabFilters.negatedColumns ?? []).indexOf(dateColumn) !== -1,
            readStoredValues: () => tabFilters.columnValueFilters[dateColumn] ?? null,
            writeStoredValues: (values) => {

                tabFilters.columnValueFilters[dateColumn] = values;
            },
            removeFilter: () => {

                delete tabFilters.columnValueFilters[dateColumn];
            },
            getAllValues: () => Ren.RowObjectFilter.getDistinctValues(markerData.rows, dateColumn)
        });

        if (!selection.isShown(value)) return;

        selection.toggle(value);

        Ren.DateValueChart_DateMarkersGrid_FilterSet.setFilterSet(visualisation, props, filterSet);
    };

    /**
     * Stops a chart drawing the markers at one date.  Written through the chart's dates grid where
     * it is open, so its tick boxes and every chart following it stay in step.
     */
    const hideDate = (visualisation, props, value) => {

        const gridId = Ren.DateValueChart_DateMarkersGrid_Context.tryGetGridId(
            Ren.DateValueChart_DateMarkersGrid_Context.getGridSettingsGroup(visualisation)
        );

        if (gridId !== undefined && getDateSelection(gridId)) {

            setDateShown(gridId, value, false);
            return;
        }

        hideDateOnChart(visualisation, props, value);
    };

    return {
        hideDate,
        getShownDates,
        forgetFilteredValues,
        isDateFilteredOut,
        isDateShown,
        setDateShown,
        setAllDatesShown,
        setOnlyDateShown
    };
})();
