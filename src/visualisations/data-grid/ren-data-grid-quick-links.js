/**
 * Adds the 'Remove Row Filter', 'Show/Hide Columns' and 'Export Data' links to the top right of the
 * datagrid.
 */
Ren.AddDataGridQuickLinks = (
    gridSetGuid,
    dataGridGuid,
    dataGridSections,
    dimensions,
    container,
    visualisation,
    dataGridCellSelection) => {

    const dataGridQuickLinks = Ren.HtmlUtils.create("div")
        ._addClass(
            "ren-data-grid__quick-links",
            "js-ren-dataGrid-quick-links",
            "qa-ren-data-grid-quick-links"
        );

    dataGridSections.dataGrid.prepend(dataGridQuickLinks);

    // A Find window 'Filter Rows' filter leaves the grid showing only the matching rows, with
    // nothing on the grid itself to say so, so this link appears alongside the others while such a
    // filter is in effect and takes it off again.
    const removeRowFilterLink = Ren.HtmlUtils.create("a")
        ._addClass(
            "ren-data-grid__remove-row-filter-link",
            "qa-ren-remove-row-filter-link"
        )
        ._attr("href", "javascript:void(0)")
        ._text("Remove Row Filter")
        ._attr("title", "Show the rows hidden by the Find window's row filter");

    dataGridQuickLinks.appendChild(removeRowFilterLink);

    /**
     * Shows the 'Remove Row Filter' link when a Filter Rows filter is in effect on this grid, and
     * hides it when there is none.
     */
    const showOrHideRemoveRowFilterLink = () => {

        const hasFilterRows = !!dataGridCellSelection?.hasFilterRows();

        removeRowFilterLink.classList.toggle(
            "ren-data-grid__remove-row-filter-link--visible",
            hasFilterRows
        );
    };

    removeRowFilterLink.addEventListener("click", () => {

        // The filter is cleared on this grid directly rather than through the
        // dataGridClearFilterRows request, which only the active grid acts on: the link belongs to
        // this grid, whether or not it is the one the user last worked in.  The completed event is
        // announced so that an open Find window stops showing the filter as active.
        const wasCleared = !!dataGridCellSelection?.clearFilterRows();

        showOrHideRemoveRowFilterLink();

        if (wasCleared) Ren.Messages.Events.dataGridClearFilterRowsCompleted.notify(dataGridGuid);
    });

    Ren.Messages.Events.dataGridFilterRowsCompleted.handle((guid) => {

        if (visualisation?.isDestroyed) return false;
        if (guid !== dataGridGuid) return;

        showOrHideRemoveRowFilterLink();
    });

    Ren.Messages.Events.dataGridClearFilterRowsCompleted.handle((guid) => {

        if (visualisation?.isDestroyed) return false;
        if (guid !== dataGridGuid) return;

        showOrHideRemoveRowFilterLink();
    });

    // The filter can also come and go without the Find window: loading report settings, or clearing
    // the filters from the column headings, rewrites the row filter predicates wholesale.
    Ren.Messages.Events.filterChanged.handle(() => {

        if (visualisation?.isDestroyed) return false;

        showOrHideRemoveRowFilterLink();
    });

    Ren.Messages.Events.dataGroupingSettingsChanged.handle(() => {

        if (visualisation?.isDestroyed) return false;

        showOrHideRemoveRowFilterLink();
    });

    showOrHideRemoveRowFilterLink();

    const showHideColumnsLink = Ren.HtmlUtils.create("a")
        ._addClass(
            "ren-data-grid__show-hide-columns-link",
            "qa-ren-show-hide-columns-link"
        )
        ._attr("href", "javascript:void(0)")
        ._text("Columns")
        ._attr("title", "Show or hide columns");

    dataGridQuickLinks.appendChild(showHideColumnsLink);

    showHideColumnsLink.addEventListener("click", () => {

        Ren.Messages.Requests.dataGridShowHideColumnsWindow.notify(
            dataGridGuid,
            showHideColumnsLink,
            null
        );
    });

    const exportLink = Ren.HtmlUtils.create("a")
        ._addClass(
            "ren-data-grid__export-link",
            "qa-ren-export-data-link"
        )
        ._attr("href", "javascript:void(0)")
        ._text("Export Data")
        ._attr("title", "Export the raw data to Excel");

    dataGridQuickLinks.appendChild(exportLink);

    exportLink.addEventListener("click", () => {

        Ren.Messages.Requests.exportData.notify(gridSetGuid);
    });

    /**
     * Updates the position of the quick links so that they stay in the top right corner if the
     * datagrid is resized (by adding, removing, or resizing columns).
     */
    const updateQuickLinksPosition = () => {

        let left;

        if (!visualisation || !visualisation.isWebReportBased) {

            left = Math.min(dimensions.dataGridWidth, container.clientWidth) - 134;
        }
        else {

            // In this case, the 'convert to popup' button is visible.
            left = Math.min(dimensions.dataGridWidth, container.clientWidth) -
                138 -
                Ren.ReportConstants.convertToPopupButtonWidth;
        }

        // Kept within the container, which in a popup would otherwise scroll sideways to show the
        // links' minimum width.
        left = Math.min(left, container.clientWidth - dataGridQuickLinks.offsetWidth);

        dataGridQuickLinks.style.left = left + "px";

        if (visualisation?.isWebReportBased) updateConvertToPopupButtonPosition();
    };

    /**
     * Gets the 'convert to popup' button of the popup the grid is in, or null when there is none
     * (yet).  The button is a child of the popup's content, alongside the visualisation.
     */
    const findConvertToPopupButton = () => {

        let ancestor = dataGridQuickLinks.parentElement;

        while (ancestor) {

            const button = ancestor.querySelector(
                ":scope > .ren-visualisation__convert-to-popup-button"
            );

            if (button) return button;

            ancestor = ancestor.parentElement;
        }

        return null;
    };

    /**
     * Keeps the 'convert to popup' button just left of the quick links, which follow the grid's
     * right edge, so it does not overlap them when the grid is narrower than its popup.
     */
    const updateConvertToPopupButtonPosition = () => {

        const button = findConvertToPopupButton();
        const parent = button?.offsetParent;

        if (!parent) return;

        const parentRect = parent.getBoundingClientRect();

        // Popup content may be scaled.
        const scale = parentRect.width / parent.offsetWidth || 1;
        const parentBorderRight = parent.offsetWidth - parent.clientLeft - parent.clientWidth;
        const linksLeft = dataGridQuickLinks.getBoundingClientRect().left;

        // The button's right edge sits 4px inside the links' (empty) left end.
        const right = (parentRect.right - linksLeft) / scale - parentBorderRight - 4;

        button.style.right = right + "px";
    };

    Ren.Messages.Events.dataGridDimensionsUpdated.handle((guid) => {

        if (guid === dataGridGuid) updateQuickLinksPosition();
    });
};
