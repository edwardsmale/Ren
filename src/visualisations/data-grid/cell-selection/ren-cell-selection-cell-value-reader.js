Ren.DataGridCellSelection_CellValueReader = (tabularData, dataGroupingSettings) => {

    const valueToString = (value) => {

        if (value == null || value === Ren.NullSentinel) return "";
        const str = value.toString();
        return str.includes(Ren.NullSentinel)
            ? str.replaceAll(Ren.NullSentinel, Ren.NullSentinelDisplayLabel)
            : str;
    };

    const getHeadingCellValue = (x, y) => {

        let heading;

        if (tabularData.HasSubheadings) {

            if (y === 0) heading = tabularData.ColumnModels[x].Heading;
            if (y === 1) heading = tabularData.ColumnModels[x].Subheading;
        }
        else {

            heading = tabularData.ColumnModels[x].Heading;
        }

        return heading || "";
    };

    const getDataRowCellValue = (x, rowIndex, formatValues, overallSummaryStats, dataRowsColumnFormats) => {

        const cv = tabularData.RowModels[rowIndex].CV[x];

        let cellValue = tabularData.CompressionDictionary.decompressValue(cv, x);

        if (!formatValues) return valueToString(cellValue);

        const calcFunctions = dataRowsColumnFormats.columnCalcFunctions?.[x];
        const formatFunction = dataRowsColumnFormats.columnFormatFunctions[x];

        // Only functions read the row's values, and a selection is read column by column, so
        // building them for each cell of a plain column would be wasted on every row.
        if (!calcFunctions?.length && !formatFunction?.length) {

            return Ren.ValueFormatter.formatValue(
                valueToString(cellValue),
                x,
                dataRowsColumnFormats.columnValueFormats[x],
                formatFunction,
                null,
                null,
                overallSummaryStats,
                null
            );
        }

        const groupSummaryStats =
            dataGroupingSettings.groupings.getGroupContainingRow(rowIndex).summaryStats;

        const rowModel = tabularData.RowModels[rowIndex];

        const rowVals = Ren.RowValues.getRowValuesForFormatFunction(
            tabularData,
            rowModel.CV,
            true
        );

        const compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(
            tabularData,
            rowModel.CV
        );

        if (dataRowsColumnFormats.columnCalcFunctions && dataRowsColumnFormats.columnCalcFunctions[x]?.length) {

            const calcFunctions = dataRowsColumnFormats.columnCalcFunctions[x];

            for (let i = 0; i < calcFunctions.length; i++) {

                try {

                    cellValue = calcFunctions[i](
                        cellValue,
                        rowVals,
                        (groupSummaryStats && groupSummaryStats[x]) || null,
                        (overallSummaryStats && overallSummaryStats[x]) || null,
                        compressedRowVals
                    );
                }
                catch (e) {

                    Ren.GlobalErrorHandler.logError(
                        "[CellSelectionCellValueReader] Error applying data row calc function:",
                        e
                    );

                    return `<span title="Error executing calc function: ${e}">Error</span>`;
                }
            }
        }

        const value = valueToString(cellValue);

        return Ren.ValueFormatter.formatValue(
            value,
            x,
            dataRowsColumnFormats.columnValueFormats[x],
            dataRowsColumnFormats.columnFormatFunctions[x],
            rowVals,
            groupSummaryStats,
            overallSummaryStats,
            compressedRowVals
        );
    };

    const getGroupRowCellValue = (x, rowIndex, formatValues, overallSummaryStats) => {

        const group = dataGroupingSettings.groupings.getGroupWithRowIndex(rowIndex);

        // A group's values are compressed where possible, so decompress for display.
        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const groupValues = group.groupValues;
        const position = group.position;

        if (!formatValues) return valueToString(decompressValue(groupValues.get(position, x), x));

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

        const groupingColumnFormats =
            dataGroupingSettings.getColumnValueFormats(
                grouping.columns
            );

        const groupIndex = rowIndex - tabularData.DataRowCount;

        // The outermost grouping has no parent, and its one group spans the whole grid.
        let groupSummaryStats = overallSummaryStats;
        let parentGrouping = null;

        if (grouping.parentGroupingIndex || grouping.parentGroupingIndex === 0) {

            parentGrouping = dataGroupingSettings.groupings.entries[grouping.parentGroupingIndex];
            groupSummaryStats = parentGrouping?.getGroupContainingGroup(groupIndex)?.summaryStats;
        }

        // The cell may not have been rendered, so the stats its function reads may not exist yet.
        dataGroupingSettings.summaryStats.lazyPopulateSummaryStats(
            groupingColumnFormats,
            x,
            parentGrouping
        );

        // The materialised row is the store's own, kept while it is this group being read, so both
        // of the caches below still hit as the cells of one group row are read in turn.
        const groupRow = groupValues.getRow(position);

        const rowVals = Ren.RowValues.getRowValuesForFormatFunction(
            tabularData,
            groupRow,
            true
        );

        const compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(
            tabularData,
            groupRow
        );

        const value = valueToString(decompressValue(groupValues.get(position, x), x));

        return Ren.ValueFormatter.formatValue(
            value,
            x,
            groupingColumnFormats.columnValueFormats[x],
            groupingColumnFormats.columnFormatFunctions[x],
            rowVals,
            groupSummaryStats,
            overallSummaryStats,
            compressedRowVals
        );
    };

    const getCellValue = (x, y, formatValues, overallSummaryStats, dataRowsColumnFormats) => {

        if (dataGroupingSettings.isGapRow(y)) return "";

        const rowIndex = dataGroupingSettings.getRowIndex(y) - tabularData.HeadingCount;

        if (rowIndex < 0) {

            return getHeadingCellValue(x, y);
        }
        else if (rowIndex >= tabularData.DataRowCount) {

            return getGroupRowCellValue(x, rowIndex, formatValues, overallSummaryStats);
        }
        else {

            return getDataRowCellValue(x, rowIndex, formatValues, overallSummaryStats, dataRowsColumnFormats);
        }
    };

    /**
     * Gets the textualised version of the cell value at the given co-ordinates.
     */
    const getTextualisedCellValue = (x, y, overallSummaryStats, dataRowsColumnFormats, options) => {

        const cellValue = getCellValue(x, y, true, overallSummaryStats, dataRowsColumnFormats);

        return Ren.DataGridCellSelection_CellValueTextualiser.textualise(cellValue, options);
    };

    return {
        getCellValue,
        getTextualisedCellValue
    };
};
