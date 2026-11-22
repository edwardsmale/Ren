/**
 * Sets up the resize handles on a popup window's edges and bottom-right corner.  Resizing brings
 * the window to the front unless the right mouse button is used.
 */
Ren.PopupWindow_ResizeHandles = (() => {

    const TITLE_BAR_NEGATIVE_MARGIN_PX = 24; // 1.5rem * 16px
    const TITLE_BAR_TWEAK_PX = 6;

    // Gets the scale implied by a rendered size against its untransformed layout size, or ownScale
    // where they nearly agree, avoiding sub-pixel drift on ordinary popups and dividing by zero.
    const scaleOrFallback = (renderedSize, layoutSize, ownScale) => {

        if (!layoutSize) return ownScale;

        const scale = renderedSize / layoutSize;

        return Math.abs(scale - ownScale) < 0.01 ? ownScale : scale;
    };

    const createResizeHandle = position =>
        Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-report-popup-window__resize-handle",
                `ren-report-popup-window__resize-handle--${position}`
            );

    const revertResizeHandles = () => {

        document.querySelectorAll(".ren-report-popup-window__resize-handle").forEach(handle => {

            handle.style.width = "";
            handle.style.height = "";
            handle.style.top = "";
            handle.style.bottom = "";
        });
    };

    const setupResizeHandles = (_window, options, titleBar) => {

        const bottomRightResizeHandle = createResizeHandle("bottom-right");
        const topResizeHandle = createResizeHandle("top");
        const rightResizeHandle = createResizeHandle("right");
        const bottomResizeHandle = createResizeHandle("bottom");
        const leftResizeHandle = createResizeHandle("left");

        if (options.titleBarModifier) {

            topResizeHandle._addClass(
                `ren-report-popup-window__resize-handle--top--${options.titleBarModifier}`
            );
        }

        const isResizableX = options.isResizable === true || options.isResizable === "x" || options.isResizable === "X";
        const isResizableY = options.isResizable === true || options.isResizable === "y" || options.isResizable === "Y";

        if (isResizableX) {

            _window.appendChild(leftResizeHandle);
            _window.appendChild(rightResizeHandle);
        }

        if (isResizableY) {

            _window.appendChild(topResizeHandle);
            _window.appendChild(bottomResizeHandle);
        }

        if (isResizableX && isResizableY) {
            _window.appendChild(bottomRightResizeHandle);
        }

        const enlargeBottomRightResizeHandle = () => {

            bottomRightResizeHandle.style.width = "40rem";
            bottomRightResizeHandle.style.height = "40rem";
        };
        const enlargeTopResizeHandle = () => {

            topResizeHandle.style.top = "-25rem";
            topResizeHandle.style.height = "50rem";
        };
        const enlargeRightResizeHandle = () => {

            rightResizeHandle.style.width = "40rem";
        };
        const enlargeBottomResizeHandle = () => {

            bottomResizeHandle.style.bottom = "-25rem";
            bottomResizeHandle.style.height = "50rem";
        };
        const enlargeLeftResizeHandle = () => {

            leftResizeHandle.style.width = "40rem";
        };

        const setupResizeHandle = (resizeHandle, onStart, onMove, onEnlargeHandle) => {

            resizeHandle.addEventListener("mousedown", e => {

                // The browser reports a right-click on releasing the right button (on Windows),
                // which would open a context menu over the window just resized.
                const isRightButtonDrag = e.which === 3;
                let hasMovedDuringThisDrag = false;

                if (e.which === 1) {

                    Ren.PopupWindowOrder.bringToFront(_window);

                    // Tab-scoped page-coordinate popups would be hidden by raising this one above
                    // them, so they are raised with it.
                    const scopedPagePopups =
                        Ren.TabbedModulePopupDrop.getPagePopupsScopedToModule(_window);

                    for (let index = 0; index < scopedPagePopups.length; index++) {
                        Ren.PopupWindowOrder.bringToFront(scopedPagePopups[index]);
                    }
                }

                e.preventDefault();

                options.onManualResizeStarting();

                const initialRect = _window.getBoundingClientRect();
                const initialScroll = Ren.PopupPositioning.getScrollOffsets();

                // style.left/top are relative to the offsetParent, which for a tab-relative popup
                // is its tab content, so measuring in page coordinates would jump it by the
                // parent's offset on the first move.  This also encodes the scroll position.
                const offsetParent = _window.offsetParent || Ren.HtmlUtils.getBody();
                const offsetParentRect = offsetParent.getBoundingClientRect();

                // Read from the computed style, as an unpositioned body is the offsetParent but not
                // the containing block, so measuring from it would jump by the body's margin.
                const initialWindowLeft = parseFloat(window.getComputedStyle(_window).left) || 0;
                const initialWindowTop =
                    initialRect.top - offsetParentRect.top - offsetParent.clientTop;
                const initialWindowWidth = initialRect.width;
                const initialWindowHeight = initialRect.height;
                const initialMouseX = e.pageX;
                const initialMouseY = e.pageY;

                // options.scale is only this window's own zoom, but the rect also reflects any
                // transformed ancestor's, which would otherwise make the window jump on the first
                // move.  So the cumulative scale is derived against the untransformed offset size.
                const effectiveScaleX = scaleOrFallback(initialRect.width, _window.offsetWidth, options.scale);
                const effectiveScaleY = scaleOrFallback(initialRect.height, _window.offsetHeight, options.scale);

                onEnlargeHandle();

                const mouseMoveHandler = moveEvent => {

                    moveEvent.preventDefault();
                    hasMovedDuringThisDrag = true;
                    const currentScroll = Ren.PopupPositioning.getScrollOffsets();
                    const deltaX = (moveEvent.pageX + currentScroll.left) - (initialMouseX + initialScroll.left);
                    const deltaY = (moveEvent.pageY + currentScroll.top) - (initialMouseY + initialScroll.top);
                    onMove({
                        initialWindowLeft,
                        initialWindowTop,
                        initialWindowWidth,
                        initialWindowHeight,
                        effectiveScaleX,
                        effectiveScaleY,
                        deltaX,
                        deltaY,
                        moveEvent,
                        currentScroll
                    });
                };

                const mouseUpHandler = upEvent => {

                    upEvent.preventDefault();

                    // A right-press that resized nothing is left to open its menu.
                    if (isRightButtonDrag && hasMovedDuringThisDrag) {

                        Ren.ContextMenuRegistry.suppressNextRightClickMenu();
                    }

                    revertResizeHandles();
                    document.removeEventListener("mousemove", mouseMoveHandler);
                    document.removeEventListener("mouseup", mouseUpHandler);
                };

                document.addEventListener("mousemove", mouseMoveHandler);
                document.addEventListener("mouseup", mouseUpHandler);

                if (onStart) onStart(e);
            });
        };

        setupResizeHandle(
            bottomRightResizeHandle,
            null,
            ({
                initialWindowWidth,
                initialWindowHeight,
                effectiveScaleX,
                effectiveScaleY,
                deltaX,
                deltaY
            }) => {

                const newWidth = (initialWindowWidth + deltaX) / effectiveScaleX;
                const newHeight = (initialWindowHeight + deltaY) / effectiveScaleY;
                _window.style.width = newWidth + "px";
                _window.style.height = newHeight + "px";
                options.onResizeWidth(newWidth);
                options.onResizeHeight(newHeight);
                Ren.Messages.Events.popupResized.notify();
                Ren.Messages.Events.popupManuallyResized.notify(_window, 'both');
            },
            enlargeBottomRightResizeHandle
        );

        setupResizeHandle(
            topResizeHandle,
            null,
            ({ initialWindowTop, initialWindowHeight, effectiveScaleY, deltaY }) => {

                // Adjusted for the title bar's negative margin overhang.  initialWindowTop already
                // encodes scroll.
                const newTop = initialWindowTop + deltaY + 8 + titleBar.titleBarHeight - TITLE_BAR_NEGATIVE_MARGIN_PX - TITLE_BAR_TWEAK_PX;
                const newHeight = (initialWindowHeight - deltaY + TITLE_BAR_NEGATIVE_MARGIN_PX - TITLE_BAR_TWEAK_PX) / effectiveScaleY;
                _window.style.top = newTop + "px";
                _window.style.height = newHeight + "px";
                options.onMoveTop(newTop);
                options.onResizeHeight(newHeight);
                Ren.Messages.Events.popupResized.notify();
                Ren.Messages.Events.popupManuallyResized.notify(_window, 'height');
            },
            enlargeTopResizeHandle
        );

        setupResizeHandle(
            rightResizeHandle,
            null,
            ({ initialWindowWidth, effectiveScaleX, deltaX }) => {

                const newWidth = (initialWindowWidth + deltaX) / effectiveScaleX;
                _window.style.width = newWidth + "px";
                options.onResizeWidth(newWidth);
                Ren.Messages.Events.popupResized.notify();
                Ren.Messages.Events.popupManuallyResized.notify(_window, 'width');
            },
            enlargeRightResizeHandle
        );

        setupResizeHandle(
            bottomResizeHandle,
            null,
            ({ initialWindowHeight, effectiveScaleY, deltaY }) => {

                const newHeight = (initialWindowHeight + deltaY) / effectiveScaleY;
                _window.style.height = newHeight + "px";
                options.onResizeHeight(newHeight);
                Ren.Messages.Events.popupResized.notify();
                Ren.Messages.Events.popupManuallyResized.notify(_window, 'height');
            },
            enlargeBottomResizeHandle
        );

        setupResizeHandle(
            leftResizeHandle,
            null,
            ({ initialWindowLeft, initialWindowWidth, effectiveScaleX, deltaX }) => {

                // initialWindowLeft already encodes scroll, so no scroll term is added.
                const newLeft = initialWindowLeft + deltaX;
                const newWidth = (initialWindowWidth - deltaX) / effectiveScaleX;
                _window.style.left = newLeft + "px";
                _window.style.width = newWidth + "px";
                options.onMoveLeft(newLeft);
                options.onResizeWidth(newWidth);
                Ren.Messages.Events.popupResized.notify();
                Ren.Messages.Events.popupManuallyResized.notify(_window, 'width');
            },
            enlargeLeftResizeHandle
        );
    };

    return {
        setupResizeHandles
    };
})();
