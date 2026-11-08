/**
 * Keeps report settings in the browser's localStorage, for use with no backend.  Each report has
 * one preset, which is also its default and its Editor page settings, and any number of user
 * settings.
 */
(() => {

    const KEY_PREFIX = "ren-report-settings:";

    const LOCATION = "localStorage";

    const getKey = (kind, reportName, settingsName) =>
        KEY_PREFIX + reportName + (kind === "user" ? "__" + (settingsName || "") : "");

    const read = (key) => {

        try {

            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        }
        catch (error) {

            return null;
        }
    };

    const formatNow = () => new Date().toISOString().replace("T", " ").substring(0, 19);

    const load = (kind, reportName, settingsName) => {

        const entry = read(getKey(kind, reportName, settingsName));

        return Promise.resolve(entry ? entry.serializedReportSettings : null);
    };

    const save = (kind, reportName, settingsName, serializedReportSettings) => {

        const key = getKey(kind, reportName, settingsName);
        const existing = read(key);
        const now = formatNow();

        try {

            localStorage.setItem(key, JSON.stringify({
                serializedReportSettings,
                createdDateTime: existing ? existing.createdDateTime : now,
                lastWriteTime: now
            }));

            return Promise.resolve({ ok: true, location: LOCATION, errorDetails: null });
        }
        catch (error) {

            const errorDetails = {
                error: error.message,
                details: null,
                sqlThatFailed: null,
                isUserFacing: true
            };

            return Promise.resolve({ ok: false, location: LOCATION, errorDetails });
        }
    };

    const deleteSettings = (reportName, settingsName) => {

        try {

            localStorage.removeItem(getKey("user", reportName, settingsName));
            return Promise.resolve(true);
        }
        catch (error) {

            return Promise.resolve(false);
        }
    };

    const createFileDetails = (reportName, settingsName, isPreset, onEditorPage) => {

        const key = getKey(isPreset ? "preset" : "user", reportName, settingsName);
        const entry = read(key);

        return {
            IsPreset: isPreset,
            FileName: settingsName ? reportName + "__" + settingsName : reportName,
            FullPath: key,
            FileExists: !!entry,
            Report: reportName,
            Name: settingsName,
            IsDefault: settingsName === null,
            CreatedDateTime: entry ? entry.createdDateTime : null,
            LastWriteTime: entry ? entry.lastWriteTime : null,
            Load: key,
            Save: key,
            Delete: key,
            OnEditorPage: onEditorPage,
            CanSave: true,
            CanDelete: !isPreset,
            IsLoadedByDefault: isPreset
        };
    };

    const list = (reportName, onEditorPage) => {

        const userKeyPrefix = KEY_PREFIX + reportName + "__";
        const settingsNames = [];

        try {

            for (let index = 0; index < localStorage.length; index++) {

                const key = localStorage.key(index);

                if (key.startsWith(userKeyPrefix)) {
                    settingsNames.push(key.substring(userKeyPrefix.length));
                }
            }
        }
        catch (error) {

            return Promise.resolve(null);
        }

        settingsNames.sort();

        const allFileDetails = [createFileDetails(reportName, null, true, onEditorPage)];

        for (let index = 0; index < settingsNames.length; index++) {

            allFileDetails.push(
                createFileDetails(reportName, settingsNames[index], false, onEditorPage)
            );
        }

        return Promise.resolve(allFileDetails);
    };

    Ren.Extensions.registerSettingsStore("localStorage", {
        canList: () => true,
        canSave: () => true,
        delete: deleteSettings,
        list,
        load,
        save
    });
})();
