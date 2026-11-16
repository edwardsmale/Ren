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

    /**
     * Removes a row's cells from the DOM and forgets them, so that they are rendered afresh if the
     * row comes back into view.
     */
    const removeRow = (rowIndexIncHeadings) => {

        const row = renderedCells[rowIndexIncHeadings];
        if (!row) return;

        for (let c = 0; c < row.length; c++) row[c]?.remove();

        renderedCells[rowIndexIncHeadings] = undefined;
    };

    const removeGroupRows = () => {

        if (renderedCells.length > tabularData.ActualRowCount) {
            renderedCells.length = tabularData.ActualRowCount;
        }
    };

    return {
        get,
        add,
        removeRow,
        removeGroupRows
    };
};
