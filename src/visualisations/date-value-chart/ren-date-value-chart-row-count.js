/**
 * Charts how many rows hold each value of a selection with no value column - string, enum or ID
 * columns, and perhaps a date - as the word cloud does.  The auto row-count column is the value,
 * and the selection's first such column splits it into a series per value.
 */
Ren.DateValueChart_RowCount = (() => {

    const COUNT_COLUMN = "__Count";

    const isDateColumnModel = (columnModel) =>
        columnModel.ColumnType === "Date" || columnModel.ColumnType === "Date/Time";

    /**
     * Gets a value indicating whether a column's values name things rather than measure them.
     */
    const isCategoryColumnModel = (columnModel) =>
        columnModel.ColumnType === "String"
        || columnModel.ColumnType === "Text"
        || columnModel.ColumnFormat === Ren.SpreadsheetColumnFormatEnum.Id
        || (Ren.ObjectUtils.isObject(columnModel.EnumValues)
            && Object.keys(columnModel.EnumValues).length > 0);

    /**
     * Gets the selected column to count the rows of each value of, or null where any selected
     * column is neither a category nor a date, none is a category, or the data source has no
     * row-count column.
     */
    const getCountedColumn = (tabularData, selectedColumns) => {

        const columnResolver = tabularData?.columnResolver;

        if (!columnResolver || !selectedColumns || selectedColumns.length === 0) return null;
        if (columnResolver.getColumnIndex(COUNT_COLUMN) == null) return null;

        let countedColumn = null;

        for (let i = 0; i < selectedColumns.length; i++) {

            const columnIndex = columnResolver.getColumnIndex(selectedColumns[i]);
            const columnModel = columnIndex != null ? tabularData.ColumnModels[columnIndex] : null;

            if (!columnModel) return null;

            if (isCategoryColumnModel(columnModel)) {

                if (countedColumn === null) countedColumn = selectedColumns[i];
            }
            else if (!isDateColumnModel(columnModel)) {

                return null;
            }
        }

        return countedColumn;
    };

    return {
        COUNT_COLUMN,
        getCountedColumn
    };
})();
