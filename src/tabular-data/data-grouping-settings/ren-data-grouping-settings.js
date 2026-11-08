/**
* The settings and current state of a visualisation's sorting, filtering and groupings.  Each
* visualisation has its own instance even when sharing a settings group, as group state may differ.
*/
Ren.DataGroupingSettings = (
    tabularData,
    visualisation,
    tracksRowDisplayOption,
    dataGroupingSettingsGroupOption) => {

    // Scratch settings built only to read aggregated values are never rendered, so the rowY arrays
    // are left empty rather than rebuilt on every filter change for every column.
    const tracksRowDisplay = tracksRowDisplayOption !== false;

    // A grid set's grids share one visualisation, but each has a settings group of its own.
    const dataGroupingSettingsGroup =
        dataGroupingSettingsGroupOption ?? visualisation.dataGroupingSettingsGroup;

    const filterGroup = visualisation.filterGroup || visualisation.dataGroupingSettingsGroup;
    const containingReportGuid = visualisation.containingReportGuid;
    const visualisationGuid = visualisation.visualisationGuid;
    const _columnDefaults = visualisation.columnDefaults;

    let activeRowCount = tabularData.ActualRowCount;

    const rowYs = []; // The zero-based row number each data row is displayed at.

    // The inverse of rowYs, as a plain array rather than a Map for far less memory.
    const rowYIndexes = [];

    const initialiseRowYs = () => {

        rowYs.length = 0;

        if (!tracksRowDisplay) return;

        for (let h = 0; h < tabularData.HeadingCount; h++) {
            rowYs.push(h); // Headings have rowYs of 0 and 1.
        }

        for (let rowIndex = 0; rowIndex < tabularData.DataRowCount; rowIndex++) {
            rowYs.push(rowIndex + tabularData.HeadingCount);
        }
    };

    initialiseRowYs();

    /**
     * Rebuilds an inverse-index Map from an array, excluding hidden (-1) entries.
     */
    const rebuildInverseIndex = (arr, indexMap) => {

        indexMap.clear();

        for (let i = 0; i < arr.length; i++) {

            if (arr[i] !== -1) indexMap.set(arr[i], i);
        }
    };

    /**
     * Rebuilds rowYIndexes as the inverse of rowYs.  Pre-sized so V8 keeps it as packed fast
     * elements rather than a slow dictionary.
     */
    const updateRowYIndexes = () => {

        rowYIndexes.length = 0;
        rowYIndexes.length = rowYs.length;

        for (let i = 0; i < rowYs.length; i++) {

            const rowY = rowYs[i];

            if (rowY !== -1) rowYIndexes[rowY] = i;
        }
    };

    updateRowYIndexes();

    const colXs = []; // The zero-based display position each SQL column is rendered at.
    const colXIndexes = new Map(); // The inverse of colXs: display X position → SQL column index.

    // The natural order, until overwritten with the display order once gridState is available.
    const initialiseColXs = () => {

        colXs.length = 0;

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {
            colXs.push(columnIndex);
        }
    };

    initialiseColXs();

    const updateColXIndexes = () => rebuildInverseIndex(colXs, colXIndexes);

    updateColXIndexes();

    const groupings = Ren.Groupings();

    const totalsRow = {
        position: Ren.DataGridTotalsRowPositionEnum.Bottom
    };

    const setTotalsRowPosition = (newPosition) => {

        totalsRow.position = newPosition;
    };

    Ren.DataGroupingSettings_TotalsRow.setTotalsRowPositionAccordingToVisualisation(
        visualisation,
        setTotalsRowPosition
    );

    // Pages the second-to-last grouping's groups, or the data rows where there are no groupings.
    // pageCount and groupCount are worked out by the applyer, which keeps pageIndex within range.
    const paging = {
        pageSize: null,
        pageIndex: 0,
        pageCount: 1,
        groupCount: 0
    };

    const dataRows = Ren.DataGroupingSettingsDataRows();

    const layout = Ren.DataGroupingSettingsLayout();

    // Each column's default filter type (Ren.DataGroupingSettingsColumnMenus).
    const columnMenus = {};

    const getGroupCtrlsCountMode = () => layout.groupCtrlsCountMode;
    const setGroupCtrlsCountMode = (newMode) => {

        layout.groupCtrlsCountMode = newMode;
    };

    /**
     * Gets the number of rows that are currently not hidden due to filtering or grouping.
     */
    const getActiveRowCount = () => activeRowCount;
    const setActiveRowCount = (value) => activeRowCount = value;

    const getActiveRowCountExcludingTotalsRowAndHeaderRows = () => {

        const rowCount = getActiveRowCount() - tabularData.HeadingCount;

        if (rowCount === 0) return 0; // No totals row shows if there are no rows.

        return rowCount
            - (totalsRow.position === Ren.DataGridTotalsRowPositionEnum.None ? 0 : 1);
    };

    /**
     * Gets the number of rows that are currently not hidden by grouping or filtering.
     */
    const getExposedRowCount = () => {

        return rowYs.filter((rowY) => rowY !== -1).length;
    };

    const getRowIndex = (rowY) => rowYIndexes[rowY];
    const getRowY = (rowIndex) => rowYs[rowIndex];

    const getColIndex = (colX) => colXIndexes.get(colX);
    const getColX = (columnIndex) => colXs[columnIndex];

    const isGapRow = (rowIndex) => isNaN(getRowIndex(rowIndex));

    const totalsRowY = () => rowYs[groupings.totalsRowIndex() + tabularData.HeadingCount];

    /**
     * @param {number} rowIndex The index of the row (ex.  headings), or null to set for all rows.
     */
    const setFormatFunction = (columnIndex, rowIndex, valueFormatFunction) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        if (rowIndex === null) {

            _dataGroupingSettings.setDataRowsFormatFunction(columnIdOrHeading, valueFormatFunction);

            for (let i = 0; i < groupings.numGroupings(); i++) {

                setGroupingFormatFunction(columnIdOrHeading, groupings.entries[i], valueFormatFunction);
            }
        }
        else if (tabularData.isDataRow(rowIndex)) {

            _dataGroupingSettings.setDataRowsFormatFunction(columnIdOrHeading, valueFormatFunction);
        }
        else {

            const grouping = groupings.getGroupingWithRowIndex(rowIndex);
            setGroupingFormatFunction(columnIdOrHeading, grouping, valueFormatFunction);
        }

        _dataGroupingSettings.fireChangedEvent();
    };

    // Gets the format function set on the cell's own rows: the data rows, or the row's grouping.
    const getFormatFunction = (columnIndex, rowIndex) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        const columns = rowIndex === null || tabularData.isDataRow(rowIndex)
            ? _dataGroupingSettings.dataRows.columns
            : groupings.getGroupingWithRowIndex(rowIndex).columns;

        return columns?.[columnIdOrHeading]?.valueFormatFunction ?? null;
    };

    const getCalcFunction = (columnIndex, rowIndex) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        if (rowIndex === null || tabularData.isDataRow(rowIndex)) {

            return _dataGroupingSettings.getDataRowsCalcFunction(columnIdOrHeading);
        }
        else {

            const grouping = groupings.getGroupingWithRowIndex(rowIndex);

            return grouping.columns?.[columnIdOrHeading]?.calcFunction
                || _dataGroupingSettings.getDataRowsCalcFunction(columnIdOrHeading);
        }
    };

    /**
     * @param {number} rowIndex The index of the row (ex.  headings), or null to set for all rows.
     */
    const setCalcFunction = (columnIndex, rowIndex, calcFunction) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        if (rowIndex === null || tabularData.isDataRow(rowIndex)) {

            _dataGroupingSettings.setDataRowsCalcFunction(columnIdOrHeading, calcFunction);
        }
        else {

            const grouping = groupings.getGroupingWithRowIndex(rowIndex);
            setGroupingCalcFunction(columnIdOrHeading, grouping, calcFunction);
        }

        _dataGroupingSettings.repopulateGroupings();
        _dataGroupingSettings.fireChangedEvent();
    };

    const columnDefaults = {};

    if (_columnDefaults) {

        for (const columnIdOrHeading in _columnDefaults) {

            columnDefaults[columnIdOrHeading] = {
                calcFunction: _columnDefaults[columnIdOrHeading].calcFunction,
                valueFormatFunction: Ren.ArrayUtils.ensureArray(_columnDefaults[columnIdOrHeading].valueFormatFunction),
                aggregationType: _columnDefaults[columnIdOrHeading].aggregationType,
                aggregationIndicator: _columnDefaults[columnIdOrHeading].aggregationIndicator
            };
        }
    }

    const setGroupingFormatFunction = (columnIdOrHeading, grouping, formatFunction) => {

        grouping.columns[columnIdOrHeading] ??= {};
        grouping.columns[columnIdOrHeading].valueFormatFunction = Ren.ArrayUtils.ensureArray(formatFunction);
    };

    const setGroupingCalcFunction = (columnIdOrHeading, grouping, calcFunction) => {

        grouping.columns[columnIdOrHeading] ??= {};
        grouping.columns[columnIdOrHeading].calcFunction = Ren.ArrayUtils.ensureArray(calcFunction);
    };

    const createGroupingIndexMap = () => {

        groupings._groupingIndexMap = new Map();

        for (let i = 0; i < groupings.entries.length; i++) {

            const key = Array.isArray(groupings.entries[i].groupByColumnIndexes)
                ? groupings.entries[i].groupByColumnIndexes.join(",")
                : String(groupings.entries[i].groupByColumnIndexes);

            groupings._groupingIndexMap.set(key, i);
        }
    };

    /**
     * Gets a copy of the settings whose groupings can be changed without touching the live ones.
     * Only the groupings are cloned: the rest is shared, as the services hanging off the settings
     * reach the tabular data, and cloning that froze the page on large reports.
     */
    const cloneWithDetachedGroupings = () => {

        const settings = Object.assign({}, _dataGroupingSettings);

        settings.groupings = {
            entries: Ren.ObjectUtils.clone(groupings.entries),
            disabledGroupings: Ren.ObjectUtils.clone(groupings.disabledGroupings)
        };

        return settings;
    };

    const setGroupingState = (grouping, updateFunction) => {

        const settings = cloneWithDetachedGroupings();

        createGroupingIndexMap();

        const lookupKey = grouping.groupByColumnIndexes.join(",");

        const groupingIndex = groupings._groupingIndexMap.get(lookupKey);

        if (groupingIndex === undefined) {

            Ren.GlobalErrorHandler.logError(
                "[DataGroupingSettings] Grouping not found in groupings.entries:",
                grouping.groupByColumnIndexes.join(",")
            );

            return;
        }

        const newGrouping = settings.groupings.entries[groupingIndex];

        updateFunction(newGrouping);

        settings.signifier = Ren.RandomUtils.generateRandomClassName();
        Ren.Messages.Events.dataGroupingSettingsChanged.notify(settings);

        Ren.Messages.Events.groupingsChanged.notify(
            tabularData.tabularDataGuid,
            _dataGroupingSettings.dataGroupingSettingsGroup,
            _dataGroupingSettings.containingReportGuid
        );
    };

    const setGroupingColumnProperty = (columnIndex, grouping, propertyName, value) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        setGroupingState(grouping, (newGrouping) => {

            newGrouping.columns ??= {};
            newGrouping.columns[columnIdOrHeading] ??= {};
            newGrouping.columns[columnIdOrHeading][propertyName] = value;
        });
    };

    /**
     * Sets a property on multiple columns of a grouping in one setGroupingState call, as message
     * deduplication would drop intermediate changes.
     */
    const setGroupingColumnPropertyBatch = (grouping, columnIndexes, propertyName, value) => {

        setGroupingState(grouping, (newGrouping) => {

            newGrouping.columns ??= {};

            for (let i = 0; i < columnIndexes.length; i++) {

                const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndexes[i]);
                newGrouping.columns[columnIdOrHeading] ??= {};
                newGrouping.columns[columnIdOrHeading][propertyName] = value;
            }
        });
    };

    const setAggregationType = (columnIndex, grouping, aggregationType) => {

        setGroupingColumnProperty(columnIndex, grouping, "aggregationType", aggregationType);
    };

    const setAggregateWithRespectToColumn = (columnIndex, grouping, aggregateWithRespectToColumn) => {

        setGroupingColumnProperty(columnIndex, grouping, "aggregateWithRespectToColumn", aggregateWithRespectToColumn);
    };

    const setAggregationIndicator = (columnIndex, grouping, aggregationIndicator) => {

        setGroupingColumnProperty(columnIndex, grouping, "aggregationIndicator", aggregationIndicator);
    };

    const repopulateGroupings = function () {

        // groupingsAdder is added by addDataGroupingSettingsServices.
        this.groupingsAdder.populateGroupings(
            this.groupings.entries.slice()
        );
    };

    const dataSourceUri = visualisation.dataSourceUri;
    const sqlFilename = visualisation.sqlFilename;
    const tabularDataGuid = tabularData.tabularDataGuid;

    // The visualisation shows every row whatever its group's filters say, which still apply to
    // everything else following the group (e.g. the date markers grid, which ticks rows instead).
    const ignoreRowFilters = !!visualisation.ignoreRowFilters;

    const _dataGroupingSettings = {
        dataRows,
        dataSourceUri,
        sqlFilename,
        ignoreRowFilters,
        visualisationGuid,
        tabularDataGuid,
        columnDefaults,
        columnMenus,
        getActiveRowCount,
        getActiveRowCountExcludingTotalsRowAndHeaderRows,
        getCalcFunction,
        getExposedRowCount,
        getFormatFunction,
        getRowIndex,
        getRowY,
        groupings,
        isGapRow,
        layout,
        paging,
        colXs,
        colXIndexes,
        getColIndex,
        getColX,
        rowYs,
        tracksRowDisplay,
        setActiveRowCount,
        setAggregateWithRespectToColumn,
        setAggregationIndicator,
        setAggregationType,
        setGroupingColumnPropertyBatch,
        setCalcFunction,
        setFormatFunction,
        getGroupCtrlsCountMode,
        setGroupCtrlsCountMode,
        setGroupingCalcFunction,
        setGroupingFormatFunction,
        dataGroupingSettingsGroup,
        filterGroup,
        setTotalsRowPosition,
        totalsRow,
        totalsRowY,
        updateColXIndexes,
        updateRowYIndexes,
        containingReportGuid,
        repopulateGroupings
    };

    _dataGroupingSettings.signifier = Ren.RandomUtils.generateRandomClassName();

    return _dataGroupingSettings;
};
