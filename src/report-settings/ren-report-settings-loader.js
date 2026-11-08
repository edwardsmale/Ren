/**
 * Loads report settings from the settings store and applies them to the page.
 */
Ren.ReportSettingsLoader = (() => {

    /**
     * Loads report settings based on the URL query parameters, if any.
     */
    const loadReportSettingsBasedOnUrlQueryParameters = () => {

        const settingsName = Ren.ReportSettingsUrlParameters.getReportSettingsNameFromQueryString();

        if (!settingsName) {

            return loadReportSettings(null, true, true);
        }
        else {

            const isPreset = Ren.ReportSettingsUrlParameters.getReportSettingsIsPresetFromQueryString();

            return loadReportSettings(settingsName, isPreset, true);
        }
    };

    // Null until settings are loaded or saved, as the page opens with the settings the server
    // embeds, which are those named in the URL.
    let mostRecentSettings = null;

    const setMostRecentSettings = (settingsName, isPreset, isDefault) => {

        mostRecentSettings = {
            settingsName,
            isPreset,
            isDefault
        };
    };

    const loadMostRecentSettings = (onEditorPage) => {

        if (!mostRecentSettings) {

            setMostRecentSettings(
                Ren.ReportSettingsUrlParameters.getReportSettingsNameFromQueryString(),
                Ren.ReportSettingsUrlParameters.getReportSettingsIsPresetFromQueryString(),
                Ren.ReportSettingsUrlParameters.urlNamesNoSettings()
            );
        }

        return loadReportSettings(
            mostRecentSettings.settingsName,
            mostRecentSettings.isPreset,
            onEditorPage,
            mostRecentSettings.isDefault
        );
    };

    /**
     * Loads the report settings for the report that the page contains from the settings store,
     * then applies them to the page.
     *
     * @param {string} settingsName - The name of the report settings to load.
     * @param {boolean} isPreset - Indicates whether the settings are a preset (stored in the
     *   codebase) or user-defined (stored in the report settings directory).
     * @param {boolean} isDefault - Indicates whether to load the report's default settings when no
     *   settings name is given, which on the Reporting server are its __Default user settings, if
     *   it has any, rather than its preset settings.
     */
    const loadReportSettings = async (settingsName, isPreset, onEditorPage, isDefault) => {

        /**
         * Applies the page's fallback settings, if it has any, when the settings store has none,
         * then fires the reportSettingsLoaded event so that callers are
         * not left waiting.
         */
        const applyFallbackAndNotify = () => {

            const fallbackSettings = onEditorPage ? Ren.PageHooks.getFallbackSettings() : null;

            if (fallbackSettings) {

                Ren.ReportSettingsLoader_Applyer.applyReportSettings(
                    fallbackSettings,
                    onEditorPage
                );
            }
            Ren.Messages.Events.reportSettingsLoaded.notify();
        };

        const reportName = Ren.WebReports.getWebReportName();

        if (!reportName) {

            // Still need to notify that settings loading is complete, even if there's no report
            // name.  Otherwise, callers waiting for this event (e.g. in ren-report-runner.js)
            // will hang indefinitely.
            Ren.Messages.Events.reportSettingsLoaded.notify();
            return;
        }

        if (settingsName === "null") settingsName = null;

        isDefault = !!isDefault && !settingsName && isPreset && !onEditorPage;

        let kind = isPreset ? "preset" : "user";

        if (onEditorPage && isPreset) {
            kind = "sqlBasedPreset";
        }
        else if (isDefault) {

            kind = "default";
        }

        setMostRecentSettings(settingsName, isPreset, isDefault);

        let textResponse;

        try {

            textResponse = await Ren.SettingsStore.load(kind, reportName, settingsName);
        }
        catch (error) {

            Ren.PopupErrorMessage("Error loading report settings");
            return;
        }

        if (textResponse === null) {

            applyFallbackAndNotify();
            return;
        }

        const diskSettings = Ren.JsonUtils_Lenient.parse(textResponse);

        if (!diskSettings || typeof diskSettings !== "object" || Array.isArray(diskSettings)) {

            Ren.PopupErrorMessage("The report settings file couldn't be read.");
            applyFallbackAndNotify();
            return;
        }

        // The page may apply in-memory changes on top of the disk settings.
        const settingsToApply =
            onEditorPage ? Ren.PageHooks.settingsLoaded(diskSettings) : diskSettings;

        Ren.ReportSettingsLoader_Applyer.applyReportSettings(settingsToApply, onEditorPage);

        // Variations and visualisations use the disk settings, not the in-memory overrides.
        Ren.ReportSettings_GridStateCollection.updateGridStateVariations(diskSettings);
        Ren.ReportSettings_DataGroupingSettingsCollection.updateDataGroupingSettingsVariations(diskSettings);

        // Report settings can contain client-side visualisations.
        Ren.VisualisationActuizer.actuize(diskSettings);

        Ren.ReportSettingsUrlParameters.updateReportSettingsNameInQueryString(
            settingsName,
            isPreset,
            isDefault
        );

        Ren.ReportSettingsFilesList.populateListOfReportSettingsFiles();

        Ren.Messages.Events.reportSettingsLoaded.notify();
    };

    Ren.Messages.Requests.loadReportSettings.handle((settingsName, isPreset, onEditorPage) => {

        // Destroy any client-side visualisations that the user created on the page before loading a
        // fresh set of settings, so that stale visualisations from the previous settings don't
        // linger on the page (and in memory) alongside the newly loaded ones.
        Ren.VisualisationCollection.destroyAllClientSideVisualisations();

        loadReportSettings(settingsName, isPreset, onEditorPage);
    });

    return {
        loadReportSettingsBasedOnUrlQueryParameters,
        loadReportSettings,
        setMostRecentSettings,
        loadMostRecentSettings
    };
})();
