/**
 * Where report settings are loaded from, saved to, deleted from and listed: the store that
 * settingsStore in ren.config names, which is "http" (the server's endpoints) by default or
 * "localStorage" for use with no backend.  Others are registered through Ren.Extensions.
 *
 * Settings are of four kinds: "preset", "user", "default" (those a report loads when its URL
 * names none) and "sqlBasedPreset" (those of a report on the Editor page).  A store's load, save,
 * delete and list each return a promise, resolving to null where the store can't do that.
 */
Ren.SettingsStore = (() => {

    const DEFAULT_STORE_NAME = "http";

    const stores = {};

    Ren.Extensions.handle("settingsStore", (registration) => {

        stores[registration.name] = registration.store;
    });

    const getStore = () => {

        const name = Ren.Config.getConfig().settingsStore || DEFAULT_STORE_NAME;

        if (stores[name]) return stores[name];

        Ren.GlobalErrorHandler.logError(
            `[SettingsStore] No settings store is registered as "${name}".`
        );

        return stores[DEFAULT_STORE_NAME];
    };

    /**
     * Gets the settings as JSON, or null where there are none.  Rejects if they can't be loaded.
     */
    const load = (kind, reportName, settingsName) =>
        getStore().load(kind, reportName, settingsName);

    /**
     * Saves the settings JSON, resolving to whether it was saved, a location that names where to,
     * and, if it wasn't, the error details as Ren.DataSourceErrorPopup reads them.
     */
    const save = (kind, reportName, settingsName, serializedReportSettings) =>
        getStore().save(kind, reportName, settingsName, serializedReportSettings);

    /**
     * Deletes user settings, resolving to whether they were deleted.
     */
    const deleteSettings = (reportName, settingsName) =>
        getStore().delete(reportName, settingsName);

    /**
     * Gets the details of the report's settings, in the form of the server's
     * ReportSettingsFileDetails.
     */
    const list = (reportName, onEditorPage) => getStore().list(reportName, onEditorPage);

    /**
     * Gets a value indicating whether settings can be saved to the store.
     */
    const canSave = () => getStore().canSave();

    /**
     * Gets a value indicating whether the store can list a report's settings.
     */
    const canList = () => getStore().canList();

    return {
        canList,
        canSave,
        delete: deleteSettings,
        list,
        load,
        save
    };
})();
