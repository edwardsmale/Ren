/**
 * Gets the columns a visualisation detects its columns' roles from (words, dates, values), so one
 * begotten from whole selected columns sees the same columns as one built on an ad hoc data source
 * from selected cells.  Detectors should take their columns from here rather than the row's keys.
 */
Ren.VisualisationDetectionColumns = (() => {

    const COUNT_COLUMN = "__Count";

    const hasOwnProperty = Object.prototype.hasOwnProperty;

    const isHiddenColumn = (column, tabularData, columnResolver) => {

        if (!tabularData || !columnResolver) return false;

        const columnIndex = columnResolver.getColumnIndex(column);

        return columnIndex != null && tabularData.ColumnModels[columnIndex]?.Visible === false;
    };

    /**
     * Gets the selected columns present in the input data, in selection order, or where nothing is
     * selected the input data's visible columns - which, for an ad hoc data source, are the
     * selected cells' columns.  The auto row-count column is returned apart as countColumn, for
     * visualisations that can count rows where no column holds counts.
     */
    const getDetectionColumns = (inputData, selectedColumns, tabularData, columnResolver) => {

        if (!inputData || inputData.length === 0) {
            return { columns: [], countColumn: null };
        }

        const firstRow = inputData[0];
        const columns = [];

        if (selectedColumns && selectedColumns.length > 0) {

            for (let i = 0; i < selectedColumns.length; i++) {

                if (hasOwnProperty.call(firstRow, selectedColumns[i])) {
                    columns.push(selectedColumns[i]);
                }
            }
        }
        else {

            const keys = Object.keys(firstRow);

            for (let i = 0; i < keys.length; i++) {

                if (!isHiddenColumn(keys[i], tabularData, columnResolver)) {
                    columns.push(keys[i]);
                }
            }
        }

        return {
            columns,
            countColumn: hasOwnProperty.call(firstRow, COUNT_COLUMN) ? COUNT_COLUMN : null
        };
    };

    return {
        getDetectionColumns
    };
})();
