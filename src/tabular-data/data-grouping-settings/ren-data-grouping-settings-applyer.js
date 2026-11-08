/**
 * Applies data grouping settings to a DataGroupingSettings instance.
 */
Ren.DataGroupingSettingsApplyer = (tabularData, dataGroupingSettings) => {

    /**
     * Apply any grouping specified by ---GroupBy directives in the SQL.  Ignores grouping if any
     * group-by column indexes do not exist, and skips the directives altogether for a visualisation
     * that has asked to ignore them (see ignoreSqlGroupByDirectives below).
     */
    const addAnyGroupingsSpecifiedByGroupByDirectives = (options) => {

        if (options?.ignoreSqlGroupByDirectives) return;

        const groupByIndexes = tabularData.GroupByColumnIndexes;

        // Check if all indexes exist (are not null/undefined/negative)
        const allIndexesExist = Array.isArray(groupByIndexes) &&
            groupByIndexes.length > 0 &&
            groupByIndexes.every(index => typeof index === "number" && index >= 0);

        if (allIndexesExist) { // Ignore any invalid group-by directives.

            // Left unsorted, unlike a grouping the user adds: the query has already put its rows in
            // the order it wants them shown in, and sorting by the group-by columns would override
            // it.
            dataGroupingSettings.sortFilterGroup.addGrouping(
                groupByIndexes,
                { sortByGroupByColumns: false }
            );
        }
    };

    /**
     * Adds an outermost grouping to the data model.  This groups everything into one final group,
     * and is used for the totals row and overall sorting/filtering etc.
     */
    const addOutermostGrouping = () => {

        dataGroupingSettings.sortFilterGroup.addGrouping([]);
    };

    /**
     * Sets the position of the totals row: top, bottom or none.
     */
    const setTotalsRowPosition = (settings) => {

        const totalsRowPosition = settings.totalsRow?.position;

        dataGroupingSettings.setTotalsRowPosition(
            Ren.ObjectUtils.getEnumValue(Ren.DataGridTotalsRowPositionEnum, totalsRowPosition)
        );
    };

    /**
     * Sets the group controls count mode: count immediate children, count all descendants, or none.
     */
    const setGroupCtrlsCountMode = (settings) => {

        const groupCtrlsCountMode = settings.layout?.groupCtrlsCountMode;

        dataGroupingSettings.setGroupCtrlsCountMode(
            Ren.ObjectUtils.getEnumValue(Ren.GroupCtrlsCountModeEnum, groupCtrlsCountMode)
        );
    };

    /**
     * Sets how the grid's group cells show their aggregation type, where their columns don't say.
     */
    const setAggregationIndicator = (settings) => {

        dataGroupingSettings.layout.aggregationIndicator =
            settings.layout?.aggregationIndicator ?? Ren.AggregationIndicator.DEFAULT_MODE;
    };

    /**
     * Sets each column's default filter type: the one in the settings, or else the one for its
     * column type.
     */
    const setColumnMenus = (settings) => {

        dataGroupingSettings.columnMenus = Ren.DataGroupingSettingsColumnMenus.createColumnMenus(
            tabularData,
            settings?.columnMenus
        );
    };

    /**
     * Sets the sort order for the data rows, including any additional "then by" sort levels.
     */
    const setDataRowsSortOrder = (dataRows) => {

        const sortOrder = dataRows.sortOrder;

        if (!sortOrder) return;

        const sortColumnIndex = sortOrder.columnIndex ??
            tabularData.columnResolver.getColumnIndex(sortOrder.column);

        if (sortColumnIndex === null) return;

        const target = dataGroupingSettings.dataRows.sortOrder;
        target.columnIndex = sortColumnIndex;
        target.isDescending = sortOrder.isDescending ?? false;
        target.sortCalcFunction = sortOrder.sortCalcFunction ?? null;
        target.thenBy = Ren.SortOrderResolver.resolveThenBySortLevels(
            tabularData.columnResolver,
            sortOrder.thenBy
        );

        delete target._compiledSortCalcFunctions;
    };

    /**
     * Sets the column format, calc and style functions at the data row level.
     */
    const setDataRowColumnFormats = (dataRows) => {

        const columns = dataRows.columns;

        if (!columns || typeof columns !== "object") return;

        for (const columnIdOrHeading in columns) {

            const settings = columns[columnIdOrHeading];

            if (!settings) continue;

            if (settings.valueFormatFunction) {

                dataGroupingSettings.setDataRowsFormatFunction(
                    columnIdOrHeading,
                    settings.valueFormatFunction
                );
            }

            if (settings.calcFunction) {

                dataGroupingSettings.setDataRowsCalcFunction(
                    columnIdOrHeading,
                    settings.calcFunction
                );
            }

            setDataRowStyleFunction(columnIdOrHeading, settings, "cellStyleFunction");
            setDataRowStyleFunction(columnIdOrHeading, settings, "rowStyleFunction");
            setDataRowStyleFunction(columnIdOrHeading, settings, "headingTooltipFunction");
            setDataRowStyleFunction(columnIdOrHeading, settings, "cellTooltipFunction");
            setDataRowTooltipText(columnIdOrHeading, settings, "headingTooltip");
            setDataRowTooltipText(columnIdOrHeading, settings, "cellTooltip");
        }
    };

    const setDataRowTooltipText = (columnIdOrHeading, settings, propertyName) => {

        if (!settings[propertyName]) return;

        const columns = dataGroupingSettings.dataRows.columns;

        columns[columnIdOrHeading] ??= {};
        columns[columnIdOrHeading][propertyName] = settings[propertyName];
    };

    const setDataRowStyleFunction = (columnIdOrHeading, settings, propertyName) => {

        if (!settings[propertyName]) return;

        const columns = dataGroupingSettings.dataRows.columns;

        columns[columnIdOrHeading] ??= {};
        columns[columnIdOrHeading][propertyName] = Ren.ArrayUtils.ensureArray(settings[propertyName]);
    };

    /**
     * Applies the passed data grouping settings.
     * Pass options.ignoreSqlGroupByDirectives for a visualisation that groups the data itself and
     * so wants the data rows rather than the group rows a ---GroupBy directive would leave it with
     * - see Ren.CreateDateValueChartCreator.
     */
    const applyDataGroupingSettings = (transformedDataGroupingSettings, options) => {

        if (!transformedDataGroupingSettings) {

            addOutermostGrouping();
            addAnyGroupingsSpecifiedByGroupByDirectives(options);
            setColumnMenus(null);
        }
        else {

            const isUpdateNeeded =
                !dataGroupingSettings.signifier ||
                dataGroupingSettings.signifier !== transformedDataGroupingSettings.signifier;

            if (!isUpdateNeeded) return;

            const validationErrors = Ren.DataGroupingSettingsValidator.validateDataGroupingSettings(
                transformedDataGroupingSettings,
                tabularData
            );

            if (validationErrors !== true) {

                throw new Error(
                    "Cannot apply data grouping settings: " + validationErrors.join(" ")
                );
            }

            setTotalsRowPosition(transformedDataGroupingSettings);
            setGroupCtrlsCountMode(transformedDataGroupingSettings);
            setAggregationIndicator(transformedDataGroupingSettings);
            setColumnMenus(transformedDataGroupingSettings);

            Ren.DataGroupingSettingsApplyer_Filter.applyFilter(
                transformedDataGroupingSettings.dataRows,
                dataGroupingSettings.dataRows
            );

            if (transformedDataGroupingSettings.outerFilterSet) {
                dataGroupingSettings.outerFilterSet = transformedDataGroupingSettings.outerFilterSet;
            }

            if (transformedDataGroupingSettings.dataRows) {

                setDataRowColumnFormats(transformedDataGroupingSettings.dataRows);
                setDataRowsSortOrder(transformedDataGroupingSettings.dataRows);
            }
            else {

                dataGroupingSettings.dataRows = {
                    columns: {},
                    sortOrder: { columnIndex: -1, isDescending: false, thenBy: null }
                };
            }

            if (transformedDataGroupingSettings.groupings?.entries?.length) {

                dataGroupingSettings.sortFilterGroup.applyGroupings(transformedDataGroupingSettings.groupings);
            }
            else if (!dataGroupingSettings.groupings.entries.length) {

                addOutermostGrouping();
                addAnyGroupingsSpecifiedByGroupByDirectives(options);
            }

            // Carry disabled groupings across untouched.  They aren't applied to the group model
            // (so they don't participate in grouping), but are retained on the runtime settings so
            // the editor can list and re-enable them, and so they survive a save/reload round trip.
            dataGroupingSettings.groupings.disabledGroupings =
                transformedDataGroupingSettings.groupings?.disabledGroupings ?? [];

            if (transformedDataGroupingSettings.variationLabel) {
                dataGroupingSettings.variationLabel = transformedDataGroupingSettings.variationLabel;
            }

            if (transformedDataGroupingSettings.variationTooltip) {
                dataGroupingSettings.variationTooltip = transformedDataGroupingSettings.variationTooltip;
            }

            if (transformedDataGroupingSettings.doubleClick) {
                dataGroupingSettings.doubleClick = transformedDataGroupingSettings.doubleClick;
            }

            // The user's choice of row visualiser, which falls back to the report's own where the
            // settings applied don't make one.
            dataGroupingSettings.defaultRowVisualiser =
                transformedDataGroupingSettings.defaultRowVisualiser ?? null;
        }
    };

    return {
        applyDataGroupingSettings,
        tabularData
    };
};
