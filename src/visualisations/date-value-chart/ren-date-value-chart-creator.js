Ren.CreateDateValueChartCreator = (() => {

    /**
     * Normalises a function setting to an array of specs, or null where it holds none.
     */
    const toSpecsOrNull = (functionSetting) => {

        if (functionSetting == null) return null;

        const specs = Ren.ArrayUtils.ensureArray(functionSetting);

        return specs.length > 0 ? specs : null;
    };

    /**
     * Extracts the per-column aggregation settings of the source grid's second-last grouping, the
     * innermost actual grouping, so the begotten chart aggregates its value columns as the grid
     * does.  Returns a map keyed by column ID or heading, or null where there are none.
     */
    const extractSecondLastGroupingAggregations = (dataGroupingSettings) => {

        const entries = dataGroupingSettings?.groupings?.entries;

        if (!entries || entries.length < 2) return null;

        const secondLastGrouping = entries[entries.length - 2];
        const columns = secondLastGrouping?.columns;

        if (columns) {

            for (const k in columns) {

                if (!Object.prototype.hasOwnProperty.call(columns, k)) continue;
            }
        }

        if (!columns) return null;

        const aggregations = {};
        let hasAny = false;

        for (const columnIdOrHeading in columns) {

            if (!Object.prototype.hasOwnProperty.call(columns, columnIdOrHeading)) continue;

            const columnSettings = columns[columnIdOrHeading];

            if (columnSettings == null) continue;

            if (columnSettings.aggregationType == null
                && columnSettings.aggregateWithRespectToColumn == null
                && columnSettings.calcFunction == null
                && columnSettings.valueFormatFunction == null) continue;

            aggregations[columnIdOrHeading] = {
                aggregationType: columnSettings.aggregationType ?? null,
                aggregateWithRespectToColumn: columnSettings.aggregateWithRespectToColumn ?? null,
                calcFunction: columnSettings.calcFunction ?? null,
                valueFormatFunction: columnSettings.valueFormatFunction ?? null
            };
            hasAny = true;
        }

        return hasAny ? aggregations : null;
    };

    /**
     * Extracts the calculation and format functions the source grid applies to its data rows, so
     * the chart plots and labels the calculated values the grid shows rather than raw ones.
     * Returns a map of column ID or heading to { calcFunction, valueFormatFunction }, or null.
     */
    const extractDataRowColumnSettings = (dataGroupingSettings) => {

        const columns = dataGroupingSettings?.dataRows?.columns;

        if (!columns) return null;

        const dataRowColumns = {};
        let hasAny = false;

        for (const columnIdOrHeading in columns) {

            if (!Object.prototype.hasOwnProperty.call(columns, columnIdOrHeading)) continue;

            const calcFunction = toSpecsOrNull(columns[columnIdOrHeading]?.calcFunction);
            const valueFormatFunction =
                toSpecsOrNull(columns[columnIdOrHeading]?.valueFormatFunction);

            if (calcFunction == null && valueFormatFunction == null) continue;

            dataRowColumns[columnIdOrHeading] = { calcFunction, valueFormatFunction };
            hasAny = true;
        }

        return hasAny ? dataRowColumns : null;
    };

    /**
     * Creates a date value chart from a data grid's selected columns: one date column and one or
     * more value columns.  Unlike an ad hoc date value chart, it updates as the grid is filtered.
     * Where no value column is selected, only string, enum or ID columns and perhaps a date, it
     * charts how many rows hold each value.
     */
    const createColumnBasedDateValueChart = (
        sourceDataGridVisualisation,
        sourceTabularData,
        dataGridCellSelection,
        options
    ) => {

        let columns = dataGridCellSelection.getSelectedColumnIdsOrHeadings();

        const RowCount = Ren.DateValueChart_RowCount;
        const countedColumn = RowCount.getCountedColumn(sourceTabularData, columns);

        if (countedColumn !== null) columns = columns.concat(RowCount.COUNT_COLUMN);

        const source = Ren.DataGroupingSettingsSource.fromVisualisation(sourceDataGridVisualisation);

        const dataTabIndex = source.dataTabIndex;
        const dataTabGroup = source.dataTabGroup;

        // The chart's own group, so it keeps its own groupings. It must differ from filterGroup, as
        // the filterGroupChanged redraw path and getInputData filter overlay engage only then.
        const dataGroupingSettingsGroup =
            Ren.BegottenVisualisationSettingsGroupProvider.getSettingsGroup(
                sourceDataGridVisualisation,
                "DateValueChart"
            );

        // The source grid's filterGroup, so filters applied to the grid propagate to the chart.
        const filterGroup = source.filterGroup;

        const initialChartGroupColumnAggregations =
            extractSecondLastGroupingAggregations(source.dataGroupingSettings);

        const initialChartDataRowColumnSettings =
            extractDataRowColumnSettings(source.dataGroupingSettings);

        Ren.VisualisationCreator.createVisualisation({
            dataSourceUri: sourceDataGridVisualisation.dataSourceUri,
            sqlFilename: sourceDataGridVisualisation.sqlFilename,
            dataGroupingSettingsGroup,
            filterGroup,
            visualisationTypeName: "DateValueChart",
            isPopup: true,
            selectedColumns: columns,
            sourceVisualisation: sourceDataGridVisualisation,
            dataTabIndex,
            dataTabGroup,
            initialChartGroupCalcFunction: options?.dateGroupCalcFunction ?? null,
            initialChartSplitColumn: countedColumn,
            initialChartGroupColumnAggregations,
            initialChartDataRowColumnSettings,

            // The chart's own group starts with no settings, so the SQL's ---GroupBy directives
            // would give it group rows whose Date column aggregates to empty, leaving no date
            // column to detect.  The chart bins the rows by date itself.
            ignoreSqlGroupByDirectives: true
        });
    };

    return {
        createColumnBasedDateValueChart
    };
})();
