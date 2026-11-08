/**
 * Deletes user report settings from the settings store.
 */
Ren.ReportSettingsDeleter = (() => {

    /**
     * Deletes the user report settings.  Doesn't support deleting preset settings.  Returns a
     * promise that resolves once they are deleted, so that callers that need to know when the
     * deletion has finished can await it.
     */
    const deleteReportSettings = (settingsName, isPreset) => {

        const reportName = Ren.WebReports.getWebReportName();

        if (!reportName && !isPreset) return Promise.resolve();

        return (async () => {

            const deleted = await Ren.SettingsStore.delete(reportName, settingsName);

            if (deleted === null) return;

            if (!deleted) {

                Ren.PopupErrorMessage("Error deleting report settings");
            }

            Ren.Messages.Events.reportSettingsFileListChanged.notify();
        })();
    };

    Ren.Messages.Requests.deleteReportSettings.handle((settingsName, isPreset) => {

        deleteReportSettings(settingsName, isPreset);
    });

    return {
        deleteReportSettings
    };
})();
