/**
 * Adds a bar visualisation (the paging bar or the stat bar) beneath a datagrid, and keeps it placed
 * there as the grid resizes and as the bar's settings change.
 *
 * @param {Object} options
 * @param {string} options.visualisationTypeName - The bar's visualisation type.
 * @param {number} options.width - The bar's width.
 * @param {Function} options.onCreated - Called with the new visualisation before it is first
 *   placed, since placing either bar can depend on where the other is.
 * @param {Function} options.getPlacement - Returns the bar's {left, top, right, bottom} in pixels,
 *   leaving out the sides it isn't placed by, which are cleared.  Receives {topPos, height,
 *   isInPopup, popupHeight, onEditorPage}, where topPos is the top of the space beneath the grid.
 */
Ren.DataGrid_Bar = (dataGrid, gridStateGroup, gridSetElement, gridSetVisualisation, options) => {

    const height = Ren.DataGridPaging.barHeight;

    const visualisation = Ren.VisualisationCreator.createVisualisation({
        isChildVisualisation: true,
        visualisationTypeName: options.visualisationTypeName,
        excludeFromSerialization: true,
        sourceVisualisationGuid: dataGrid.dataGridGuid,
        sourceVisualisation: dataGrid,
        gridSetVisualisation: gridSetVisualisation,
        sourceGridStateGroup: gridStateGroup,
        targetElement: gridSetElement
    });

    options.onCreated(visualisation);

    const toPixels = value => value === undefined ? "" : value + "px";

    const isBar = element => element.classList.contains("ren-visualisation--stat-bar") ||
        element.classList.contains("ren-visualisation--paging-bar");

    // The bars are out of the flow, so the grid set's element is given a min-height that takes in
    // the shown ones, or they hang over whatever follows it.  Not where it is sized and placed, in
    // a popup, which leaves room for them itself, or on the editor page, which places them below.
    const reserveRoomForBars = () => {

        if (visualisation.isDestroyed) return;

        let minHeight = "";

        if (!gridSetVisualisation.hasDimensions &&
            !Ren.UrlContext.onEditorPage() &&
            !gridSetElement.closest(".ren-report-popup-window")) {

            const children = gridSetElement.children;

            let barsBottom = 0;

            for (let index = 0; index < children.length; index++) {

                const child = children[index];

                if (!isBar(child) || getComputedStyle(child).visibility === "hidden") continue;

                barsBottom = Math.max(barsBottom, child.offsetTop + child.offsetHeight);
            }

            if (barsBottom > 0) {

                // The bars are placed from the padding edge, which min-height may not include.
                const style = getComputedStyle(gridSetElement);

                const height = style.boxSizing === "border-box"
                    ? barsBottom + parseFloat(style.borderTopWidth) +
                        parseFloat(style.borderBottomWidth)
                    : barsBottom - parseFloat(style.paddingTop);

                minHeight = Math.ceil(height) + "px";
            }
        }

        if (gridSetElement.style.minHeight !== minHeight) {
            gridSetElement.style.minHeight = minHeight;
        }
    };

    const updatePosition = () => {

        if (visualisation.isDestroyed) return;

        const element = visualisation.element;
        const popupContainer = element.closest(".ren-report-popup-window");

        let topPos = 0;

        if (dataGrid.dimensions.gridSetViewportHeight) {
            topPos += dataGrid.dimensions.gridSetViewportHeight + 22;
        }

        if (popupContainer) topPos += 17;

        const placement = options.getPlacement({
            topPos,
            height,
            isInPopup: !!popupContainer,
            popupHeight: popupContainer ? popupContainer.clientHeight : null,
            onEditorPage: Ren.UrlContext.onEditorPage()
        });

        const style = element.style;

        style.position = "absolute";
        style.width = options.width + "px";
        style.height = height + "px";
        style.left = toPixels(placement.left);
        style.top = toPixels(placement.top);
        style.right = toPixels(placement.right);
        style.bottom = toPixels(placement.bottom);

        // Deferred, as the bars' visibility is set by stylesheets that may not have updated yet.
        Ren.FnUtils.defer(() => {

            reserveRoomForBars();
        });
    };

    updatePosition();

    Ren.Messages.Events.dataGridDimensionsUpdated.handle((dataGridGuid) => {

        if (visualisation.isDestroyed) return false;

        if (dataGridGuid !== dataGrid.dataGridGuid) return;

        // At once, so that it moves in the same frame as the grid set resizes, and again once
        // gridset tabs have resized themselves.
        updatePosition();

        Ren.FnUtils.defer(() => {

            updatePosition();
        });
    });

    // Showing the stat bar or paging the grid can bring the two bars into overlap, or out of it.
    Ren.Messages.Events.visualisationSettingsChanged.handle((changedVisualisation) => {

        if (visualisation.isDestroyed) return false;

        if (changedVisualisation.visualisationSettingsGroup !==
            visualisation.visualisationSettingsGroup) return;

        updatePosition();
    });

    return visualisation;
};
