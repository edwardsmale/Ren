/**
 * Applies report settings to the page following a Load button click in the user report settings
 * window or when reports are previewed on the Editor page.
 */
Ren.ReportSettingsLoader_Applyer = (() => {

    /**
     * @param {boolean} populateCollectionsForActuizer - If true, also populates the collections
     *   directly, for grids the Actuizer creates later from JSON visualisation settings.
     * @param {boolean} sendNotifications - If true, updates already-existing grids.  False for
     *   isolated contexts (e.g. popup reports), to prevent cross-contamination.
     */
    const applyReportSettings = (reportSettings, populateCollectionsForActuizer = false, sendNotifications = true) => {

        Ren.GlobalReportSettingsCollection.applyGlobalReportSettings(reportSettings);

        Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover.removeDuplicateQueryEmbeddings(
            reportSettings
        );

        // The loaded filters are saved back out however the page is filtered afterwards, and marks
        // are cleared as this is a new page as far as its filters are concerned.
        Ren.ReportSettings_IncludedFilters.captureLoadedFilters(reportSettings);
        Ren.ReportSettings_IncludedFilters.clearPageFilterMarks();

        // Early, so format functions are available when visualisations initialise.
        Ren.FormatFunctions.createFunctionsFromReportSettings(reportSettings);

        if (populateCollectionsForActuizer) {

            for (const gridStateGroup in reportSettings.gridState) {

                const gridState = reportSettings.gridState[gridStateGroup];

                Ren.ReportSettings_GridStateCollection.allGridState[gridStateGroup] = gridState;
            }

            for (const dataGroupingSettingsGroup in reportSettings.dataGroupingSettings) {

                Ren.ReportSettings_DataGroupingSettingsCollection.allDataGroupingSettings[dataGroupingSettingsGroup] =
                    reportSettings.dataGroupingSettings[dataGroupingSettingsGroup];
            }

            // Falls through, to also update grids already created (e.g. the preview's main
            // GridSet).
        }

        // For visualisations rebuilt from their markup rather than created from these settings.
        Ren.ReportSettings_VisualisationPropertiesCollection.addFromReportSettings(reportSettings);

        if (sendNotifications) {
            Ren.VisualisationPropertiesTransformer.applyToExistingVisualisations();
        }

        // Applying re-fetches existing target visualisations; adding serves those the actuizer
        // creates later.
        if (sendNotifications) {
            Ren.UploadedFilesGroupsCollection.applyReportSettings(reportSettings);
        }
        else {

            Ren.UploadedFilesGroupsCollection.addFromReportSettings(reportSettings);
        }

        if (sendNotifications) {

            for (const gridStateGroup in reportSettings.gridState) {

                const gridState = reportSettings.gridState[gridStateGroup];
                gridState.gridStateGroup = gridStateGroup;

                // Null report context GUID: a settings load applies to the whole page.
                Ren.Messages.Requests.applyDeserialisedGridState.notify(gridState, null);
            }

            for (const dataGroupingSettingsGroup in reportSettings.dataGroupingSettings) {

                const dataGroupingSettings = reportSettings.dataGroupingSettings[dataGroupingSettingsGroup];
                dataGroupingSettings.dataGroupingSettingsGroup = dataGroupingSettingsGroup;

                Ren.Messages.Requests.applyDeserialisedDataGroupingSettings.notify(
                    dataGroupingSettings,
                    null
                );
            }

            Ren.Messages.Requests.collapseAllGroups.notify(null);
            Ren.Messages.Events.variationsChanged.notify();
        }
    };

    return {
        applyReportSettings
    };
})();
