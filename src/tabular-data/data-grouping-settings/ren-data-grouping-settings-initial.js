Ren.DataGroupingSettings_Initial = (() => {

    /**
     * Gets any data grouping settings specified in the initial report settings (loaded from the
     * web report's JSON file).  Where the grid's data tabs are given, a tab whose
     * query has changed since its settings were saved is given the settings saved against its
     * query instead.
     *
     * @param {Object} tabs - The visualisation's data tabs (optional; see
     *   Ren.SettingsEmbeddingMatcher.findSettingsForTab).
     * @param {number} tabIndex - The index of the grid's data tab among them.
     */
    const getInitialDataGroupingSettings = (
        dataGroupingSettingsGroup,
        reportSettings,
        tabs,
        tabIndex) => {

        const allSettings = reportSettings?.dataGroupingSettings;

        if (!allSettings) return null;
        if (!tabs) return allSettings[dataGroupingSettingsGroup] ?? null;

        const match = Ren.SettingsEmbeddingMatcher.findSettingsForTab(
            tabIndex,
            tabs,
            allSettings
        );

        if (!match) return null;

        // Another tab's settings are cloned, as applying them brings their objects along.
        return match.key === dataGroupingSettingsGroup ?
            allSettings[match.key] :
            Ren.ObjectUtils.clone(allSettings[match.key]);
    };

    return {
        getInitialDataGroupingSettings
    };
})();
