/**
 * Sets up a popup window's title bar, with its title and resize/close/pop-out buttons.  Dragging it
 * with the right mouse button moves the window without bringing it to the front.
 */
Ren.PopupWindow_TitleBar = (_window, popup, title, options, closeWindow) => {

    if (options.isAdHoc) {

        const visualisationTypeName = Ren.TextUtils.addSpacesBeforeCapitals(
            options.visualisationTypeName.replace("GridSet", "Grid")
        );

        const defaultTitle = visualisationTypeName;
        title = title ? title + defaultTitle : defaultTitle;

        // An ad hoc popup is not saved with the report settings, so won't exist next time the
        // report is loaded.
        options.isEphemeral = true;
    }

    if (options.isEphemeral) {

        options.icon = "ephemeral-icon.png";
        options.iconTooltip = "This popup is 'ephemeral' and won't be included when you save " +
            "the report settings.  But it will be included if you download the report.";
    }

    const titleBarHeight = options.titleBarModifier === "thin" ?
        8 : // $title-bar-height-thin
        26; // $title-bar-height-standard

    const captionDiv = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__title-bar-caption")
        ._text(title);

    if (options.warningTriangle) {

        captionDiv.insertBefore(
            Ren.HtmlUtils.create("span")
                ._addClass("ren-report-popup-window__warning-triangle")
                ._textContent("⚠"),
            captionDiv.firstChild
        );
    }

    if (options.icon) {

        captionDiv
            ._addClass("ren-report-popup-window__title-bar-caption--with-icon")
            ._style("background-image", `url('${Ren.HostUrls.imageUrl(options.icon)}')`);

        if (options.iconTooltip) {
            captionDiv._attr("title", options.iconTooltip);
        }
    }

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__title-bar")
        ._style("user-select", "none")
        ._append(captionDiv);

    if (options.isAdHoc) {
        element._addClass("ren-report-popup-window__title-bar--ad-hoc-visualisation");
    }

    // Popup reports can't be saved, restored on load or downloaded, so are styled differently.
    if (options.isPopupReport) {
        element._addClass("ren-report-popup-window__title-bar--popup-report");
    }

    if (options.titleBarModifier) {
        element._addClass("ren-report-popup-window__title-bar--" + options.titleBarModifier);
    }

    const titleBarDragHandle = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__title-bar-drag-handle");

    element.appendChild(titleBarDragHandle);

    const windowButtons = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__window-buttons");

    const addToReportButton = options.showAddToReportButton
        ? Ren.HtmlUtils.create("div")
            ._addClass("ren-report-popup-window__add-to-report-button", "qa-ren-popup-report-add-to-report-button")
            ._set("title", "Add this to the report (rather than it being a popup)")
        : null;

    const popOutButton = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__pop-out-button", "qa-ren-popup-report-pop-out-button")
        ._set("title", "Open this report in a new browser tab");

    const minimiseButton = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__minimise-button")
        ._set("title", "Minimise");

    const maximiseButton = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__maximise-button")
        ._set("title", "Maximise");

    const closeButton = Ren.HtmlUtils.create("div")
        ._addClass("ren-report-popup-window__close-button")
        ._addClass("qa-ren-popup-window-close-button")
        ._set("title", "Close");

    if (addToReportButton) {

        windowButtons.appendChild(addToReportButton);
    }

    if (options.isResizable) {

        windowButtons.appendChild(minimiseButton);
        windowButtons.appendChild(maximiseButton);
    }

    windowButtons.appendChild(popOutButton);
    windowButtons.appendChild(closeButton);

    if (!options.showPopoutButton) popOutButton.style.display = "none";

    if (!options.showTitleBarButtons) windowButtons.style.display = "none";

    element.appendChild(windowButtons);

    closeButton.addEventListener("click", () => {

        closeWindow(false);
    });

    /**
     * Enlarges the drag handle so the mouse stays over it when the user drags rapidly.
     */
    const enlargeTitleBarDragHandle = () => {

        titleBarDragHandle.style.inset = "-25rem";
    };

    const revertTitleBarDragHandle = () => {

        titleBarDragHandle.style.inset = "0 0 0 1rem"; // Don't overlap the popup icon.
    };

    if (options.width) _window.style.width = options.width + "px";
    if (options.height) _window.style.height = options.height + "px";

    const rect = _window.getBoundingClientRect();

    // When resizeToFitContentOnLoad is false, saved dimensions are being restored, so are left be.
    if (options.resizeToFitContentOnLoad && rect.width > 0 && rect.height > 0) {

        options.onResizeWidth(rect.width);
        options.onResizeHeight(rect.height);
    }

    titleBarDragHandle.addEventListener("mousedown", function (e) {

        // Tab-scoped popups in page coordinates are siblings of this popup rather than nested in
        // it, so must be raised alongside it or its higher z-index would hide them.
        const scopedPagePopups = Ren.TabbedModulePopupDrop.getPagePopupsScopedToModule(_window);

        // The browser reports a right-click when a right-button drag is released, which would open
        // a context menu over the window just put down.
        const isRightButtonDrag = e.which === 3;
        const isLeftButtonDrag = e.which === 1;
        let hasMovedDuringThisDrag = false;

        if (isLeftButtonDrag) {

            Ren.PopupWindowOrder.raiseToDragLayer(_window);

            // A tab-relative popup is parented inside an outer popup, which forms its own stacking
            // context, so every ancestor popup is brought to front for it to paint above others.
            let ancestor = _window.parentElement
                ? _window.parentElement.closest(".ren-report-popup-window")
                : null;

            while (ancestor) {

                Ren.PopupWindowOrder.bringToFront(ancestor);
                ancestor = ancestor.parentElement
                    ? ancestor.parentElement.closest(".ren-report-popup-window")
                    : null;
            }

            for (let index = 0; index < scopedPagePopups.length; index++) {
                Ren.PopupWindowOrder.raiseToDragLayer(scopedPagePopups[index]);
            }
        }

        e.preventDefault();

        enlargeTitleBarDragHandle();

        // A window put in a tab's content or a popup report is positioned relative to it, and would
        // be clipped by a tab content's overflow: hidden, so is lifted out to the body for the drag
        // and placed again on the drop.  Other popups have overflow clipping lifted on their
        // ancestors instead.
        const clippingAncestors = [];

        if (!Ren.PopupVisualisationPlacement.liftOutForDrag(_window)) {

            let clippingElement = _window.parentElement;

            while (clippingElement && clippingElement !== document.documentElement) {

                const computedOverflow = window.getComputedStyle(clippingElement).overflow;

                if (computedOverflow === "hidden" || computedOverflow === "scroll"
                        || computedOverflow === "auto") {

                    clippingAncestors.push(
                        {
                            element: clippingElement,
                            originalOverflow: clippingElement.style.overflow
                        }
                    );

                    clippingElement.style.overflow = "visible";
                }

                clippingElement = clippingElement.parentElement;
            }
        }

        const rect = _window.getBoundingClientRect();

        const mouseOffsetX = e.clientX - rect.left;
        const mouseOffsetY = e.clientY - rect.top;

        // Measured once, as measuring in the move handler would force a layout on every mouse move,
        // straight after writing the window's position.
        const windowWidth = rect.width / options.scale;

        const mouseMoveHandler = (e) => {

            e.preventDefault();

            const bodyScrollPos = Ren.HtmlUtils.getBodyScrollPos();

            // Keep at least 25px of the window on screen horizontally.
            let newLeft = Math.max(e.clientX - mouseOffsetX, -windowWidth + 25);
            newLeft = Math.min(newLeft, window.innerWidth - 25);
            newLeft += bodyScrollPos.left;

            // Keep the title bar below the top of the screen.
            const newTop = Math.max(e.clientY - mouseOffsetY, titleBarHeight) + bodyScrollPos.top;

            _window.style.left = newLeft + "px";
            _window.style.top = newTop + "px";

            options.onMoveLeft(newLeft);
            options.onMoveTop(newTop);

            popup.hasBeenMoved = true;
            hasMovedDuringThisDrag = true;

            // Highlights the tab content that dropping the popup would scope its visualisation to.
            Ren.TabbedModulePopupDrop.updateDropTargetHighlight(_window);
        };

        const mouseUpHandler = (e) => {

            e.preventDefault();

            // A right-press that moved nothing still opens the title bar's own menu.
            if (isRightButtonDrag && hasMovedDuringThisDrag) {

                Ren.ContextMenuRegistry.suppressNextRightClickMenu();
            }

            // Only a left-button drag raised the windows, and settling them would otherwise bring a
            // right-dragged popup to the front.
            if (isLeftButtonDrag) {

                Ren.PopupWindowOrder.endDrag(_window);

                // After this popup, so the scoped popups settle above it.
                for (let index = 0; index < scopedPagePopups.length; index++) {
                    Ren.PopupWindowOrder.endDrag(scopedPagePopups[index]);
                }
            }

            revertTitleBarDragHandle();

            for (let index = 0; index < clippingAncestors.length; index++) {
                clippingAncestors[index].element.style.overflow = clippingAncestors[index].originalOverflow;
            }

            Ren.TabbedModulePopupDrop.dropPopup(_window);

            // Put where it now belongs straight away, as dropPopup's re-placing is asynchronous,
            // and meanwhile a move or resize of an outer popup would raise it above this one.
            popup.updatePlacement();

            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);
        };

        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
    });

    // Not deferred: the handle's hit area comes entirely from this inset, so until it ran a
    // mouse-down would miss the handle and the drag would silently fail.
    revertTitleBarDragHandle();

    const titleBar = {
        element,
        addToReportButton,
        popOutButton,
        minimiseButton,
        maximiseButton,
        titleBarHeight
    };

    if (options.isResizable) {

        Ren.PopupWindow_TitleBarResizeButtons.setupResizeWindowButtons(_window, titleBar, options);
    }

    return titleBar;
};
