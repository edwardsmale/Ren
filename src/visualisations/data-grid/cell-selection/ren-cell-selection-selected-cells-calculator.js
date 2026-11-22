Ren.DataGridCellSelection_SelectedCellsCalculator = (tabularData, dataGroupingSettings, gridState) => {

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(dataGroupingSettings);

    // Guard against an incomplete rect (one without both start and end cells), matching the
    // defence in dragRectExtent/dragRectSelectionType, so getRectExtent never reads x off an
    // undefined cell.
    const isCompleteRect = (rect) => rect && rect.startCell && rect.endCell;

    /**
     * Visits every cell in the given rectangle, leaving out the columns that are not on show, the
     * totals row when a totals row Y is given, and the heading rows when those are excluded.
     *
     * Cells are visited a column at a time, and the SQL column index the walk has reached is handed
     * to the callback, so that a caller doing per-column work can do it once a column rather than
     * once a cell.
     */
    const forEachCellInRect = (rect, totalsRowY, excludeHeaderRows, callback) => {

        const rectExtent = rectCalculator.getRectExtent(rect);

        // Every column of a rect covers the same rows, so where the rows start is worked out here
        // rather than again for each column.
        let minY = rectExtent.minY;

        if (excludeHeaderRows && minY < tabularData.HeadingCount) {
            minY = tabularData.HeadingCount;
        }

        for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) {

            const sqlColIndex = dataGroupingSettings.getColIndex(x);

            if (!gridState.isColumnVisible(sqlColIndex)) continue;

            for (let y = minY; y <= rectExtent.maxY; y++) {

                if (y === totalsRowY) continue;

                callback(x, y, sqlColIndex);
            }
        }
    };

    /**
     * Visits every selected cell without building an array of them first, which matters where the
     * selection is the whole of a large grid and the array would hold millions of objects.
     *
     * The callback is given the cell's display x and y, and the SQL index of its column.
     */
    const forEachSelectedCell = (state, excludeTotalsRow, excludeHeaderRows, callback) => {

        const totalsRowY = excludeTotalsRow ? dataGroupingSettings.totalsRowY() : null;

        if (isCompleteRect(state.dragRect)) {

            forEachCellInRect(state.dragRect, totalsRowY, excludeHeaderRows, callback);
        }

        state.selectedRects.forEach((rect) => {

            if (isCompleteRect(rect)) {

                forEachCellInRect(rect, totalsRowY, excludeHeaderRows, callback);
            }
        });
    };

    /**
     * Gets an array containing the co-ordinates of the selected cells' x and y co-ordinates.
     */
    const getSelectedCells = (state, excludeTotalsRow, excludeHeaderRows) => {

        const cells = [];

        forEachSelectedCell(state, excludeTotalsRow, excludeHeaderRows, (x, y) => {

            cells.push({ x, y });
        });

        return cells;
    };

    return {
        forEachSelectedCell,
        getSelectedCells
    };
};
