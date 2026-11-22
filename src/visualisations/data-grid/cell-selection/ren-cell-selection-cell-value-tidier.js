/**
 * Tidies cell values before values are copied to the clipboard.
 */
Ren.DataGridCellSelection_CellValueTidier = (() => {

    /**
     * Tidies up a cell value.  Optionally applies the formatting specified for the column, then
     * does some further processing to extract the text from HTML if necessary.  Returns the tidied
     * value as a string.
     */
    const tidyValue = (
        value,
        formatValue,
        columnIndex,
        columnFormats,
        rowVals,
        groupSummaryStats,
        overallSummaryStats,
        compressedRowVals) => {

        if (!formatValue && !value) return value;

        // If formatValue is true, we have to continue, as format functions may produce output even
        // when the cell value is empty.

        value = value?.toString() || "";

        if (formatValue) {

            value = Ren.ValueFormatter.formatValue(
                value,
                columnIndex,
                columnFormats.columnValueFormats[columnIndex],
                columnFormats.columnFormatFunctions[columnIndex],
                rowVals,
                groupSummaryStats,
                overallSummaryStats,
                compressedRowVals
            );
        }

        return value;
    };

    return {
        tidyValue
    };
})();
