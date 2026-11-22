Ren.ReportSettingsReader = (() => {

    // Persistent: settings read from the page are merged in, and repopulate the settings
    // collections on every read, so removals must be applied here too.
    const reportSettings = {};

    // Scopes getAllSettings to a popup report, so other popups' settings are not read.
    let currentScopeElement = null;

    /**
     * Reads the page's ".js-ren-report-settings" script elements into the reportSettings object.
     */
    const readReportSettingsFromPage = () => {

        const allSettings = getAllSettings();

        // Populated before any data source URI is resolved, so a group's grids fetch the correct
        // uploaded files on their first render.
        for (let ai = 0; ai < allSettings.length; ai++) {
            Ren.UploadedFilesGroupsCollection.addFromReportSettings(allSettings[ai].settings);
        }

        reportSettings.dataGroupingSettings ??= {};
        reportSettings.gridState ??= {};

        reportSettings.visualisations = [];
        reportSettings.dataSources = [];

        for (let ai = 0; ai < allSettings.length; ai++) {

            const { scriptElement, settings } = allSettings[ai];

            normaliseVisualisationsAndDataSources(settings);
            applyPageReportSettingsDefaults(settings);

            for (let vi = 0; vi < settings.visualisations.length; vi++) {

                const visualisation = settings.visualisations[vi];

                // Visualisations from JSON files may already have fully-resolved URIs, and are
                // marked as not needing re-resolution.
                if (visualisation.needsUriReResolution !== false) {

                    Ren.DataSourceUriResolver.resolveDataSourceUri(visualisation, scriptElement);

                    // Resolved before default-dates ran, so it needs re-resolution.
                    visualisation.needsUriReResolution = true;
                }
            }

            Ren.ObjectUtils.mergeObject(settings, reportSettings);

            if (Ren.UrlContext.isDownloadedReport() && scriptElement) {
                scriptElement.classList.add("js-ren-report-settings-done");
            }
        }

        Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover.removeDuplicateQueryEmbeddings(reportSettings);

        // The filters the report is written with are saved back out however the page is filtered
        // afterwards.
        Ren.ReportSettings_IncludedFilters.capturePageFilters(reportSettings);

        Ren.ReportSettings_DataGroupingSettingsCollection.addNewDataGroupingSettings(reportSettings);
        Ren.ReportSettings_GridStateCollection.addNewGridState(reportSettings);
        Ren.ReportSettings_VisualisationPropertiesCollection.addFromReportSettings(reportSettings);

        Ren.GlobalReportSettingsCollection.applyGlobalReportSettings(reportSettings);

        // A copy, as subsequent reads reset the visualisations array.
        const result = Object.assign({}, reportSettings);
        result.visualisations = (reportSettings.visualisations || []).slice();
        result.dataSources = (reportSettings.dataSources || []).slice();
        return result;
    };

    const getAllSettings_DownloadedReportContext = (scriptElements) => {

        // The script elements are kept, marked done, as they are needed if the user downloads
        // again; the download removes the mark so the downloaded page processes them on load.
        scriptElements = scriptElements
            .filter(scriptElement => !scriptElement.classList.contains("js-ren-report-settings-done"));

        const allSettings = scriptElements
            .map(scriptElement => {

                const settings = Ren.JsonUtils_Lenient.parse(scriptElement.textContent, scriptElement);

                // Marked done only once processed, so scanify can find settings scripts created
                // within the same run.

                return {
                    scriptElement,
                    settings
                };
            });

        return allSettings;
    };

    /**
     * Gets a value indicating whether the settings script is an embedded report's settings file.
     * Its visualisations are saved in the containing report's file too, so applying both would
     * put two of each on the page.
     */
    const isEmbeddedReportSettingsFile = (scriptElement) => {

        if (!scriptElement.classList.contains("js-ren-report-settings-file")) return false;

        const reportContext = Ren.HtmlUtils.getContainingReportContext(scriptElement);

        return !!reportContext &&
            reportContext.classList.contains("js-ren-report-context--embedded-report");
    };

    /**
     * Gets all the report settings from the page's script elements, when not a downloaded report.
     */
    const getAllSettings_NormalContext = (scriptElements) => {

        scriptElements = scriptElements
            .filter(scriptElement => !scriptElement.classList.contains("js-ren-downloaded-report-visualisation-script"));

        const allSettings = scriptElements
            .map(scriptElement => {

                const settings = Ren.JsonUtils_Lenient.parse(scriptElement.textContent, scriptElement);

                if (!settings) {

                    scriptElement.remove();
                    return null;
                }

                // The containing report's settings file describes these already.
                if (isEmbeddedReportSettingsFile(scriptElement)) {

                    delete settings.visualisation;
                    delete settings.visualisations;
                }

                let visualisationScriptElement;

                // Visualisation settings go into a script element of their own, positioned where
                // they render, which the page ignores but a downloaded report creates on load.

                if (settings.visualisation) {
                    settings.visualisations = [settings.visualisation];
                }

                if (settings.visualisations) {

                    const visualisationSettings = {
                        visualisations: settings.visualisations
                    };

                    visualisationScriptElement = Ren.HtmlUtils.create("script")
                        ._addClass(
                            "js-ren-report-settings",
                            "js-ren-downloaded-report-visualisation-script"
                        )
                        ._attr("type", "application/json")
                        ._textContent(JSON.stringify(visualisationSettings));

                    scriptElement.insertAdjacentElement("afterend", visualisationScriptElement);

                    for (let vi = 0; vi < settings.visualisations.length; vi++) {

                        const visualisation = settings.visualisations[vi];

                        if (visualisation.clientSide &&
                            Ren.ReportContextCollection.isAwaitingReportContextElement(visualisation)) {

                            // Defers rendering the visualisation until its report context element
                            // is available.

                            const reportSettingsScriptElement = Ren.HtmlUtils.create("script")
                                ._addClass("js-ren-report-settings")
                                ._html(JSON.stringify({ visualisations: [visualisation] }));

                            Ren.HtmlUtils.getBody()._append(reportSettingsScriptElement);
                        }
                    }
                }

                scriptElement.remove();

                return {
                    scriptElement: visualisationScriptElement,
                    settings
                };
            });

        return allSettings.filter(item => item !== null);
    };

    /**
     * Gets all the report settings from the page's ".js-ren-report-settings" script elements.
     */
    const getAllSettings = () => {

        const queryRoot = currentScopeElement || document;
        const scriptElements = Array.from(queryRoot.querySelectorAll(".js-ren-report-settings"))
            .filter(scriptElement => scriptElement.textContent.trim());

        if (Ren.UrlContext.isDownloadedReport()) {
            return getAllSettings_DownloadedReportContext(scriptElements);
        }
        else {

            return getAllSettings_NormalContext(scriptElements);
        }
    };

    const normaliseSingularToPlural = (settings, singular, plural) => {

        if (settings[singular] && !settings[plural]) {

            settings[plural] = [settings[singular]];
            delete settings[singular];
        }
    };

    const normaliseVisualisationsAndDataSources = (settings) => {

        normaliseSingularToPlural(settings, "visualisation", "visualisations");
        normaliseSingularToPlural(settings, "dataSource", "dataSources");

        settings.visualisations ??= [];
        settings.dataSources ??= [];
    };

    const applyPageReportSettingsDefaults = (settings) => {

        for (let i = 0; i < settings.visualisations.length; i++) {

            settings.visualisations[i].isInsidePopup = false;
        }
    };

    const removeVariationFromSettingsSection = (settings, settingsGroup, variationName) => {

        if (!settings) return;

        const keys = Object.keys(settings);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            if (key.startsWith(settingsGroup + "__") && key.endsWith("__" + variationName)) {

                delete settings[key];
            }
        }
    };

    /**
     * Removes a variation's settings from the persistent reportSettings object, or the next read
     * would re-add a variation deleted via the variations window.
     */
    const removeVariation = (dataGroupingSettingsGroup, gridStateGroup, variationName) => {

        removeVariationFromSettingsSection(
            reportSettings.dataGroupingSettings,
            dataGroupingSettingsGroup,
            variationName
        );

        removeVariationFromSettingsSection(
            reportSettings.gridState,
            gridStateGroup,
            variationName
        );
    };

    const setScopeElement = (element) => {

        currentScopeElement = element;
    };

    const clearScopeElement = () => {

        currentScopeElement = null;
    };

    return {
        readReportSettingsFromPage,
        removeVariation,
        setScopeElement,
        clearScopeElement
    };
})();
