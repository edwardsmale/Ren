(() => {

    // popupReuseId -> { _window, contentContainer, popup, contentListenerOwner }
    const popupReuseMap = new Map();

    const FULL_SCREEN_CLASS_NAME = "ren-report-popup-window--full-screen";

    // On the html element while a full screen window is open.
    const FULL_SCREEN_OPEN_CLASS_NAME = "ren-report-popup-window-full-screen-open";

    /**
     * Gets a value indicating whether the caller has named a position on one axis.  Zero is a
     * position like any other, so a truthiness test won't do.
     */
    const positionIsNamed = (position) => {

        return position !== null && position !== undefined && position !== "" &&
            !isNaN(parseFloat(position));
    };

    /**
     * Renders a popup window.
     */
    Ren.PopupWindow = (className, renderContent, title, options) => {

        // A menu item probed for what it shows is stopped before showing it (see
        // Ren.MenuItemProbe).
        Ren.MenuItemProbe.intercept("window", { className, title });

        const defaultOptions = {
            titleBarModifier: null,
            // Shows a warning triangle before the title.
            warningTriangle: false,
            noShadow: false,
            isPoppedIn: false,
            reportUrl: null,
            withOffset: false,
            leftPos: 100,
            topPos: 100,
            centred: false,
            centredYOffset: 0,
            centredOnPoint: null,
            autoSized: false,
            width: 640,
            height: 240,
            hasFixedWidth: false,
            hasFixedHeight: false,
            initialMaxHeight: null,
            initialMaxWidth: null,
            verticalScrollbar: true,
            isVisibleInitially: true,
            closeWhenFocusLost: false,
            // Called as the window starts to close, before the visualisations in it are destroyed.
            onClosing: null,
            onClose: null,
            horizontalScrollbar: true,
            isResizable: true,
            onMoveLeft: () => true,
            onMoveTop: () => true,
            onResizeWidth: () => true,
            onResizeHeight: () => true,
            // Called as the user starts to resize the window, before its size changes.
            onManualResizeStarting: () => true,
            onPopInChanged: () => true,
            // Moves the window into the element it belongs in, or out to the page.
            place: () => true,
            showPopoutButton: false,
            showTitleBarButtons: true,
            showAddToReportButton: false,
            allowOffscreen: false,
            scale: 1,
            scaleContentToFit: false,
            contentScaleBaseWidth: null,
            onContentScaleBaseChanged: null,
            hasBeenMoved: false,
            isAdHoc: false,
            popupReuseId: null,
            delayOpacityMs: null,
            // Fills the browser window, hiding the page's scroll bars, with no title bar, and can
            // be neither moved nor resized, so only its content can close it.
            isFullScreen: false
        };

        if (options.popupReuseId) {

            const existing = popupReuseMap.get(options.popupReuseId);

            if (existing) {

                // Null out popup references before destroying, otherwise destroyVisualisation will
                // call popup.closeWindow() and remove this window from the DOM.
                existing.contentContainer.querySelectorAll(".ren-visualisation").forEach(element => {

                    const guid = Ren.HtmlUtils.getGuidClassName(element, "ren-visualisation-");
                    const vis = Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid);
                    if (vis) vis.popup = null;
                });

                Ren.VisualisationCollection.destroyAllVisualisationsInsideContainer(existing.contentContainer);
                existing.contentContainer.innerHTML = '';

                const caption = existing._window.querySelector('.ren-report-popup-window__title-bar-caption');
                if (caption) caption.textContent = title;

                // The content being replaced takes its listeners with it, and the content
                // rendered in its place registers its own under the same owner.
                Ren.Messages.removeListenersByOwner(existing.contentListenerOwner);

                Ren.Messages.withOwner(existing.contentListenerOwner, () => {

                    renderContent(existing.contentContainer, existing.popup);
                });

                Ren.PopupWindowOrder.bringToFront(existing._window);
                Ren.PopupWindowOrder.focus(existing._window);

                // The window keeps its size, rather than taking the new content's initial one,
                // until it is refitted to the new content.
                existing.popup.isReused = true;
                existing.refitToReusedContent();

                return existing.popup;
            }
        }

        const positionIsDerived = !positionIsNamed(options.leftPos) &&
            !positionIsNamed(options.topPos);

        if (positionIsDerived) {

            const defaultPosition = Ren.PopupPositioning.getDefaultPosition();

            options.leftPos = defaultPosition.left;
            options.topPos = defaultPosition.top;
        }

        Ren.ObjectUtils.applyDefaultOptions(options, defaultOptions);

        options.titleBarModifier = Ren.TextUtils.removeLeading(options.titleBarModifier, "--");

        if (options.isFullScreen) options.isResizable = false;

        // Both kinds of centring are done once the window has been laid out and can be measured,
        // so neither names a position up front.
        if (options.centred || options.centredOnPoint) {

            options.leftPos = null;
            options.topPos = null;
        }

        if (options.autoSized) {

            options.width = null;
            options.height = null;
        }

        // Underscore prefix is used to avoid clashing with the global 'window' variable.
        const _window = Ren.HtmlUtils.create("div");

        if (!options.isVisibleInitially) {

            _window.style.visibility = "hidden";
        }

        if (options.windowAttrs) {

            options.windowAttrs.forEach(attr =>
                _window._set(attr.attrName, attr.attrValue)
            );
        }

        _window._addClass("ren-report-popup-window", className);

        if (options.isFullScreen) {

            _window._addClass(FULL_SCREEN_CLASS_NAME);
            document.documentElement.classList.add(FULL_SCREEN_OPEN_CLASS_NAME);
        }

        if (options.initialMaxHeight) {

            _window.style.maxHeight = typeof options.initialMaxHeight === "number"
                ? options.initialMaxHeight + "px"
                : options.initialMaxHeight;
        }

        if (options.initialMaxWidth) {

            _window.style.maxWidth = typeof options.initialMaxWidth === "number"
                ? options.initialMaxWidth + "px"
                : options.initialMaxWidth;
        }

        const windowGuid = Ren.RandomUtils.generateRandomClassName("ren-popup-window");
        _window._addClass(windowGuid);

        Ren.PopupWindowOrder.bringToFront(_window); // Set initial z-index.
        Ren.PopupWindowOrder.focus(_window);

        // Removed when the window closes, since left on the bus their closures would pin the closed
        // window's DOM tree in memory.
        const windowListenerOwner = { popupWindow: windowGuid };

        // Owned apart from the window's, as a reused window renders fresh content into itself and
        // the replaced content's listeners must go with it.
        const contentListenerOwner = { popupWindowContent: windowGuid };

        let contentResizeObserver = null;
        let contentScale = null;

        if (!options.isVisibleInitially) _window.style.opacity = 0;

        if (options.delayOpacityMs) {

            _window.style.opacity = "0";
            setTimeout(() => { _window.style.opacity = "1"; }, options.delayOpacityMs);
        }

        const closeWindow = (keepVisualisation) => {

            options.onClosing && options.onClosing();

            // A released popup no longer holds its reuse ID, which a newer popup may now hold.
            if (options.popupReuseId &&
                popupReuseMap.get(options.popupReuseId)?._window === _window) {

                popupReuseMap.delete(options.popupReuseId);
            }

            Ren.PopupPositioning.remove(_window);
            Ren.PopupWindowOrder.releaseFocus(_window);

            Ren.VisualisationCollection.destroyAllVisualisationsInsideContainer(_window);

            Ren.Messages.removeListenersByOwner(windowListenerOwner);
            Ren.Messages.removeListenersByOwner(contentListenerOwner);

            if (contentResizeObserver) {

                contentResizeObserver.disconnect();
                contentResizeObserver = null;
            }

            if (contentScale) {

                contentScale.disconnect();
                contentScale = null;
            }

            _window.remove();

            if (!document.querySelector("." + FULL_SCREEN_CLASS_NAME)) {

                document.documentElement.classList.remove(FULL_SCREEN_OPEN_CLASS_NAME);
            }

            options.onClose && options.onClose(keepVisualisation);
        };

        /**
         * Resizes the popup width to fit the width of the grid it contains.
         */
        const resizePopupToFitDataGrid = (visualisation) => {

            const gridSetViewport = visualisation.instance?.element?.querySelector(".ren-grid-set__viewport");

            if (!gridSetViewport) return;

            const gridWidth = gridSetViewport.scrollWidth;
            const contentPadding = 16;

            const newWidth = Math.min(gridWidth + contentPadding, window.innerWidth - 50) + 20;

            visualisation.popup.setWidth(newWidth);
        };

        const popup = {
            closeWindow,
            isPoppedIn: false,
            showPopoutButton: options.showPopoutButton ?? false,
            resizePopupToFitDataGrid
        };

        // Held on the element so that a caller with only the element can close the window through
        // closeWindow rather than removing it from the DOM.
        _window.popup = popup;

        const titleBar = Ren.PopupWindow_TitleBar(
            _window,
            popup,
            title,
            options,
            closeWindow
        );

        popup.popOutButton = titleBar.popOutButton;
        popup.addToReportButton = titleBar.addToReportButton;
        popup.titleBarElement = titleBar.element;

        const contentContainer = Ren.HtmlUtils.create("div");
        contentContainer._addClass("ren-report-popup-window__content-container");

        if (options.fillAvailableSpace) {
            contentContainer._addClass("ren-report-popup-window__content-container--fill-available-space");
        }

        popup.contentContainer = contentContainer;

        if (options.horizontalScrollbar) {
            contentContainer.style.overflowX = "auto";
        }
        else {

            contentContainer.style.overflowX = "hidden";
        }

        if (options.verticalScrollbar) {

            contentContainer.style.overflowY = "auto";
            contentContainer.style.maxHeight = "100%";
        }

        _window.appendChild(titleBar.element);
        _window.appendChild(contentContainer);

        // The root body tag, since SVG can also contain body tags in foreignObject elements.
        Ren.HtmlUtils.getBody().appendChild(_window);

        Ren.PopupPositioning.add(_window);

        Ren.FnUtils.defer(() => {

            const okButton = contentContainer.querySelector(".js-ren-popup-message-ok-button");

            if (okButton) okButton.addEventListener("click", () => {

                closeWindow(false);
            });
        });

        Ren.Messages.withOwner(windowListenerOwner, () => {

            Ren.Messages.Events.reportGenerating.handle(() => {

                closeWindow(false);
            });

            Ren.Messages.Events.windowMouseDown.handle((target) => {

                if (options.closeWhenFocusLost) {

                    if (!target.classList.contains(windowGuid) && !_window.contains(target)) {

                        closeWindow();
                    }
                }
            });
        });

        if (options.scaleContentToFit) {

            contentScale = Ren.PopupWindow_ContentScale(_window, contentContainer, options);
        }

        const onManualResizeStarting = options.onManualResizeStarting;

        // Content scaled to fit is laid out at the size it has before the first resize.
        options.onManualResizeStarting = () => {

            if (contentScale) contentScale.fixBaseWidth();
            onManualResizeStarting();
        };

        if (options.isResizable) {

            Ren.PopupWindow_ResizeHandles.setupResizeHandles(_window, options, titleBar);

            if (options.initialMaxHeight) {

                const removeInitialMaxHeight = () => {

                    _window.style.maxHeight = "";
                    _window.removeEventListener("mousedown", removeInitialMaxHeight);
                };
                _window.addEventListener("mousedown", removeInitialMaxHeight);
            }

            if (options.initialMaxWidth) {

                const removeInitialMaxWidth = () => {

                    _window.style.maxWidth = "";
                    _window.removeEventListener("mousedown", removeInitialMaxWidth);
                };
                _window.addEventListener("mousedown", removeInitialMaxWidth);
            }
        }

        Ren.Messages.withOwner(contentListenerOwner, () => {

            renderContent(contentContainer, popup);
        });

        const getWindowReport = () => _window.querySelector(".js-ren-report-context");
        const getWindowVisualisation = () => _window.querySelector(".ren-visualisation");
        const getContent = () => getWindowReport() || getWindowVisualisation();

        const makeWindowVisualisationTargetsVisible = () => {

            _window.querySelectorAll(".ren-visualisation-target").forEach(v => {

                v.style.opacity = 1;
            });
        };

        const makeHeightFitContent = (element) => {

            if (element.style.height === undefined) {

                element.dataset.originalHeight = "undefined";
            }
            else {

                element.dataset.originalHeight = element.style.height;
            }

            element.style.height = "fit-content";
        };

        const undoMakeHeightFitContent = (element) => {

            if (element.dataset.originalHeight === "undefined") {

                delete element.style.height;
            }
            else {

                element.style.height = element.dataset.originalHeight;
            }

            delete element.dataset.originalHeight;
        };

        /**
         * Temporarily removes width constraints to measure actual content width.
         */
        const makeWidthFitContent = (element) => {

            if (element.style.width === undefined) {

                element.dataset.originalWidth = "undefined";
            }
            else {

                element.dataset.originalWidth = element.style.width;
            }

            element.style.width = "fit-content";

            const children = element.querySelectorAll("[style*='webkit-fill-available']");
            children.forEach(child => {

                if (child.dataset.originalChildStyle === undefined) {

                    child.dataset.originalChildStyle = child.getAttribute("style");
                }

                let style = child.getAttribute("style") || "";
                style = style.replace(/-webkit-fill-available/g, "auto");
                child.setAttribute("style", style);
            });
        };

        const undoMakeWidthFitContent = (element) => {

            if (element.dataset.originalWidth === "undefined") {

                delete element.style.width;
            }
            else {

                element.style.width = element.dataset.originalWidth;
            }

            delete element.dataset.originalWidth;

            const children = element.querySelectorAll("[data-original-child-style]");
            children.forEach(child => {

                const originalStyle = child.dataset.originalChildStyle;

                if (originalStyle === undefined || originalStyle === "undefined") {

                    child.removeAttribute("style");
                }
                else {

                    child.setAttribute("style", originalStyle);
                }

                delete child.dataset.originalChildStyle;
            });
        };

        /**
         * Gets the height on show between the popup's top edge and the bottom of the viewport, less
         * a small margin.
         */
        const getAvailableHeightBelowWindowTop = () => {

            const available = window.innerHeight - _window.getBoundingClientRect().top - 20;

            return Math.max(available, 150);
        };

        /**
         * Moves the popup up so that a window of the given height fits above the bottom of the
         * viewport, as far as the top of the viewport allows.
         */
        const raiseToFitHeight = (height) => {

            const available = window.innerHeight - _window.getBoundingClientRect().top - 20;
            const shortfall = height - available;

            if (shortfall <= 0 || popup.isPoppedIn) return;

            const position = Ren.PopupPositioning.keepOnScreen(
                parseFloat(_window.style.left) || 0,
                (parseFloat(_window.style.top) || 0) - shortfall,
                _window.getBoundingClientRect().width,
                options
            );

            _window.style.top = position.top + "px";
            options.onMoveTop(position.top);
        };

        let hasFittedWidth = false;
        let userHasManuallyResizedWidth = false;

        // Caps the auto-calculated size only; the user can still drag beyond it manually.
        const AUTO_SIZE_MAX_PX = 1740;

        /**
         * Gets a value indicating whether the popup's width is still being fitted to its content,
         * so may yet grow to fit a grid that is wider than it.
         */
        const isFittingWidthToContent = () => {

            return options.resizeToFitContentOnLoad &&
                options.hasFixedWidth !== true &&
                !userHasManuallyResizedWidth &&
                !(contentScale && contentScale.hasBaseWidth()) &&
                parseFloat(_window.style.width) < AUTO_SIZE_MAX_PX;
        };

        /**
         * Gets the horizontal padding and borders of the elements between the content and the
         * window's content container, e.g. an embedded report's response wrapper.
         */
        const getHorizontalSpaceAroundContent = (content) => {

            let space = 0;
            let element = content.parentElement;

            while (element && element !== contentContainer) {

                const style = getComputedStyle(element);

                space += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
                    parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);

                element = element.parentElement;
            }

            return space;
        };

        /**
         * Gets the right edge of the content's furthest-reaching visible stat bar, relative to the
         * content's left edge.  A stat bar is absolutely positioned, so it is left out of the
         * content's fitted width, and is wider than a grid of only a few columns.
         */
        const getStatBarsRightEdge = (content) => {

            const statBars = content.querySelectorAll(".ren-visualisation--stat-bar");

            if (statBars.length === 0) return 0;

            const contentRect = content.getBoundingClientRect();

            // Rects are zoomed along with the popup, while clientWidth is not.
            const scale = content.offsetWidth ? contentRect.width / content.offsetWidth : 1;

            let rightEdge = 0;

            for (let index = 0; index < statBars.length; index++) {

                if (getComputedStyle(statBars[index]).visibility === "hidden") continue;

                const statBarRight = statBars[index].getBoundingClientRect().right;

                rightEdge = Math.max(rightEdge, (statBarRight - contentRect.left) / scale);
            }

            return rightEdge;
        };

        /**
         * Resizes the popup window to match the content size (enlarges or shrinks as needed).
         */
        const resizePopupToMatchContent = (heightOnlyRequested) => {

            // A width or height the popup was opened with is kept, and only the other is fitted.
            const heightOnly = heightOnlyRequested || options.hasFixedWidth === true;
            const fitHeight = options.hasFixedHeight !== true;

            if (heightOnly && !fitHeight) return;

            // Content scaled to the window is fitted by its scale, not by resizing the window.
            if (contentScale && contentScale.hasBaseWidth()) return;

            makeWindowVisualisationTargetsVisible();

            const content = getContent();

            if (!content) return;

            makeHeightFitContent(content);

            if (!heightOnly) {

                makeWidthFitContent(content);
            }

            // A data grid is given room beyond its measured content for its scroll bars and stat
            // bar.  A visualisation that sizes itself to its content wants a couple of pixels only.
            const fitExactly = options.fitPopupToContentExactly === true;

            // An exact fit also leaves room for what surrounds the content, which would otherwise
            // leave it scrolling sideways by a few pixels.
            const contentWidth = Math.max(content.clientWidth, getStatBarsRightEdge(content)) +
                (fitExactly ? getHorizontalSpaceAroundContent(content) : 0);

            const contentHeight = content.clientHeight + (fitExactly ? 0 : 48);

            undoMakeHeightFitContent(content);

            if (!heightOnly) {

                undoMakeWidthFitContent(content);
            }

            const heightMargin = fitExactly ? 2 : 16;

            if (fitExactly && options.raiseToFitContent) {

                raiseToFitHeight(contentHeight + heightMargin);
            }

            // Also capped to the space beneath the popup's top edge, so tall content (e.g. a popup
            // report of stacked charts) scrolls within the popup rather than running off the page.
            // That space is on screen, where a zoomed popup's height is scaled.
            const maximumHeight = Math.min(
                getAvailableHeightBelowWindowTop() / options.scale,
                AUTO_SIZE_MAX_PX
            );

            const newHeight =
                Ren.NumberUtils.clamp(contentHeight + heightMargin, 24, maximumHeight);

            // Capping the height leaves the content scrolling inside the popup, so its vertical
            // scroll bar needs room; an uncapped exact fit shows no scroll bar and needs none.
            const heightWasCapped = newHeight < contentHeight + heightMargin;

            const widthMargin = fitExactly
                ? (heightWasCapped ? Ren.DataGridConstants.scrollBarWidth + 2 : 2)
                : Ren.DataGridConstants.scrollBarWidth + 56 + 32;

            // A popup the user has just asked for is measured before its content has a vertical
            // scroll bar, which would take its width out of the content, so it is allowed for up
            // front.  A popup restored from report settings wants no such allowance.
            const scrollBarAllowance =
                options.allowForScrollBarInInitialWidth && fitExactly && !heightWasCapped
                    ? Ren.DataGridConstants.scrollBarWidth
                    : 0;

            // Floored, since a narrow visualisation's title bar and close button need room.
            const EXACT_FIT_MIN_WIDTH_PX = 160;

            const fittedWidth = fitExactly
                ? Math.max(contentWidth + widthMargin + scrollBarAllowance, EXACT_FIT_MIN_WIDTH_PX)
                : contentWidth + widthMargin + scrollBarAllowance;

            const newWidth = Math.min(fittedWidth, AUTO_SIZE_MAX_PX);

            // A capped popup's scroll bar narrows its content, and content that fills its width
            // (e.g. charts) then measures narrower at each refit, so it is not narrowed once
            // fitted.
            const keepWidth = hasFittedWidth && heightWasCapped &&
                newWidth < parseFloat(_window.style.width);

            const setWidth = !heightOnly && !keepWidth;

            if (setWidth) {

                _window.style.width = newWidth + "px";
                hasFittedWidth = true;
            }

            if (fitHeight) {
                _window.style.height = newHeight + "px";
            }

            if (setWidth) {
                options.onResizeWidth(newWidth);
            }

            if (fitHeight) {
                options.onResizeHeight(newHeight);
            }
            Ren.Messages.Events.popupResized.notify();

            if (!heightOnly) {

                // Fixed at 100% now that it has been measured, to avoid an overhang of content.
                content.style.width = "100%";
            }
        };

        const onPopupShown = () => {

            makeWindowVisualisationTargetsVisible();

            if (options.resizeToFitContentOnLoad) {

                resizePopupToMatchContent();

                options.onResizeWidth && options.onResizeWidth();
                options.onResizeHeight && options.onResizeHeight();
            }
            else {

                // A popup restored from saved settings still needs its visualisation (e.g. a
                // DateValueChart) to know its container dimensions, to scale to fill the popup.
                if (popup.notifyContainerResize) {

                    popup.notifyContainerResize();
                }
            }

            _window.style.visibility = "visible";
        };

        // An embedded report's loading animation is only present once the report is in the DOM, so
        // that is waited for before the animations are.
        const hasEmbeddedReportInPopup = options.visualisationTypeName === "EmbeddedReport";

        const showWhenEmbeddedReportLoaded = () => {

            let waitingForAnimations = false;

            const startWaitingForLoadingAnimations = () => {

                if (waitingForAnimations) return;
                waitingForAnimations = true;

                Ren.MessageBus_Conditions.onCondition(
                    () => Ren.LoadingAnimations.areAnyLoadingAnimationsVisible() !== true,
                    onPopupShown,
                    true,
                    50
                );
            };

            Ren.MessageBus_Conditions.onCondition(
                () => getWindowReport() !== null,
                startWaitingForLoadingAnimations,
                true
            );
        };

        /**
         * Fits a reused popup to the embedded report rendered into it, once that has loaded.
         */
        const refitToReusedContent = () => {

            if (!hasEmbeddedReportInPopup || !options.resizeToFitContentOnLoad) return;

            // The previous report's fitted width no longer holds.
            hasFittedWidth = false;

            showWhenEmbeddedReportLoaded();
        };

        if (hasEmbeddedReportInPopup) {

            showWhenEmbeddedReportLoaded();
        }
        else {

            Ren.MessageBus_Conditions.onCondition(
                () => Ren.LoadingAnimations.areAnyLoadingAnimationsVisible() !== true,
                onPopupShown,
                true,
                50
            );
        }

        const containingWebReport = document.querySelector(".js-ren-report-context");

        let popupWidth = _window.getBoundingClientRect().width;

        const availableWidth = (containingWebReport ?
            containingWebReport.clientWidth :
            window.innerWidth) - 10;

        // Dimensions restored from saved settings (resizeToFitContentOnLoad off) are left as
        // they are.
        if (options.resizeToFitContentOnLoad && popupWidth > availableWidth) {

            popupWidth = availableWidth;
            _window.style.width = popupWidth + "px";

            options.onResizeWidth(popupWidth);

            Ren.Messages.Events.popupResized.notify();
        }

        /**
         * Puts the window at the given position, and tells the caller where it ended up.
         */
        const applyPosition = (left, top) => {

            _window.style.left = left + "px";
            _window.style.top = top + "px";

            options.onMoveLeft(left);
            options.onMoveTop(top);
        };

        if (positionIsNamed(options.leftPos) && positionIsNamed(options.topPos)) {

            const width = _window.getBoundingClientRect().width;

            const keepWindowOnScreen = (left, top) =>
                Ren.PopupPositioning.keepOnScreen(left, top, width, options);

            // Shift the window clear of any window already open in the same place.  A window
            // restoring a position saved in report settings is left exactly where it was put.
            const position = positionIsDerived || options.withOffset
                ? Ren.PopupPositioning.getNonClashingPosition(
                    options.leftPos,
                    options.topPos,
                    _window,
                    keepWindowOnScreen
                )
                : keepWindowOnScreen(options.leftPos, options.topPos);

            applyPosition(position.left, position.top);
        }
        else {

            // Deferred until after layout, so that the window can be measured.
            requestAnimationFrame(() => {

                const rect = _window.getBoundingClientRect();
                const width = rect.width;
                const height = rect.height;

                const scrollOffsets = Ren.PopupPositioning.getScrollOffsets();

                let left;
                let top;

                if (options.centredOnPoint) {

                    // Where the user right-clicked to open the menu the window came from.
                    left = options.centredOnPoint.x - (width / 2);
                    top = options.centredOnPoint.y - (height / 2);
                }
                else {

                    left = scrollOffsets.left + (window.innerWidth - width) / 2;
                    top = scrollOffsets.top + (window.innerHeight - height) / 2;
                }

                if (options.centred && options.centredYOffset !== undefined && options.centredYOffset !== null) {

                    let offset = options.centredYOffset;

                    if (typeof offset === "number") {

                        top += offset;
                    }
                    else if (typeof offset === "string") {

                        top += Ren.StylesUtils.convertToPixels(offset);
                    }
                }

                const keepWindowOnScreen = (candidateLeft, candidateTop) =>
                    Ren.PopupPositioning.keepOnScreen(candidateLeft, candidateTop, width, options);

                const position = options.centred
                    ? Ren.PopupPositioning.getNonClashingPosition(
                        left,
                        top,
                        _window,
                        keepWindowOnScreen
                    )
                    : keepWindowOnScreen(left, top);

                applyPosition(position.left, position.top);
            });
        }

        const windowHeight = _window.getBoundingClientRect().height;

        // Ensures that vertical scrollbar appears on load (if needed).
        _window.style.height = windowHeight + "px";
        options.onResizeHeight(windowHeight);

        Ren.Messages.Events.popupResized.notify();

        const ensureWindowNotTooTall = () => {

            const rect = _window.getBoundingClientRect();
            const windowBottom = rect.top + rect.height;

            const availableHeight = containingWebReport ?
                containingWebReport.clientHeight - 200 :
                window.innerHeight;

            if (windowBottom > availableHeight - 50) {

                const tabHeader = _window.querySelector('.ren-tabbed-module__tab-header');
                const tabHeaderHeight = tabHeader ? tabHeader.offsetHeight : 0;

                let newHeight = availableHeight - rect.top - 90 - tabHeaderHeight;

                newHeight = Math.max(newHeight, 400);

                _window.style.height = newHeight + "px";

                options.onResizeHeight(newHeight);

                Ren.Messages.Events.popupResized.notify();
            }
        };

        if (options.resizeToFitContentOnLoad && !options.allowOffscreen) ensureWindowNotTooTall();

        const popupWindowZoom = Ren.PopupWindow_Zoom(_window, options);

        popup.getWidth = () => {

            return _window.getBoundingClientRect().width;
        };

        popup.getHeight = () => {

            return _window.getBoundingClientRect().height;
        };

        popup.setWidth = (width, skipCallback) => {

            width = Ren.StylesUtils.convertToPixels(width);
            _window.style.width = width + "px";
            if (!skipCallback) options.onResizeWidth(width);
            Ren.PopupReportPoppedInWindows.updateRoom(_window);
        };

        popup.setHeight = (height, skipCallback) => {

            height = Ren.StylesUtils.convertToPixels(height);
            _window.style.height = height + "px";
            if (!skipCallback) options.onResizeHeight(height);
            Ren.PopupReportPoppedInWindows.updateRoom(_window);
        };

        popup.setLeftPos = (left) => {

            left = Ren.StylesUtils.convertToPixels(left);
            _window.style.left = left + "px";
            options.onMoveLeft(left);
            Ren.PopupReportPoppedInWindows.updateRoom(_window);
        };

        popup.setRightPos = (right) => {

            right = Ren.StylesUtils.convertToPixels(right);
            popup.setLeftPos(window.innerWidth - right - _window.getBoundingClientRect().width);
        };

        popup.setTopPos = (top) => {

            top = Ren.StylesUtils.convertToPixels(top);
            _window.style.top = top + "px";
            options.onMoveTop(top);
            Ren.PopupReportPoppedInWindows.updateRoom(_window);
        };

        popup.setZoom = (scale) => {

            popupWindowZoom.setScale(scale);
        };

        /**
         * Sets the width a scaleContentToFit popup's content is laid out at before it is scaled to
         * the window, or with null leaves it unscaled until the user next resizes the window.
         */
        popup.setContentScaleBaseWidth = (width) => {

            if (!contentScale) return;

            contentScale.setBaseWidth(width ? Ren.StylesUtils.convertToPixels(width) : null);
        };

        /**
         * Starts or stops scaling the content to fit the window.  Started, the content keeps the
         * layout it has at the window's current size.
         */
        popup.setScaleContentToFit = (shouldScale) => {

            options.scaleContentToFit = !!shouldScale;

            if (shouldScale) {

                if (!contentScale) {

                    contentScale =
                        Ren.PopupWindow_ContentScale(_window, contentContainer, options);
                }

                contentScale.fixBaseWidth();
            }
            else if (contentScale) {

                contentScale.setBaseWidth(null);
                contentScale.disconnect();
                contentScale = null;

                // Otherwise turning it back on would restore the base width it had at creation.
                options.contentScaleBaseWidth = null;
            }
        };

        popup.hide = () => {

            _window.style.visibility = "hidden";
        };

        popup.show = () => {

            onPopupShown();
        };

        const updatePoppedInState = (isPoppedIn) => {

            popup.isPoppedIn = isPoppedIn;
            _window.classList.toggle("ren-report-popup-window--popped-in", isPoppedIn);

            // A popped-in popup is on the page, so stays behind floating popups.  One recreated and
            // popped in would otherwise keep its creation z-index and paint over floating windows.
            if (isPoppedIn) {

                Ren.PopupWindowOrder.sendToPageLayer(_window);
            }
            else {

                Ren.PopupWindowOrder.bringToFront(_window);
            }

            // A popped-in window may belong in a popup report.
            popup.updatePlacement();

            options.onPopInChanged(isPoppedIn);
        };

        if (popup.addToReportButton) {

            popup.addToReportButton.addEventListener("click", () => {

                popup.popIn();
            });
        }

        popup.updatePlacement = () => { options.place(_window); };
        popup.popIn = () => { updatePoppedInState(true); };
        popup.revertPopIn = () => { updatePoppedInState(false); };
        popup.resizeToMatchContent = resizePopupToMatchContent;
        popup.isFittingWidthToContent = isFittingWidthToContent;

        (() => {

            if (options.resizeToFitContentOnLoad) {

                const content = getContent();

                if (content) {

                    let lastContentHeight = null;
                    let lastContentWidth = null;
                    let userHasManuallyResizedHeight = false;

                    const observer = new MutationObserver(() => {

                        if (userHasManuallyResizedHeight || userHasManuallyResizedWidth) {

                            observer.disconnect();
                            return;
                        }

                        const content = getContent(); // Re-query this.
                        if (!content) return;

                        const currentHeight = content.offsetHeight;
                        const currentWidth = content.offsetWidth;

                        const heightChanged = currentHeight && lastContentHeight !== currentHeight;
                        const widthChanged = currentWidth && lastContentWidth !== currentWidth;

                        if (heightChanged || widthChanged) {

                            lastContentHeight = currentHeight;
                            lastContentWidth = currentWidth;
                            resizePopupToMatchContent(heightChanged && !widthChanged || userHasManuallyResizedWidth);
                        }
                    });

                    observer.observe(content, { childList: true, subtree: true, attributes: true });

                    // Held so closeWindow can disconnect it: an observer left watching the closed
                    // window's content keeps that content alive.
                    contentResizeObserver = observer;

                    Ren.Messages.withOwner(windowListenerOwner, () => {

                        Ren.Messages.Events.popupManuallyResized.handle((windowElement, resizeType) => {

                            if (windowElement === _window) {

                                if (resizeType === 'height' || resizeType === 'both') {

                                    userHasManuallyResizedHeight = true;
                                }

                                if (resizeType === 'width' || resizeType === 'both') {

                                    userHasManuallyResizedWidth = true;
                                }
                            }
                        });
                    });
                }
            }
        })();

        // Put in the element it belongs in straight away, e.g. a tab-relative window in its tab's
        // content, rather than flashing at its page position until it is next placed.
        popup.updatePlacement();

        if (options.popupReuseId) {

            popupReuseMap.set(
                options.popupReuseId,
                { _window, contentContainer, popup, contentListenerOwner, refitToReusedContent }
            );
        }

        return popup;
    };

    /**
     * Closes every open popup window matching the selector.  Use this rather than removing the
     * elements, which would leave the windows' listeners and resize observers holding on to them.
     */
    Ren.ClosePopupWindows = (selector) => {

        document.querySelectorAll(selector).forEach(element => {

            if (element.popup) {
                element.popup.closeWindow();
            }
            else {

                element.remove();
            }
        });
    };

    /**
     * Stops the popup open under the reuse ID from being reused, leaving it open, so that the
     * next popup given the ID opens anew and becomes the one reused.
     */
    Ren.ReleasePopupReuseId = (popupReuseId) => {

        popupReuseMap.delete(popupReuseId);
    };
})();
