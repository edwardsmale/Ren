/**
 * Creates instances of Ren.DataGroupingSettings.  These contain the settings and current state of
 * a visualisation's data groupings, including sorting, filtering and grouping settings.
 * This class exists in order to add functions to the settings object, since when these settings
 * are deserialized from JSON, they only contain data, and no functions.
 *
 * NB even if multiple visualisations have the same data grouping settings group, each visualisation
 * still has its own separate instance of Ren.DataGroupingSettings, because the instance contains
 * the current state of the groups, and this may differ per visualisation.
 */
Ren.DataGroupingSettingsFactory = (() => {

    const createDataGroupingSettings = (
        tabularData,
        visualisation,
        expandedGroups,
        addToCollection,
        dataGroupingSettingsGroup) => {

        if (tabularData.isDestroyed) {

            Ren.GlobalErrorHandler.logError(
                "[DataGroupingSettingsFactory] tabularData is destroyed."
            );

            console.trace();
            return null;
        }

        expandedGroups = expandedGroups ?? new Set();

        // Settings that aren't added to the collection are scratch settings, built to read
        // aggregated values rather than to be rendered, so they track no row display positions.
        const dataGroupingSettings = Ren.DataGroupingSettings(
            tabularData,
            visualisation,
            addToCollection !== false,
            dataGroupingSettingsGroup
        );

        // --- Copy outerFilterSet from initial settings if present ---
        if (visualisation.reportSettings && dataGroupingSettings.dataGroupingSettingsGroup) {

            const initialSettings = Ren.DataGroupingSettings_Initial.getInitialDataGroupingSettings(
                dataGroupingSettings.dataGroupingSettingsGroup,
                visualisation.reportSettings
            );

            // Initial settings may contain an outerFilterSet from older code paths.  Store it
            // temporarily so it can be applied to the second-to-last grouping when groupings
            // are populated.  We avoid creating dataGroupingSettings.outerFilterSet.
            if (initialSettings?.outerFilterSet) {
                dataGroupingSettings._initialOuterFilterSet = initialSettings.outerFilterSet;
            }
        }

        Ren.DataGroupingSettings_Services.addDataGroupingSettingsServices(
            tabularData,
            dataGroupingSettings,
            expandedGroups
        );

        if (addToCollection !== false) {
            Ren.DataGroupingSettingsCollection.addDataGroupingSettings(dataGroupingSettings);
        }

        return dataGroupingSettings;
    };

    return {
        createDataGroupingSettings
    };
})();
