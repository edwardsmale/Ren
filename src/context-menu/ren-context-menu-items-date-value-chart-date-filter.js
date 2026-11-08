/**
 * The date/value chart context menu's "Show date filter" and "Filter by": filter module popups
 * over the chart's columns - the date column nested by year, quarter and month - which filter the
 * group the chart takes its filters from, and so everything else filtered by that group too.
 */
Ren.ContextMenuItems_DateValueChart_DateFilter = (chart) => {

    const { tabularData, visualisation, props } = chart;

    // The periods a date can be nested under, outermost first.
    const PARENT_LEVELS = [
        { calcFunction: "date-year-start", period: Ren.DatePeriodEnum.Year },
        { calcFunction: "date-quarter-start", period: Ren.DatePeriodEnum.Quarter },
        { calcFunction: "date-month-start", period: Ren.DatePeriodEnum.Month }
    ];

    const getFilterGroup = () =>
        visualisation.filterGroup || visualisation.dataGroupingSettingsGroup;

    /**
     * Gets the first open filter module popup matching a predicate, or null where none is open.
     */
    const findFilterModule = (predicate) => {

        const filterModules = Ren.VisualisationCollection.getVisualisations("FilterModule");

        for (let index = 0; index < filterModules.length; index++) {

            const filterModule = filterModules[index];

            if (!filterModule.isDestroyed && predicate(filterModule)) return filterModule;
        }

        return null;
    };

    /**
     * Gets the chart's date filter popup, or null where it has none open.
     */
    const findDateFilter = () => findFilterModule(filterModule =>
        filterModule.chartDateFilterGuid === visualisation.visualisationGuid);

    /**
     * Gets the chart's popup filtering by a column, or null where it has none open.
     */
    const findColumnFilter = (columnIdOrHeading) => findFilterModule(filterModule =>
        filterModule.chartColumnFilterGuid === visualisation.visualisationGuid
        && filterModule.chartColumnFilterColumn === columnIdOrHeading);

    /**
     * Gets a column as the filter module names it.
     */
    const getColumnIdOrHeading = (columnModel) =>
        columnModel.ColumnIdOrHeading ?? columnModel.ColumnId ?? columnModel.Heading;

    /**
     * Gets the date column as the filter module names it, or null where the chart has none.
     */
    const getDateColumnIdOrHeading = () => {

        if (!tabularData || !props.dateHeading) return null;

        const columnIndex = tabularData.findColumnIndex(props.dateHeading);
        const columnModel = columnIndex >= 0 ? tabularData.ColumnModels[columnIndex] : null;

        if (!columnModel) return null;

        return getColumnIdOrHeading(columnModel);
    };

    /**
     * Gets a value indicating whether the chart can be filtered through its filter group: an ad
     * hoc chart takes no filters, and a filter module needs the group's settings.
     */
    const canFilter = () => !visualisation.isAdHoc
        && !!Ren.DataGroupingSettingsCollection.getDataGroupingSettings(getFilterGroup());

    /**
     * Gets the levels the dates are nested under: only those coarser than the dates themselves, as
     * a date cannot be nested under its own period.
     */
    const getParentGroupings = (columnIdOrHeading) => {

        const datePeriod = Ren.DatePeriodDetector.detectDatePeriodForRows(
            props.rawInputData,
            props.dateHeading
        );

        const parentGroupings = [];

        for (let index = 0; index < PARENT_LEVELS.length; index++) {

            const level = PARENT_LEVELS[index];

            if (datePeriod && level.period <= datePeriod) continue;

            parentGroupings.push({ column: columnIdOrHeading, calcFunction: level.calcFunction });
        }

        return parentGroupings;
    };

    /**
     * Opens a filter module popup filtering the chart's filter group; the options add its title,
     * its column's settings and what it is found by again.
     */
    const showFilterModule = (options) => {

        const clickPosition = Ren.LastRightClickPosition;

        Ren.VisualisationCreator.createVisualisation(Object.assign({
            visualisationTypeName: "FilterModule",
            popupIcon: "filter-icon.png",
            dataSourceUri: visualisation.dataSourceUri,
            sqlFilename: visualisation.sqlFilename,
            sourceDataGroupingSettingsGroup: getFilterGroup(),
            sourceVisualisation: visualisation.sourceVisualisation ?? null,
            dataTabIndex: visualisation.dataTabIndex,
            dataTabGroup: visualisation.dataTabGroup,
            initLabelFunctionsFromSource: true,
            showRightClickHint: false,
            isPopup: true,
            fillAvailableSpace: true,
            resizeToFitContentOnLoad: true,
            verticalScrollbar: true,
            initialMaxWidth: 1000,
            maxHeight: "calc(100% - 22px)",
            popupLeft: clickPosition ? clickPosition.x : null,
            popupTop: clickPosition ? clickPosition.y : null
        }, options));
    };

    const showDateFilter = () => {

        const columnIdOrHeading = getDateColumnIdOrHeading();

        if (!columnIdOrHeading) return;

        showFilterModule({
            popupTitle: "Date filter",
            chartDateFilterGuid: visualisation.visualisationGuid,
            columnOverrides: {

                [columnIdOrHeading]: {
                    included: true,
                    sortByValue: true,
                    parentGroupings: getParentGroupings(columnIdOrHeading)
                }
            }
        });
    };

    const toggleDateFilter = () => {

        const dateFilter = findDateFilter();

        if (dateFilter) {

            Ren.VisualisationCollection.destroyVisualisation(dateFilter);
        }
        else {

            showDateFilter();
        }
    };

    const toggleColumnFilter = (columnModel) => {

        const columnIdOrHeading = getColumnIdOrHeading(columnModel);
        const columnFilter = findColumnFilter(columnIdOrHeading);

        if (columnFilter) {

            Ren.VisualisationCollection.destroyVisualisation(columnFilter);
            return;
        }

        showFilterModule({
            popupTitle: columnModel.Heading + " filter",
            chartColumnFilterGuid: visualisation.visualisationGuid,
            chartColumnFilterColumn: columnIdOrHeading,
            columnOverrides: {

                [columnIdOrHeading]: {
                    included: true
                }
            }
        });
    };

    /**
     * Gets the columns the chart can be filtered by: every column but its dates, which have a
     * filter of their own, and the values it plots.
     */
    const getFilterableColumns = () => {

        if (!tabularData) return [];

        // A split chart's value headings name its series, so its source columns are added too.
        const valueHeadings = (props.valueHeadings || []).concat(props.seriesSourceHeadings || []);
        const columns = [];

        for (let index = 0; index < tabularData.ColumnModels.length; index++) {

            const columnModel = tabularData.ColumnModels[index];

            if (!columnModel.Heading) continue;
            if (Ren.DateValueChart_InputColumns.isInternalColumn(columnModel)) continue;

            const columnIdOrHeading = getColumnIdOrHeading(columnModel);

            if (columnIdOrHeading === props.dateHeading
                || columnModel.Heading === props.dateHeading) continue;

            if (valueHeadings.indexOf(columnIdOrHeading) !== -1
                || valueHeadings.indexOf(columnModel.Heading) !== -1) continue;

            columns.push(columnModel);
        }

        return columns;
    };

    const showDateFilterMenuItem = {
        section: "Dates",
        text: "Show date filter",
        id: "chart-show-date-filter",
        visible: () => canFilter() && !!getDateColumnIdOrHeading(),
        action: () => toggleDateFilter(),
        ticked: () => !!findDateFilter()
    };

    // Getter so the submenu follows the columns as the data changes.
    const filterByMenuItem = {
        section: "Chart data",
        text: "Filter by",
        id: "chart-filter-by",
        visible: () => canFilter() && getFilterableColumns().length > 0,
        get submenu() {

            return getFilterableColumns().map(columnModel => ({
                text: columnModel.Heading,
                id: "chart-filter-by-" + getColumnIdOrHeading(columnModel),
                action: () => toggleColumnFilter(columnModel),
                ticked: () => !!findColumnFilter(getColumnIdOrHeading(columnModel))
            }));
        }
    };

    return {
        filterByMenuItem,
        getFilterableColumns,
        showDateFilterMenuItem
    };
};
