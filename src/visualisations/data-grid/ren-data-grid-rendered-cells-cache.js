/**
 * Caches cells that have been rendered in a datagrid.  Firstly, this means that if there are
 * value or formatting changes, we can just update the cells rather than removing and re-rendering
 * them; secondly, it allows us to avoid re-rendering cells that have already been rendered, since
 * this causes problems.
 */
Ren.DataGridRenderedCellsCache = (tabularData) => {

    // Preallocate outer array for rows
    const renderedCells = new Array(tabularData.ActualRowCount);

    const get = (rowIndexIncHeadings, columnIndex) => {

        const row = renderedCells[rowIndexIncHeadings];
        return row ? row[columnIndex] : undefined;
    };

    const add = (rowIndexIncHeadings, columnIndex, cell) => {

        let row = renderedCells[rowIndexIncHeadings];

        if (!row) {

            row = [];
            renderedCells[rowIndexIncHeadings] = row;
        }
        row[columnIndex] = cell;
    };

    const removeGroupRows = () => {

        if (renderedCells.length > tabularData.ActualRowCount) {
            renderedCells.length = tabularData.ActualRowCount;
        }
    };

    return {
        get,
        add,
        removeGroupRows
    };
};
