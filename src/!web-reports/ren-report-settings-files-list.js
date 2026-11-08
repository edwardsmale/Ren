/**
 * Contains the list of user report settings files for the current report.
 */
Ren.ReportSettingsFilesList = (() => {

    const DEFAULT_USER_SETTINGS_NAME = "Default";

    /**
     * Contains details about all the user report settings files that exist for the current report.
     */
    const allReportSettingsFileDetails = [];

    const populateListOfReportSettingsFiles = () => {

        if (Ren.UrlContext.isDownloadedReport()) return;

        const reportName = Ren.WebReports.getWebReportName();

        if (!reportName) return;

        if (!Ren.SettingsStore.canList()) return;

        allReportSettingsFileDetails.length = 0;
        allReportSettingsFileDetails[0] = "PENDING";

        (async () => {

            const reportSettings =
                await Ren.SettingsStore.list(reportName, Ren.UrlContext.onEditorPage());

            if (reportSettings) {

                allReportSettingsFileDetails.length = 0;

                for (let i = 0; i < reportSettings.length; i++) {

                    allReportSettingsFileDetails.push(reportSettings[i]);
                }

                // Refreshes the load / save report settings window, if it is open, even when the
                // list is unchanged, as a save changes which settings the window marks as current.
                Ren.Messages.Requests.updateLoadSaveReportSettingsWindow.notify();
            }
        })();
    };

    Ren.Messages.Events.reportSettingsFileListChanged.handle(() => {

        populateListOfReportSettingsFiles();
    });

    Ren.Messages.Events.pageLoaded.handle(() => {

        if (Ren.UrlContext.onEditorPage()) {

            Ren.Messages.Events.sqlLoaded.handle(() => {

                setTimeout(() => {

                    populateListOfReportSettingsFiles();
                }, 0);
            });
        }
    });

    const settingsFileExists = (settingsName) => {

        return allReportSettingsFileDetails
            .some(fileDetails => fileDetails.Name === settingsName);
    };

    const defaultUserSettingsFileExists = () => settingsFileExists(DEFAULT_USER_SETTINGS_NAME);

    return {
        DEFAULT_USER_SETTINGS_NAME,
        allReportSettingsFileDetails,
        settingsFileExists,
        defaultUserSettingsFileExists,
        populateListOfReportSettingsFiles
    };
})();
