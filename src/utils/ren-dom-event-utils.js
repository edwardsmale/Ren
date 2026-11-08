/**
 * Small DOM event idioms that recur across the report's controls, named so that the code using them
 * says what it is doing rather than leaving a bare stopPropagation() to be explained.
 *
 * Several of the report's containers - a filter module item, a data grid row, a compare strip -
 * treat a click anywhere within them as a selection of themselves.  A button or link drawn inside
 * one is therefore wired up here, so its click is its own and does not also read as a selection of
 * what it sits in.
 */
Ren.DomEventUtils = (() => {

    const onClickWithoutSelectingContainer = (element, handler) => {

        element.addEventListener("click", (event) => {

            event.stopPropagation();
            handler(event);
        });
    };

    /**
     * The same, for something with no click handler of its own: a checkbox the browser already
     * ticks, or the click a drag ends on.
     */
    const stopClickSelectingContainer = (element) => {

        element.addEventListener("click", (event) => event.stopPropagation());
    };

    /**
     * Keeps a mousedown from starting whatever the container does with one - a column drag, an item
     * reorder - so the pointer belongs to the element it went down on.
     */
    const stopMouseDownReachingContainer = (element) => {

        element.addEventListener("mousedown", (event) => event.stopPropagation());
    };

    return {
        onClickWithoutSelectingContainer,
        stopClickSelectingContainer,
        stopMouseDownReachingContainer
    };
})();
