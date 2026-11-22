/**
 * Shows a data grid with the dates returned by a date/value chart's date marker data source.
 *
 * The grid itself hides no row for a filter, which is what its ignoreRowFilters option is for (see
 * Ren.VisualisationTypes_GridSet).  A grid that hid them would be a list a reader was choosing
 * from that shrank as they chose, leaving no way of seeing what had been left out or of putting any
 * of it back - and a filter module on the group, which is the pleasant way of filtering a long list
 * of dates, would empty the grid it was filtering.  So every date stays listed, and the tick column
 * says which of them the chart is annotated with.  A date left out by the date column's own filter
 * is simply unticked - that filter is the ticks, and clicking the box ticks it back on - while one
 * left out by a filter on some other column is drawn unticked and disabled, its tooltip saying why:
 * the reader cannot tick it back while a filter they set elsewhere is what is holding it out.
 *
 * The dateMarkersFilterGroup setting specifies which grid a chart follows.
 *
 * This is the whole of the outside of it.  The parts are in the files beside it:
 *
 *   context      - which grid is which, and what dates it lists
 *   filter-set   - moving a filter between the chart and the grid
 *   selection    - which dates are ticked, and which cannot be
 *   checkboxes   - drawing the boxes and reacting to clicks on them
 *   tick-column  - laying the boxes out as a column of the grid
 *   following    - filtering the grid filters the charts that read it
 */
