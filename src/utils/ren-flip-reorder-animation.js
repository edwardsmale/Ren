/**
 * Animates a list whose elements have been reordered in the DOM, so that they appear to slide from
 * where they were to where they now are.
 */
Ren.FlipReorderAnimation = (() => {

    const transitionStyle = "transform 0.1s ease-out";
    const smallestMovementWorthAnimating = 0.1; // px

    /**
     * Runs a reordering of elements already in the document, and animates the move.
     *
     * The technique is FLIP: each element's position is read before and after the reordering, and
     * the element is then put back where it started with a transform, which is transitioned away.
     *
     * @param {Array} elements The elements being reordered, in any order.
     * @param {Function} reorderElements Performs the reordering itself.
     */
    const animateReorder = (elements, reorderElements) => {

        const topsBeforeReorder = [];

        for (let i = 0; i < elements.length; i++) {

            topsBeforeReorder.push(elements[i].getBoundingClientRect().top);
        }

        reorderElements();

        // The whole set is measured before anything is moved back, since writing an element's
        // transform invalidates the layout that the next element's measurement would then have to
        // force.
        const movedElements = [];

        for (let i = 0; i < elements.length; i++) {

            const element = elements[i];
            const deltaY = topsBeforeReorder[i] - element.getBoundingClientRect().top;

            if (Math.abs(deltaY) <= smallestMovementWorthAnimating) continue;

            movedElements.push({ element: element, deltaY: deltaY });
        }

        if (movedElements.length === 0) return;

        for (let i = 0; i < movedElements.length; i++) {

            const element = movedElements[i].element;

            element.style.transition = "none";
            element.style.transform = `translateY(${movedElements[i].deltaY}px)`;
        }

        // Reading the height forces the reflow that makes the transforms the starting point of the
        // transitions rather than a state the browser never paints.  Layout is worked out for the
        // document as a whole, so one read commits the transforms written above however many
        // elements carry them.
        void movedElements[0].element.offsetHeight;

        for (let i = 0; i < movedElements.length; i++) {

            const element = movedElements[i].element;

            element.style.transition = transitionStyle;
            element.style.transform = "translateY(0)";

            element.addEventListener("transitionend", () => {

                element.style.transition = "none";
                element.style.transform = "";
            }, { once: true });
        }
    };

    return {
        animateReorder
    };
})();
