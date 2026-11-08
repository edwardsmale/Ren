Ren.ReportSettingsSaver = (() => {

    const initialise = () => {

        /**
         * Saves the report settings to the settings store.
         */
        const saveReportSettings = (settingsName, isPreset, isSqlBasedReport) => {

            const reportName = Ren.WebReports.getWebReportName();

            if (!reportName) return;

            let kind = isPreset ? "preset" : "user";

            if (isSqlBasedReport && isPreset) {
                kind = "sqlBasedPreset";
            }

            // Saving the __Default settings leaves a URL that names no settings as it is.
            const leaveUrlUnchanged = !isPreset &&
                settingsName === Ren.ReportSettingsFilesList.DEFAULT_USER_SETTINGS_NAME &&
                Ren.ReportSettingsUrlParameters.urlNamesNoSettings();

            storeReportSettings(kind, reportName, settingsName, isPreset, false, leaveUrlUnchanged);
        };

        const storeReportSettings = async (
            kind,
            reportName,
            settingsName,
            isPreset,
            isDefault,
            leaveUrlUnchanged
        ) => {

            const result = await Ren.SettingsStore.save(
                kind,
                reportName,
                settingsName,
                Ren.ReportSerializer.serializeReportSettings()
            );

            if (!result) return;

            Ren.Messages.Events.reportSettingsSaved.notify(
                result.ok,
                result.location,
                result.errorDetails
            );

            Ren.Messages.Events.reportSettingsFileListChanged.notify();

            // An embedded report re-applies the saved settings after a parameter change.
            Ren.ReportSettingsLoader.setMostRecentSettings(settingsName, isPreset, isDefault);

            if (leaveUrlUnchanged) return;

            Ren.ReportSettingsUrlParameters.updateReportSettingsNameInQueryString(
                settingsName,
                isPreset,
                isDefault
            );
        };

        /**
         * Saves the report's default settings, which the server keeps in the report's __Default
         * user settings file on the Reporting server and in its preset settings file elsewhere,
         * whatever settings the URL names, and removes the settings parameters from the URL.
         */
        const saveDefaultReportSettings = () => {

            const reportName = Ren.WebReports.getWebReportName();

            if (!reportName) return;

            storeReportSettings("default", reportName, null, true, true);
        };

        /**
         * Saves the settings named in the URL, or the report's default settings if none are.  On
         * the Editor page, saves the SQL-based report's preset settings, as saving the SQL does.
         */
        const saveCurrentReportSettings = () => {

            if (Ren.UrlContext.onEditorPage()) {

                saveReportSettings(null, true, true);
                return;
            }

            const settingsName = Ren.ReportSettingsUrlParameters.getReportSettingsNameFromQueryString();
            const isPreset = Ren.ReportSettingsUrlParameters.getReportSettingsIsPresetFromQueryString();

            if (settingsName || !isPreset) {

                saveReportSettings(settingsName, isPreset, false);
            }
            else {

                saveDefaultReportSettings();
            }
        };

        Ren.Messages.Requests.saveReportSettings.handle((settingsName, isPreset, isSqlBasedReport) => {

            saveReportSettings(settingsName, isPreset, isSqlBasedReport);
        });

        Ren.Messages.Requests.saveCurrentReportSettings.handle(() => {

            saveCurrentReportSettings();
        });

        Ren.Messages.Requests.saveDefaultReportSettings.handle(() => {

            saveDefaultReportSettings();
        });

        // When SQL is saved on the Editor page, also save the report settings to the preset file,
        // provided a preview has been generated (so we don't overwrite existing settings with an
        // empty state).  sqlSaved is an editor-only message, so only register the handler there.
        if (Ren.UrlContext.onEditorPage()) {

            Ren.Messages.Events.sqlSaved.handle(() => {

                if (!Ren.GridStateCollection.entries.length) return;

                saveReportSettings(null, true, true);
            });
        }

        Ren.ReportSettingsFilesList.populateListOfReportSettingsFiles();
    };

    return {
        initialise
    };
})();