Ren.DateValueChart_DateMarkersGrid = (() => {

    /**
     * The dates a grid lists, in the order its marker source gives them and each of them once.
     * What the heading's box ticks and unticks, and what a right-click on a row's box leaves one
     * of - neither of which the tick boxes themselves can say, only some of them being rendered.
     */
    const getMarkerValues = (markerData, dateColumn) => {

        const markerValues = new Set();

        for (let i = 0; i < markerData.rows.length; i++) {

            markerValues.add(Ren.DateValueChart_DateMarkersGrid_Context
                .toDateValue(markerData.rows[i][dateColumn]));
        }

        return Array.from(markerValues);
    };

    /**
     * Creates the popup grid itself over the chart's marker data source.
     */
    const createGridSet = (visualisation, config, tabularData, settingsGroup) =>
        Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "GridSet",
            dataSourceUri: config.dataSourceUri,
            tabularDataTransformers: Ren.DateValueChart_DateMarkers.getTabularDataTransformers(
                config,
                tabularData
            ),
            dataGroupingSettingsGroup: settingsGroup,
            dataTabGroup: config.dataTabGroup,
            dataTabIndex: config.dataTabIndex ?? 1,
            excludeFromSerialization: true,
            fitPopupToContentExactly: true,
            gridStateGroup: settingsGroup,
            ignoreRowFilters: true,
            initialMaxHeight: "35rem",
            initialMaxWidth: 900,
            isPopup: true,
            maxHeight: "35rem",
            popupTitle: config.title || "Date markers",
            resizeToFitContentOnLoad: true,
            settingsNonSerializable: true,
            sourceVisualisation: visualisation,
            statBar: false,
            totalsRow: "None",
            variations: false
        });

    /**
     * Opens the dates grid for a chart: a popup grid over its marker data source, filtered by the
     * chart's marker filter and followed so that filtering it filters the chart's markers.
     */
    const showDatesGrid = (visualisation, props) => {

        const config = Ren.DateValueChart_DateMarkers.getConfig(visualisation);

        if (!config) return;

        const tabularData = Ren.DateValueChart_DateMarkers.getTabularData(config);

        if (!tabularData) {

            Ren.DateValueChart_DateMarkers.requestDataSource(config, props);

            Ren.Messages.Events.dataSourcesChanged.handle(() => {

                if (!Ren.DateValueChart_DateMarkers.getTabularData(config)) return;

                showDatesGrid(visualisation, props);

                // Returning false removes this listener: the grid it was waiting to open is open.
                return false;
            });

            return;
        }

        const settingsGroup = Ren.DateValueChart_DateMarkersGrid_Context
            .getSettingsGroup(visualisation);
        const gridSettingsGroup = Ren.DateValueChart_DateMarkersGrid_Context
            .getGridSettingsGroup(visualisation);
        const filterSet = Ren.DateValueChart_DateMarkersGrid_FilterSet.getFilterSet(visualisation);

        Ren.DateValueChart_DateMarkersGrid_Following.followChart(visualisation, props);

        const gridSet = createGridSet(visualisation, config, tabularData, settingsGroup);

        const markerData = Ren.DateValueChart_DateMarkers.getMarkerData(config, tabularData);
        const tickColumn = markerData.tickColumn;
        const dateColumn = markerData.dateColumn;
        const gridId = Ren.DateValueChart_DateMarkersGrid_Context.getGridId(gridSettingsGroup);

        if (dateColumn) {

            Ren.DateValueChart_DateMarkersGrid_Context.setGridContext(gridId, {
                tabularData,
                rows: markerData.rows,
                dateColumn,
                markerValues: getMarkerValues(markerData, dateColumn)
            });
        }

        // The grid registers its settings as it is built, which is after the call above returns for
        // a data source that has yet to arrive, so the filter waits for them rather than assuming.
        Ren.DataGroupingSettingsCollection.waitForDataGroupingSettings(
            gridSettingsGroup,
            gridSet?.visualisationGuid,
            (settings) => {

                Ren.DateValueChart_DateMarkersGrid_TickColumn.addCheckboxColumn(
                    settings,
                    tickColumn,
                    dateColumn,
                    gridId
                );

                Ren.FnUtils.defer(() => {

                    Ren.DateValueChart_DateMarkersGrid_FilterSet.initialiseFilter(
                        settings,
                        tabularData,
                        filterSet
                    );

                    settings.fireChangedEvent();

                    Ren.DateValueChart_DateMarkersGrid_TickColumn.layOutTickColumn(
                        settingsGroup,
                        gridSet,
                        tickColumn,
                        gridId
                    );
                });
            }
        );
    };

    const getSettingsGroup = (visualisation) =>
        Ren.DateValueChart_DateMarkersGrid_Context.getSettingsGroup(visualisation);

    const getGridSettingsGroup = (visualisation) =>
        Ren.DateValueChart_DateMarkersGrid_Context.getGridSettingsGroup(visualisation);

    const getFilterSet = (visualisation) =>
        Ren.DateValueChart_DateMarkersGrid_FilterSet.getFilterSet(visualisation);

    const setFilterSet = (visualisation, props, filterSet) =>
        Ren.DateValueChart_DateMarkersGrid_FilterSet.setFilterSet(visualisation, props, filterSet);

    const hasFilter = (visualisation) =>
        Ren.DateValueChart_DateMarkersGrid_FilterSet.hasFilter(visualisation);

    const clearFilter = (visualisation, props) =>
        Ren.DateValueChart_DateMarkersGrid_FilterSet.clearFilter(visualisation, props);

    const hideDate = (visualisation, props, value) =>
        Ren.DateValueChart_DateMarkersGrid_Selection.hideDate(visualisation, props, value);

    const captureFilterSet = (settings) =>
        Ren.DateValueChart_DateMarkersGrid_FilterSet.captureFilterSet(settings);

    const renderDateCheckbox = (gridId, value) =>
        Ren.DateValueChart_DateMarkersGrid_Checkboxes.renderDateCheckbox(gridId, value);

    const followChart = (visualisation, props) =>
        Ren.DateValueChart_DateMarkersGrid_Following.followChart(visualisation, props);

    return {
        getSettingsGroup,
        getGridSettingsGroup,
        getFilterSet,
        setFilterSet,
        hasFilter,
        clearFilter,
        hideDate,
        captureFilterSet,
        renderDateCheckbox,
        followChart,
        showDatesGrid
    };
})();
