/**
 * Renders a task board: a heading for each of its columns, and beneath them its lanes, which are
 * its children (see Ren.VisualisationContainers).  Each lane has a cell per column, so the board
 * is laid out as a grid.  A column's heading and subheading are each edited from the context menu
 * of its own element, and an empty one is shown as a placeholder while the heading is hovered, so
 * that it can be right-clicked to fill it in.  Columns are added and removed from the headings'
 * menu, moved by holding the mouse button down on a heading and dragging it, and each column (and
 * the lanes' headings) is resized by dragging its right edge.
 */
Ren.CreateTaskBoard = (_tabularData, visualisation) => {

    const EMPTY_CLASS_NAME = "ren-task-board__part--empty";
    const RESIZING_CLASS_NAME = "ren-task-board--resizing";
    const MIN_WIDTH_PX = 48;

    // As for dragging a task tile (see Ren.VisualisationContainerEditing).
    const HOLD_DURATION_MS = 500;
    const HOLD_MOVE_TOLERANCE_PX = 5;

    const COLUMN_DRAGGING_CLASS_NAME = "ren-task-board__column-heading--dragging";
    const DRAGGING_COLUMN_CLASS_NAME = "ren-task-board--dragging-column";
    const CELL_DRAGGING_CLASS_NAME = "ren-task-lane__cell--dragging";
    const SHIFTING_CLASS_NAME = "ren-task-board__shifting";

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskBoard", {});

    const headerElement = element.querySelector(".js-ren-task-board-header");
    const laneHeadingColumnElement =
        element.querySelector(".js-ren-task-board-lane-heading-column");
    const lanesElement = element.querySelector(".js-ren-task-board-lanes");
    const questionsElement = element.querySelector(".js-ren-task-board-questions");
    const questionListElement = element.querySelector(".js-ren-task-board-question-list");

    if (!visualisation.columns) {
        visualisation.columns = [];
    }

    const columns = visualisation.columns;

    // Downloaded reports cannot save their settings back, so there would be nothing to keep an
    // edit.
    const isEditable = !Ren.UrlContext.isDownloadedReport();

    if (!isEditable) {
        element.classList.add("ren-task-board--read-only");
    }

    if (visualisation.moduleCssClass) {

        const cssClasses = visualisation.moduleCssClass.split(" ");

        for (let index = 0; index < cssClasses.length; index++) {

            if (cssClasses[index]) element.classList.add(cssClasses[index]);
        }
    }

    const getLaneHeadingWidth = () =>
        visualisation.laneHeadingWidth || "var(--ren-task-board-lane-heading-width, 11rem)";

    const getColumnWidth = (column) =>
        column.width ||
        visualisation.columnWidth ||
        "var(--ren-task-board-column-width, 18rem)";

    /**
     * Lays the header and the lanes out to the widths of the lanes' headings and the columns.  A
     * board with no columns still has one, as a lane then has a single cell.
     */
    const setGridColumns = (orderedColumns = columns) => {

        const widths = [getLaneHeadingWidth()];

        for (let index = 0; index < orderedColumns.length; index++) {
            widths.push(getColumnWidth(orderedColumns[index]));
        }

        if (columns.length === 0) {
            widths.push(getColumnWidth({}));
        }

        element.style.setProperty("--ren-task-board-grid-columns", widths.join(" "));
    };

    /**
     * Draws the board and its lanes again, for each lane to have a cell for each column.
     */
    const recreateBoardAndLanes = () => {

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);

        const lanes = Ren.VisualisationContainers.getChildren(visualisation);
        const hostElement = visualisation.element;

        // Held at its height until the board and its lanes are drawn again, as the page would
        // otherwise be shorter for a moment, and the browser would scroll it up to fit.
        hostElement.style.minHeight = hostElement.offsetHeight + "px";

        const renderedListener = Ren.Messages.Events.visualisationRendered.handle(() => {

            if (!visualisation.isRendered || !lanes.every(lane => lane.isRendered)) return;

            hostElement.style.minHeight = "";
            Ren.Messages.removeListener(renderedListener);
        });

        // Their cells are registered again in the columns' new order, so that a tile in no column
        // goes in the first, and none goes in a removed one.
        for (let index = 0; index < lanes.length; index++) {

            Ren.VisualisationContainers.forgetContainer(lanes[index]);
            lanes[index].recreate();
        }

        Ren.VisualisationContainers.forgetContainer(visualisation);
        visualisation.recreate();
    };

    const generateColumnId = () => {

        let number = columns.length + 1;

        while (columns.some(column => column.id === "column-" + number)) {
            number++;
        }

        return "column-" + number;
    };

    const addColumn = (index) => {

        columns.splice(index, 0, { id: generateColumnId(), heading: "New column" });

        recreateBoardAndLanes();
    };

    /**
     * Gets a value indicating whether a lane has a task in the given column.
     */
    const hasTasks = (column) => Ren.VisualisationContainers
        .getChildren(visualisation)
        .some(lane => Ren.VisualisationContainers.getChildren(lane, column.id).length > 0);

    const removeColumn = (column) => {

        Ren.PopupConfirm(
            "Remove this column?",
            "Remove column",
            () => {

                columns.splice(columns.indexOf(column), 1);

                recreateBoardAndLanes();
            }
        );
    };

    /**
     * Gets the column whose heading was right-clicked, or null for a click elsewhere in the header.
     */
    const getClickedColumn = () => {

        const columnHeadingElement =
            Ren.LastRightClickTarget?.closest(".js-ren-task-board-column-heading");

        if (!columnHeadingElement || !headerElement.contains(columnHeadingElement)) return null;

        return columns[Number(columnHeadingElement.getAttribute("data-column-index"))] ?? null;
    };

    const getColumnMenuItems = () => {

        const column = getClickedColumn();

        const items = [{
            section: "Task board",
            text: column ? "Add column after" : "Add column",
            id: "task-board-add-column",
            action: () => addColumn(column ? columns.indexOf(column) + 1 : columns.length)
        }];

        // Its tasks would otherwise move to the first column.
        if (column && !hasTasks(column)) {

            items.push({
                section: "Task board",
                text: "Remove column...",
                id: "task-board-remove-column",
                positionAtEndOfSection: true,
                action: () => removeColumn(column)
            });
        }

        return items;
    };

    /**
     * Puts a handle on the given element's right edge, which is dragged to set its width (by
     * the given function, given a CSS length or null for the default) and double-clicked to go
     * back to the default.
     */
    const addResizeHandle = (cellElement, setWidth) => {

        const handleElement = document.createElement("div");
        handleElement.className = "ren-task-board__resize-handle qa-ren-task-board-resize-handle";

        cellElement.appendChild(handleElement);

        let startX = 0;
        let startWidth = 0;
        let width = null;

        const onPointerMove = (event) => {

            width = Math.max(MIN_WIDTH_PX, startWidth + event.clientX - startX);

            setWidth(width + "px");
            setGridColumns();
        };

        const onPointerUp = () => {

            handleElement.removeEventListener("pointermove", onPointerMove);
            handleElement.removeEventListener("pointerup", onPointerUp);
            handleElement.removeEventListener("pointercancel", onPointerUp);
            element.classList.remove(RESIZING_CLASS_NAME);

            if (width === null) return;

            // Saved in rems, to the nearest quarter, like the widths written by hand.
            const remSize = parseFloat(getComputedStyle(document.documentElement).fontSize);

            setWidth(Math.round(width / remSize * 4) / 4 + "rem");
            setGridColumns();

            Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        };

        handleElement.addEventListener("pointerdown", (event) => {

            if (event.button !== 0) return;

            // So that it isn't also the start of dragging the board, or of selecting text.
            event.preventDefault();
            event.stopPropagation();

            startX = event.clientX;
            startWidth = cellElement.getBoundingClientRect().width;
            width = null;

            handleElement.setPointerCapture(event.pointerId);
            handleElement.addEventListener("pointermove", onPointerMove);
            handleElement.addEventListener("pointerup", onPointerUp);
            handleElement.addEventListener("pointercancel", onPointerUp);
            element.classList.add(RESIZING_CLASS_NAME);
        });

        handleElement.addEventListener("dblclick", () => {

            setWidth(null);
            setGridColumns();

            Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        });
    };

    const getColumnHeadingElements = () => Array.prototype.slice.call(
        headerElement.querySelectorAll(".js-ren-task-board-column-heading")
    );

    /**
     * Puts the columns in the order their headings are now in, and draws the board again if that
     * has changed it.
     */
    const commitColumnOrder = () => {

        const headingElements = getColumnHeadingElements();
        const reorderedColumns = [];
        let isChanged = false;

        for (let index = 0; index < headingElements.length; index++) {

            const columnIndex = Number(headingElements[index].getAttribute("data-column-index"));

            reorderedColumns.push(columns[columnIndex]);

            if (columnIndex !== index) isChanged = true;
        }

        if (!isChanged) return;

        for (let index = 0; index < reorderedColumns.length; index++) {
            columns[index] = reorderedColumns[index];
        }

        recreateBoardAndLanes();
    };

    const getCellElements = () => Array.prototype.slice.call(
        lanesElement.querySelectorAll(".js-ren-task-lane-cell")
    );

    const getCellColumnId = (cellElement) =>
        cellElement.getAttribute(Ren.VisualisationContainers.SLOT_ATTRIBUTE_NAME);

    /**
     * Gets where the given element is laid out, leaving out the translation it is sliding by.
     */
    const getLayoutRect = (shownElement) => {

        const rect = shownElement.getBoundingClientRect();
        const transform = getComputedStyle(shownElement).transform;

        if (transform === "none") return rect;

        const matrix = new DOMMatrixReadOnly(transform);

        return new DOMRect(rect.x - matrix.m41, rect.y - matrix.m42, rect.width, rect.height);
    };

    /**
     * Shows the columns in the order their headings are in, each lane's cells following them,
     * and slides the headings and cells from where they were shown to where they now go.
     */
    const showColumnsInHeadingOrder = () => {

        const headingElements = getColumnHeadingElements();
        const cellElements = getCellElements();
        const elements = headingElements.concat(cellElements);
        const orderedColumns = [];

        for (let index = 0; index < headingElements.length; index++) {

            const columnIndex = Number(headingElements[index].getAttribute("data-column-index"));

            orderedColumns.push(columns[columnIndex]);
        }

        const oldRects = [];

        for (let index = 0; index < elements.length; index++) {

            oldRects.push(elements[index].getBoundingClientRect());
            elements[index].classList.remove(SHIFTING_CLASS_NAME);
            elements[index].style.transform = "";
        }

        setGridColumns(orderedColumns);

        // Appended in the columns' new order, each after its lane's heading and earlier cells.
        for (let index = 0; index < orderedColumns.length; index++) {

            for (let cellIndex = 0; cellIndex < cellElements.length; cellIndex++) {

                const cellElement = cellElements[cellIndex];

                if (getCellColumnId(cellElement) === orderedColumns[index].id) {
                    cellElement.parentElement.appendChild(cellElement);
                }
            }
        }

        const shiftedElements = [];

        for (let index = 0; index < elements.length; index++) {

            const newRect = elements[index].getBoundingClientRect();
            const offsetX = oldRects[index].left - newRect.left;
            const offsetY = oldRects[index].top - newRect.top;

            if (offsetX === 0 && offsetY === 0) continue;

            elements[index].style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            shiftedElements.push(elements[index]);
        }

        // Makes the browser lay them out where they were shown, so their transitions start there.
        element.getBoundingClientRect();

        for (let index = 0; index < shiftedElements.length; index++) {

            shiftedElements[index].classList.add(SHIFTING_CLASS_NAME);
            shiftedElements[index].style.transform = "";
        }
    };

    /**
     * Puts the columns back in their order, after a drag that was given up.
     */
    const restoreColumnOrder = () => {

        const headingElements = getColumnHeadingElements();

        headingElements.sort((first, second) =>
            Number(first.getAttribute("data-column-index")) -
            Number(second.getAttribute("data-column-index"))
        );

        for (let index = 0; index < headingElements.length; index++) {
            headerElement.appendChild(headingElements[index]);
        }

        showColumnsInHeadingOrder();
    };

    /**
     * Moves the dragged heading before the first other heading whose middle is right of the point,
     * and its column with it.
     */
    const moveDraggedHeading = (headingElement, clientX) => {

        const otherElements = getColumnHeadingElements()
            .filter(otherElement => otherElement !== headingElement);

        let nextElement = null;

        for (let index = 0; index < otherElements.length; index++) {

            const rect = getLayoutRect(otherElements[index]);

            if (clientX < rect.left + rect.width / 2) {

                nextElement = otherElements[index];
                break;
            }
        }

        if (headingElement.nextElementSibling === nextElement) return;

        headerElement.insertBefore(headingElement, nextElement);
        showColumnsInHeadingOrder();
    };

    /**
     * Marks or unmarks the cells of the column being dragged.
     */
    const markDraggedCells = (headingElement, isDragged) => {

        const columnIndex = Number(headingElement.getAttribute("data-column-index"));
        const columnId = columns[columnIndex].id;
        const cellElements = getCellElements();

        for (let index = 0; index < cellElements.length; index++) {

            if (getCellColumnId(cellElements[index]) === columnId) {
                cellElements[index].classList.toggle(CELL_DRAGGING_CLASS_NAME, isDragged);
            }
        }
    };

    /**
     * Lets a column be picked up by holding the mouse button down on its heading for half a
     * second, as a task tile is, and dropped where it is to go.  Escape puts it back.
     */
    const addColumnDragging = (headingElement) => {

        let hold = null;
        let isDragging = false;

        const onKeyDown = (event) => {

            if (event.key === "Escape") endDrag(false);
        };

        const endDrag = (isCommitted) => {

            if (hold) {

                clearTimeout(hold.timer);
                hold = null;
            }

            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("pointercancel", onPointerCancel);
            document.removeEventListener("keydown", onKeyDown);

            if (!isDragging) return;

            isDragging = false;

            headingElement.classList.remove(COLUMN_DRAGGING_CLASS_NAME);
            element.classList.remove(DRAGGING_COLUMN_CLASS_NAME);
            markDraggedCells(headingElement, false);

            if (isCommitted) {
                commitColumnOrder();
            }
            else {

                restoreColumnOrder();
            }
        };

        const onPointerMove = (event) => {

            if (hold) {

                const movedX = Math.abs(event.clientX - hold.startX);
                const movedY = Math.abs(event.clientY - hold.startY);

                if (movedX > HOLD_MOVE_TOLERANCE_PX || movedY > HOLD_MOVE_TOLERANCE_PX) {
                    endDrag(false);
                }

                return;
            }

            if (isDragging) {
                moveDraggedHeading(headingElement, event.clientX);
            }
        };

        const onPointerUp = () => endDrag(true);
        const onPointerCancel = () => endDrag(false);

        headingElement.addEventListener("pointerdown", (event) => {

            if (event.button !== 0 || hold || isDragging) return;

            // So that it isn't also the start of dragging the board itself.
            event.stopPropagation();

            // On the document, as moving the heading among the others loses a pointer capture.
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
            document.addEventListener("pointercancel", onPointerCancel);

            hold = {
                startX: event.clientX,
                startY: event.clientY,
                timer: setTimeout(() => {

                    hold = null;
                    isDragging = true;

                    headingElement.classList.add(COLUMN_DRAGGING_CLASS_NAME);
                    element.classList.add(DRAGGING_COLUMN_CLASS_NAME);
                    markDraggedCells(headingElement, true);
                    document.addEventListener("keydown", onKeyDown);
                }, HOLD_DURATION_MS)
            };
        });
    };

    const showPart = (partElement, value) => {

        partElement.textContent = value ?? "";
        partElement.classList.toggle(EMPTY_CLASS_NAME, !value);
    };

    /**
     * Sets a column's heading or subheading, removing it when it is cleared.
     */
    const setColumnProperty = (column, propertyName, value, partElement) => {

        const trimmedValue = value.trim();

        if (trimmedValue) {
            column[propertyName] = trimmedValue;
        }
        else {

            delete column[propertyName];
        }

        showPart(partElement, column[propertyName]);

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const addColumnMenuItem = (column, partElement, text, id, propertyName) => {

        Ren.AddContextMenuItems(partElement, () => [{
            section: "Task board",
            text: text,
            id: id,
            action: () => Ren.CreateOkCancelTextEditorPopupWindow(
                text.replace("...", ""),
                (value) => setColumnProperty(column, propertyName, value, partElement),
                {
                    initialText: column[propertyName] ?? "",
                    multiline: false,
                    width: 400,
                    height: 110
                }
            )
        }]);
    };

    const addColumnHeading = (column, columnIndex) => {

        const columnHeadingElement =
            Ren.HtmlTemplateFunctions.reifyHtmlTemplate("TaskBoardColumnHeading", {});

        const headingElement = columnHeadingElement.querySelector(".js-ren-task-board-heading");
        const subheadingElement = columnHeadingElement.querySelector(".js-ren-task-board-subheading");

        columnHeadingElement.setAttribute("data-column-index", String(columnIndex));

        showPart(headingElement, column.heading);
        showPart(subheadingElement, column.subheading);

        if (isEditable) {

            addColumnMenuItem(
                column,
                headingElement,
                "Edit heading...",
                "task-board-edit-heading",
                "heading"
            );

            addColumnMenuItem(
                column,
                subheadingElement,
                "Edit subheading...",
                "task-board-edit-subheading",
                "subheading"
            );

            addResizeHandle(columnHeadingElement, (width) => {

                if (width) {
                    column.width = width;
                }
                else {

                    delete column.width;
                }
            });

            addColumnDragging(columnHeadingElement);
        }

        headerElement.appendChild(columnHeadingElement);
    };

    for (let index = 0; index < columns.length; index++) {
        addColumnHeading(columns[index], index);
    }

    if (isEditable) {

        Ren.AddContextMenuItems(headerElement, getColumnMenuItems);

        addResizeHandle(laneHeadingColumnElement, (width) => {

            if (width) {
                visualisation.laneHeadingWidth = width;
            }
            else {

                delete visualisation.laneHeadingWidth;
            }
        });
    }

    setGridColumns();

    const showQuestionsWidth = () => {
        questionsElement.style.width = visualisation.questionsWidth ?? "";
    };

    showQuestionsWidth();

    if (isEditable) {

        addResizeHandle(questionsElement, (width) => {

            if (width) {
                visualisation.questionsWidth = width;
            }
            else {

                delete visualisation.questionsWidth;
            }

            showQuestionsWidth();
        });
    }

    const endShifting = (event) => {

        if (event.propertyName === "transform") {
            event.target.classList.remove(SHIFTING_CLASS_NAME);
        }
    };

    element.addEventListener("transitionend", endShifting);
    element.addEventListener("transitioncancel", endShifting);

    /**
     * Lists the task questions in the board's tiles (see Ren.CreateTaskTile), each after its
     * task's ID.
     */
    const showQuestions = () => {

        const lineElements = lanesElement.querySelectorAll(".ren-task-tile__question");

        questionListElement.textContent = "";

        for (let index = 0; index < lineElements.length; index++) {

            const tileElement = lineElements[index].closest(".ren-task-tile");
            const taskId = tileElement.querySelector(".js-ren-task-tile-id").textContent;

            const idElement = document.createElement("span");
            idElement.className = "ren-task-board__question-id";
            idElement.textContent = taskId;

            if (taskId) {
                idElement.setAttribute("data-task-id", taskId);
            }

            const textElement = document.createElement("span");
            textElement.className = "ren-task-board__question-text";

            const lineNodes = lineElements[index].childNodes;

            for (let nodeIndex = 0; nodeIndex < lineNodes.length; nodeIndex++) {
                textElement.appendChild(lineNodes[nodeIndex].cloneNode(true));
            }

            questionListElement.appendChild(idElement);
            questionListElement.appendChild(textElement);
        }

        questionsElement.hidden = lineElements.length === 0;
    };

    /**
     * Gets the task ID of the task ID or tile reference under the given event's target, or null.
     */
    const getEventTaskId = (event) =>
        event.target.closest?.("[data-task-id]")?.getAttribute("data-task-id") ?? null;

    questionListElement.addEventListener("click", (event) => {

        const taskId = getEventTaskId(event);

        if (taskId) {
            Ren.TaskBoardHighlights.goToTile(visualisation.visualisationId, taskId);
        }
    });

    questionListElement.addEventListener("mouseover", (event) => {

        const taskId = getEventTaskId(event);

        Ren.TaskBoardHighlights.showHoveredTiles(
            visualisation.visualisationId,
            taskId ? [taskId] : []
        );
    });

    questionListElement.addEventListener("mouseleave", () =>
        Ren.TaskBoardHighlights.showHoveredTiles(visualisation.visualisationId, [])
    );

    // Listed again once a frame at most while tiles are drawn, placed, edited or removed.
    let isQuestionsUpdatePending = false;

    new MutationObserver(() => {

        if (isQuestionsUpdatePending) return;

        isQuestionsUpdatePending = true;

        requestAnimationFrame(() => {

            isQuestionsUpdatePending = false;
            showQuestions();
        });
    }).observe(lanesElement, { childList: true, subtree: true });

    Ren.VisualisationContainers.registerChildrenElement(visualisation, lanesElement);

    return {
        element
    };
};
