/**
* Sets up Alt+click highlighting for a group of elements.  A plain click is left alone, as it
* selects the element's series.
* @param {Element} parent - The element to scope the query to (e.g., props.chartGroup).
* @param {string} selector - CSS selector for selectable elements (e.g., '.bar.vertical').
* @param {string} altSelectionClass - Class name for alt selection (e.g., 'bar-alt-selected').
*/
Ren.ChartElementSelection = (() => {

    const setupSelectionHandlers = (parent, selector, altSelectionClass) => {

        let lastAltClickedIndex = null;

        const onClick = event => {

            if (!event.altKey) return;

            const elements = parent.querySelectorAll(selector);
            const clickedIndex = Array.prototype.indexOf.call(elements, event.currentTarget);

            // Alt+Shift+Click: alt-select range.
            if (event.shiftKey && lastAltClickedIndex !== null) {

                const start = Math.min(lastAltClickedIndex, clickedIndex);
                const end = Math.max(lastAltClickedIndex, clickedIndex);

                for (let index = start; index <= end; index++) {
                    elements[index].classList.add(altSelectionClass);
                }

                lastAltClickedIndex = clickedIndex;
                return;
            }

            // Alt+Click: toggle alt selection for this element only.
            event.currentTarget.classList.toggle(altSelectionClass);
            lastAltClickedIndex = clickedIndex;
        };

        const elements = parent.querySelectorAll(selector);

        // Set as the property, so that setting it up again replaces the handler rather than adding
        // another.
        for (let index = 0; index < elements.length; index++) {
            elements[index].onclick = onClick;
        }
    };

    return {
        setupSelectionHandlers
    };
})();
