/**
 * Global next z-index for popup windows, and which popup window has focus.
 */
Ren.PopupWindowOrder = (() => {

    // Floating popups ("above the page") occupy an incrementing band starting here.
    const FLOATING_BASE_Z_INDEX = 5555555;

    // Popped-in popups ("on the page") occupy a lower band so they can never obscure a floating
    // popup.  This lets a floating window (e.g. the Load/Save report settings window) stay in front
    // of on-page modules that get recreated beneath it (e.g. filter modules rebuilt when settings
    // load).
    const PAGE_LAYER_BASE_Z_INDEX = 5000000;

    let nextZIndex = FLOATING_BASE_Z_INDEX;
    let nextPageLayerZIndex = PAGE_LAYER_BASE_Z_INDEX;

    // Drag-layer offset: large enough to exceed any normally-stacked popup but well within safe
    // integer range.  A dragged popup is raised here for the duration of the drag so it stays in
    // front of every other popup regardless of the order in which they were last clicked.
    const DRAG_LAYER_OFFSET = 999999999;

    const bringToFront = (_window) => {

        const currentZIndex = window.getComputedStyle(_window).zIndex;

        if (currentZIndex < nextZIndex) {

            nextZIndex++;
            _window.style.zIndex = nextZIndex;
        }
    };

    // Places a popped-in ("on the page") window into the lower page-layer band, beneath every
    // floating popup, so on-page modules never paint over a floating window.
    const sendToPageLayer = (_window) => {

        nextPageLayerZIndex++;

        // Never let the page layer climb into the floating band.
        if (nextPageLayerZIndex >= FLOATING_BASE_Z_INDEX) {

            nextPageLayerZIndex = PAGE_LAYER_BASE_Z_INDEX + 1;
        }

        _window.style.zIndex = nextPageLayerZIndex;
    };

    // Raises the window to a temporary drag layer above all normal popup z-indexes.  Call
    // endDrag when the drag ends to settle the window back into the normal stacking order.
    const raiseToDragLayer = (_window) => {

        nextZIndex++;
        _window.style.zIndex = nextZIndex + DRAG_LAYER_OFFSET;
    };

    // Returns the window from the drag layer to the top of the normal stacking order.
    const endDrag = (_window) => {

        nextZIndex++;
        _window.style.zIndex = nextZIndex;
    };

    const FOCUSED_CLASS_NAME = "ren-report-popup-window--focused";

    let focusedWindow = null;

    // Gives the window the focused styling, taking it from the previously focused window.  Passing
    // null leaves no window focused.
    const focus = (_window) => {

        if (_window === focusedWindow) {
            return;
        }

        if (focusedWindow) {
            focusedWindow.classList.remove(FOCUSED_CLASS_NAME);
        }

        focusedWindow = _window;

        if (_window) {
            _window.classList.add(FOCUSED_CLASS_NAME);
        }
    };

    // Called as a window closes, so that the closed window's DOM tree isn't kept alive here.
    const releaseFocus = (_window) => {

        if (_window === focusedWindow) {
            focusedWindow = null;
        }
    };

    // The innermost popup is focused, so a tab-relative popup takes it from its outer popup.
    const focusWindowContainingEventTarget = (e) => {

        const _window = e.target instanceof Element
            ? e.target.closest(".ren-report-popup-window")
            : null;

        focus(_window);
    };

    document.addEventListener("mousedown", focusWindowContainingEventTarget, true);
    document.addEventListener("focusin", focusWindowContainingEventTarget, true);

    return {
        bringToFront,
        sendToPageLayer,
        raiseToDragLayer,
        endDrag,
        focus,
        releaseFocus
    };
})();
