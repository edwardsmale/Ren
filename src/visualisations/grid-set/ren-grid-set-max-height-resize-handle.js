/**
 * Adds a handle to the bottom edge of a grid set's viewport that drags its maximum height.  The
 * dragged height is kept apart from the markup's maxHeight, as resizedMaxHeight, so that
 * double-clicking the handle can return the grid set to the height it was declared with.
 */
Ren.GridSetMaxHeightResizeHandle = (
    visualisation,
    gridSet,
    gridSetViewport,
    visualisationStyles
) => {

    const MINIMUM_HEIGHT_PX = 60;

    // A popup sizes its grids to the window, and a positioned grid has a height of its own.
    const isResizable = !visualisation.isPopup &&
        !visualisation.isInsidePopup &&
        !visualisation.hasDimensions &&
        !Ren.UrlContext.onEditorPage();

    if (!isResizable) {

        return {
            updatePosition: () => { }
        };
    }

    const handle = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
        "GridSetMaxHeightResizeHandle",
        {}
    );

    gridSet.appendChild(handle);
    gridSet.classList.add("ren-grid-set--max-height-resizable");

    // The viewport otherwise shrinks to its rows, so a dragged height would stop at their bottom.
    const applyMinHeight = () => {

        gridSetViewport.style.minHeight = visualisation.resizedMaxHeight || "";
    };

    const applyMaxHeight = () => {

        visualisationStyles.setMaxWidthAndHeight(
            visualisation.maxWidth,
            visualisation.resizedMaxHeight || visualisation.maxHeight || "none",
            true // explicitMaxHeightSet
        );

        applyMinHeight();

        Ren.Messages.Requests.repaint.notify();
    };

    applyMinHeight();

    /**
     * Lines the handle up with the bottom edge of the viewport, whose height changes with the grid
     * set's rows and maximum height.
     */
    const updatePosition = () => {

        const offsetParent = handle.offsetParent;

        // The grid set is not displayed.
        if (!offsetParent) return;

        const parentRect = offsetParent.getBoundingClientRect();
        const viewportRect = gridSetViewport.getBoundingClientRect();

        const style = handle.style;

        style.left = (viewportRect.left - parentRect.left - offsetParent.clientLeft) + "px";
        style.top = (viewportRect.bottom - parentRect.top - offsetParent.clientTop) + "px";
        style.width = viewportRect.width + "px";
    };

    const startDrag = (mouseDownEvent) => {

        if (mouseDownEvent.button !== 0) return;

        mouseDownEvent.preventDefault();

        const initialHeight = gridSetViewport.offsetHeight;
        const initialMouseY = mouseDownEvent.pageY;

        const bodyStyle = document.body.style;
        const previousUserSelect = bodyStyle.userSelect;
        const previousCursor = bodyStyle.cursor;

        bodyStyle.userSelect = "none";
        bodyStyle.cursor = "row-resize";

        const mouseMoveHandler = (moveEvent) => {

            moveEvent.preventDefault();

            const height = Math.max(
                MINIMUM_HEIGHT_PX,
                Math.round(initialHeight + moveEvent.pageY - initialMouseY)
            );

            visualisation.resizedMaxHeight = height + "px";

            applyMaxHeight();
        };

        const endDrag = () => {

            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", endDrag);
            document.removeEventListener("mouseleave", endDrag);

            bodyStyle.userSelect = previousUserSelect;
            bodyStyle.cursor = previousCursor;

            // The height is now one of the grid set's saved settings.
            Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        };

        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", endDrag);
        document.addEventListener("mouseleave", endDrag);
    };

    const resetMaxHeight = () => {

        if (!visualisation.resizedMaxHeight) return;

        delete visualisation.resizedMaxHeight;

        applyMaxHeight();

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    handle.addEventListener("mousedown", (e) => startDrag(e));
    handle.addEventListener("dblclick", () => resetMaxHeight());

    return {
        updatePosition
    };
};
