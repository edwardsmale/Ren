/**
 * The hooks through which a page that runs reports, such as the Editor, takes part in reading the
 * report inputs, loading and saving report settings and rendering previews.  They're registered
 * with Ren.Extensions.registerPageHooks, and each is optional.
 */
Ren.PageHooks = (() => {

    const registeredHooks = [];

    Ren.Extensions.handle("pageHooks", (hooks) => registeredHooks.push(hooks));

    /**
     * Gets a value indicating whether hooks have been registered for the Editor page.
     */
    const isEditorPage = () => {

        for (let i = 0; i < registeredHooks.length; i++) {

            if (registeredHooks[i].isEditorPage) return true;
        }

        return false;
    };

    /**
     * Lets each page add to the data read from the report inputs.
     */
    const readInputs = (data) => {

        for (let i = 0; i < registeredHooks.length; i++) {

            if (registeredHooks[i].readInputs) registeredHooks[i].readInputs(data);
        }
    };

    /**
     * Gets the report settings to apply in place of those loaded, which each page may change.
     */
    const settingsLoaded = (settings) => {

        for (let i = 0; i < registeredHooks.length; i++) {

            if (registeredHooks[i].settingsLoaded) {
                
                settings = registeredHooks[i].settingsLoaded(settings);
            }
        }

        return settings;
    };

    /**
     * Gets the report settings to apply when none could be loaded, or null if there are none.
     */
    const getFallbackSettings = () => {

        for (let i = 0; i < registeredHooks.length; i++) {

            const settings = registeredHooks[i].getFallbackSettings
                ? registeredHooks[i].getFallbackSettings()
                : null;

            if (settings) return settings;
        }

        return null;
    };

    /**
     * Lets each page tidy the report settings being serialised, given the visualisations that
     * qualify for serialisation.
     */
    const settingsSerialised = (reportSettings, visualisations) => {

        for (let i = 0; i < registeredHooks.length; i++) {

            if (registeredHooks[i].settingsSerialised) {
                registeredHooks[i].settingsSerialised(reportSettings, visualisations);
            }
        }
    };

    /**
     * Tells each page that a report preview has been rendered and added to the DOM.
     */
    const previewRendered = () => {

        for (let i = 0; i < registeredHooks.length; i++) {

            if (registeredHooks[i].previewRendered) registeredHooks[i].previewRendered();
        }
    };

    /**
     * Gets the function that opens SQL in the host's SQL editor, or null if no page has one.
     */
    const getSqlEditorOpener = () => {

        for (let i = 0; i < registeredHooks.length; i++) {

            if (registeredHooks[i].openSqlInEditor) return registeredHooks[i].openSqlInEditor;
        }

        return null;
    };

    return {
        getFallbackSettings,
        getSqlEditorOpener,
        isEditorPage,
        previewRendered,
        readInputs,
        settingsLoaded,
        settingsSerialised
    };
})();
