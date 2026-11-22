/**
 * Sets up the minimise and maximise buttons on a popup window's title bar, and also the double-
 * click to maximise/restore functionality.
 *
 * The behaviour is designed to mimic Windows, but has a further enhancement based on RISC OS: the
 * user may right-click to maximise or restore without the window being brought to the front.
 */
Ren.PopupWindow_TitleBarResizeButtons = (() => {

    const setupResizeWindowButtons = (_window, titleBar, options) => {

        let isMaximised = false;
        let isMinimised = false;
        let storedDimensions = null;

        const storeRestoreDimensions = () => {

            storedDimensions = _window.getBoundingClientRect();
        };

        const restoreDimensions = () => {

            const scrollOffsets = Ren.PopupPositioning.getScrollOffsets();

            _window.style.width = storedDimensions.width + "px";
            _window.style.height = storedDimensions.height + "px";
            _window.style.left = (storedDimensions.left + scrollOffsets.left) + "px";
            _window.style.top = (storedDimensions.top + scrollOffsets.top) + "px";
            _window.style.bottom = "";

            options.onMoveLeft(storedDimensions.left);
            options.onMoveTop(storedDimensions.top);
            options.onResizeWidth(storedDimensions.width);
            options.onResizeHeight(storedDimensions.height);

            Ren.Messages.Events.popupResized.notify();
        };

        const setupMaximiseButton = () => {

            const toggleMaximiseWindow = (isLeftMouseButton) => {

                options.onManualResizeStarting();

                if (!isMaximised) {

                    if (!isMinimised) storeRestoreDimensions();

                    const bounds = Ren.PopupPositioning.getMaximisedBounds(titleBar.element);

                    const newLeft = bounds.left;
                    const newTop = bounds.top;

                    const newWidth = bounds.width;
                    const newHeight = bounds.height;

                    _window.style.width = newWidth + "px";
                    _window.style.height = newHeight + "px";
                    _window.style.left = newLeft + "px";
                    _window.style.top = newTop + "px";
                    _window.style.bottom = "";

                    options.onMoveLeft(newLeft);
                    options.onMoveTop(newTop);
                    options.onResizeWidth(newWidth);
                    options.onResizeHeight(newHeight);

                    Ren.Messages.Events.popupResized.notify();

                    isMaximised = true;
                    titleBar.maximiseButton.classList.add("ren-maximised");

                    isMinimised = false;
                    titleBar.minimiseButton.classList.remove("ren-minimised");

                    if (isLeftMouseButton) Ren.PopupWindowOrder.bringToFront(_window);
                }
                else {

                    restoreDimensions();
                    isMaximised = false;
                    titleBar.maximiseButton.classList.remove("ren-maximised");
                }
            };

            titleBar.maximiseButton.addEventListener("click", () => { toggleMaximiseWindow(true); });
            titleBar.maximiseButton.addEventListener("contextmenu", () => toggleMaximiseWindow(false));
            titleBar.element.addEventListener("dblclick", toggleMaximiseWindow);
        };

        const setupMinimiseButton = () => {

            const toggleMinimiseWindow = () => {

                options.onManualResizeStarting();

                if (!isMinimised) {

                    if (!isMaximised) storeRestoreDimensions();

                    _window.style.left = "0";
                    _window.style.top = "";
                    _window.style.bottom = "25px";
                    _window.style.width = "150px";
                    _window.style.height = "25px";

                    isMinimised = true;
                    titleBar.minimiseButton.classList.add("ren-minimised");

                    isMaximised = false;
                    titleBar.maximiseButton.classList.remove("ren-maximised");
                }
                else {

                    restoreDimensions();
                    isMinimised = false;
                    titleBar.minimiseButton.classList.remove("ren-minimised");
                }

                const rect = _window.getBoundingClientRect();

                options.onMoveLeft(rect.left);
                options.onMoveTop(rect.top);
                options.onResizeWidth(rect.width);
                options.onResizeHeight(rect.height);

                Ren.Messages.Events.popupResized.notify();
            };

            titleBar.minimiseButton.addEventListener("click", toggleMinimiseWindow);
        };

        setupMaximiseButton();
        setupMinimiseButton();
    };

    return {
        setupResizeWindowButtons
    };
})();
