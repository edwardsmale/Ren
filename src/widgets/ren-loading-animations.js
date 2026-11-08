/**
 * Creates the various types of loading animation used in Ren.
 */
Ren.LoadingAnimations = (() => {

    const createHomeEditorLoadingAnimation = () => {

        return Ren.HtmlTemplateFunctions.reifyHtmlTemplate("HomeEditorLoadingAnimation", {});
    };

    /**
     * Creates a visualisation loading animation and returns its DOM element.
     */
    const createVisualisationLoadingAnimation = (visualisation) => {

        if (visualisation.suppressLoadingAnimation) {

            return Ren.HtmlUtils.create("<div>");
        }
        else {

            return Ren.HtmlTemplateFunctions.reifyHtmlTemplate("VisualisationLoadingAnimation", {});
        }
    };

    /**
     * Creates the loading animation shown inside a scanned visualisation's target element, marked
     * with the target's selector, which is what lets each visualisation remove its own and leave
     * the others spinning.
     */
    const createTargetedVisualisationLoadingAnimation = (visualisation) => {

        const animation = createVisualisationLoadingAnimation(visualisation);

        animation.setAttribute("data-target-selector", visualisation.targetSelector);

        return animation;
    };

    /**
     * Gets a value indicating whether the passed loading animation belongs to the visualisation
     * rendered (or given up on) in the passed target.  An unmarked animation is the only one in its
     * container, and a marked one whose target has gone has nothing left to wait for.
     */
    const isLoadingAnimationForTarget = (animation, visualisationTarget) => {

        const targetSelector = animation.getAttribute("data-target-selector");

        if (!targetSelector) return true;

        const animationTarget = document.querySelector(targetSelector);

        return animationTarget === null || animationTarget === visualisationTarget;
    };

    const removeChildLoadingAnimations = (parent, visualisationTarget) => {

        const children = Array.from(parent.children);

        for (let i = 0; i < children.length; i++) {

            if (children[i].classList.contains("ren-visualisation-loading-animation") &&
                isLoadingAnimationForTarget(children[i], visualisationTarget)) {

                children[i].remove();
            }
        }
    };

    /**
     * Removes the marked loading animation of the visualisation, wherever it is, for a
     * visualisation whose element is not inside its target.
     */
    const removeTargetedLoadingAnimation = (visualisation) => {

        if (!visualisation.targetSelector) return;

        const animations = document.querySelectorAll(
            ".ren-visualisation-loading-animation[data-target-selector]"
        );

        for (let i = 0; i < animations.length; i++) {

            if (animations[i].getAttribute("data-target-selector") ===
                visualisation.targetSelector) {

                animations[i].remove();
            }
        }
    };

    const removeLoadingAnimation = (visualisation) => {

        if (!visualisation.instance) return;

        // The animation sat in the space reserved for the visualisation, which is no longer needed.
        Ren.VisualisationDimensionMemory.releaseReservedSpace(visualisation);

        removeTargetedLoadingAnimation(visualisation);

        const visualisationTarget = visualisation.instance.element.closest(".ren-visualisation-target");

        if (!visualisationTarget) return;

        removeChildLoadingAnimations(visualisationTarget.parentNode, visualisationTarget);
    };

    /**
     * Removes the loading animation of a visualisation that has not rendered, and has no instance
     * to find it by.
     */
    const removeUnrenderedLoadingAnimation = (visualisation) => {

        // An inline visualisation's animation is marked with its target; a popup's is inside it.
        const target = visualisation.targetSelector
            ? document.querySelector(visualisation.targetSelector)
            : null;

        Ren.VisualisationDimensionMemory.releaseReservedSpace(visualisation);

        removeTargetedLoadingAnimation(visualisation);

        if (target?.parentNode) {
            removeChildLoadingAnimations(target.parentNode, target);
        }

        if (visualisation.element) {
            removeChildLoadingAnimations(visualisation.element, target);
        }
    };

    /**
     * Removes the loading animations of the visualisations whose data source failed to load, which
     * would otherwise spin on behind the error for good, since they never render.
     */
    const removeLoadingAnimationsForDataSource = (dataSourceUri) => {

        const visualisations = Ren.VisualisationCollection.getVisualisations();

        for (let i = 0; i < visualisations.length; i++) {

            const visualisation = visualisations[i];

            if (!visualisation.dataSourceUri ||
                Ren.UrlUtils.sortDataSourceUriParameters(visualisation.dataSourceUri) !==
                dataSourceUri) {

                continue;
            }

            removeUnrenderedLoadingAnimation(visualisation);
        }
    };

    /**
     * Returns a value indicating whether any loading animations are currently visible on the page.
     */
    const areAnyLoadingAnimationsVisible = () => {

        const loadingAnimations = document.querySelectorAll(".js-ren-report-loading-animation");

        return Array.from(loadingAnimations).some(animation => {

            return animation.offsetWidth > 0 && animation.offsetHeight > 0;
        });
    };

    /**
     * Returns a value indicating whether any loading animations currently exist (visible or not).
     */
    const areAnyLoadingAnimationsPresent = () => {

        const loadingAnimations = document.querySelectorAll(".js-ren-report-loading-animation");

        return Array.from(loadingAnimations).length > 0;
    };

    return {
        createHomeEditorLoadingAnimation,
        createVisualisationLoadingAnimation,
        createTargetedVisualisationLoadingAnimation,
        removeLoadingAnimation,
        removeLoadingAnimationsForDataSource,
        removeUnrenderedLoadingAnimation,
        areAnyLoadingAnimationsVisible,
        areAnyLoadingAnimationsPresent
    };
})();
