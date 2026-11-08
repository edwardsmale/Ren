/**
 * The columns a date/value chart reads from its data source, so its input rows can be built with
 * those alone rather than with every column of a wide data source.
 *
 * Anything handing a whole row to report-authored code - a calc function, a marker line, a series
 * colour function - could read any column, so a chart using one is given them all.
 */
Ren.DateValueChart_InputColumns = (() => {

    const hasOwnProperty = Object.prototype.hasOwnProperty;

    // The value columns found in each data source's rows, keyed weakly so they go with the rows.
    const valueColumnsByRowModels = new WeakMap();
    const dateColumnsByRowModels = new WeakMap();

    const hasCalcFunction = (columns) => {

        for (const key in columns) {

            if (columns[key]?.calcFunction) return true;
        }

        return false;
    };

    /**
     * Gets a value indicating whether the chart runs report-authored code over whole rows.
     */
    const readsWholeRows = (visualisation) => {

        const markerLines = visualisation.markerLines;

        if (markerLines && (!Array.isArray(markerLines) || markerLines.length > 0)) return true;

        const series = visualisation.series || [];

        for (let i = 0; i < series.length; i++) {

            if (series[i]?.colourFunction) return true;
        }

        const settings = visualisation.chartDataGroupingSettings;

        // Not set until first drawn, when detectColumns creates it from the initial settings.
        if (!settings) {

            return hasCalcFunction(visualisation.initialChartGroupColumnAggregations) ||
                hasCalcFunction(visualisation.initialChartDataRowColumnSettings);
        }

        if (hasCalcFunction(settings.dataRows?.columns)) return true;

        const entries = settings.groupings?.entries || [];

        for (let i = 0; i < entries.length; i++) {

            if (hasCalcFunction(entries[i].columns)) return true;
        }

        return false;
    };

    const addColumn = (columnIndexes, columnResolver, column) => {

        const columnIndex = columnResolver.getColumnIndex(column);

        if (columnIndex != null) columnIndexes.add(columnIndex);
    };

    const addColumns = (columnIndexes, columnResolver, columns) => {

        if (!columns) return;

        for (let i = 0; i < columns.length; i++) {

            addColumn(columnIndexes, columnResolver, columns[i]);
        }
    };

    // Adds the columns aggregated, and the columns they are aggregated with respect to.
    const addColumnSettings = (columnIndexes, columnResolver, columns) => {

        for (const key in columns) {

            addColumn(columnIndexes, columnResolver, key);

            const withRespectToColumn = columns[key]?.aggregateWithRespectToColumn;

            if (withRespectToColumn != null) {
                addColumn(columnIndexes, columnResolver, withRespectToColumn);
            }
        }
    };

    /**
     * Gets the indexes of the columns the chart reads, in column order, or null where it needs
     * them all.  They are its selected columns, its series' columns and every column its own
     * grouping groups by or aggregates.
     */
    const getRequiredColumnIndexes = (visualisation, tabularData) => {

        const selectedColumns = visualisation.selectedColumns;
        const columnResolver = tabularData?.columnResolver;

        // With nothing selected, the chart detects its columns from every column in the rows.
        if (visualisation.isAdHoc || !columnResolver) return null;
        if (!selectedColumns || selectedColumns.length === 0) return null;
        if (readsWholeRows(visualisation)) return null;

        const columnIndexes = new Set();

        addColumns(columnIndexes, columnResolver, selectedColumns);

        const series = visualisation.series || [];

        for (let i = 0; i < series.length; i++) {

            // A split series names a split value rather than a column, so resolves to none.
            if (series[i]?.column != null) addColumn(columnIndexes, columnResolver, series[i].column);
        }

        if (visualisation.subdivideColumn != null) {
            addColumn(columnIndexes, columnResolver, visualisation.subdivideColumn);
        }

        const settings = visualisation.chartDataGroupingSettings;

        if (settings) {

            const entries = settings.groupings?.entries || [];

            for (let i = 0; i < entries.length; i++) {

                addColumns(columnIndexes, columnResolver, entries[i].groupByColumnIndexes);
                addColumns(columnIndexes, columnResolver, entries[i].groupByColumns);
                addColumnSettings(columnIndexes, columnResolver, entries[i].columns);
            }

            addColumnSettings(columnIndexes, columnResolver, settings.dataRows?.columns);
        }
        else {

            addColumnSettings(
                columnIndexes,
                columnResolver,
                visualisation.initialChartGroupColumnAggregations
            );

            addColumnSettings(
                columnIndexes,
                columnResolver,
                visualisation.initialChartDataRowColumnSettings
            );
        }

        return Array.from(columnIndexes).sort((a, b) => a - b);
    };

    /**
     * Gets a value indicating whether rows hold each of the given columns, or every column where
     * columnIndexes is null.  Empty rows hold nothing to miss.
     */
    const rowsHoldColumns = (rows, tabularData, columnIndexes) => {

        if (!rows || rows.length === 0) return true;

        const firstRow = rows[0];
        const columnResolver = tabularData.columnResolver;
        const columnCount = columnIndexes ? columnIndexes.length : tabularData.ColumnCount;

        for (let i = 0; i < columnCount; i++) {

            const columnIndex = columnIndexes ? columnIndexes[i] : i;
            const key = columnResolver.getColumnIdOrHeading(columnIndex);

            if (!hasOwnProperty.call(firstRow, key)) return false;
        }

        return true;
    };

    /**
     * Gets the value columns across the data source's data rows, by the ad hoc column detector's
     * test, for a chart whose rows hold only the columns it reads.
     */
    const getValueColumns = (tabularData) => {

        const rowModels = tabularData.RowModels;
        let valueColumns = valueColumnsByRowModels.get(rowModels);

        if (valueColumns) return valueColumns;

        valueColumns = [];

        const isNumericValue = Ren.AdHocDataSource_ColumnDetector.isNumericValue;
        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const rowCount = Math.min(tabularData.DataRowCount, rowModels.length);

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const isCompressed = tabularData.IsColumnCompressed[columnIndex];
            let hasValue = false;
            let allNumeric = true;

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                const cv = rowModels[rowIndex].CV[columnIndex];
                const value = isCompressed ? decompressValue(cv, columnIndex) : cv;

                if (Ren.IsNullOrEmpty(value)) continue;

                if (!isNumericValue(value)) {

                    allNumeric = false;
                    break;
                }

                hasValue = true;
            }

            if (hasValue && allNumeric) {
                valueColumns.push(tabularData.columnResolver.getColumnIdOrHeading(columnIndex));
            }
        }

        valueColumnsByRowModels.set(rowModels, valueColumns);

        return valueColumns;
    };

    /**
     * Gets the data source's columns of dates, each judged by its first non-empty value, as the
     * chart judges its date column, and noting those holding quarters (e.g. "Q1 2024").
     */
    const getDateColumns = (tabularData) => {

        const rowModels = tabularData.RowModels;
        let dateColumns = dateColumnsByRowModels.get(rowModels);

        if (dateColumns) return dateColumns;

        dateColumns = [];

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const rowCount = Math.min(tabularData.DataRowCount, rowModels.length);

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const isCompressed = tabularData.IsColumnCompressed[columnIndex];

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                const cv = rowModels[rowIndex].CV[columnIndex];
                const value = isCompressed ? decompressValue(cv, columnIndex) : cv;

                if (Ren.IsNullOrEmpty(value)) continue;

                if (Ren.DateUtils.parseDateTimeUniversal(value)) {

                    dateColumns.push({
                        columnIndex,
                        isQuarter: typeof value === "string" && value.indexOf("Q") !== -1
                    });
                }

                break;
            }
        }

        dateColumnsByRowModels.set(rowModels, dateColumns);

        return dateColumns;
    };

    /**
     * Gets a value indicating whether a column is one of the data source's internal columns, such
     * as __Zero, which the chart's menus leave out. Takes a column model or a column ID or heading.
     */
    const isInternalColumn = (column) => {

        if (typeof column === "string") return column.startsWith("__");

        return !!column?.ColumnIdOrHeading?.startsWith("__")
            || !!column?.Heading?.includes("__");
    };

    return {
        isInternalColumn,
        getRequiredColumnIndexes,
        rowsHoldColumns,
        getValueColumns,
        getDateColumns
    };
})();
