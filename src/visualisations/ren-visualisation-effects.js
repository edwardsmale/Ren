/**
 * Applies CSS filter effects - hue, brightness, contrast and the like - to a visualisation.  Every
 * visualisation has them, but they reach only its elements with the visualisation-effects-apply
 * class, so each type chooses what they change.
 */
Ren.VisualisationEffects = (() => {

    const EFFECTS_APPLY_CLASS_NAME = "visualisation-effects-apply";

    // In the order they are applied, which changes the result.
    const EFFECTS = [
        {
            property: "effectHue",
            label: "Hue",
            filterFunction: "hue-rotate",
            unit: "deg",
            unitLabel: "°",
            min: 0,
            max: 359
        },
        {
            property: "effectBrightness",
            label: "Brightness",
            filterFunction: "brightness",
            unit: "%",
            unitLabel: "%",
            min: 0,
            max: 200
        },
        {
            property: "effectContrast",
            label: "Contrast",
            filterFunction: "contrast",
            unit: "%",
            unitLabel: "%",
            min: 0,
            max: 200
        },
        {
            property: "effectSaturation",
            label: "Saturation",
            filterFunction: "saturate",
            unit: "%",
            unitLabel: "%",
            min: 0,
            max: 300
        },
        {
            property: "effectGreyscale",
            label: "Greyscale",
            filterFunction: "grayscale",
            unit: "%",
            unitLabel: "%",
            min: 0,
            max: 100
        },
        {
            property: "effectSepia",
            label: "Sepia",
            filterFunction: "sepia",
            unit: "%",
            unitLabel: "%",
            min: 0,
            max: 100
        },
        {
            property: "effectInvert",
            label: "Invert",
            filterFunction: "invert",
            unit: "%",
            unitLabel: "%",
            min: 0,
            max: 100
        }
    ];

    const getDefaultValue = (effect) =>
        Ren.VisualisationTypes_CommonDefaultOptions[0][effect.property];

    const getValue = (visualisation, effect) => {

        const value = parseFloat(visualisation[effect.property]);

        return isNaN(value) ? getDefaultValue(effect) : value;
    };

    const getFilter = (visualisation) => {

        const filterFunctions = [];

        for (let i = 0; i < EFFECTS.length; i++) {

            const effect = EFFECTS[i];
            const value = getValue(visualisation, effect);

            if (value === getDefaultValue(effect)) continue;

            filterFunctions.push(`${effect.filterFunction}(${value}${effect.unit})`);
        }

        return filterFunctions.join(" ");
    };

    /**
     * Gets a value indicating whether an element belongs to a visualisation nested inside this
     * one, which has effects of its own.
     */
    const isInsideNestedVisualisation = (element, visualisationElement) => {

        const selector = Ren.VisualisationTypes.tagNames.join(",") + ",.ren-visualisation";
        const closestVisualisationElement = element.parentElement.closest(selector);

        return closestVisualisationElement !== null
            && closestVisualisationElement !== visualisationElement
            && visualisationElement.contains(closestVisualisationElement);
    };

    const applyEffects = (visualisation) => {

        const visualisationElement = visualisation.element;

        if (!visualisationElement) return;

        const filter = getFilter(visualisation);

        if (visualisationElement.classList.contains(EFFECTS_APPLY_CLASS_NAME)) {

            visualisationElement.style.filter = filter;
        }

        const elements = visualisationElement.querySelectorAll("." + EFFECTS_APPLY_CLASS_NAME);

        for (let i = 0; i < elements.length; i++) {

            if (isInsideNestedVisualisation(elements[i], visualisationElement)) continue;

            elements[i].style.filter = filter;
        }
    };

    return {
        EFFECTS_APPLY_CLASS_NAME,
        EFFECTS,
        getDefaultValue,
        getValue,
        applyEffects
    };
})();
