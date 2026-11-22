/**
 * Works out where a popup window goes, shifting a newly opened one clear of any already open in the
 * same place, and keeping windows on screen where the user can reach them.
 */
Ren.PopupPositioning = (() => {

    // Where a window whose caller names no position opens.
    const DEFAULT_LEFT = 40;
    const DEFAULT_TOP = 100;

    // Two windows within this many pixels of each other are taken to be in the same place.
    const CLASH_TOLERANCE = 2;

    // How far down and right a clashing window is shifted on each attempt.
    const SHIFT = 40;

    // Once a window has been shifted this far down the page, it goes back to its original top
    // position and starts again a further SHIFT pixels to the right.
    const MAX_VERTICAL_SHIFT = 400;

    // Safety net, so that a pathological arrangement of windows can never spin the search forever.
    const MAX_ATTEMPTS = 200;

    // Kept clear at the left and right edges, so that a window is always grabbable.
    const SCREEN_MARGIN = 25;

    // How much of a window's top has to stay on screen for its title bar to be grabbable.
    const TITLE_BAR_HEIGHT = 26;
    const THIN_TITLE_BAR_HEIGHT = 8;

    // Kept clear around a maximised window.  The resize handles stand 6px out from its right and
    // bottom edges, and any less would have them overflow the page and give it scroll bars.
    const MAXIMISED_MARGIN = 6;

    const popupWindows = [];

    /**
     * Gets the page's current scroll position.
     */
    const getScrollOffsets = () => ({
        left: window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
        top: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    });

    /**
     * Gets the position and size of a window filling the browser window, excluding its scroll bars.
     * The title bar is measured, as its height depends on what it holds: its negative top margin
     * lifts it above the window's top, and any height beyond that pushes the window's content down
     * past its bottom.
     */
    const getMaximisedBounds = (titleBarElement) => {

        const scrollOffsets = getScrollOffsets();

        // The body in quirks mode, as reports are shown in, and the html element otherwise.  Its
        // client size is then the browser window's, less any scroll bars.
        const viewport = document.scrollingElement || document.documentElement;

        const titleBarHeight = titleBarElement.offsetHeight;
        const titleBarLift = -parseFloat(getComputedStyle(titleBarElement).marginTop) || 0;

        return {
            left: scrollOffsets.left + MAXIMISED_MARGIN,
            top: scrollOffsets.top + MAXIMISED_MARGIN + titleBarLift,
            width: viewport.clientWidth - (MAXIMISED_MARGIN * 2),
            height: viewport.clientHeight - (MAXIMISED_MARGIN * 2) - titleBarHeight
        };
    };

    /**
     * Drops any windows that are no longer in the document.
     */
    const prune = () => {

        for (let index = popupWindows.length - 1; index >= 0; index--) {

            if (!popupWindows[index].isConnected) popupWindows.splice(index, 1);
        }
    };

    const add = (_window) => {

        prune();

        if (popupWindows.indexOf(_window) === -1) popupWindows.push(_window);
    };

    const remove = (_window) => {

        const index = popupWindows.indexOf(_window);

        if (index !== -1) popupWindows.splice(index, 1);

        prune();
    };

    /**
     * Gets the popup window elements currently on the page.
     */
    const getAll = () => {

        prune();

        return popupWindows.slice();
    };

    /**
     * Gets the position of a popup window, in page coordinates.
     */
    const getPosition = (_window) => {

        const left = parseFloat(_window.style.left);
        const top = parseFloat(_window.style.top);

        if (!isNaN(left) && !isNaN(top)) return { left, top };

        const rect = _window.getBoundingClientRect();
        const scrollOffsets = getScrollOffsets();

        return {
            left: rect.left + scrollOffsets.left,
            top: rect.top + scrollOffsets.top
        };
    };

    /**
     * Gets the positions a newly opened window should keep clear of, which popped-in and hidden
     * windows are not.
     */
    const getOccupiedPositions = (windowToIgnore) => {

        prune();

        const positions = [];

        for (let index = 0; index < popupWindows.length; index++) {

            const _window = popupWindows[index];

            if (_window === windowToIgnore) continue;
            if (_window.classList.contains("ren-report-popup-window--popped-in")) continue;
            if (_window.style.visibility === "hidden") continue;

            // offsetParent is null for a window that is not displayed, e.g. one on another tab.
            if (!_window.offsetParent) continue;

            positions.push(getPosition(_window));
        }

        return positions;
    };

    /**
     * Gets a value indicating whether the given position is within CLASH_TOLERANCE pixels of any of
     * the given occupied positions.
     */
    const clashes = (left, top, occupiedPositions) => {

        for (let index = 0; index < occupiedPositions.length; index++) {

            const position = occupiedPositions[index];

            if (Math.abs(position.left - left) <= CLASH_TOLERANCE &&
                Math.abs(position.top - top) <= CLASH_TOLERANCE) {

                return true;
            }
        }

        return false;
    };

    const getDefaultPosition = () => {

        const scrollOffsets = getScrollOffsets();

        return {
            left: DEFAULT_LEFT + scrollOffsets.left,
            top: DEFAULT_TOP + scrollOffsets.top
        };
    };

    /**
     * Brings a position back onto the screen, clear of the left and right edges with the title bar
     * below the top.  A popped-in window keeps its exact position, or one converted from content
     * near the top of the page would be shoved down over whatever sits beneath it.
     */
    const keepOnScreen = (left, top, width, options) => {

        const scrollOffsets = getScrollOffsets();

        const minLeft = options.isPoppedIn ? 0 : SCREEN_MARGIN;

        if (left < minLeft + scrollOffsets.left) {
            left = minLeft + scrollOffsets.left;
        }

        if (left + width > window.innerWidth - SCREEN_MARGIN + scrollOffsets.left) {
            left = window.innerWidth - width - SCREEN_MARGIN + scrollOffsets.left;
        }

        const titleBarHeight = options.isPoppedIn
            ? 0
            : (options.titleBarModifier === "thin" ? THIN_TITLE_BAR_HEIGHT : TITLE_BAR_HEIGHT);

        if (top < titleBarHeight + scrollOffsets.top) {
            top = titleBarHeight + scrollOffsets.top;
        }

        return { left, top };
    };

    /**
     * Gets a position for a newly opened window that does not coincide with any window already
     * open.  The position and each candidate are passed through adjustPosition (e.g. keeping it on
     * screen) before being tested.  Shifts are made from the adjusted position, since shifting the
     * requested one would, on a scrolled page, be undone by the adjustment.
     */
    const getNonClashingPosition = (left, top, windowToIgnore, adjustPosition) => {

        const adjust = (candidateLeft, candidateTop) => adjustPosition
            ? adjustPosition(candidateLeft, candidateTop)
            : { left: candidateLeft, top: candidateTop };

        const occupiedPositions = getOccupiedPositions(windowToIgnore);

        const basePosition = adjust(left, top);

        let position = basePosition;

        if (!occupiedPositions.length) return position;

        let columnShift = 0;
        let verticalShift = 0;
        let attempts = 0;

        while (clashes(position.left, position.top, occupiedPositions) && attempts < MAX_ATTEMPTS) {

            attempts++;
            columnShift += SHIFT;
            verticalShift += SHIFT;

            if (verticalShift >= MAX_VERTICAL_SHIFT) {

                verticalShift = 0;
            }

            position = adjust(
                basePosition.left + columnShift,
                basePosition.top + verticalShift
            );
        }

        return position;
    };

    return {
        add,
        remove,
        getAll,
        getScrollOffsets,
        getMaximisedBounds,
        getDefaultPosition,
        getNonClashingPosition,
        keepOnScreen
    };
})();
