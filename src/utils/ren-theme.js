/**
 * The colours Ren works out in code rather than in its stylesheet.  A host restyles them by
 * setting Ren's --ren-* custom properties, such as --ren-data-grid-background, on the page's body,
 * then notifying Ren.Messages.Events.themeChanged so that what's drawn is redrawn.
 */
Ren.Theme = (() => {

    /**
     * Gets the value of the specified --ren-* custom property on the body, or the specified
     * default where it isn't set.
     */
    const getValue = (name, defaultValue) => {

        if (!document.body) return defaultValue;

        const value = getComputedStyle(document.body).getPropertyValue("--ren-" + name).trim();

        return value || defaultValue;
    };

    /**
     * Gets a CSS value that's the specified --ren-* custom property, or the specified default
     * where it isn't set.
     */
    const cssValue = (name, defaultValue) => "var(--ren-" + name + ", " + defaultValue + ")";

    return {
        getValue,
        cssValue
    };
})();
