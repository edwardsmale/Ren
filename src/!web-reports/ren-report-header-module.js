Ren.ReportHeaderModule = (() => {

    let module = null;

    /**
     * Initialises the report header module.  Places it in the body, outside the report context
     * so it persists when the report context is updated.
     */
    const initialise = (targetSelector) => {

        if (module && document.body.contains(module)) return; // Module already exists.

        Ren.FnUtils.onElementExists(targetSelector, () => {

            module = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("ReportHeaderModule");

            // Prepend to body instead of to the report context element.  This keeps the header
            // module outside of the report context so that it persists across reloads.
            const body = Ren.HtmlUtils.enrich(document.body);
            body._prepend(module);
        });
    };

    /**
     * Adds a button to the report header module.
     */
    const addButton = (button) => {

        if (!module) return;

        button._addClass("ren-report-header-module__button");

        module._append(button);
    };

    /**
     * Adds an item to the report header module, with plainer styling than a button (no box-shadow
     * or hover effects).
     */
    const addItem = (item) => {

        if (!module) return;

        item._addClass("ren-report-header-module__item");

        module._append(item);
    };

    /**
     * Adds a non-button element to the report header module.
     */
    const addElement = (element) => {

        if (!module) return;

        module._append(element);
    };

    /**
     * Enables or disables a report header button, updating its disabled styling and the tooltip
     * shown on it.
     */
    const setButtonEnabled = (button, isEnabled, enabledTooltip) => {

        if (isEnabled) {

            button._removeClass("ren-report-header-module__button--disabled");
            button._attr("title", enabledTooltip);
        }
        else {

            button._addClass("ren-report-header-module__button--disabled");
            button._attr("title", getDisabledTooltipText());
        }
    };

    /**
     * Gets the tooltip text to show when the report header button is disabled.
     */
    const getDisabledTooltipText = () => {

        if (Ren.UrlContext.onEditorPage()) {
            return "Execute the SQL to enable this button.";
        }
        else {

            return "Please wait a moment; just loading...";
        }
    };

    return {
        initialise,
        addButton,
        addItem,
        addElement,
        setButtonEnabled,
        getDisabledTooltipText
    };
})();
