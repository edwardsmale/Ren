/**
 * Parses the 'ren-c-' and 'ren-r-' classes of a cell element in a datagrid to get the x and y
 * coordinates.
 */
Ren.DataGridCellSelection_CellParser = (dataGroupingSettings) => {

    const colRegex = /\bren-c-(\d+)\b/;
    const rowRegex = /\bren-r-(\d+)\b/;

    /**
     * Gets the column index of the cell in the datagrid from the cell element's 'ren-c-' class.
     */
    const getColumnIndex = (elem) => {

        const className = elem.className;
        const match = colRegex.exec(className);
        if (!match) return null;
        return parseInt(match[1], 10);
    };

    /**
     * Gets the row index of the cell in the datagrid from the cell element's 'ren-r-' class.
     */
    const getRowIndex = (elem) => {

        const className = elem.className;
        const match = rowRegex.exec(className);
        if (!match) return null;
        return parseInt(match[1], 10);
    };

    /**
     * Converts a datagrid cell DOM element to an object with `x` and `y` properties.
     * x is the display X position (not the SQL column index); use getColIndex to convert back.
     * y is the display Y position (not the row index); use getRowIndex to convert back.
     */
    const toCell = (element) => {

        const columnIndex = getColumnIndex(element);
        const x = dataGroupingSettings.getColX(columnIndex);
        const rowIndex = getRowIndex(element);
        const y = dataGroupingSettings.getRowY(rowIndex);
        return { x, y };
    };

    return {
        getColumnIndex,
        getRowIndex,
        toCell
    };
};
