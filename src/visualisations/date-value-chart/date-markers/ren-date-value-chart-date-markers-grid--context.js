/**
 * Identifies a date/value chart's dates grid and remembers what it lists (see
 * ren-date-value-chart-date-markers-grid.js).
 *
 * The numbered files behind that one are read in order, each taking hold of the ones before it as
 * it loads, so this - which takes hold of nothing - is first.
 */
Ren.DateValueChart_DateMarkersGrid_Context = (() => {

    const getSettingsGroup = (visualisation) =>
        visualisation.dateMarkersFilterGroup ||
        visualisation.visualisationGuid + " -|- DateMarkers";

    const getGridSettingsGroup = (visualisation) => getSettingsGroup(visualisation);

    const gridIdsByGroup = new Map();
    const groupsByGridId = new Map();
    let nextGridId = 1;

    const getGridId = (gridSettingsGroup) => {

        let gridId = gridIdsByGroup.get(gridSettingsGroup);

        if (gridId === undefined) {

            gridId = nextGridId++;
            gridIdsByGroup.set(gridSettingsGroup, gridId);
            groupsByGridId.set(gridId, gridSettingsGroup);
        }

        return gridId;
    };

    /**
     * The grid a settings group already has an id for, or undefined where none has been opened on
     * it.  For a group arriving from somewhere else - a filter change - where there is nothing to
     * refresh if no grid has ever been drawn.
     */
    const tryGetGridId = (gridSettingsGroup) => gridIdsByGroup.get(gridSettingsGroup);

    // Everything a grid needs to know about the dates it lists, by the grid it is for: the marker
    // source it was opened on, the marker rows, the column its ticks filter, and the dates
    // themselves - what the heading's box ticks and unticks, and what a right-click on a row's box
    // leaves one of.  Recorded as the grid is opened, since a tick box is only rendered as the
    // reader scrolls to it and the boxes are therefore no list of the dates there are.
    const gridContextsByGridId = new Map();

    const setGridContext = (gridId, gridContext) => gridContextsByGridId.set(gridId, gridContext);

    const getGridContext = (gridId) => gridContextsByGridId.get(gridId) ?? null;

    const getMarkerValues = (gridId) => gridContextsByGridId.get(gridId)?.markerValues ?? [];

    /**
     * A date as the filters hold it: the string form of the column's value, which is what a filter
     * value, a tick box's value and a marker row's date are all compared as.
     */
    const toDateValue = (value) => Ren.RowObjectFilter.toValueString(value);

    /**
     * The settings a grid keeps its filters in - the ticks among them - or null where the grid has
     * been closed and its settings collected.  Asked for each time rather than kept, since a grid
     * closed and reopened registers new ones under the same group.
     */
    const getGridSettings = (gridId) => {

        const gridSettingsGroup = groupsByGridId.get(gridId);

        if (gridSettingsGroup === undefined) return null;

        return Ren.DataGroupingSettingsCollection
            .getDataGroupingSettings(gridSettingsGroup) ?? null;
    };

    /**
     * A grid's filter entry for the marker source's tab, or null where nothing has been filtered.
     * Read straight off the filter set rather than through the filter accessors, which create the
     * structures they read: this is asked as every tick box is drawn, and a grid nobody has
     * filtered should be left holding no filter set at all to be captured onto the chart.
     */
    const getTabFilters = (gridId) => {

        const settings = getGridSettings(gridId);
        const gridContext = getGridContext(gridId);

        if (!settings || !gridContext) return null;

        return settings.dataRows?.filterSet?.[gridContext.tabularData.Title] ?? null;
    };

    return {
        getSettingsGroup,
        getGridSettingsGroup,
        getGridId,
        tryGetGridId,
        setGridContext,
        getGridContext,
        getMarkerValues,
        toDateValue,
        getGridSettings,
        getTabFilters
    };
})();
