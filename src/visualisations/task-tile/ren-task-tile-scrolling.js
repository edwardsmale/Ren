/**
 * Scrolls to a task tile gone to from a reference to it, easing in and out.  Animated here rather
 * than by the browser, which jumps when the system turns off animations.  A scroll started while
 * another is under way takes its place.
 */
Ren.TaskTileScrolling = (() => {

    const DURATION_MS = 600;
    const SIDE_MARGIN_PX = 16;

    let currentAnimation = null;

    /**
     * Gets the nearest ancestor of the given element that scrolls, or the page's scrolling
     * element for one in none.
     */
    const getScrollContainer = (shownElement) => {

        let ancestor = shownElement.parentElement;

        while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {

            const style = getComputedStyle(ancestor);
            const isScrollable = /auto|scroll/.test(style.overflowX + " " + style.overflowY);
            const hasOverflow =
                ancestor.scrollHeight > ancestor.clientHeight ||
                ancestor.scrollWidth > ancestor.clientWidth;

            if (isScrollable && hasOverflow) return ancestor;

            ancestor = ancestor.parentElement;
        }

        return document.scrollingElement;
    };

    /**
     * Gets how far to scroll across for the given rectangle to be in view, or 0 for one already in
     * view.
     */
    const getHorizontalDistance = (rect, viewLeft, viewRight) => {

        if (rect.left >= viewLeft && rect.right <= viewRight) return 0;

        if (rect.left < viewLeft) return rect.left - viewLeft - SIDE_MARGIN_PX;

        return Math.min(
            rect.right - viewRight + SIDE_MARGIN_PX,
            rect.left - viewLeft - SIDE_MARGIN_PX
        );
    };

    const easeInOut = (progress) => {

        if (progress < 0.5) return 4 * progress * progress * progress;

        return 1 - Math.pow(-2 * progress + 2, 3) / 2;
    };

    /**
     * Scrolls the given element to its scroll-margin-top below the top of its scroll container,
     * and across into view if it is out of it.
     */
    const scrollTo = (shownElement) => {

        const scrollContainer = getScrollContainer(shownElement);
        const isPage = scrollContainer === document.scrollingElement;
        const containerRect = scrollContainer.getBoundingClientRect();
        const viewTop = isPage ? 0 : containerRect.top;
        const viewLeft = isPage ? 0 : containerRect.left;
        const viewRight = viewLeft + scrollContainer.clientWidth;

        const rect = shownElement.getBoundingClientRect();
        const marginTop = parseFloat(getComputedStyle(shownElement).scrollMarginTop) || 0;

        const startTop = scrollContainer.scrollTop;
        const startLeft = scrollContainer.scrollLeft;
        const distanceTop = rect.top - viewTop - marginTop;
        const distanceLeft = getHorizontalDistance(rect, viewLeft, viewRight);

        const animation = {};
        let startTime = null;

        currentAnimation = animation;

        const step = (time) => {

            if (currentAnimation !== animation) return;

            if (startTime === null) {
                startTime = time;
            }

            const eased = easeInOut(Math.min(1, (time - startTime) / DURATION_MS));

            scrollContainer.scrollTop = startTop + distanceTop * eased;
            scrollContainer.scrollLeft = startLeft + distanceLeft * eased;

            if (eased < 1) {
                requestAnimationFrame(step);
            }
        };

        requestAnimationFrame(step);
    };

    return {
        scrollTo
    };
})();
