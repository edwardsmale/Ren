/**
 * Wires up message handlers that update the datagrid when its data grouping settings change.
 */
Ren.DataGridUpdater = (() => {

    const bindDataGroupingSettingsChangedMessages = (
        tabularData,
        dataGroupingSettings,
        dataGroupingSettingsApplyer) => {

        let lastProcessedSettingsSignifier = null;

        Ren.Messages.Events.dataGroupingSettingsChanged.handle((settings) => {

            if (tabularData.isDestroyed) return false;
            if (dataGroupingSettings.isDestroyed) return false;

            if (!Ren.ReportContextMatch.isSameDataGroupingSettingsGroup(
                settings,
                dataGroupingSettings
            )) return;

            if (settings.signifier === lastProcessedSettingsSignifier) return;
            if (settings.isDestroyedCleanup) return;

            // Remove event handler if dataGroupingSettingsApplyer has an old tabularData.
            if (dataGroupingSettingsApplyer.tabularData !== tabularData) return false;

            lastProcessedSettingsSignifier = settings.signifier;

            const transformedDataGroupingSettings = Ren.DataGroupingSettingsTransformer.transform(
                tabularData,
                settings
            );

            dataGroupingSettingsApplyer.applyDataGroupingSettings(transformedDataGroupingSettings);
        });
    };

    return {
        bindDataGroupingSettingsChangedMessages
    };
})();
