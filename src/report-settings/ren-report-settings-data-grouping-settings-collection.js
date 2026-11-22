/**
 * Contains all of the data grouping settings that exist on the page.  Only contains the settings,
 * and not materialised data grouping settings objects.
 */
Ren.ReportSettings_DataGroupingSettingsCollection = (() => {

    const baseCollection = Ren.SettingsCollectionBase.createCollection({
        collectionName: "DataGroupingSettings",
        settingsKey: "dataGroupingSettings",
        getSettingsGroupFromVis: vis => vis.dataGroupingSettingsGroup
    });

    const {
        allSettings: allDataGroupingSettings,
        updateVariations: updateDataGroupingSettingsVariations,
        addNewSettings: addNewDataGroupingSettings,
        getSettings: getDataGroupingSettings,
        hasSettings: hasDataGroupingSettings,
        garbageCollect
    } = baseCollection;

    /**
     * Gets a clone of the data grouping settings for the given group and variation, stamped with
     * the group.  Where the grid's data tabs are given, a tab whose query has changed since its
     * settings were saved is given the settings saved against its query instead.
     *
     * @param {Object} tabs - The visualisation's data tabs (optional; see
     *   Ren.SettingsEmbeddingMatcher.findSettingsForTab).
     * @param {number} tabIndex - The index of the grid's data tab among them.
     */
    const getClonedDataGroupingSettings = (settingsGroup, variationName, tabs, tabIndex) => {

        // Variations are chosen by name, so are never paired with a query.
        if (variationName || !tabs) {
            return baseCollection.getClonedSettings(settingsGroup, variationName);
        }

        const match = Ren.SettingsEmbeddingMatcher.findSettingsForTab(
            tabIndex,
            tabs,
            allDataGroupingSettings
        );

        if (!match) return null;

        const settings = Ren.ObjectUtils.clone(allDataGroupingSettings[match.key]);

        settings.dataGroupingSettingsGroup = settingsGroup;

        return settings;
    };

    /**
     * If there are existing data grouping settings for the given group, replaces the data grouping
     * settings in the report settings with those existing settings.
     */
    const replaceDataGroupingSettingsWithExisting = (reportSettings, settingsGroup) => {

        baseCollection.replaceSettingsWithExisting(reportSettings, settingsGroup);
    };

    return {
        updateDataGroupingSettingsVariations,
        addNewDataGroupingSettings,
        allDataGroupingSettings,
        getDataGroupingSettings,
        getClonedDataGroupingSettings,
        replaceDataGroupingSettingsWithExisting,
        hasDataGroupingSettings,
        garbageCollect
    };
})();
