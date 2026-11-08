/**
 * Resolves the data grouping settings a visualisation should work with: those of a source a
 * visualisation is begotten from, and those of the group a consuming visualisation reads.
 */
Ren.DataGroupingSettingsSource = (() => {

    /**
     * Gets the live data grouping settings of the visualisation's active data tab, or null.
     */
    const getActiveDataGroupingSettings = (visualisation, dataTabIndex) => {

        const instance = visualisation?.instance;

        if (!instance) return null;

        // The positional array is indexed by grid order, not necessarily by dataTabIndex, so it is
        // only a fallback.
        return instance.getActiveDataGroupingSettings?.()
            ?? instance.dataGroupingSettings?.[dataTabIndex]
            ?? null;
    };

    /**
     * Gets the source context a visualisation begotten from this visualisation is created with.
     */
    const fromVisualisation = (visualisation, dataTabIndex) => {

        const instance = visualisation?.instance;

        const activeDataTabIndex = dataTabIndex ?? instance?.getActiveDataTabIndex?.() ?? 1;
        const dataTabGroup = instance?.getActiveDataTabGroup?.() ?? null;

        const dataGroupingSettings = getActiveDataGroupingSettings(visualisation, activeDataTabIndex);

        // A grid set gives each grid its own settings group, which its events are fired with.
        const dataGroupingSettingsGroup = dataGroupingSettings?.dataGroupingSettingsGroup
            ?? visualisation?.dataGroupingSettingsGroup;

        const filterGroup = dataGroupingSettings?.filterGroup
            ?? visualisation?.filterGroup
            ?? visualisation?.dataGroupingSettingsGroup;

        return {
            visualisation,
            dataTabIndex: activeDataTabIndex,
            dataTabGroup,
            dataGroupingSettings,
            dataGroupingSettingsGroup,
            filterGroup
        };
    };

    /**
     * Gets the source's live settings for one of its data tabs, or null.  Every grid in a set
     * shares one settings group and visualisation GUID, so looking the group up would answer with
     * the first tab's settings.
     */
    const resolveForDataTab = (sourceVisualisation, dataTabIndex) => {

        if (dataTabIndex == null) return null;

        return sourceVisualisation?.instance?.getDataGroupingSettingsForDataTabIndex?.(dataTabIndex)
            ?? null;
    };

    /**
     * Resolves the live settings of the group a consuming visualisation reads from.  Returns
     * undefined while the source has yet to register its settings, the consumer's cue to return
     * Ren.NotReady.
     */
    const resolve = (
        dataGroupingSettingsGroup, sourceVisualisation, presetDataGroupingSettings, dataTabIndex
    ) =>
        presetDataGroupingSettings
        ?? resolveForDataTab(sourceVisualisation, dataTabIndex)
        ?? Ren.DataGroupingSettingsCollection.getDataGroupingSettings(
            dataGroupingSettingsGroup,
            sourceVisualisation?.visualisationGuid
        );

    return {
        getActiveDataGroupingSettings,
        fromVisualisation,
        resolve
    };
})();
