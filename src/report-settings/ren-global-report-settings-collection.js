/**
 * Maintains an in-memory collection of global report settings (such as raiseReport). These settings
 * are preserved across save/load cycles and are included in serialized report settings.
 */
Ren.GlobalReportSettingsCollection = (() => {

    const globalSettings = {};

    /**
     * Sets the raiseReport setting.  False is held as the setting's absence, so that it is left out
     * of the serialised report settings.
     *
     * @param {boolean} value - The value to set.
     */
    const setRaiseReport = (value) => {

        if (value === true) {
            globalSettings.raiseReport = true;
        }
        else {

            delete globalSettings.raiseReport;
        }
    };

    /**
     * Toggles the raiseReport setting and applies the result to the page.
     */
    const toggleRaiseReport = () => {

        setRaiseReport(!globalSettings.raiseReport);

        Ren.Messages.Requests.applyDeserialisedGlobalReportSettings.notify();
    };

    /**
     * Sets the showReportHeader setting.  True is held as the setting's absence, so that it is
     * left out of the serialised report settings.
     *
     * @param {boolean} value - The value to set.
     */
    const setShowReportHeader = (value) => {

        if (value === false) {
            globalSettings.showReportHeader = false;
        }
        else {

            delete globalSettings.showReportHeader;
        }
    };

    /**
     * Gets a value indicating whether the report header module is shown.
     */
    const getShowReportHeader = () => globalSettings.showReportHeader !== false;

    /**
     * Toggles the showReportHeader setting and applies the result to the page.
     */
    const toggleShowReportHeader = () => {

        setShowReportHeader(!getShowReportHeader());

        Ren.Messages.Requests.applyDeserialisedGlobalReportSettings.notify();
    };

    /**
     * Gets all global settings.
     *
     * @returns {Object} An object containing all global settings.
     */
    const getAllGlobalSettings = () => {

        return { ...globalSettings };
    };

    /**
     * Applies the global report settings such as raiseReport.
     */
    const applyGlobalReportSettings = (reportSettings) => {

        if (!reportSettings) return;

        if (reportSettings.raiseReport !== undefined) {

            setRaiseReport(reportSettings.raiseReport);
        }

        if (reportSettings.showReportHeader !== undefined) {

            setShowReportHeader(reportSettings.showReportHeader);
        }

        Ren.Messages.Requests.applyDeserialisedGlobalReportSettings.notify();
    };

    return {
        applyGlobalReportSettings,
        setRaiseReport,
        toggleRaiseReport,
        setShowReportHeader,
        getShowReportHeader,
        toggleShowReportHeader,
        getAllGlobalSettings
    };
})();
