/**
 * Manages the resize handles for columns in a datagrid.
 */
Ren.CreateDataGridColumnResizeHandles = (
    dataGridGuid,
    columnCount,
    freezePanesCoords,
    dataGridSections,
    gridState,
    dataGridColumnLeftPositions,
    transitionSuppression
) => {

    let columnResizeHandleBeingDragged = null;
    let columnResizeHandleColumnIndex = -1;
    let columnResizeHandle_InitWidth = -1;
    let columnResizeHandle_InitX = -1;

    // Styles that apply during the dragging of a column resize handle.
    const dragStylesheet = Ren.DynamicStylesheets
        .setupDynamicStylesheet(dataGridGuid, "dataGrid-drag")
        .getStylesheet();

    const isColumnResizeHandleVisible = [];
    const updateColumnResizeHandleVisibility = () => {

        isColumnResizeHandleVisible.length = columnCount;

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

            const visible = gridState.isColumnVisible(columnIndex);

            if (isColumnResizeHandleVisible[columnIndex] === visible) continue;

            const selector = `.${dataGridGuid} .ren-data-grid__column-resize-handle.ren-c-${columnIndex + 1}`;
            const columnResizeHandles = dataGridSections.frozenTopLeftSection.querySelectorAll(selector);
            columnResizeHandles.forEach(handle => {

                handle.classList.toggle("ren-data-grid__column-resize-handle--hidden", !visible);
            });
            isColumnResizeHandleVisible[columnIndex] = visible;
        }
    };

    const renderColumnResizeHandles = () => {

        for (let columnIndex = columnCount - 1; columnIndex >= 0; columnIndex--) {

            const columnResizeHandleClass = "ren-data-grid__column-resize-handle ren-c-" + (columnIndex + 1);

            const columnHeadingResizeHandle = Ren.HtmlUtils.create("div")
                ._addClass(columnResizeHandleClass);

            const mainSectionColumnResizeHandle = Ren.HtmlUtils.create("div")
                ._addClass(
                    columnResizeHandleClass,
                    "ren-r-0"
                );

            if (columnIndex === columnCount - 1) {
                mainSectionColumnResizeHandle.style.marginLeft = "-6px";
            }

            if (columnIndex < freezePanesCoords.x) {

                dataGridSections.frozenTopLeftSection.appendChild(columnHeadingResizeHandle);
                dataGridSections.frozenLeftSection.appendChild(mainSectionColumnResizeHandle);
            }
            else {

                dataGridSections.frozenTopSection.appendChild(columnHeadingResizeHandle);
                dataGridSections.dataGridMainSection.appendChild(mainSectionColumnResizeHandle);
            }

            const onDblClick = function (columnIndex) {

                gridState.makeColumnFullWidth(columnIndex);
                Ren.Messages.Events.columnResized.notify();
                window.getSelection().empty();
            };

            columnHeadingResizeHandle.addEventListener("dblclick", () => onDblClick(columnIndex));
            mainSectionColumnResizeHandle.addEventListener("dblclick", () => onDblClick(columnIndex));

            const onMouseDown = function (e, columnIndex) {

                if (!gridState.isColumnVisible(columnIndex)) return;

                columnResizeHandleBeingDragged = e.target;
                columnResizeHandleColumnIndex = columnIndex;
                columnResizeHandle_InitX = e.pageX;
                columnResizeHandle_InitWidth = gridState.getColumnWidth(columnIndex);

                dragStylesheet.textContent = "* { user-select: none; }";

                transitionSuppression.suppressTransitions();

                addDragListeners();
            };

            columnHeadingResizeHandle.addEventListener("mousedown", (e) => onMouseDown(e, columnIndex));
            mainSectionColumnResizeHandle.addEventListener("mousedown", (e) => onMouseDown(e, columnIndex));
        }
    };

    renderColumnResizeHandles();

    const handleMouseMove = (e) => {

        // Reposition and enlarge the dragging handle during dragging, so that if the user moves
        // the mouse too fast, the handle doesn't get left behind.

        const resizeHandle = columnResizeHandleBeingDragged;

        const left = dataGridColumnLeftPositions.columnLeftPositions[columnResizeHandleColumnIndex] +
            gridState.getColumnWidth(columnResizeHandleColumnIndex) - 100;
        resizeHandle.style.left = left;
        resizeHandle.style.width = 200;
        resizeHandle.style.height = 1000;

        gridState.draggingColumnResizeHandle = true;

        gridState.setColumnWidth(
            columnResizeHandleColumnIndex,
            columnResizeHandle_InitWidth + e.pageX - columnResizeHandle_InitX
        );
    };

    const documentMouseMoveHandler = (e) => {

        if (columnResizeHandleBeingDragged === null) return;

        handleMouseMove(e);
    };

    // Called from IVTs.  Resizes a column if the data grid is visible.
    Ren.Messages.Requests.qaColumnWidthChange.handle((columnIndex, columnWidth) => {

        const dataGrids = document.querySelectorAll("." + dataGridGuid);

        dataGrids.forEach(dataGrid => {

            if (dataGrid.offsetWidth) { // If visible

                gridState.setColumnWidth(columnIndex, columnWidth);

                Ren.Messages.Events.columnResized.notify();
            }
        });
    });

    const endColumnResize = () => {

        removeDragListeners();

        // Restore the dragging handle to its original size and position.
        columnResizeHandleBeingDragged.style.left = "";
        columnResizeHandleBeingDragged.style.width = "";
        columnResizeHandleBeingDragged.style.height = "";

        columnResizeHandleBeingDragged = null;
        columnResizeHandleColumnIndex = -1;
        columnResizeHandle_InitWidth = -1;
        columnResizeHandle_InitX = -1;

        dragStylesheet.textContent = "";

        transitionSuppression.restoreTransitions();

        delete gridState.draggingColumnResizeHandle;

        Ren.Messages.Events.gridStateChanged.notify(gridState);
    };

    const endDrag = () => {

        if (columnResizeHandleBeingDragged === null) return;

        endColumnResize();
    };

    // Held on the document only for the duration of a drag.  Left there for the life of the page
    // they would outlive the grid they close over, keeping it and its state in memory long after it
    // had been re-rendered or removed.
    const addDragListeners = () => {

        document.addEventListener("mousemove", documentMouseMoveHandler);
        document.addEventListener("mouseleave", endDrag);
        document.addEventListener("mouseup", endDrag);
    };

    const removeDragListeners = () => {

        document.removeEventListener("mousemove", documentMouseMoveHandler);
        document.removeEventListener("mouseleave", endDrag);
        document.removeEventListener("mouseup", endDrag);
    };

    Ren.Messages.Events.columnVisibilityChanged.handle(updateColumnResizeHandleVisibility);
};
