/**
 * Reads the current cell selection: what is selected, what its values are, and its shape (all in
 * one column, more than one cell, values that can be filtered on).  Nothing here changes the
 * selection or touches the DOM.
 */
Ren.DataGridCellSelection_Queries = (parts) => {

    const {
        tabularData,
        dataGroupingSettings,
        cellValueReader,
        selectedCellsCalculator,
        tsvGenerator,
        selection,
        cellSelectionStatBar,
        selectionStateReader,
        rawValueReader
    } = parts;

    /**
     * Gets an array of the indexes of the selected columns.
     */
    const getSelectedColumnIndexes = () => selectionStateReader.getSelectedColumnIndexes();

    /**
     * Gets an array of the IDs or headings of the selected columns.
     */
    const getSelectedColumnIdsOrHeadings = () => selectionStateReader.getSelectedColumnIdsOrHeadings();

    /**
     * Gets the text of all the selected cells as a TSV string.
     */
    const getSelectedCellsTsv = (options) => {

        // In the case where cells are selected (as opposed to whole rows or columns), get the
        // 'extent' of the area selected - the smallest rectangle that contains all the selected
        // cells - then return a TSV string of that rectangle.

        const selectedCells = selectedCellsCalculator.getSelectedCells(
            selection.state,
            options?.excludeTotalsRow,
            options?.excludeHeaderRows
        );

        return tsvGenerator.getSelectedCellsTsv(
            selection.state,
            selectedCells,
            options
        );
    };

    /**
     * Returns a value indicating whether multiple cells are selected.
     */
    const areMultipleCellsSelected = () => {

        const selectedRects = selection.selectedRects();

        if (selection.selectionType() === "all") return true;
        if (selectedRects.length > 1) return true;

        const dragRect = selection.dragRect();

        if (dragRect) {

            return (
                dragRect.startCell.x !== dragRect.endCell.x ||
                dragRect.startCell.y !== dragRect.endCell.y
            );
        }

        if (selectedRects.length === 0) return false;

        for (let i = 0; i < selectedRects.length; i++) {

            const rect = selectedRects[i];

            if (rect.startCell.x !== rect.endCell.x ||
                rect.startCell.y !== rect.endCell.y) {

                return true;
            }
        }

        return false;
    };

    /**
     * Returns a value indicating whether all selected cells are in the same column.
     */
    const areSelectedCellsAllInSameColumn = () => {

        let seenColumnIndex = null;

        const selectedRectExtents = selection.selectedRectExtents();

        for (let ri = 0; ri < selectedRectExtents.length; ri++) {

            const rectExtent = selectedRectExtents[ri];

            for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) {

                if (seenColumnIndex === null) {
                    seenColumnIndex = x;
                }
                else if (seenColumnIndex !== x) {

                    return false;
                }
            }
        }

        return true;
    };

    /**
     * Returns a value indicating whether the values of the selected cells in the same column exist
     * in the compression dictionary, as a shortcut to work out whether aggregated values actually
     * exist in the column as data rows.
     */
    const areSelectedCellValuesValidForFiltering = (columnIndex) => {

        const values = getCompressedValuesOfSelectedCells();

        const columnFormat = tabularData.ColumnModels[columnIndex].ColumnFormat;

        if (Ren.SpreadsheetColumnFormatEnum.IsNumeric(columnFormat)) {

            for (let i = 0; i < values.length; i++) {

                if (!Ren.TextUtils.isStringNumeric(values[i])) return false;
            }

            return true;
        }
        else {

            for (let i = 0; i < values.length; i++) {

                const value = values[i];

                if (typeof value === "string" &&
                    !tabularData.CompressionDictionary.valueIsInDictionary(value, columnIndex)) {

                    return false;
                }
            }

            return true;
        }
    };

    /**
     * Gets a one-dimensional array containing the compressed values of the selected cells.
     */
    const getCompressedValuesOfSelectedCells = (excludeTotalsRow, excludeHeaderRows) => {

        const cells = selectedCellsCalculator.getSelectedCells(
            selection.state,
            excludeTotalsRow,
            excludeHeaderRows
        );

        const values = [];

        for (let i = 0; i < cells.length; i++) {

            const cell = cells[i];

            const rowIndex = dataGroupingSettings.getRowIndex(cell.y) - tabularData.HeadingCount;

            if (tabularData.isDataRow(rowIndex)) {

                const sqlColIndex = dataGroupingSettings.getColIndex(cell.x);
                const cv = tabularData.RowModels[rowIndex].CV[sqlColIndex];
                const cellValue = tabularData.CompressionDictionary.decompressValue(cv, sqlColIndex);

                values.push(cellValue);
            }
            else if (tabularData.isGroupRow(rowIndex)) {

                const cellValue = cellValueReader.getCellValue(
                    dataGroupingSettings.getColIndex(cell.x),
                    cell.y,
                    false
                );

                values.push(cellValue);
            }
        }

        return values;
    };

    /**
     * Gets the extents of all the selected rectangles, taking in the one currently being dragged
     * out, which is not among the selected rectangles until the drag ends.
     */
    const getAllSelectedRectExtents = () => {

        const rectExtents = selection.selectedRectExtents();
        const dragRectExtent = selection.dragRectExtent();

        if (dragRectExtent) rectExtents.push(dragRectExtent);

        return rectExtents;
    };

    /**
     * Gets the SQL row index of the row the given display Y position stands for, or null where that
     * position is a heading row or one of the gap rows between groupings, neither of which is any
     * part of the data.
     */
    const getRowIndexOfRowY = (rowY) => {

        if (dataGroupingSettings.isGapRow(rowY)) return null;

        const rowIndex = dataGroupingSettings.getRowIndex(rowY) - tabularData.HeadingCount;

        return rowIndex >= 0 ? rowIndex : null;
    };

    /**
     * Gets the SQL row indexes of the rows the given display Y positions stand for, leaving out the
     * heading rows and the gap rows between groupings, which are no part of the data.
     */
    const getRowIndexesOfRowYs = (rowYs) => {

        const rowIndexes = new Set();

        rowYs.forEach((rowY) => {

            const rowIndex = getRowIndexOfRowY(rowY);

            if (rowIndex !== null) rowIndexes.add(rowIndex);
        });

        return rowIndexes;
    };

    /**
     * Gets the SQL column indexes of the columns the given display X positions stand for.
     */
    const getColumnIndexesOfColumnXs = (columnXs) => {

        const columnIndexes = new Set();

        columnXs.forEach((columnX) => {

            const columnIndex = dataGroupingSettings.getColIndex(columnX);

            if (columnIndex !== undefined) columnIndexes.add(columnIndex);
        });

        return columnIndexes;
    };

    /**
     * Gets what the user has selected in the terms an export needs: the rows and the columns to
     * include, as sets of SQL indexes, either of which is null when the selection does not narrow
     * that one down (whole rows leave every column in, whole columns leave every row in).
     *
     * Returns null - meaning export everything - when there is no selection, when everything is
     * selected, and when a selection of individual cells is not a whole block of rows and columns.
     *
     * @returns {{rowIndexes: Set<number>, columnIndexes: Set<number>}} What to export, or null to
     * export the lot.
     */
    const getExportSelection = () => {

        const selectionType = selection.selectionType();

        if (!selectionType || selectionType === "all") return null;

        const rectExtents = getAllSelectedRectExtents();

        if (!rectExtents.length) return null;

        const rowYs = new Set();
        const columnXs = new Set();

        let cellCount = 0;

        for (let i = 0; i < rectExtents.length; i++) {

            const rectExtent = rectExtents[i];

            cellCount +=
                (rectExtent.maxY - rectExtent.minY + 1) * (rectExtent.maxX - rectExtent.minX + 1);

            for (let y = rectExtent.minY; y <= rectExtent.maxY; y++) rowYs.add(y);
            for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) columnXs.add(x);
        }

        // The selected cells only make a block when there are as many of them as the rows and
        // columns they cover would hold; anything else is ragged, so the whole grid is exported.
        if (cellCount !== rowYs.size * columnXs.size) return null;

        const rowIndexes = selectionType === "column" ? null : getRowIndexesOfRowYs(rowYs);
        const columnIndexes = selectionType === "row" ? null : getColumnIndexesOfColumnXs(columnXs);

        // A selection of nothing but heading rows says nothing about which data to export, so the
        // export is left as it was.
        if (rowIndexes && !rowIndexes.size) return null;
        if (columnIndexes && !columnIndexes.size) return null;

        return { rowIndexes, columnIndexes };
    };

    /**
     * Gets the SQL row indexes of the selected data and group rows, in the order the grid shows
     * them rather than the order the data arrived in, so that a sorted or grouped grid reads down
     * the page.  Heading rows and gap rows are left out.
     */
    const getSelectedRowIndexesInDisplayOrder = () => {

        const rectExtents = getAllSelectedRectExtents();

        const rowYs = new Set();

        for (let i = 0; i < rectExtents.length; i++) {

            const rectExtent = rectExtents[i];

            for (let y = rectExtent.minY; y <= rectExtent.maxY; y++) rowYs.add(y);
        }

        const sortedRowYs = Array.from(rowYs).sort((a, b) => a - b);

        const rowIndexes = [];

        for (let i = 0; i < sortedRowYs.length; i++) {

            const rowIndex = getRowIndexOfRowY(sortedRowYs[i]);

            if (rowIndex !== null) rowIndexes.push(rowIndex);
        }

        return rowIndexes;
    };

    /**
     * Gets the SQL row indexes of the selected data rows, in the order the grid shows them.
     *
     * Only the data rows are returned, not heading rows, gap rows or group rows.
     */
    const getSelectedDataRowIndexes = () => {

        const selectedRowIndexes = getSelectedRowIndexesInDisplayOrder();

        const rowIndexes = [];

        for (let i = 0; i < selectedRowIndexes.length; i++) {

            const rowIndex = selectedRowIndexes[i];

            // The group rows the grid writes above and below the data rows carry an index of their
            // own past the end of the data, and are display rather than rows to be inserted.
            if (tabularData.isDataRow(rowIndex)) rowIndexes.push(rowIndex);
        }

        return rowIndexes;
    };

    /**
     * Gets the raw values, before the grid's formatting, of the selected cells in the given column,
     * in the order the grid shows them (see Ren.DataGridCellSelection_RawValueReader for what a
     * group row's cell gives).
     */
    const getSelectedRawValuesInColumn = (columnIndex) => {

        const rowIndexes = getSelectedRowIndexesInDisplayOrder();

        const values = [];

        for (let i = 0; i < rowIndexes.length; i++) {

            const value = rawValueReader.getRawValue(rowIndexes[i], columnIndex);

            if (value !== undefined) values.push(value);
        }

        return values;
    };

    /**
     * Gets an array of strings to display in the stat bar.
     */
    const getStatBarValues = () => cellSelectionStatBar.getStatBarValues();

    /**
     * Gets every selected cell as a flat array of {x, y} coordinates.
     */
    const getSelectedCells = () =>
        selectedCellsCalculator.getSelectedCells(selection.state, false, false);

    return {
        getSelectedColumnIndexes,
        getSelectedColumnIdsOrHeadings,
        getSelectedCellsTsv,
        areMultipleCellsSelected,
        areSelectedCellsAllInSameColumn,
        areSelectedCellValuesValidForFiltering,
        getCompressedValuesOfSelectedCells,
        getExportSelection,
        getSelectedRowIndexesInDisplayOrder,
        getSelectedDataRowIndexes,
        getSelectedRawValuesInColumn,
        getStatBarValues,
        getSelectedCells
    };
};
