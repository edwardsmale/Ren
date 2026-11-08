/**
 * Works out what a function editor's code gives for the row of one of this grid's cells, for the
 * editor's auto preview (see Ren.FunctionEditorAutoPreview).  The code is given what the grid gives
 * the functions on that row: a calc or sort function the cell's own value, and any other the value
 * the column's calc functions make of it.
 */
Ren.DataGridCellSelection_FunctionEditorPreviewSource = (parts) => {

    const { visualisation, tabularData, dataGroupingSettings, cellParser } = parts;

    // The functions given a data row's own value rather than its calculated value.
    const RAW_VALUE_PARAMETER_SETS = ["calc", "valueOnly"];

    const decompressValue = (compressedValue, columnIndex) =>
        tabularData.CompressionDictionary.decompressValue(compressedValue, columnIndex);

    // Compile errors are thrown for the preview to show, not logged as errors on the page.
    const compile = (code) => Ren.ArrayUtils.ensureArray(
        Ren.FormatFunctions.createFunction(
            code,
            Ren.ReportInputParameters.getInputParametersForGuid(
                dataGroupingSettings.containingReportGuid
            ),
            true
        )
    );

    const getOverallSummaryStats = () =>
        dataGroupingSettings.groupings.firstGroupOfOutermostGrouping()?.summaryStats;

    const applyFunctions = (functions, value, columnIndex, rowArguments) => {

        const groupSummaryStats = rowArguments.groupSummaryStats;
        const overallSummaryStats = rowArguments.overallSummaryStats;

        for (let index = 0; index < functions.length; index++) {

            value = functions[index](
                value,
                rowArguments.rowVals,
                (groupSummaryStats && groupSummaryStats[columnIndex]) || null,
                (overallSummaryStats && overallSummaryStats[columnIndex]) || null,
                rowArguments.compressedRowVals
            );
        }

        return value;
    };

    const evaluateOnDataRow = (code, rowIndex, columnIndex, usesRawValue) => {

        const functions = compile(code);
        const grouping = dataGroupingSettings.groupings.entries[0];
        const summaryStats = dataGroupingSettings.summaryStats;

        const calcFunctions = usesRawValue
            ? null
            : dataGroupingSettings.getDataRowsColumnFormats().columnCalcFunctions[columnIndex];

        summaryStats.populateStatsUsedByFunctions(functions, columnIndex, grouping);

        if (calcFunctions) {
            summaryStats.populateStatsUsedByFunctions(calcFunctions, columnIndex, grouping);
        }

        const cv = tabularData.RowModels[rowIndex].CV;

        const rowArguments = {
            rowVals: Ren.RowValues.getRowValuesForFormatFunction(tabularData, cv, true),
            compressedRowVals: Ren.RowValues.getCompressedRowValuesForFormatFunction(
                tabularData,
                cv
            ),
            groupSummaryStats:
                dataGroupingSettings.groupings.getGroupContainingRow(rowIndex).summaryStats,
            overallSummaryStats: getOverallSummaryStats()
        };

        let value = decompressValue(cv[columnIndex], columnIndex);

        if (calcFunctions) {
            value = applyFunctions(calcFunctions, value, columnIndex, rowArguments);
        }

        return applyFunctions(functions, value, columnIndex, rowArguments);
    };

    const evaluateOnGroupRow = (code, rowIndex, columnIndex) => {

        const functions = compile(code);
        const groupings = dataGroupingSettings.groupings;
        const grouping = groupings.getGroupingWithRowIndex(rowIndex);
        const group = groupings.getGroupWithRowIndex(rowIndex);

        // The outermost grouping has no parent, and its one group spans the whole grid.
        const parentGrouping = grouping.parentGroupingIndex || grouping.parentGroupingIndex === 0
            ? groupings.entries[grouping.parentGroupingIndex]
            : null;

        dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
            functions,
            columnIndex,
            parentGrouping
        );

        const overallSummaryStats = getOverallSummaryStats();

        const groupSummaryStats = parentGrouping
            ? parentGrouping.getGroupContainingGroup(rowIndex - tabularData.DataRowCount)
                ?.summaryStats
            : overallSummaryStats;

        const groupRow = group.groupValues.getRow(group.position);

        const rowArguments = {
            rowVals: Ren.RowValues.getRowValuesForFormatFunction(tabularData, groupRow, true),
            compressedRowVals: Ren.RowValues.getCompressedRowValuesForFormatFunction(
                tabularData,
                groupRow
            ),
            groupSummaryStats,
            overallSummaryStats
        };

        return applyFunctions(
            functions,
            decompressValue(group.groupValues.get(group.position, columnIndex), columnIndex),
            columnIndex,
            rowArguments
        );
    };

    /**
     * Gets the preview ({ evaluate(code) }) of the code of a function of the named parameter set
     * (see Ren.FunctionEditorWidget.parameterSets) for a cell's row, or null where the cell is in
     * neither a data row nor a group row.  The row is read now, as the grid may go on to render
     * another row in the cell.
     */
    const createPreview = (cellElement, parameterSetName) => {

        const rowIndex = cellParser.getRowIndex(cellElement) - tabularData.HeadingCount;
        const columnIndex = cellParser.getColumnIndex(cellElement);

        if (rowIndex < 0) return null;

        if (tabularData.isDataRow(rowIndex)) {

            const usesRawValue = RAW_VALUE_PARAMETER_SETS.indexOf(parameterSetName) !== -1;

            return {
                evaluate: (code) => evaluateOnDataRow(code, rowIndex, columnIndex, usesRawValue)
            };
        }

        if (tabularData.isGroupRow(rowIndex)) {

            return {
                evaluate: (code) => evaluateOnGroupRow(code, rowIndex, columnIndex)
            };
        }

        return null;
    };

    return {
        visualisation,
        createPreview
    };
};
