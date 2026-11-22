/**
 * Manages dimension calculation and updates for a datagrid.
 */
Ren.DataGridDimensionManager = (
    tabularData,
    visualisation,
    dataGroupingSettings,
    dataGridGuid,
    dataGridSections,
    dataGridColumnLeftPositions,
    visualisationStyles,
    containerViewport,
    freezePanesCoords
) => {

    const dimensions = {
        frozenHeight: 0,
        frozenWidth: 0,
        dataGridWidth: 0,
        dataGridHeight: 0
    };

    let previousDimensions = Object.assign({}, dimensions);

    // A dragged height's min-height can hold the viewport below its rows, but the paging and stat
    // bars stay with the rows, at the height the grid set fitted to them.
    const getGridSetViewportHeight = () => {

        const height = containerViewport.offsetHeight;
        const fittedHeight = parseFloat(containerViewport.style.height);

        return fittedHeight < height ? fittedHeight : height;
    };

    /**
     * Gets how the grid set viewport sits in the popup's content, unscrolled.  Measured rather than
     * taken from offsetTop, whose offset parent may be any positioned element between the grid and
     * the popup (e.g. an embedded report or a tabbed module), leaving out whatever sits above that
     * element, such as a popup report's filters bar.
     */
    const measureViewportInPopup = (popup) => {

        const popupRect = popup.getBoundingClientRect();
        const viewportRect = containerViewport.getBoundingClientRect();

        // Rects are scaled along with a zoomed popup, while clientHeight is not.
        const scale = popup.offsetHeight ? popupRect.height / popup.offsetHeight : 1;

        const contentContainer = containerViewport.closest(
            ".ren-report-popup-window__content-container"
        );

        const scrollTop = contentContainer ? contentContainer.scrollTop : 0;
        const scrollLeft = contentContainer ? contentContainer.scrollLeft : 0;

        // Rounded, so that subpixel layout doesn't keep changing the dimensions.
        return {
            top: Math.ceil(
                (viewportRect.top - popupRect.top) / scale - popup.clientTop + scrollTop
            ),
            left: Math.ceil(
                (viewportRect.left - popupRect.left) / scale - popup.clientLeft + scrollLeft
            ),
            heightBelow: Math.ceil(Math.max(
                getMinimumHeightBelowViewport(),
                measureHeightBelowViewport(contentContainer, viewportRect.bottom, scale)
            ))
        };
    };

    /**
     * Gets the height the stat bar, and the paging bar it may wrap beneath, take up below the grid
     * set viewport in a popup, as placed by Ren.DataGrid_StatBar, plus a margin for the popup's
     * padding.  Used before those bars have been added.
     */
    const getMinimumHeightBelowViewport = () => {

        const paging = Ren.DataGridPaging;

        let height = Ren.DataGridConstants.scrollBarHeight + paging.barHeight + 8;

        // Whether the stat bar wraps depends on its grid's width, so a paged grid leaves room.
        if (paging.getPageSize(visualisation) !== null) {
            height += paging.barHeight + paging.barGap;
        }

        return height;
    };

    /**
     * Gets the height laid out below the grid set viewport, down to the bottom of the popup's
     * content: the rest of the grid set, its stat and paging bars, and the bottom padding, borders
     * and margins of the elements it sits in.  Measured as though everything below the viewport
     * moves with it, so that it is the same whatever the viewport's height, or the max height
     * worked out from it would keep changing.
     */
    const measureHeightBelowViewport = (contentContainer, viewportBottom, scale) => {

        const element = visualisation.element;

        if (!element || !contentContainer) return 0;

        const elementStyle = getComputedStyle(element);
        const elementRect = element.getBoundingClientRect();
        const children = element.children;

        // The element may be taller than its content (e.g. filling the available space), so is
        // measured as though it fitted its content.
        let contentBottom = viewportBottom;

        for (let index = 0; index < children.length; index++) {

            const child = children[index];

            if (getComputedStyle(child).position !== "absolute") {

                contentBottom = Math.max(contentBottom, child.getBoundingClientRect().bottom);
            }
        }

        const fittedElementBottom = contentBottom + (
            parseFloat(elementStyle.paddingBottom) + parseFloat(elementStyle.borderBottomWidth)
        ) * scale;

        // The stat and paging bars are positioned children, placed beneath the viewport for its
        // height at the last update, or on the editor page at the element's bottom.
        const placedViewportHeight = previousDimensions.gridSetViewportHeight;

        const viewportHeightChange = placedViewportHeight
            ? (getGridSetViewportHeight() - placedViewportHeight) * scale
            : 0;

        let bottom = fittedElementBottom;

        for (let index = 0; index < children.length; index++) {

            const child = children[index];

            if (getComputedStyle(child).position !== "absolute") continue;

            const childBottom = child.getBoundingClientRect().bottom;

            const placedBottom = child.style.top
                ? childBottom + viewportHeightChange
                : fittedElementBottom + childBottom - elementRect.bottom;

            bottom = Math.max(bottom, placedBottom);
        }

        let height = (bottom - viewportBottom) / scale;
        let ancestor = element;

        while (ancestor && ancestor !== contentContainer) {

            const style = getComputedStyle(ancestor);

            height += parseFloat(style.marginBottom);

            if (ancestor !== element) {

                height += parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
            }

            ancestor = ancestor.parentElement;
        }

        return height + parseFloat(getComputedStyle(contentContainer).paddingBottom);
    };

    /**
     * Gets the width laid out to the right of the grid set viewport, up to the popup's inner edge:
     * the right margins, padding, borders and scroll bars of the elements it sits in.  Measured, so
     * that a grid nearly as wide as its popup still has room for its own vertical scroll bar.
     */
    const measureWidthRightOfViewport = (popup) => {

        let width = parseFloat(getComputedStyle(containerViewport).marginRight);
        let ancestor = containerViewport.parentElement;

        while (ancestor && ancestor !== popup) {

            const style = getComputedStyle(ancestor);
            const borderLeft = parseFloat(style.borderLeftWidth);
            const borderRight = parseFloat(style.borderRightWidth);
            const scrollBar = ancestor.offsetWidth - ancestor.clientWidth - borderLeft - borderRight;

            width += parseFloat(style.marginRight) + parseFloat(style.paddingRight) + borderRight +
                Math.max(scrollBar, 0);

            ancestor = ancestor.parentElement;
        }

        return Math.ceil(width + parseFloat(getComputedStyle(popup).paddingRight));
    };

    const calculateDimensions = () => {

        const frozenRowCount = freezePanesCoords.y + tabularData.HeadingCount + (visualisation.showRowAndColumnHeadings ? 1 : 0);

        const dimensions = {
            frozenHeight: Ren.DataGridConstants.rowHeight * frozenRowCount,
            frozenWidth: dataGridColumnLeftPositions.computeFrozenWidth(freezePanesCoords.x),
            dataGridWidth: dataGridColumnLeftPositions.columnLeftPositions[tabularData.ColumnCount],
            dataGridHeight: Ren.DataGridConstants.rowHeight * dataGroupingSettings.getActiveRowCount(),
            gridSetViewportWidth: containerViewport.offsetWidth,
            gridSetViewportHeight: getGridSetViewportHeight()
        };

        if (visualisation?.isInsidePopup) {

            const popup = dataGridSections.dataGrid.closest(".ren-report-popup-window");

            if (popup) {

                const viewportInPopup = measureViewportInPopup(popup);

                const calculatedMaxHeight =
                    popup.clientHeight - viewportInPopup.top - viewportInPopup.heightBelow;

                const MIN_MEANINGFUL_HEIGHT = 200;

                if (calculatedMaxHeight >= MIN_MEANINGFUL_HEIGHT) {
                    dimensions.maxHeight = calculatedMaxHeight;
                }

                dimensions.maxWidth =
                    popup.clientWidth - viewportInPopup.left - measureWidthRightOfViewport(popup);

                dimensions.popupIsFittingWidth =
                    popup.popup?.isFittingWidthToContent?.() === true;
            }
        }

        return dimensions;
    };

    /**
     * Gets a value indicating whether the datagrid dimensions have changed compared to previous
     * dimensions.
     */
    const dimensionsChanged = (newDims, oldDims) => {

        return newDims.frozenHeight !== oldDims.frozenHeight ||
               newDims.frozenWidth !== oldDims.frozenWidth ||
               newDims.dataGridWidth !== oldDims.dataGridWidth ||
               newDims.dataGridHeight !== oldDims.dataGridHeight ||
               newDims.gridSetViewportWidth !== oldDims.gridSetViewportWidth ||
               newDims.gridSetViewportHeight !== oldDims.gridSetViewportHeight ||
               newDims.maxHeight !== oldDims.maxHeight ||
               newDims.maxWidth !== oldDims.maxWidth ||
               newDims.popupIsFittingWidth !== oldDims.popupIsFittingWidth;
    };

    const applyDimensionStyles = (dims) => {

        const frozenWidthPx = dims.frozenWidth + "px";
        const frozenHeightPx = dims.frozenHeight + "px";
        const dataGridWidthPx = dims.dataGridWidth + "px";
        const dataGridHeightPx = dims.dataGridHeight + "px";

        // Update frozen sections.
        const ftls = dataGridSections.frozenTopLeftSection.style;
        ftls.width = frozenWidthPx;
        ftls.height = frozenHeightPx;
        ftls.maxWidth = dataGridWidthPx;

        const flsv = dataGridSections.frozenLeftSection_Viewport.style;
        flsv.width = frozenWidthPx;

        const ftsv = dataGridSections.frozenTopSection_Viewport.style;
        ftsv.height = frozenHeightPx;

        if (visualisation?.hasDimensions) {

            ftsv.width = Ren.StylesUtils.toCssDimension(visualisation.visualisationWidth);
        }
        else if (visualisation?.isInsidePopup && dims.maxHeight) {

            visualisationStyles.setMaxWidthAndHeight(
                dims.maxWidth + "px",
                dims.maxHeight + "px",
                false
            );
        }
        else if (visualisation?.isInsidePopup && dims.maxWidth && !dims.popupIsFittingWidth) {

            // A popup too short for a meaningful max height must still keep the grid to its width,
            // or the popup scrolls horizontally beneath the grid's own scroll bar.  Not while the
            // popup is fitting its width to its content, which would then fit to its own width.
            visualisationStyles.setMaxWidth(dims.maxWidth + "px");
        }
        else {

            ftsv.width = dataGridWidthPx;

            const dgs = dataGridSections.dataGrid.style;
            dgs.width = dataGridWidthPx;
            dgs.height = dataGridHeightPx;
        }

        // A grid too tall to scroll through is given the most scrollable height, and its rows,
        // positioned at their true heights, are clipped to it (see Ren.DataGrid's verticalScroll).
        const dgs = dataGridSections.dataGrid.style;
        const maxScrollableHeight = Ren.DataGridConstants.maxScrollableHeight;

        if (dims.dataGridHeight > maxScrollableHeight) {

            dgs.height = maxScrollableHeight + "px";
            dgs.overflowY = "clip";
        }
        else if (dgs.overflowY) {

            dgs.overflowY = "";
            // Left unset where the grid's height isn't (see above).
            if (dgs.height === maxScrollableHeight + "px") dgs.height = "";
        }
    };

    /**
     * Recalculates the datagrid's dimensions and updates its styles and layout if the dimensions 
     * have changed.
     */
    const updateDimensions = () => {

        const newDimensions = calculateDimensions();

        if (dimensionsChanged(newDimensions, previousDimensions)) {

            Object.assign(dimensions, newDimensions);

            applyDimensionStyles(newDimensions);

            previousDimensions = Object.assign({}, newDimensions);

            Ren.Messages.Events.dataGridDimensionsUpdated.notify(dataGridGuid);
        }
    };

    return {
        dimensions,
        updateDimensions
    };
};
