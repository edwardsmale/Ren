/**
 * Attaches cell selection's mouse listeners to the datagrid container once, and works out from the
 * element under the pointer which handler each event belongs to.  Attaching them per cell, row
 * heading and column heading instead would mean thousands of listeners on a large grid, plus
 * re-attaching them every time rows are rendered.
 *
 * Row hover highlighting lives here too: delegation is what sees the mouse move between rows, so
 * the highlighted row is tracked here to be cleared when the pointer moves off it or leaves the
 * grid altogether.
 */
Ren.DataGridCellSelection_EventDelegation = (parts, handlers) => {

    const { visualisation, dataGridGuid, gridState, cellParser, selection } = parts;

    const {
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
        onDblClick,
        finalizeDragOnMouseUp
    } = handlers;

    const functionEditorCellPicker = Ren.DataGridCellSelection_FunctionEditorCellPicker(parts);

    const functionEditorPreviewSource =
        Ren.DataGridCellSelection_FunctionEditorPreviewSource(parts);

    const rowHoverStyles = Ren.DataGridCellSelection_RowHoverStyles(
        dataGridGuid,
        gridState,
        visualisation
    );

    // The row that currently has the hover highlight (heading-inclusive index), or -1 for none.
    // Because event delegation drives hovering, we track the highlighted row here so it can be
    // cleared when the mouse leaves the grid or moves off any row.
    let currentHoverRow = -1;

    const setRowHover = (r) => {

        currentHoverRow = r;
        rowHoverStyles.rowHoverMouseOver(r);
    };

    const clearRowHover = () => {

        if (currentHoverRow === -1) return;

        rowHoverStyles.rowHoverMouseLeave(currentHoverRow);
        currentHoverRow = -1;
    };

    /**
     * Resolves the datagrid element an event relates to, and the role it plays. Returns null if the
     * event did not occur on a selectable element.  A header cell (.ren-data-grid__cell.ren-h)
     * doubles as a column heading when the row & column headings strip is hidden (e.g. in popup
     * reports), where the .ren-data-grid__column-heading is display:none.
     */
    const resolveEventActor = (target) => {

        const columnHeading = target.closest(".ren-data-grid__column-heading");
        if (columnHeading) return { role: "column", element: columnHeading };

        const cell = target.closest(".ren-data-grid__cell");

        if (cell) {

            if (cell.classList.contains("ren-h") && !gridState.showRowAndColumnHeadings) {
                return { role: "column", element: cell };
            }

            return { role: "cell", element: cell };
        }

        const rowHeading = target.closest(".ren-data-grid__row-heading");
        if (rowHeading) return { role: "row", element: rowHeading };

        const groupCtrls = target.closest(".ren-data-grid__group-ctrls");
        if (groupCtrls) return { role: "groupCtrls", element: groupCtrls };

        return null;
    };

    /**
     * Attaches a single set of mouse-event listeners to the datagrid container and dispatches each
     * event to the appropriate handler based on the element under the pointer.  This replaces
     * attaching the same handlers to every cell, row heading and column heading individually.
     */
    const setupDelegatedEvents = (container) => {

        if (container.delegatedEventsAttached) return;
        container.delegatedEventsAttached = true;

        Ren.FunctionEditorAutoPreview.registerSource(container, functionEditorPreviewSource);

        container.addEventListener("mousedown", (e) => {

            const actor = resolveEventActor(e.target);
            if (!actor) return;

            // A cell clicked into a function editor's code is not selected.
            if (actor.role === "cell" &&
                functionEditorCellPicker.pick(e, actor.element, container)) {

                return;
            }

            // The user is making a selection of their own, so it is no longer the cell that Find
            // landed on.  Each handler below ends by refreshing the selection styles.
            selection.isFoundCell(false);

            if (actor.role === "column") {
                dataGridColumnHeadingOnMouseDown.call(actor.element, e);
            }
            else if (actor.role === "cell") {

                dataGridCellOnMouseDown.call(actor.element, e);
            }
            else if (actor.role === "row") {

                dataGridRowHeadingMouseDown.call(actor.element, e);
            }
        });

        container.addEventListener("mouseover", (e) => {

            const actor = resolveEventActor(e.target);

            if (!actor) { clearRowHover(); return; }

            if (actor.role === "column") {

                dataGridColumnHeadingOnMouseOver.call(actor.element, e);
                clearRowHover();
            }
            else if (actor.role === "cell") {

                // Only act if the cell is visible (a hidden column has zero-width cells).
                if (actor.element.offsetWidth) {

                    dataGridCellOnMouseOver(e, actor.element);
                    setRowHover(cellParser.getRowIndex(actor.element));
                }
            }
            else if (actor.role === "row") {

                dataGridRowHeadingMouseOver.call(actor.element, e);
                setRowHover(cellParser.getRowIndex(actor.element));
            }
            else if (actor.role === "groupCtrls") {

                setRowHover(cellParser.getRowIndex(actor.element));
            }
        });

        container.addEventListener("mouseup", (e) => {

            // Route by the element released over, matching the previous per-element handlers.  If
            // released over a gap (or a group-ctrl, which has no mouseup handler), fall back to
            // finalising by the type of drag in progress so the selection is never left dangling.
            const actor = resolveEventActor(e.target);

            if (actor && actor.role === "column") {
                dataGridColumnHeadingOnMouseUp(e);
            }
            else if (actor && actor.role === "cell") {

                dataGridCellOnMouseUp(e);
            }
            else if (actor && actor.role === "row") {

                dataGridRowHeadingMouseUp(e);
            }
            else {

                finalizeDragOnMouseUp(e);
            }
        });

        // Selects what was right-clicked before the menu's items, which look at the selection, are
        // built.
        Ren.ContextMenuRegistry.prepareForRightClick(container, (e) => {

            const actor = resolveEventActor(e.target);
            if (!actor) return;

            if (actor.role === "column") {
                dataGridColumnHeadingRightClick.call(actor.element, e);
            }
            else if (actor.role === "cell") {

                dataGridCellOnRightClick.call(actor.element, e);
            }
            else if (actor.role === "row") {

                dataGridRowHeadingRightClick.call(actor.element, e);
            }
        });

        container.addEventListener("dblclick", (e) => {

            const actor = resolveEventActor(e.target);
            if (!actor) return;

            if (actor.role === "cell") {

                // Header cells have no double-click action.
                if (actor.element.classList.contains("ren-h")) return;

                onDblClick(
                    e,
                    cellParser.getRowIndex(actor.element),
                    cellParser.getColumnIndex(actor.element)
                );
            }
            else if (actor.role === "row") {

                onDblClick(e, cellParser.getRowIndex(actor.element), -1);
            }
        });

        // When the mouse leaves the datagrid mid-drag, finalise the selection (the mouseup would
        // otherwise land outside the grid and be missed), and clear any row hover highlight.
        container.addEventListener("mouseleave", (e) => {

            finalizeDragOnMouseUp(e);
            clearRowHover();
        });
    };

    return { setupDelegatedEvents };
};
