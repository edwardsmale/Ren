/**
 * Provides drag-and-drop functionality to reorder columns in the data grid.  When a user clicks
 * and holds a column header, they can drag it left/right to reorder columns.
 */
Ren.DataGridColumnDrag = (gridState, gridContainer, transitionSuppression) => {

    let draggedElement = null;
    let draggedColumnIndex = null;
    let originalColumnOrder = null;
    let dragDelayTimer = null;
    let isActuallyDragging = false;
    let mouseDownX = null;
    let mouseDownY = null;
    let cachedHeaders = null;
    let lastUpdateClientX = null;
    let pendingNotifications = false;
    let notificationTimer = null;
    let lastReorderedPair = null;
    let previousBodyCursor = "";

    const DRAG_DELAY_MS = 600;
    const MOUSE_MOVE_TOLERANCE_PX = 2;
    const NOTIFICATION_DEBOUNCE_MS = 100;

    /**
     * Gets all visible column header elements in order.
     */
    const getVisibleColumnHeaders = () => {

        const headers = [];
        const allHeaders = gridContainer.querySelectorAll(".ren-data-grid__column-heading, .ren-data-grid__cell.ren-r-0");

        allHeaders.forEach(header => {

            const match = header.className.match(/ren-c-(\d+)/);

            if (match) {

                const columnIndex = parseInt(match[1], 10);

                if (gridState.isColumnVisible(columnIndex)) {

                    headers.push({ element: header, columnIndex });
                }
            }
        });

        return headers;
    };

    /**
     * Finds the column header under the mouse, accounting for overlap threshold.
     */
    const getColumnHeaderUnderMouseCached = (clientX, headers) => {

        let targetHeader = null;
        let maxOverlap = 0;

        headers.forEach(({ element, columnIndex }) => {

            const rect = element.getBoundingClientRect();
            const overlap = Math.min(clientX - rect.left, rect.right - clientX);

            if (clientX >= rect.left && clientX <= rect.right && overlap >= 8 &&
                overlap > maxOverlap && columnIndex !== draggedColumnIndex) {

                maxOverlap = overlap;
                targetHeader = { element, columnIndex };
            }
        });

        return targetHeader;
    };

    /**
     * Updates the visual representation during drag (temporarily reorders columns).
     */
    const updateColumnOrderDuringDrag = (clientX) => {

        const targetHeader = getColumnHeaderUnderMouseCached(clientX, cachedHeaders);

        if (!targetHeader) {

            lastReorderedPair = null;
            return;
        }

        const currentOrder = gridState.columnOrder;
        const draggedPos = currentOrder.indexOf(draggedColumnIndex);
        const targetPos = currentOrder.indexOf(targetHeader.columnIndex);

        if (draggedPos === -1 || targetPos === -1 || draggedPos === targetPos) return;

        const pairId = [Math.min(draggedColumnIndex, targetHeader.columnIndex),
                        Math.max(draggedColumnIndex, targetHeader.columnIndex)].join('-');

        if (lastReorderedPair === pairId) return;
        lastReorderedPair = pairId;

        const newOrder = currentOrder.slice();
        newOrder.splice(draggedPos, 1);
        newOrder.splice(targetPos, 0, draggedColumnIndex);
        // Directly mutate the columnOrder array so watchers observe the change immediately.
        gridState.columnOrder.length = 0;

        for (let i = 0; i < newOrder.length; i++) {
            gridState.columnOrder.push(newOrder[i]);
        }

        if (pendingNotifications) return;

        pendingNotifications = true;
        clearTimeout(notificationTimer);
        notificationTimer = setTimeout(() => {

            // Restored, and the restoration forced to take effect, before the columns are moved
            // below, so that they slide into their new positions rather than jumping there.
            transitionSuppression.restoreTransitions();
            void gridContainer.offsetHeight;

            Ren.Messages.Events.columnsMoved.notify();
            Ren.Messages.Requests.repaint.notify();
            pendingNotifications = false;
        }, NOTIFICATION_DEBOUNCE_MS);
    };

    /**
     * Initialises drag listeners on column headers.
     */
    const initialiseDragListeners = () => {

        const headers = gridContainer.querySelectorAll(".ren-data-grid__column-heading, .ren-data-grid__cell.ren-r-0");
        headers.forEach(header => header.addEventListener("mousedown", onHeaderMouseDown));
    };

    /**
     * Handles mousedown on a column header.
     */
    const onHeaderMouseDown = (e) => {

        if (e.which !== 1 || e.target.closest(".ren-data-grid__header-cell-down-arrow")) return;
        e.preventDefault();

        const match = e.currentTarget.className.match(/ren-c-(\d+)/);
        if (!match) return;

        // A press released outside the window sends no mouseup, so its timer could still be
        // pending, and would otherwise fire after this press's mouseup has cleared the drag.
        clearTimeout(dragDelayTimer);

        draggedColumnIndex = parseInt(match[1], 10);
        draggedElement = e.currentTarget;
        isActuallyDragging = false;
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        // Store the current column order.
        originalColumnOrder = gridState.columnOrder.slice();

        dragDelayTimer = setTimeout(() => {

            isActuallyDragging = true;
            draggedElement.classList.add("ren-data-grid__column-heading--dragging");

            transitionSuppression.suppressTransitions();

            cachedHeaders = getVisibleColumnHeaders();
            lastUpdateClientX = mouseDownX;
            previousBodyCursor = document.body.style.cursor;
            document.body.style.cursor = "grabbing";

            Ren.Messages.Events.dragStarted.notify();
            document.addEventListener("mousemove", onDocumentMouseMove);
            document.addEventListener("mouseup", onDocumentMouseUp);
        }, DRAG_DELAY_MS);

        const handleMouseMoveWhileWaiting = (moveEvent) => {

            const delta = Math.sqrt(Math.pow(moveEvent.clientX - mouseDownX, 2) +
                                   Math.pow(moveEvent.clientY - mouseDownY, 2));

            if (delta > MOUSE_MOVE_TOLERANCE_PX) {

                clearTimeout(dragDelayTimer);
                dragDelayTimer = null;
                document.removeEventListener("mousemove", handleMouseMoveWhileWaiting);
                document.removeEventListener("mouseup", handleMouseUpWhileWaiting);
            }
        };

        const handleMouseUpWhileWaiting = () => {

            clearTimeout(dragDelayTimer);
            dragDelayTimer = null;
            document.removeEventListener("mousemove", handleMouseMoveWhileWaiting);
            document.removeEventListener("mouseup", handleMouseUpWhileWaiting);
            draggedElement = null;
            draggedColumnIndex = null;
        };

        document.addEventListener("mousemove", handleMouseMoveWhileWaiting);
        document.addEventListener("mouseup", handleMouseUpWhileWaiting);
    };

    /**
     * Handles mousemove during drag.
     */
    const onDocumentMouseMove = (e) => {

        if (!isActuallyDragging || !draggedElement) return;
        e.preventDefault();

        if (Math.abs(e.clientX - lastUpdateClientX) > 10 || !lastUpdateClientX) {

            lastUpdateClientX = e.clientX;
            updateColumnOrderDuringDrag(e.clientX);
        }
    };

    /**
     * Handles mouseup to end the drag.
     */
    const onDocumentMouseUp = () => {

        clearTimeout(dragDelayTimer);
        clearTimeout(notificationTimer);
        document.removeEventListener("mousemove", onDocumentMouseMove);
        document.removeEventListener("mouseup", onDocumentMouseUp);

        if (isActuallyDragging) {

            document.body.style.cursor = previousBodyCursor;
            Ren.Messages.Events.dragEnded.notify();

            transitionSuppression.restoreTransitions();

            if (draggedElement) {

                draggedElement.classList.remove("ren-data-grid__column-heading--dragging");
                void draggedElement.offsetHeight;
            }

            if (!arraysEqual(originalColumnOrder, gridState.columnOrder)) {

                if (pendingNotifications) {

                    Ren.Messages.Events.columnsMoved.notify();
                    Ren.Messages.Requests.repaint.notify();
                    pendingNotifications = false;
                }
                Ren.Messages.Events.gridStateChanged.notify(gridState);
            }
        }
        else if (draggedElement) {

            draggedElement.classList.remove("ren-data-grid__column-heading--dragging");
        }

        draggedElement = null;
        draggedColumnIndex = null;
        isActuallyDragging = false;
        cachedHeaders = null;
        lastUpdateClientX = null;
        pendingNotifications = false;
        lastReorderedPair = null;
    };

    /**
     * Utility function to compare arrays.
     */
    const arraysEqual = (a, b) => a.length === b.length && a.every((val, index) => val === b[index]);

    // Reinitialize listeners when columns change.
    const reinitializeListeners = () => {

        const headers = gridContainer.querySelectorAll(".ren-data-grid__column-heading, .ren-data-grid__cell.ren-r-0");
        headers.forEach(header => {

            header.removeEventListener("mousedown", onHeaderMouseDown);
            header.addEventListener("mousedown", onHeaderMouseDown);
        });
    };

    Ren.Messages.Events.columnsMoved.handle(reinitializeListeners);
    Ren.Messages.Events.columnVisibilityChanged.handle(reinitializeListeners);

    return { initialiseDragListeners };
};
