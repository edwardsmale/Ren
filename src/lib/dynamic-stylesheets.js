/**
 * Facilitates the creation of dynamic stylesheets for the report preview.  Dynamic stylesheets are
 * used to efficiently apply styles without having to modify DOM elements.
 */
Ren.DynamicStylesheets = (() => {

    const stylesheetsContainerClass = "js-ren-dynamic-stylesheets-container";
    let stylesheetsContainer = null;

    const stylesheetElementsByClass = new Map();
    const stylesheetClassesByGuid = new Map();

    const getStylesheetsContainer = () => {

        if (stylesheetsContainer && stylesheetsContainer.isConnected) return stylesheetsContainer;

        stylesheetsContainer = document.querySelector("." + stylesheetsContainerClass);

        return stylesheetsContainer;
    };

    // At the end of the body, not in the head, as the stylesheets override ren.css's rules of the
    // same specificity, so they must come after it, and a host page can load ren.css in its body.
    const getOrCreateStylesheetsContainer = () => {

        const existingContainer = getStylesheetsContainer();

        if (existingContainer) return existingContainer;

        stylesheetsContainer = document.createElement("div");
        stylesheetsContainer.className = stylesheetsContainerClass;
        document.body.appendChild(stylesheetsContainer);

        return stylesheetsContainer;
    };

    const getStylesheetClass = (guid, name) => `ren-style-${guid}-${name}`;
    const getGuidKey = guid => String(guid ?? "");

    const getStylesheet = (guid, name) => {

        const stylesheetClass = getStylesheetClass(guid, name);

        const cachedStylesheet = stylesheetElementsByClass.get(stylesheetClass);

        if (cachedStylesheet && cachedStylesheet.isConnected) return cachedStylesheet;

        const stylesheet = getOrCreateStylesheetsContainer().querySelector("." + stylesheetClass);

        if (stylesheet) stylesheetElementsByClass.set(stylesheetClass, stylesheet);

        return stylesheet;
    };

    const addStylesheetClassToGuidLookup = (guid, stylesheetClass) => {

        const guidKey = getGuidKey(guid);

        if (!stylesheetClassesByGuid.has(guidKey)) stylesheetClassesByGuid.set(guidKey, new Set());

        stylesheetClassesByGuid.get(guidKey).add(stylesheetClass);
    };

    const usedStylesheetClasses = new Set();

    const deleteStylesheetWithClass = (stylesheetClass) => {

        const stylesheet = stylesheetElementsByClass.get(stylesheetClass)
            ?? getOrCreateStylesheetsContainer().querySelector("." + stylesheetClass);

        if (stylesheet) {

            stylesheet.remove();
            stylesheetElementsByClass.delete(stylesheetClass);
            usedStylesheetClasses.delete(stylesheetClass);
        }
    };

    /**
     * Removes all dynamic stylesheets associated with the specified GUID.
     */
    const removeDynamicStylesheets = (guid) => {

        const guidKey = getGuidKey(guid);

        const stylesheetClasses = stylesheetClassesByGuid.get(guidKey);

        if (stylesheetClasses && stylesheetClasses.size) {

            stylesheetClasses.forEach((stylesheetClass) => {

                deleteStylesheetWithClass(stylesheetClass);
            });

            stylesheetClassesByGuid.delete(guidKey);

            return;
        }

        const stylesheetElements = getOrCreateStylesheetsContainer().querySelectorAll(`style[data-guid='${guidKey}']`);

        stylesheetElements.forEach(stylesheetElement => {

            const stylesheetClass = Ren.HtmlUtils.getClassName(stylesheetElement, "ren-style-");

            if (stylesheetClass) {

                usedStylesheetClasses.delete(stylesheetClass);
                stylesheetElementsByClass.delete(stylesheetClass);
            }

            stylesheetElement.remove();
        });

        stylesheetClassesByGuid.delete(guidKey);
    };

    const setupDynamicStylesheet = (guid, name) => {

        const stylesheetsContainer = getOrCreateStylesheetsContainer();
        const stylesheetClass = getStylesheetClass(guid, name);

        let stylesheet = getStylesheet(guid, name);

        if (!stylesheet) {

            stylesheet = document.createElement("style");
            stylesheet.classList.add(stylesheetClass);
            stylesheet.dataset.guid = getGuidKey(guid);
            stylesheetsContainer.appendChild(stylesheet);
        }

        stylesheetElementsByClass.set(stylesheetClass, stylesheet);
        usedStylesheetClasses.add(stylesheetClass);
        addStylesheetClassToGuidLookup(guid, stylesheetClass);

        const getOrRestoreStylesheet = () => {

            if (stylesheet && stylesheet.isConnected) return stylesheet;

            stylesheet = getStylesheet(guid, name);

            if (stylesheet) return stylesheet;

            stylesheet = document.createElement("style");
            stylesheet.classList.add(stylesheetClass);
            stylesheet.dataset.guid = getGuidKey(guid);
            getOrCreateStylesheetsContainer().appendChild(stylesheet);
            stylesheetElementsByClass.set(stylesheetClass, stylesheet);
            addStylesheetClassToGuidLookup(guid, stylesheetClass);

            return stylesheet;
        };

        let prevStyles = stylesheet.textContent || null;
        const prefix = guid ? "." + guid + " " : "";

        const scopeSelectorsAndConcatenate = (styles) => {

            if (!prefix) return styles.join("\n");

            return prefix + styles.join("\n" + prefix);
        };

        const updateIfChanged = (styles) => {

            const newStyles = scopeSelectorsAndConcatenate(styles);

            if (newStyles !== prevStyles) {

                getOrRestoreStylesheet().textContent = newStyles;
                prevStyles = newStyles;
            }
        };

        return {
            getStylesheet: getOrRestoreStylesheet,
            scopeSelectorsAndConcatenate,
            updateIfChanged
        };
    };

    return {
        setupDynamicStylesheet,
        removeDynamicStylesheets,
        getStylesheet
    };
})();
