/**
 * The mouse behaviour of cell selection on cells, column headings and row headings.  Each handler
 * reads its element from `this`, as if bound to it directly; the -event-delegation module decides
 * which handler an event belongs to.
 */
Ren.DataGridCellSelection_PointerHandlers = (parts, updateUI) => {

    const {
        visualisation,
        tabularData,
        dataGroupingSettings,
        dataGridGuid,
        gridState,
        cellParser,
        selectedCellsCalculator,
        firstLastCell,
        selection,
        doubleClickVisualisationCreator
    } = parts;

    /**
     * Gets a value indicating whether the specified element is part of a header cell.
     */
    const isHeaderCell = (elem) =>
        elem.closest(".ren-data-grid__cell")?.classList?.contains("ren-h");

    const dataGridColumnHeadingOnMouseDown = function (e) {

        if (e.button !== 0) return; // Left mouse button only.

        // Prevent column selection if clicking a down arrow button in a header cell.
        if (e.target.className && e.target.className.includes("js-ren-context-menu-button")) return;

        e.preventDefault();

        const clickedColumn = dataGroupingSettings.getColX(cellParser.getColumnIndex(this));

        if (e.shiftKey && !e.ctrlKey) {

            const minX = Math.min(clickedColumn, selection.focussedCell().x);
            const maxX = Math.max(clickedColumn, selection.focussedCell().x);

            selection.clearSelectedRects();

            for (let x = minX; x <= maxX; x++) {
                selection.selectColumn(x);
            }
        }
        else if (e.ctrlKey) {

            selection.toggleColumn(clickedColumn);
        }
        else {

            selection.clearSelectedRects();

            selection.dragRect({
                startCell: { x: clickedColumn, y: 0 },
                endCell: { x: clickedColumn, y: firstLastCell.getLastCell().y },
                selectionType: "column"
            });

            selection.focussedCell({ x: clickedColumn, y: 0 });
        }

        selection.isMouseDown(true);

        if (selection.selectionType() === "row") {

            selection.selectionType("cell");
        }
        else {

            selection.selectionType("column");
        }

        updateUI();
    };

    const dataGridColumnHeadingOnMouseOver = function () {

        if (!selection.isMouseDown()) return;

        const dragRect = selection.dragRect();

        if (dragRect && dragRect.selectionType !== "column") return;

        const column = dataGroupingSettings.getColX(cellParser.getColumnIndex(this));

        if (dragRect) {
            dragRect.endCell = { x: column, y: firstLastCell.getLastCell().y };
        }
        else {

            selection.dragRect({
                startCell: { x: column, y: 0 },
                endCell: { x: column, y: firstLastCell.getLastCell().y },
                selectionType: "column"
            });
        }

        updateUI();
    };

    const dataGridColumnHeadingOnMouseUp = (e) => {

        if (e.button !== 0) return; // Left mouse button only.
        e.preventDefault();

        const rectExtent = selection.dragRectExtent();

        if (rectExtent) {

            // A rect per column, so that Ctrl-clicking a column heading can remove just that one.

            for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) {

                selection.selectColumn(x);
            }
        }

        selection.clearDragRect();
        selection.isMouseDown(false);

        updateUI();
    };

    const dataGridColumnHeadingRightClick = function (e) {

        e.preventDefault();

        const clickedCell = cellParser.toCell(this);

        if (selection.selectedRects().some(rect =>
            rect.startCell.x === clickedCell.x &&
            rect.selectionType === "column")
        ) {

            return;
        }

        selection.clearSelectedRects();

        selection.dragRect({
            startCell: { x: clickedCell.x, y: 0 },
            endCell: { x: clickedCell.x, y: firstLastCell.getLastCell().y },
            selectionType: "column"
        });

        selection.focussedCell({ x: clickedCell.x, y: 0 });
        selection.selectionType("column");

        updateUI();
    };

    const dataGridCellOnMouseDown = function (e) {

        if (e.button !== 0) return; // Left mouse button only.

        const className = e.target.className;

        if (className.includes("js-ren-context-menu-button")) return; // down arrow buttons
        if (className.includes("ren-data-grid__group-expand-collapse-button")) return;
        if (className.includes("ren-checkbox-cell")) return;

        e.preventDefault();

        const clickedCell = cellParser.toCell(this);

        if (e.shiftKey && !e.ctrlKey) {

            if (!isHeaderCell(e.target)) {

                selection.selectedRects([
                    {
                        startCell: selection.focussedCell(),
                        endCell: clickedCell,
                        selectionType: "cell"
                    }
                ]);

                selection.selectionType("cell");
            }
            else {

                // A header cell doubles as its column's heading, so Shift-clicking one selects the
                // range of columns between the previously-focussed column and the clicked one.
                const minX = Math.min(clickedCell.x, selection.focussedCell().x);
                const maxX = Math.max(clickedCell.x, selection.focussedCell().x);

                selection.clearSelectedRects();

                for (let x = minX; x <= maxX; x++) {
                    selection.selectColumn(x);
                }

                selection.selectionType("column");
            }
        }
        else if (e.ctrlKey) {

            if (!isHeaderCell(e.target)) {

                const selectedCells = selectedCellsCalculator.getSelectedCells(
                    selection.state,
                    false,
                    false
                );

                selection.toggleCell(clickedCell, selectedCells);
                selection.selectionType("cell");
            }
            else {

                // A header cell doubles as its column's heading, so Ctrl-clicking one toggles that
                // column in the selection, allowing multiple columns to be selected.
                selection.toggleColumn(clickedCell.x);
                selection.selectionType("column");
            }
        }
        else {

            selection.clearSelectedRects();

            const selectionType = isHeaderCell(e.target) ? "column" : "cell";

            selection.dragRect({ startCell: clickedCell, endCell: clickedCell, selectionType });
            selection.focussedCell(clickedCell);
            selection.selectionType(selectionType);
        }

        selection.isMouseDown(true);

        updateUI();
    };

    /**
     * The cell element is passed explicitly because, under event delegation, e.target may be a
     * descendant of the cell.
     */
    const dataGridCellOnMouseOver = (e, cellElement) => {

        if (!selection.isMouseDown()) return;

        if (e.target.className.includes("js-ren-context-menu-button")) return; // down arrow buttons

        const dragRect = selection.dragRect();

        // The mouse button can be down without a drag rect, e.g. after Ctrl-clicking a cell to
        // deselect it.
        if (!dragRect) return;

        if (selection.dragRectSelectionType() === "column" || isHeaderCell(e.target)) {

            const column = dataGroupingSettings.getColX(cellParser.getColumnIndex(cellElement));

            const selectionType = isHeaderCell(e.target) ? "column" : "cell";

            selection.dragRect(Object.assign({}, dragRect, { endCell: { x: column, y: firstLastCell.getLastCell().y }, selectionType }));
        }
        else if (selection.dragRectSelectionType() === "cell") {

            const cell = cellParser.toCell(cellElement);

            selection.dragRect(Object.assign({}, dragRect, { endCell: cell, selectionType: "cell" }));
        }

        updateUI();
    };

    const dataGridCellOnMouseUp = function (e) {

        if (e.button !== 0) return; // Left mouse button only.

        if (e.target.className.includes("js-ren-context-menu-button")) return; // down arrow buttons

        e.preventDefault();

        if (!selection.dragRect()) return;
        if (!selection.dragRectExtent()) return;

        const dragRectExtent = selection.dragRectExtent();

        const rowCount = dataGroupingSettings.getActiveRowCountExcludingTotalsRowAndHeaderRows();

        const selectedRects = selection.selectedRects();

        if (dragRectExtent.maxY - dragRectExtent.minY + 1 >= rowCount) {

            for (let x = dragRectExtent.minX; x <= dragRectExtent.maxX; x++) {

                selectedRects.push({
                    startCell: { x, y: dragRectExtent.minY },
                    endCell: { x, y: dragRectExtent.maxY },
                    selectionType: "column-v"
                });

                selection.selectionType("column-v");
            }
        }
        else {

            selectedRects.push(selection.dragRect());
        }

        selection.clearDragRect();
        selection.isMouseDown(false);

        updateUI();
    };

    /**
     * Replaces the selection with the right-clicked cell, unless the cell is already part of it.
     */
    const dataGridCellOnRightClick = function () {

        const clickedCell = cellParser.toCell(this);

        if (selection.selectedRects().some(rect =>
            rect.startCell.x === clickedCell.x &&
            rect.startCell.y === clickedCell.y &&
            rect.selectionType === "cell")
        ) {

            return;
        }

        const selectedCells = selectedCellsCalculator.getSelectedCells(
            selection.state,
            false,
            false
        );

        if (selectedCells.length !== 1 &&
            selectedCells.some(c => c.x === clickedCell.x && c.y === clickedCell.y)) {

            return;
        }

        selection.selectedRects([{
            startCell: clickedCell,
            endCell: clickedCell,
            selectionType: "cell"
        }]);

        selection.focussedCell(clickedCell);
        selection.clearDragRect();
        selection.isMouseDown(true);
        selection.selectionType("cell");

        updateUI();
    };

    /**
     * Selects the whole of a row.
     * @param {number} r The row index (including headings).
     */
    const selectRow = (r) => {

        const y = dataGroupingSettings.getRowY(r);

        selection.clearSelectedRects();
        selection.clearDragRect();

        selection.selectedRects([{
            startCell: { x: 0, y },
            endCell: { x: firstLastCell.getLastCell().x, y },
            selectionType: "row"
        }]);

        selection.focussedCell({ x: 0, y });
        selection.selectionType("row");
        updateUI();
    };

    /**
     * Expands or collapses the group of the group row with the specified index (including
     * headings), unless it is the totals row.
     */
    const toggleGroupExpansion = (r) => {

        const rowIndex = r - tabularData.HeadingCount;

        if (!tabularData.isGroupRow(rowIndex)) return;

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

        if (!grouping || grouping.isOutermostGrouping) return;

        Ren.Messages.Requests.groupExpandCollapse.notify(dataGridGuid, rowIndex);
    };

    /**
     * Opens the group of the group row with the specified index (including headings) in a new
     * grid, as its "Open group in new grid" menu item does.  Returns false if the group cannot be.
     */
    const extractGroup = (r, columnIndex) => {

        const rowIndex = r - tabularData.HeadingCount;

        if (!tabularData.isGroupRow(rowIndex)) return false;

        const groupings = dataGroupingSettings.groupings;
        const group = groupings.getGroupWithRowIndex(rowIndex);
        const grouping = groupings.getGroupingWithRowIndex(rowIndex);

        if (!Ren.DataGrid_ExtractGroup.canExtractGroup(dataGroupingSettings, group, grouping)) {
            return false;
        }

        Ren.DataGrid_ExtractGroup.extractGroup(
            visualisation,
            tabularData,
            dataGroupingSettings,
            gridState,
            group,
            grouping,
            columnIndex
        );

        return true;
    };

    /**
     * Selects a double-clicked cell's or row heading's row and opens the default row visualiser
     * for it, where the row can be opened in one, or else expands or collapses its group.  With
     * Ctrl held, a group row's group is opened in a new grid instead.
     * @param {number} r The row index (including headings).
     * @param {number} columnIndex The double-clicked cell's column index, or -1 for a row heading.
     */
    const onDblClick = (e, r, columnIndex) => {

        const className = e.target.className;

        if (className.includes("js-ren-context-menu-button")) return; // down arrow buttons
        if (className.includes("ren-data-grid__group-expand-collapse-button")) return;
        if (className.includes("ren-checkbox-cell")) return;

        if (e.ctrlKey && extractGroup(r, columnIndex)) return;

        if (!doubleClickVisualisationCreator.isVisualisableRow(r)) {

            toggleGroupExpansion(r);
            return;
        }

        selectRow(r);

        // A double-click opens a new popup, which holding Alt reuses rather than opening another.
        const popupReuseId = "DoubleClickedRow";

        if (!e.altKey) Ren.ReleasePopupReuseId(popupReuseId);

        doubleClickVisualisationCreator.createDoubleClickVisualisation(r, popupReuseId);
    };

    const dataGridRowHeadingMouseDown = function (e) {

        if (e.button !== 0) return; // Left mouse button only.
        e.preventDefault();

        const rowHeading = this;
        const clickedCell = cellParser.toCell(rowHeading);

        if (e.shiftKey && !e.ctrlKey) {

            const minY = Math.min(clickedCell.y, selection.focussedCell().y);
            const maxY = Math.max(clickedCell.y, selection.focussedCell().y);

            selection.clearSelectedRects();
            const selectedRects = [];

            for (let y = minY; y <= maxY; y++) {

                selectedRects.push({
                    startCell: { x: 0, y },
                    endCell: { x: firstLastCell.getLastCell().x, y },
                    selectionType: "row"
                });
            }

            selection.selectedRects(selectedRects);
        }
        else if (e.ctrlKey) { // Ctrl-clicking on a row heading toggles the row.

            selection.toggleRow(selection.state, clickedCell.y);
        }
        else { // Clicking normally on a row heading selects the row.

            selection.clearSelectedRects();

            selection.dragRect({
                startCell: { x: 0, y: clickedCell.y },
                endCell: { x: firstLastCell.getLastCell().x, y: clickedCell.y },
                selectionType: "row"
            });

            selection.focussedCell({ x: 0, y: clickedCell.y });
        }

        selection.isMouseDown(true);
        selection.selectionType(selection.selectionType() === "column" ? "cell" : "row");

        updateUI();
    };

    const dataGridRowHeadingMouseOver = function () {

        if (!selection.isMouseDown()) return;
        if (selection.dragRectSelectionType() !== "row") return;

        const rowHeading = this;
        const cell = cellParser.toCell(rowHeading);

        selection.dragRect().endCell = { x: firstLastCell.getLastCell().x, y: cell.y };

        updateUI();
    };

    const dataGridRowHeadingMouseUp = function (e) {

        if (e.button !== 0) return; // Left mouse button only.
        e.preventDefault();

        if (!selection.dragRect()) return;

        // A rect per row, so that Ctrl-clicking a row heading can remove just that one.

        const rectExtent = selection.dragRectExtent();

        const selectedRects = selection.selectedRects();

        for (let y = rectExtent.minY; y <= rectExtent.maxY; y++) {

            selectedRects.push({
                startCell: { x: 0, y },
                endCell: { x: firstLastCell.getLastCell().x, y },
                selectionType: "row"
            });
        }

        selection.clearDragRect();
        selection.isMouseDown(false);

        updateUI();
    };

    const dataGridRowHeadingRightClick = function (e) {

        e.preventDefault();

        const clickedCell = cellParser.toCell(this);

        if (selection.selectedRects().some(rect =>
            rect.startCell.y === clickedCell.y &&
            rect.selectionType === "row")
        ) {

            return;
        }

        selection.clearSelectedRects();

        selection.dragRect({
            startCell: { x: 0, y: clickedCell.y },
            endCell: { x: firstLastCell.getLastCell().x, y: clickedCell.y },
            selectionType: "row"
        });

        selection.focussedCell({ x: 0, y: clickedCell.y });
        selection.selectionType("row");

        updateUI();
    };

    /**
     * Finalises a drag selection by the type of drag in progress rather than the element under the
     * pointer, so that it also serves a mouse leaving the grid mid-drag.
     */
    const finalizeDragOnMouseUp = (e) => {

        const dragType = selection.dragRectSelectionType();

        if (dragType === "column") {
            dataGridColumnHeadingOnMouseUp(e);
        }
        else if (dragType === "row") {

            dataGridRowHeadingMouseUp(e);
        }
        else if (dragType === "cell") {

            dataGridCellOnMouseUp(e);
        }
    };

    return {
        dataGridColumnHeadingOnMouseDown,
        dataGridColumnHeadingOnMouseOver,
        dataGridColumnHeadingOnMouseUp,
        dataGridColumnHeadingRightClick,
        dataGridCellOnMouseDown,
        dataGridCellOnMouseOver,
        dataGridCellOnMouseUp,
        dataGridCellOnRightClick,
        dataGridRowHeadingMouseDown,
        dataGridRowHeadingMouseOver,
        dataGridRowHeadingMouseUp,
        dataGridRowHeadingRightClick,
        selectRow,
        onDblClick,
        finalizeDragOnMouseUp
    };
};
