Ren.DataGroupingSettings_Services = (() => {

    const fireChangedEvent = function() {

        this.signifier = Ren.RandomUtils.generateRandomClassName();
        Ren.Messages.Events.dataGroupingSettingsChanged.notify(this);
    };

    /**
     * Announces a change to nothing but tooltips, so that other grids take it up as they would any
     * change, but the data grid does not render its cells again: tooltips are shown from its
     * tooltip stylesheets (see Ren.DataGridTooltips).
     */
    const fireTooltipsChangedEvent = function() {

        this.signifier = Ren.RandomUtils.generateRandomClassName();
        this.tooltipsOnlySignifier = this.signifier;
        Ren.Messages.Events.dataGroupingSettingsChanged.notify(this);
    };

    /**
     * Announces a filter change to visualisations sharing only the filterGroup, to sync just their
     * filters.  Scoped to the report context, as another instance of the same report is filtered
     * independently.
     */
    const notifyFilterGroupChanged = (tabularData, dataGroupingSettings) => {

        Ren.Messages.Events.filterGroupChanged.notify(
            tabularData.tabularDataGuid,
            dataGroupingSettings.filterGroup ?? dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.dataRows?.filterSet,
            dataGroupingSettings.containingReportGuid
        );
    };

    /**
     * Announces a filter change without firing the settings-changed event, for a caller that has
     * already announced the settings itself and would otherwise make every listener work twice.
     */
    const notifyFilterChanged = (tabularData, dataGroupingSettings) => {

        // Immediate, so that a listener is heard before the queued messages below start redrawing.
        Ren.Messages.Events.filterChanging.notifyImmediately(
            dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.filterGroup ?? dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.containingReportGuid
        );

        Ren.Messages.Events.filterChanged.notify(
            tabularData.tabularDataGuid,
            dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.containingReportGuid
        );

        notifyFilterGroupChanged(tabularData, dataGroupingSettings);
    };

    const fireFilterChangedEvent = (tabularData, dataGroupingSettings) => {

        notifyFilterChanged(tabularData, dataGroupingSettings);

        fireChangedEvent.call(dataGroupingSettings);
    };

    /**
     * Returns a value indicating whether any column value filters are applied.
     */
    const hasFilter = (tabularData, dataGroupingSettings) => {

        return Ren.DataGroupingSettings_Services_HasFilter.hasFilter(
            tabularData,
            dataGroupingSettings
        );
    };

    /**
     * Returns a value indicating whether multiple columns have column value filters.
     */
    const hasMultipleColumnFilters = (tabularData, dataGroupingSettings) => {

        return Ren.DataGroupingSettings_Services_HasFilter.hasMultipleColumnFilters(
            tabularData,
            dataGroupingSettings
        );
    };

    /**
     * Returns a value indicating whether the specified column has a column value filter applied.
     */
    const hasColumnFilter = (tabularData, dataGroupingSettings, columnIdOrHeading) => {

        return Ren.DataGroupingSettings_Services_HasFilter.hasColumnFilter(
            tabularData,
            dataGroupingSettings,
            columnIdOrHeading
        );
    };

    const clearFilterSetParentFilters = (filterSetParent, tabularData) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.clearColumnValueFilters(
            filterSetParent,
            tabularData
        );

        Ren.DataGroupingSettings_Services_FilterAccessors.clearRowFilterPredicates(
            filterSetParent,
            tabularData
        );
    };

    /**
     * Removes every filter, both the data rows' own and those the grouping levels apply to their
     * group rows.
     */
    const removeFilter = (tabularData, dataGroupingSettings) => {

        clearFilterSetParentFilters(dataGroupingSettings.dataRows, tabularData);

        const entries = dataGroupingSettings.groupings.entries;

        for (let i = 0; i < entries.length; i++) {
            clearFilterSetParentFilters(entries[i], tabularData);
        }

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    const clearFilterSetParentColumnFilters = (filterSetParent, tabularData) => {

        const filterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;

        if (!filterAccessors.tabFiltersExist(filterSetParent, tabularData)) return;

        filterAccessors.clearColumnValueFilters(filterSetParent, tabularData);

        const predicates = filterAccessors.getRowFilterPredicates(filterSetParent, tabularData);
        const remainingPredicates = [];

        for (let i = 0; i < predicates.length; i++) {
            if (predicates[i]?.type !== "compare") remainingPredicates.push(predicates[i]);
        }

        if (remainingPredicates.length === predicates.length) return;

        filterAccessors.setRowFilterPredicates(filterSetParent, tabularData, remainingPredicates);
    };

    /**
     * Removes every column's value and compare filters, at the data rows and every grouping level,
     * leaving any other row-filter predicates in place.
     */
    const removeAllColumnFilters = (tabularData, dataGroupingSettings) => {

        clearFilterSetParentColumnFilters(dataGroupingSettings.dataRows, tabularData);

        const entries = dataGroupingSettings.groupings?.entries ?? [];

        for (let i = 0; i < entries.length; i++) {
            clearFilterSetParentColumnFilters(entries[i], tabularData);
        }

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    /**
     * Gets the row-filter predicate list applied at the data row level, or an empty array.
     */
    const getRowFilterPredicates = (tabularData, dataGroupingSettings) =>
        Ren.DataGroupingSettings_Services_FilterAccessors.getRowFilterPredicates(
            dataGroupingSettings.dataRows,
            tabularData
        );

    /**
     * Replaces the row-filter predicate list applied at the data row level.
     */
    const setRowFilterPredicates = (tabularData, dataGroupingSettings, predicates) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.setRowFilterPredicates(
            dataGroupingSettings.dataRows,
            tabularData,
            predicates
        );

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    /**
     * Takes the column's compare filters off the data rows.  Written through the accessors rather
     * than setRowFilterPredicates so the caller announces the filter change only once.
     */
    const removeCompareFiltersForColumn = (tabularData, dataGroupingSettings, columnIdOrHeading) => {

        const filterAccessors = Ren.DataGroupingSettings_Services_FilterAccessors;

        if (!filterAccessors.tabFiltersExist(dataGroupingSettings.dataRows, tabularData)) return;

        const predicates = filterAccessors.getRowFilterPredicates(
            dataGroupingSettings.dataRows,
            tabularData
        );

        const remainingPredicates = Ren.FilterCompareOperators.removeComparePredicatesForColumn(
            predicates,
            columnIdOrHeading
        );

        if (remainingPredicates.length === predicates.length) return;

        filterAccessors.setRowFilterPredicates(
            dataGroupingSettings.dataRows,
            tabularData,
            remainingPredicates
        );
    };

    const removeColumnFilter = (tabularData, dataGroupingSettings, columnIdOrHeading) => {

        removeCompareFiltersForColumn(tabularData, dataGroupingSettings, columnIdOrHeading);

        Ren.DataGroupingSettings_Services_FilterAccessors.clearColumnFilterForColumn(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading
        );

        // Only groupings that have filter sets, to avoid creating empty filterSet structures.
        const groupingsEntries = dataGroupingSettings.groupings?.entries ?? [];

        for (let i = 0; i < groupingsEntries.length; i++) {

            const grouping = groupingsEntries[i];

            if (Ren.DataGroupingSettings_Services_FilterAccessors.tabFiltersExist(grouping, tabularData)) {

                Ren.DataGroupingSettings_Services_FilterAccessors.clearColumnFilterForColumn(
                    grouping,
                    tabularData,
                    columnIdOrHeading
                );
            }
        }

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    /**
     * Ensures dataGroupingSettings.dataRows has a filterSet with columnValueFilters and rowFilter.
     */
    const ensureTabFilterExists = (tabularData, dataGroupingSettings) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.ensureTabFiltersExist(
            dataGroupingSettings.dataRows,
            tabularData
        );
    };

    /**
     * Creates a column value filter including every distinct value in the column, if it has none.
     * A column with a data-row calcFunction uses its transformed values.
     */
    const populateColumnFilterIfNeeded = (tabularData, dataGroupingSettings, columnIdOrHeading) => {

        ensureTabFilterExists(tabularData, dataGroupingSettings);

        const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

        if (columnIndex === null) return;

        let existingColumnFilter;

        if (Ren.DataGroupingSettings_Services_FilterAccessors.tabFiltersExist(dataGroupingSettings.dataRows, tabularData)) {

            existingColumnFilter = Ren.DataGroupingSettings_Services_FilterAccessors.getColumnFilterForColumn(
                dataGroupingSettings.dataRows,
                tabularData,
                columnIdOrHeading
            );
        }

        if (existingColumnFilter) return;

        const columnSettings = dataGroupingSettings.dataRows?.columns?.[columnIdOrHeading];
        const hasCalcFunction = !!(columnSettings?.calcFunction);

        let filterValues;

        if (hasCalcFunction) {

            const transformedDataColumns = dataGroupingSettings.transformedDataColumns
                ?? Ren.CalcFunctionsApplyer.applyCalcFunctionsToDataRows(
                    tabularData,
                    dataGroupingSettings.dataRows.columns,
                    Ren.ReportInputParameters.getInputParametersForGuid(
                        dataGroupingSettings.containingReportGuid
                    )
                );

            const transformedColumn = transformedDataColumns?.[columnIndex];

            if (transformedColumn) {

                const seen = new Set();

                const decompressValue = tabularData.CompressionDictionary.decompressValue;

                for (let i = 0; i < transformedColumn.length; i++) {

                    const v = decompressValue(transformedColumn[i], columnIndex);

                    // So the initial "all values" filter matches NULL rows, which ren-filter.js
                    // also normalises to the sentinel.
                    seen.add(v == null ? Ren.NullSentinel : v.toString());
                }

                filterValues = Array.from(seen);
            }
        }

        if (!filterValues) {

            filterValues = Array.from(tabularData.getDistinctColumnCV(columnIndex))
                .map(cv => {

                    const v = tabularData.CompressionDictionary.decompressValue(cv, columnIndex);
                    return v == null ? Ren.NullSentinel : v;
                });
        }

        Ren.DataGroupingSettings_Services_FilterAccessors.setColumnFilterForColumn(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading,
            filterValues
        );
    };

    /**
     * Sets the data row level filter on a column to the given values.
     */
    const setColumnFilter = (tabularData, dataGroupingSettings, columnIdOrHeading, filterValues) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.setColumnFilterForColumn(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading,
            filterValues
        );

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    const setAllFilter = setColumnFilter;

    /**
     * Toggles whether the value is included in the column's filter.
     */
    const toggleColumnFilter = (tabularData, dataGroupingSettings, columnIdOrHeading, filterValue) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.toggleColumnFilterValue(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading,
            filterValue
        );

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    /**
     * Marks (or unmarks) a data-row column filter as naming the values to leave out rather than the
     * values to keep.  The values are left as they are, so the same list means the opposite filter.
     */
    const setColumnFilterNegated = (
        tabularData, dataGroupingSettings, columnIdOrHeading, isNegated
    ) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.setNegatedFilterColumn(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading,
            isNegated
        );

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    /**
     * Leaves values out of a data-row column's filter (see
     * FilterAccessors.excludeColumnFilterValues).
     */
    const excludeColumnFilterValues = (
        tabularData, dataGroupingSettings, columnIdOrHeading, excludedValues
    ) => {

        Ren.DataGroupingSettings_Services_FilterAccessors.excludeColumnFilterValues(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading,
            excludedValues
        );

        fireFilterChangedEvent(tabularData, dataGroupingSettings);
    };

    /**
     * Gets a value indicating whether a data-row column filter names the values to leave out.
     */
    const isColumnFilterNegated = (tabularData, dataGroupingSettings, columnIdOrHeading) =>
        Ren.FilterNegation.isNegatedColumn(
            dataGroupingSettings.dataRows,
            tabularData,
            columnIdOrHeading
        );

    const getDataRowsColumnFormats = (dataGroupingSettings) =>
        dataGroupingSettings.getColumnValueFormats(
            dataGroupingSettings.dataRows.columns
        );

    const getOverallSummaryStats = (dataGroupingSettings) =>
        dataGroupingSettings.groupings.firstGroupOfOutermostGrouping()?.summaryStats;

    const setDataRowsFormatFunction = function(columnIdOrHeading, formatFunction) {

        this.dataRows.columns[columnIdOrHeading] ??= {};
        this.dataRows.columns[columnIdOrHeading].valueFormatFunction = Ren.ArrayUtils.ensureArray(formatFunction);
    };

    const getDataRowsCalcFunction = function(columnIdOrHeading) {

        return this.dataRows.columns[columnIdOrHeading]?.calcFunction ?? "";
    };

    const setDataRowsCalcFunction = function(columnIdOrHeading, calcFunction) {

        this.dataRows.columns[columnIdOrHeading] ??= {};
        this.dataRows.columns[columnIdOrHeading].calcFunction = Ren.ArrayUtils.ensureArray(calcFunction);
    };

    /**
     * Gets the columns settings that a row's style functions are set in: the data rows' for a data
     * row (or a null row index), else those of the row's grouping.
     */
    const getStyleFunctionColumns = (tabularData, dataGroupingSettings, rowIndex) => {

        if (rowIndex === null || tabularData.isDataRow(rowIndex)) {
            return dataGroupingSettings.dataRows.columns;
        }

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

        grouping.columns ??= {};

        return grouping.columns;
    };

    /**
     * Gets the code of a column's style function for a row, or "" if none is set.
     *
     * @param {string} propertyName "cellStyleFunction" or "rowStyleFunction".
     */
    const getStyleFunction = (
        tabularData, dataGroupingSettings, propertyName, columnIndex, rowIndex
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        return getColumnsStyleFunction(columns, columnIdOrHeading, propertyName);
    };

    const getColumnsStyleFunction = (columns, columnIdOrHeading, propertyName) =>
        Ren.ArrayUtils.ensureArray(columns[columnIdOrHeading]?.[propertyName] ?? [])[0] ?? "";

    /**
     * Sets the code of a column's style function for a row, removing it if the code is blank.
     *
     * @param {string} propertyName "cellStyleFunction" or "rowStyleFunction".
     */
    const setStyleFunction = (
        tabularData, dataGroupingSettings, propertyName, columnIndex, rowIndex, code
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        setColumnsStyleFunction(columns, columnIdOrHeading, propertyName, code);

        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Gets a value indicating whether any column has a style function for a row, which is how a
     * row style can be found without knowing which column carries it.
     *
     * @param {string} propertyName "cellStyleFunction" or "rowStyleFunction".
     */
    const hasStyleFunctionInAnyColumn = (
        tabularData, dataGroupingSettings, propertyName, rowIndex
    ) => {

        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);
        const columnIdOrHeadings = Object.keys(columns);

        for (let i = 0; i < columnIdOrHeadings.length; i++) {

            if (getColumnsStyleFunction(columns, columnIdOrHeadings[i], propertyName)) return true;
        }

        return false;
    };

    /**
     * Removes a style function for a row from every column that has one.
     *
     * @param {string} propertyName "cellStyleFunction" or "rowStyleFunction".
     */
    const removeStyleFunctionFromAllColumns = (
        tabularData, dataGroupingSettings, propertyName, rowIndex
    ) => {

        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);
        const columnIdOrHeadings = Object.keys(columns);

        for (let i = 0; i < columnIdOrHeadings.length; i++) {
            removeColumnsProperty(columns, columnIdOrHeadings[i], propertyName);
        }

        dataGroupingSettings.fireChangedEvent();
    };

    /**
     * Gets the columns settings of the data rows followed by those of every grouping.
     */
    const getAllLevelsStyleFunctionColumns = (dataGroupingSettings) => {

        const entries = dataGroupingSettings.groupings.entries;
        const allColumns = [dataGroupingSettings.dataRows.columns];

        for (let i = 0; i < entries.length; i++) {

            entries[i].columns ??= {};
            allColumns.push(entries[i].columns);
        }

        return allColumns;
    };

    /**
     * Gets the code of a column's style function at each level, the data rows' first then each
     * grouping's, with "" where none is set.
     *
     * @param {string} propertyName "cellStyleFunction" or "rowStyleFunction".
     */
    const getColumnStyleFunctions = (
        tabularData, dataGroupingSettings, propertyName, columnIndex
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const allColumns = getAllLevelsStyleFunctionColumns(dataGroupingSettings);
        const styleFunctions = new Array(allColumns.length);

        for (let i = 0; i < allColumns.length; i++) {

            styleFunctions[i] =
                getColumnsStyleFunction(allColumns[i], columnIdOrHeading, propertyName);
        }

        return styleFunctions;
    };

    /**
     * Sets the code of a column's style function at every level, removing it where the code is
     * blank.  An array of codes (as got by getColumnStyleFunctions) sets each level its own.
     *
     * @param {string} propertyName "cellStyleFunction" or "rowStyleFunction".
     */
    const setColumnStyleFunctions = (
        tabularData, dataGroupingSettings, propertyName, columnIndex, codes
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const allColumns = getAllLevelsStyleFunctionColumns(dataGroupingSettings);

        for (let i = 0; i < allColumns.length; i++) {

            setColumnsStyleFunction(
                allColumns[i],
                columnIdOrHeading,
                propertyName,
                Array.isArray(codes) ? codes[i] : codes
            );
        }

        dataGroupingSettings.fireChangedEvent();
    };

    const removeColumnsProperty = (columns, columnIdOrHeading, propertyName) => {

        if (!columns[columnIdOrHeading]) return;

        delete columns[columnIdOrHeading][propertyName];

        if (Ren.ObjectUtils.isEmptyObject(columns[columnIdOrHeading])) {
            delete columns[columnIdOrHeading];
        }
    };

    const setColumnsStyleFunction = (columns, columnIdOrHeading, propertyName, code) => {

        // A { name, parameters } spec is kept as it is.
        if (code && (typeof code !== "string" || code.trim())) {

            columns[columnIdOrHeading] ??= {};
            columns[columnIdOrHeading][propertyName] = [code];
        }
        else {

            removeColumnsProperty(columns, columnIdOrHeading, propertyName);
        }
    };

    /**
     * Gets the text of a column's tooltip for a row, or "" if none is set.  A null row index is a
     * data row's, and where the tooltip is the column's heading's.
     *
     * @param {string} propertyName "headingTooltip" or "cellTooltip".
     */
    const getTooltipText = (
        tabularData, dataGroupingSettings, propertyName, columnIndex, rowIndex
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        return columns[columnIdOrHeading]?.[propertyName] ?? "";
    };

    /**
     * Sets the text of a column's tooltip for a row, removing it if the text is blank.
     *
     * @param {string} propertyName "headingTooltip" or "cellTooltip".
     */
    const setTooltipText = (
        tabularData, dataGroupingSettings, propertyName, columnIndex, rowIndex, text
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        if (text && text.trim()) {

            columns[columnIdOrHeading] ??= {};
            columns[columnIdOrHeading][propertyName] = text;
        }
        else {

            removeColumnsProperty(columns, columnIdOrHeading, propertyName);
        }

        fireTooltipsChangedEvent.call(dataGroupingSettings);
    };

    /**
     * Sets the code of a column's tooltip function for a row, removing it if the code is blank.
     * Its code is got with getStyleFunction.
     *
     * @param {string} propertyName "headingTooltipFunction" or "cellTooltipFunction".
     */
    const setTooltipFunction = (
        tabularData, dataGroupingSettings, propertyName, columnIndex, rowIndex, code
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        setColumnsStyleFunction(columns, columnIdOrHeading, propertyName, code);

        fireTooltipsChangedEvent.call(dataGroupingSettings);
    };

    /**
     * Gets a value indicating whether a group row's cells in a column are given the mixed
     * backgrounds of the group's data rows, or null for a data row, which has none to mix.
     */
    const getMergesDataRowBackgrounds = (
        tabularData, dataGroupingSettings, columnIndex, rowIndex
    ) => {

        if (rowIndex === null || tabularData.isDataRow(rowIndex)) return null;

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        return !!columns[columnIdOrHeading]?.mergeDataRowBackgrounds;
    };

    /**
     * Sets whether a group row's cells in a column are given the mixed backgrounds of the group's
     * data rows.
     */
    const setMergesDataRowBackgrounds = (
        tabularData, dataGroupingSettings, columnIndex, rowIndex, mergesBackgrounds
    ) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);
        const columns = getStyleFunctionColumns(tabularData, dataGroupingSettings, rowIndex);

        if (mergesBackgrounds) {

            columns[columnIdOrHeading] ??= {};
            columns[columnIdOrHeading].mergeDataRowBackgrounds = true;
        }
        else if (columns[columnIdOrHeading]) {

            delete columns[columnIdOrHeading].mergeDataRowBackgrounds;

            if (Ren.ObjectUtils.isEmptyObject(columns[columnIdOrHeading])) {
                delete columns[columnIdOrHeading];
            }
        }

        dataGroupingSettings.fireChangedEvent();
    };

    const revertDataRowsBlankFormatFunctions = function() {

        for (const columnIdOrHeading in this.dataRows.columns) {

            const value = this.dataRows.columns[columnIdOrHeading];

            if (value.valueFormatFunction === undefined) continue;

            for (let i = 0; i < value.valueFormatFunction.length; i++) {

                if (value.valueFormatFunction[i].name === "blank") {

                    value.valueFormatFunction.splice(i, 1);

                    i--;
                }
            }

            if (value.valueFormatFunction.length > 0) continue;

            // The column's other settings, such as its style functions, are kept.
            delete value.valueFormatFunction;

            if (Ren.ObjectUtils.isEmptyObject(value)) {
                delete this.dataRows.columns[columnIdOrHeading];
            }
        }
    };

    /**
     * Adds service functions to the dataGroupingSettings object.
     */
    const addDataGroupingSettingsServices = (tabularData, dataGroupingSettings, expandedGroups) => {

        const aggregation = Ren.Aggregation(tabularData, dataGroupingSettings);
        const groupingFactory = Ren.GroupingFactory(tabularData, dataGroupingSettings, aggregation);
        const groupingsAdder = Ren.GroupingsAdder(tabularData, dataGroupingSettings, groupingFactory);
        const sortFilterGroup = Ren.SortFilterGroup(tabularData, dataGroupingSettings, expandedGroups, groupingsAdder);
        const summaryStats = Ren.SummaryStats(tabularData, dataGroupingSettings);
        const dataGroupingSettingsMerger = Ren.DataGroupingSettingsMerger(
            tabularData,
            dataGroupingSettings
        );

        dataGroupingSettings.aggregation = aggregation;
        dataGroupingSettings.groupingsAdder = groupingsAdder;
        dataGroupingSettings.sortFilterGroup = sortFilterGroup;
        dataGroupingSettings.summaryStats = summaryStats;

        dataGroupingSettings.getColumnValueFormats = dataGroupingSettingsMerger.getColumnValueFormats.bind(null, tabularData);
        dataGroupingSettings.mergeColumnAggTypes = dataGroupingSettingsMerger.mergeColumnAggTypes.bind(null, tabularData);

        dataGroupingSettings.hasFilter = hasFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.hasColumnFilter = hasColumnFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.hasMultipleColumnFilters = hasMultipleColumnFilters.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.ensureTabFilterExists = ensureTabFilterExists.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.populateColumnFilterIfNeeded = populateColumnFilterIfNeeded.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.removeFilter = removeFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.removeColumnFilter = removeColumnFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.removeAllColumnFilters = removeAllColumnFilters.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setColumnFilter = setColumnFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setAllFilter = setAllFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.toggleColumnFilter = toggleColumnFilter.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setColumnFilterNegated = setColumnFilterNegated.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.excludeColumnFilterValues = excludeColumnFilterValues.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.isColumnFilterNegated = isColumnFilterNegated.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.getRowFilterPredicates = getRowFilterPredicates.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setRowFilterPredicates = setRowFilterPredicates.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.getDataRowsColumnFormats = getDataRowsColumnFormats.bind(null, dataGroupingSettings);
        dataGroupingSettings.getOverallSummaryStats = getOverallSummaryStats.bind(null, dataGroupingSettings);
        dataGroupingSettings.setDataRowsFormatFunction = setDataRowsFormatFunction.bind(dataGroupingSettings);
        dataGroupingSettings.getDataRowsCalcFunction = getDataRowsCalcFunction.bind(dataGroupingSettings);
        dataGroupingSettings.setDataRowsCalcFunction = setDataRowsCalcFunction.bind(dataGroupingSettings);
        dataGroupingSettings.revertDataRowsBlankFormatFunctions = revertDataRowsBlankFormatFunctions.bind(dataGroupingSettings);
        dataGroupingSettings.getStyleFunction = getStyleFunction.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setStyleFunction = setStyleFunction.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.hasStyleFunctionInAnyColumn = hasStyleFunctionInAnyColumn.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.removeStyleFunctionFromAllColumns = removeStyleFunctionFromAllColumns.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.getColumnStyleFunctions = getColumnStyleFunctions.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setColumnStyleFunctions = setColumnStyleFunctions.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.getTooltipText = getTooltipText.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setTooltipText = setTooltipText.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setTooltipFunction = setTooltipFunction.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.getMergesDataRowBackgrounds =getMergesDataRowBackgrounds.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.setMergesDataRowBackgrounds = setMergesDataRowBackgrounds.bind(null, tabularData, dataGroupingSettings);

        dataGroupingSettings.fireChangedEvent = fireChangedEvent.bind(dataGroupingSettings);
        dataGroupingSettings.notifyFilterChanged = notifyFilterChanged.bind(null, tabularData, dataGroupingSettings);
        dataGroupingSettings.notifyFilterGroupChanged = notifyFilterGroupChanged.bind(null, tabularData, dataGroupingSettings);
    };

    return {
        addDataGroupingSettingsServices
    };
})();
