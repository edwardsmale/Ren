/**
 * This supports self-closing ren-* tags, as HTML5 doesn't support self-closing custom tags.
 */
Ren.RenElementSelfClosingTagFixer = (() => {

    /**
     * Gets all ren-* elements that can be self closing.
     */
    const getAllRenElementsThatCanBeSelfClosing = () => {

        const selector = Ren.VisualisationTypes.selfClosingTagNames.join(",");

        return document.querySelectorAll(selector);
    };

    /**
     * HTML5 doesn't support self-closing custom tags, and just leaves them open, so everything 
     * that follows ends up nested inside.  This function finds any elements that are nested inside
     * ren-* but ought not to be, and moves them to be siblings of the ren-* element instead.
     */
    const fixSelfClosingRenElements = () => {

        const renElements = getAllRenElementsThatCanBeSelfClosing();

        for (let i = renElements.length - 1; i >= 0; i--) {

            const element = renElements[i];
            const renTagName = element.tagName.toLowerCase();

            const children = Array.from(element.children);

            // If element contains nested elements that are not allowed, move them to be siblings.

            // Certain nested ren-* elements are allowed, e.g.<ren-parameters-module> may contain
            // <ren-parameter>.  These are listed in the nestedTagNames property of the
            // visualisation type.
            const allowedNestedTagNames = Ren.VisualisationTypes.nestedTagNames[renTagName];

            if (allowedNestedTagNames) {

                const renElementContainsNestedElements = children.some(c =>
                    allowedNestedTagNames.includes(c.tagName.toLowerCase())
                );

                if (renElementContainsNestedElements) continue;
            }

            if (Ren.VisualisationTypes.htmlContainingTagNames.includes(element.tagName.toUpperCase())) {

                const renElementContainsNonRenElements = children.some(c =>
                    !Ren.VisualisationTypes.tagNames.includes(c.tagName.toLowerCase())
                );

                if (renElementContainsNonRenElements) continue;
            }

            // Nested tags are not of an allowed type, so move them to be siblings.
            for (let j = children.length - 1; j >= 0; j--) {

                const child = children[j];
                child.remove();
                element.after(child);
            }
        }
    };

    return {
        fixSelfClosingRenElements
    };
})();
