Ren.QADataGridCount = 0;

Ren.QA = (() => {

    const dataGridItems = [];

    const init = (dataGroupingSettings, dataGridCellSelection) => {

        dataGridItems.push({
            dataGroupingSettings,
            dataGridCellSelection
        });
    };

    const reset = () => {

        Ren.QADataGridCount = 0;
        dataGridItems.length = 0;
    };

    /**
     * Gets the selected cells' text.  Used by IVTs.
     */
    const getSelectedText = (gridIndex) => {

        if (dataGridItems[gridIndex] === undefined) {
            return "Invalid grid index: " + gridIndex;
        }

        return dataGridItems[gridIndex].dataGridCellSelection.getSelectedCellsTsv();
    };

    /**
     * Gets the text of the named columns, as selecting them and copying would.  Used by the
     * integration tests in place of clicking the headings, which costs them a round trip per
     * column of the grid to find the headings by their text before anything is read.
     */
    const getColumnText = (gridIndex, columnHeadings) => {

        if (dataGridItems[gridIndex] === undefined) {
            return "Invalid grid index: " + gridIndex;
        }

        return dataGridItems[gridIndex].dataGridCellSelection.getColumnsText(columnHeadings);
    };

    let pendingReloadCount = 0;

    // Report reloads and popup settings fetches show no loading animation, so IVTs wait on this.
    const beginReload = () => {

        pendingReloadCount++;
    };

    const endReload = () => {

        pendingReloadCount = Math.max(pendingReloadCount - 1, 0);
    };

    /**
     * Gets a value indicating whether a report is being reloaded, or a popup's settings loaded.
     * Used by IVTs.
     */
    const isReloading = () => pendingReloadCount > 0;

    const isIvt = () => {

        const cookies = document.cookie.split(';');

        for (let cookie of cookies) {

            const [name, value] = cookie.trim().split('=');

            if (name === 'ivt' && value === '1') return true;
        }

        return false;
    };

    /**
     * Gets the details of the current report's settings files, as the load / save report settings
     * window lists them.  The actions below go on these rather than on the window's buttons, so
     * that they save, load and delete with the isPreset and onEditorPage the button for a file
     * would have carried.
     */
    const listReportSettingsFiles = async () => {

        if (Ren.UrlContext.isDownloadedReport()) return [];

        const reportName = Ren.WebReports.getWebReportName();

        if (!reportName) return [];

        const allFileDetails =
            await Ren.SettingsStore.list(reportName, Ren.UrlContext.onEditorPage());

        return allFileDetails || [];
    };

    /**
     * Finds one settings file by name.  The preset file has no name of its own, and the window's
     * buttons render its missing name as the string "null", so callers may name it either way.
     */
    const findReportSettingsFile = async (settingsName) => {

        if (settingsName === "null") settingsName = null;

        const allFileDetails = await listReportSettingsFiles();

        for (let i = 0; i < allFileDetails.length; i++) {

            if (allFileDetails[i].Name === settingsName) return allFileDetails[i];
        }

        return null;
    };

    /**
     * Gets a promise that resolves with whether the server accepted the next save of the report
     * settings.
     */
    const whenReportSettingsSaved = () => {

        return new Promise((resolve) => {

            // The listener takes itself off by returning false rather than being registered as
            // runOnce, which the bus sweeps away whether or not it has fired - and the save
            // answers a network round trip later, long after the sweep that follows the save
            // request.
            Ren.Messages.Events.reportSettingsSaved.handle((success) => {

                resolve(success);

                return false;
            });
        });
    };

    /**
     * Saves the report's current state as a new user settings file, as the load / save report
     * settings window's Save As button does.  Resolves to whether the server accepted it.
     */
    const saveUserReportSettings = (settingsName) => {

        const saved = whenReportSettingsSaved();

        Ren.Messages.Requests.saveReportSettings.notify(settingsName, false, false);

        return saved;
    };

    /**
     * Overwrites an existing settings file, as that file's Save button in the window does.
     * Resolves to false when there is no such file.
     */
    const overwriteReportSettings = async (settingsName) => {

        const fileDetails = await findReportSettingsFile(settingsName);

        if (!fileDetails) return false;

        const saved = whenReportSettingsSaved();

        Ren.Messages.Requests.saveReportSettings.notify(
            fileDetails.Name,
            fileDetails.IsPreset,
            fileDetails.OnEditorPage
        );

        return await saved;
    };

    /**
     * Loads a settings file, as its Load button in the window does, resolving once the settings
     * have been applied to the page.  Resolves to false when there is no such file.
     */
    const loadUserReportSettings = async (settingsName) => {

        const fileDetails = await findReportSettingsFile(settingsName);

        if (!fileDetails) return false;

        // The Load button goes through the loadReportSettings request, whose handler clears the
        // page's client-side visualisations before loading so that stale ones don't linger.
        Ren.VisualisationCollection.destroyAllClientSideVisualisations();

        await Ren.ReportSettingsLoader.loadReportSettings(
            fileDetails.Name,
            fileDetails.IsPreset,
            fileDetails.OnEditorPage
        );

        return true;
    };

    /**
     * Deletes a settings file, as its Delete button in the window does.  Resolves to false when
     * there is no such file.
     */
    const deleteUserReportSettings = async (settingsName) => {

        const fileDetails = await findReportSettingsFile(settingsName);

        if (!fileDetails) return false;

        await Ren.ReportSettingsDeleter.deleteReportSettings(
            fileDetails.Name,
            fileDetails.IsPreset
        );

        return true;
    };

    /**
     * Deletes all of the current report's user report settings files, leaving the preset settings
     * intact.  Used by IVTs in place of opening the load / save report settings window and
     * clicking each delete button in turn, which is much slower.  Returns the number of settings
     * files deleted.
     */
    const deleteAllUserReportSettings = async () => {

        const allFileDetails = await listReportSettingsFiles();

        let deletedCount = 0;

        for (let i = 0; i < allFileDetails.length; i++) {

            const fileDetails = allFileDetails[i];

            // Preset settings live in the codebase, and files that don't exist have nothing to
            // delete.
            if (fileDetails.IsPreset || !fileDetails.FileExists) continue;

            await Ren.ReportSettingsDeleter.deleteReportSettings(fileDetails.Name, false);

            deletedCount++;
        }

        return deletedCount;
    };

    return {
        init,
        reset,
        getSelectedText,
        getColumnText,
        beginReload,
        endReload,
        isReloading,
        isIvt,
        listReportSettingsFiles,
        saveUserReportSettings,
        overwriteReportSettings,
        loadUserReportSettings,
        deleteUserReportSettings,
        deleteAllUserReportSettings
    };
})();
