Ren.DataGridCellSelection_State = (dataGroupingSettings, firstLastCell) => {

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(dataGroupingSettings);

    const state = {
        selectedRects: [],
        isMouseDown: false,
        selectionType: null,
        dragRect: null,
        focussedCell: { x: 0, y: 0 }, // The last-clicked cell, to support Shift+Click selection.
        isFoundCell: false // Whether the selection is a cell the Find window found.
    };

    const clearSelection = () => {

        state.selectedRects = [];
        state.isMouseDown = false;
        state.selectionType = null;
        state.dragRect = null;
        state.focussedCell = { x: 0, y: 0 };
        state.isFoundCell = false;
    };

    const selectionType = (arg) => {

        if (arg !== undefined) state.selectionType = arg;
        return state.selectionType;
    };

    /**
     * Gets or sets a value indicating whether the selection is a cell that the Find window found,
     * which is shown in its own colour so that the user can pick it out from the rows around it.
     * It is turned off again as soon as the user selects something themselves.
     */
    const isFoundCell = (arg) => {

        if (arg !== undefined) state.isFoundCell = arg;
        return state.isFoundCell;
    };

    const isMouseDown = (arg) => {

        if (arg !== undefined) state.isMouseDown = arg;
        return state.isMouseDown;
    };

    const selectedRects = (arg) => {

        if (arg !== undefined) state.selectedRects = arg;
        return state.selectedRects;
    };

    const selectedRectExtents = () => {

        return state.selectedRects.map(rect => rectCalculator.getRectExtent(rect));
    };

    const clearSelectedRects = () => {

        state.selectedRects = [];
    };

    const dragRect = (arg) => {

        if (arg !== undefined) state.dragRect = arg;
        return state.dragRect;
    };

    const dragRectExtent = () => {

        if (!state.dragRect || !state.dragRect.startCell || !state.dragRect.endCell) return null;
        return rectCalculator.getRectExtent(state.dragRect);
    };

    const dragRectSelectionType = () => {

        if (!state.dragRect || !state.dragRect.startCell || !state.dragRect.endCell) return null;
        return state.dragRect.selectionType;
    };

    const clearDragRect = () => {

        state.dragRect = null;
    };

    const focussedCell = (arg) => {

        if (arg !== undefined) state.focussedCell = arg;
        return state.focussedCell;
    };

    Ren.Messages.Events.windowMouseUp.handle(() => { state.isMouseDown = false; });

    /**
     * Selects all cells in the datagrid.
     */
    const selectAll = () => {

        state.selectedRects = [{
            startCell: firstLastCell.getFirstCell(),
            endCell: firstLastCell.getLastCell(),
            selectionType: "all"
        }];
        state.selectionType = "all";
    };

    /**
     * Selects the specified cells, converting the selection to a cell selection type.
     */
    const setCellSelection = (state, selectedCells) => {

        state.selectedRects = selectedCells.map(c => ({
            startCell: c,
            endCell: c,
            selectionType: "cell"
        }));
    };

    /**
     * Selects a column by adding a rectangle that spans the entire column.
     */
    const selectColumn = (x) => {

        state.selectedRects.push({
            startCell: { x, y: 0 },
            endCell: { x, y: firstLastCell.getLastCell().y },
            selectionType: "column"
        });

        state.selectionType = "column";
    };

    /**
     * Selects a column by adding a rectangle that spans the entire column.
     */
    const selectColumnV = (x, minY, maxY) => {

        state.selectedRects.push({
            startCell: { x, y: minY },
            endCell: { x, y: maxY },
            selectionType: "column-v"
        });

        state.selectionType = "column-v";
    };

    /**
     * Toggles the selected state of a cell.
     */
    const toggleCell = (cell, selectedCells) => {

        if (selectedCells.some(c => c.x === cell.x && c.y === cell.y)) {

            // Convert the selection to a cell selection type.
            const cellsExceptClicked = selectedCells.filter(c => c.x !== cell.x || c.y !== cell.y);

            setCellSelection(state, cellsExceptClicked);

            state.dragRect = null;
        }
        else {

            state.selectedRects.push({
                startCell: cell,
                endCell: cell,
                selectionType: "cell"
            });

            state.dragRect = { startCell: cell, endCell: cell, selectionType: "cell" };
        }
    };

    /**
     * Toggles the selected state of a row.
     */
    const toggleRow = (state, rowIndex) => {

        if (state.selectionType === "column" ||
            state.selectionType === "column-v" ||
            state.selectionType === "cell") return;

        // If all cells have been selected, by clicking on the top-left corner, then convert the
        // selection to a row selection.
        if (state.selectionType === "all") {

            state.selectedRects = [];

            const maxX = firstLastCell.getLastCell().x;
            const maxY = firstLastCell.getLastCell().y;

            for (let y = 0; y <= maxY; y++) {

                state.selectedRects.push({
                    startCell: { x: 0, y },
                    endCell: { x: maxX, y },
                    selectionType: "row"
                });
            }
        }

        if (state.selectedRects.some(rect =>
            rect.startCell.y === rowIndex &&
            rect.selectionType === "row")
        ) {

            state.selectedRects = state.selectedRects.filter(rect =>
                rect.startCell.x !== 0 ||
                rect.startCell.y !== rowIndex ||
                rect.selectionType !== "row");
        }
        else {

            state.selectedRects.push({
                startCell: { x: 0, y: rowIndex },
                endCell: { x: firstLastCell.getLastCell().x, y: rowIndex },
                selectionType: "row"
            });
        }
    };

    /**
     * Toggles the selected state of a column.
     */
    const toggleColumn = (columnIndex) => {

        // Drop any malformed rect (missing its start cell) up front, so the checks below cannot
        // throw on it and leave the Ctrl-click doing nothing.
        state.selectedRects = state.selectedRects.filter(rect => rect.startCell);

        // Ctrl-clicking a column heading is an unambiguous request for a column selection.  If a
        // different kind of selection is active (whole rows or individual cells), replace it with a
        // fresh column selection of the clicked column rather than silently doing nothing - which
        // would otherwise swallow the first Ctrl-click after a row or cell selection.
        if (state.selectionType === "row" ||
            state.selectionType === "cell") {

            state.selectedRects = [];
            selectColumn(columnIndex);
            return;
        }

        // If all cells have been selected, by clicking on the top-left corner, then convert the
        // selection to a column selection.

        if (state.selectionType === "all") {

            state.selectedRects = [];

            const maxX = firstLastCell.getLastCell().x;

            for (let x = 0; x <= maxX; x++) {

                selectColumn(x);
            }
        }

        if (state.selectedRects.some(rect =>
            rect.startCell.x === columnIndex &&
            rect.selectionType === "column")
        ) {

            state.selectedRects = state.selectedRects.filter(rect =>
                rect.startCell.y !== 0 ||
                rect.startCell.x !== columnIndex ||
                rect.selectionType !== "column"
            );
        }
        else {

            selectColumn(columnIndex);
        }
    };

    return {
        clearDragRect,
        clearSelectedRects,
        clearSelection,
        dragRect,
        dragRectExtent,
        dragRectSelectionType,
        focussedCell,
        isFoundCell,
        isMouseDown,
        selectAll,
        selectColumn,
        selectColumnV,
        selectedRects,
        selectedRectExtents,
        selectionType,
        setCellSelection,
        state,
        toggleCell,
        toggleColumn,
        toggleRow
    };
};
