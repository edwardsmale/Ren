/**
 * Helper that generates target elements for visualisations.
 */
Ren.VisualisationTargetElementGenerator = (() => {

    /**
     * Creates and returns a target element and selector for a visualisation.  Returns an object
     * containing the targetElement and targetSelector.  The target element will need to be added
     * to the DOM by the caller.
     */
    const createTargetElementForVisualisation = () => {

        const targetClassName = Ren.RandomUtils.generateRandomClassName("ren-target");

        const targetElement = Ren.HtmlUtils.create("div")
            ._addClass(
                targetClassName,
                "ren-visualisation-target"
            );

        return {
            targetElement,
            targetSelector: "." + targetClassName
        };
    };

    return {
        createTargetElementForVisualisation
    };
})();
