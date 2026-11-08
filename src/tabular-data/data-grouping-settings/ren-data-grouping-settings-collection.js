/**
 * Maintains a list of the data grouping settings on the page.  Note this collection contains
 * fully-fledged data grouping settings objects, not simply parsed settings JSON.
 */
Ren.DataGroupingSettingsCollection = (() => {

    const entries = [];

    const waitQueue = [];

    /**
     * Calls any callbacks in the wait queue for the given data grouping settings, then removes
     * them from the queue.
     */
    const callWaitingCallbacks = (dataGroupingSettings) => {

        for (let i = waitQueue.length - 1; i >= 0; i--) {

            const entry = waitQueue[i];

            if (entry.dataGroupingSettingsGroup === dataGroupingSettings.dataGroupingSettingsGroup &&
                (!entry.visualisationGuid || entry.visualisationGuid === dataGroupingSettings.visualisationGuid)) {

                entry.callback(dataGroupingSettings);
                waitQueue.splice(i, 1);
            }
        }
    };

    /**
     * Removes the settings registered for a filter group nothing owned, now that something does.
     */
    const removeFilterGroupOnlySettings = (dataGroupingSettingsGroup) => {

        for (let i = entries.length - 1; i >= 0; i--) {

            if (entries[i].isFilterGroupOnly
                && entries[i].dataGroupingSettingsGroup === dataGroupingSettingsGroup) {

                entries[i].isDestroyed = true;
                entries.splice(i, 1);
            }
        }
    };

    /**
     * Adds a data grouping settings object to the collection.
     */
    const addDataGroupingSettings = (dataGroupingSettings) => {

        if (entries.includes(dataGroupingSettings)) return;

        if (!dataGroupingSettings.isFilterGroupOnly) {
            removeFilterGroupOnlySettings(dataGroupingSettings.dataGroupingSettingsGroup);
        }

        if (entries.some(r =>
            r.dataGroupingSettingsGroup === dataGroupingSettings.dataGroupingSettingsGroup &&
            r.visualisationGuid === dataGroupingSettings.visualisationGuid
        )) {

            return;
        }

        entries.push(dataGroupingSettings);

        callWaitingCallbacks(dataGroupingSettings);

        Ren.Messages.Events.dataGroupingSettingsRegistered.notify();
    };

    /**
     * Returns the data grouping settings for the given group and visualisation GUID.
     * If visualisationGuid is provided, prefers an exact match on both; falls back to first match
     * by group only.  If visualisationGuid is omitted, returns the first match by group.
     */
    const getDataGroupingSettings = (dataGroupingSettingsGroup, visualisationGuid) => {

        if (visualisationGuid) {

            return entries.find(r =>
                r.dataGroupingSettingsGroup === dataGroupingSettingsGroup &&
                r.visualisationGuid === visualisationGuid
            );
        }

        return entries.find(r => r.dataGroupingSettingsGroup === dataGroupingSettingsGroup);
    };

    /**
     * Returns data grouping settings with the given group, in transformed format.
     * If sourceVisualisationGuid is provided, prefers settings from that specific visualisation.
     * Otherwise falls back to the first matching entry by dataGroupingSettingsGroup.
     */
    const getDataGroupingSettingsTransformed = (dataGroupingSettingsGroup, tabularData, sourceVisualisationGuid) => {

        const dataGroupingSettings =
            (sourceVisualisationGuid && getDataGroupingSettings(dataGroupingSettingsGroup, sourceVisualisationGuid)) ||
            getDataGroupingSettings(dataGroupingSettingsGroup);

        if (!dataGroupingSettings) return null;

        // The settings hold columns by index into their own tabular data, which is not the given
        // one when a transformer such as Duplicate Column has since added a column before them.
        const ownTabularData =
            Ren.TabularDataPool.getByTabularDataGuid(dataGroupingSettings.tabularDataGuid);

        return Ren.DataGroupingSettingsTransformer.transform(
            ownTabularData || tabularData,
            dataGroupingSettings
        );
    };

    /**
     * Returns the data grouping settings for the given tabularDataGuid and
     * dataGroupingSettingsGroup.
     */
    const getDataGroupingSettingsByTabularDataGuidAndDataGroupingSettingsGroup = (tabularDataGuid, dataGroupingSettingsGroup) => {

        return entries.find(r =>
            r.tabularDataGuid === tabularDataGuid &&
            r.dataGroupingSettingsGroup === dataGroupingSettingsGroup
        );
    };

    /**
     * Calls the callback with the dataGroupingSettings when the group/visualisation is added to the
     * collection.  If already present, calls the callback immediately.  visualisationGuid is
     * optional; when provided, waits for the specific visualisation's instance.
     */
    const waitForDataGroupingSettings = (dataGroupingSettingsGroup, visualisationGuid, callback) => {

        if (typeof visualisationGuid === 'function') {

            callback = visualisationGuid;
            visualisationGuid = null;
        }

        const existing = getDataGroupingSettings(dataGroupingSettingsGroup, visualisationGuid);

        if (existing) {

            callback(existing);
            return;
        }

        waitQueue.push({
            dataGroupingSettingsGroup,
            visualisationGuid,
            callback
        });
    };

    /**
     * Removes any data grouping settings that are not used by any visualisations, and marks them
     * as destroyed.
     */
    const garbageCollect = () => {

        for (let i = entries.length - 1; i >= 0; i--) {

            const isUsed = Ren.VisualisationCollection.hasVisualisationUsingSettingsGroup(
                entries[i].dataGroupingSettingsGroup,
                entries[i].isFilterGroupOnly
                    ? vis => vis.filterGroup
                    : vis => vis.dataGroupingSettingsGroup
            );

            if (!isUsed) {

                entries[i].isDestroyed = true;
                entries.splice(i, 1);
            }
        }
    };

    Ren.Messages.Events.visualisationDestroyed.handle(garbageCollect);

    /**
     * Removes all data grouping settings in the collection and marks them as destroyed.
     */
    const destroyAllDataGroupingSettings = () => {

        for (let i = 0; i < entries.length; i++) {

            entries[i].isDestroyed = true;
        }

        entries.length = 0;
    };

    return {
        addDataGroupingSettings,
        destroyAllDataGroupingSettings,
        getDataGroupingSettings,
        getDataGroupingSettingsTransformed,
        getDataGroupingSettingsByTabularDataGuidAndDataGroupingSettingsGroup,
        garbageCollect,
        entries,
        waitForDataGroupingSettings
    };
})();
