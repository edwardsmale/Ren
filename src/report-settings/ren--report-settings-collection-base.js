/**
 * Base functionality for settings collections (data grouping settings and grid state), with
 * support for variations and garbage collection.
 */
Ren.SettingsCollectionBase = (() => {

    /**
     * @param {Object} options
     * @param {string} options.collectionName - Name for logging, e.g. "DataGroupingSettings".
     * @param {string} options.settingsKey - Report settings key, e.g. "dataGroupingSettings".
     * @param {Function} options.getSettingsGroupFromVis - Gets a visualisation's settings group.
     */
    const createCollection = (options) => {

        const { settingsKey, getSettingsGroupFromVis } = options;
        const allSettings = {};

        const updateVariations = (reportSettings) => {

            if (!reportSettings || !reportSettings[settingsKey]) return;

            removeMissingVariations(reportSettings);
            addNewSettings(reportSettings);
        };

        const removeMissingVariations = (reportSettings) => {

            if (!reportSettings || !reportSettings[settingsKey]) return;

            const variantKeys = Object.keys(allSettings);

            for (let i = 0; i < variantKeys.length; i++) {

                const key = variantKeys[i];
                if (!key.includes("__")) continue;
                if (!reportSettings[settingsKey][key]) delete allSettings[key];
            }
        };

        const addNewSettings = (reportSettings) => {

            if (!reportSettings || !reportSettings[settingsKey]) return;

            for (const key in reportSettings[settingsKey]) {

                if (allSettings[key]) continue;

                allSettings[key] = reportSettings[settingsKey][key];
            }
        };

        const getSettings = (settingsGroup, variationName) => {

            if (variationName) {
                return allSettings[settingsGroup + "__" + variationName];
            }
            else {

                return allSettings[settingsGroup];
            }
        };

        const hasSettings = (settingsGroup) => {

            return !!allSettings[settingsGroup];
        };

        /**
         * Gets a clone of the settings, stamped with the settings group it came from.
         */
        const getClonedSettings = (settingsGroup, variationName) => {

            let settings = getSettings(settingsGroup, variationName);

            if (!settings) return null;

            settings = Ren.ObjectUtils.clone(settings);

            settings[settingsKey + "Group"] = settingsGroup;

            return settings;
        };

        const replaceSettingsWithExisting = (reportSettings, settingsGroup) => {

            const existingSettings = getSettings(settingsGroup);

            if (existingSettings) {
                reportSettings[settingsKey][settingsGroup] = existingSettings;
            }
        };

        const garbageCollect = () => {

            // The Editor page's preview cycle manages settings itself, and collecting here would
            // erase settings loaded during the fetch, leaving grids to initialise without them.
            if (Ren.UrlContext.onEditorPage()) return;

            const gcKeys = Object.keys(allSettings);

            for (let i = 0; i < gcKeys.length; i++) {

                const key = gcKeys[i];
                const isUsed = Ren.VisualisationCollection.hasVisualisationUsingSettingsGroup(
                    key,
                    getSettingsGroupFromVis
                );

                if (!isUsed) delete allSettings[key];
            }
        };

        Ren.Messages.Events.visualisationDestroyed.handle(garbageCollect);

        return {
            updateVariations,
            addNewSettings,
            allSettings,
            getSettings,
            hasSettings,
            getClonedSettings,
            replaceSettingsWithExisting,
            garbageCollect
        };
    };

    return {
        createCollection
    };
})();
