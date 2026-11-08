/**
 * Shows a window displaying the current state of the data grouping settings collection as JSON.
 */
Ren.DataGroupingSettingsCollection_Debug = (() => {

    const produceJson = () => {

        const pretty = {};
        const indented = {};
        const raw = {};

        for (let i = 0; i < Ren.DataGroupingSettingsCollection.entries.length; i++) {

            const dataGroupingSettings = Ren.DataGroupingSettingsCollection.entries[i];

            const tabularData = Ren.TabularDataPool.getByTabularDataGuid(
                dataGroupingSettings.tabularDataGuid
            );

            if (!tabularData) continue;

            const key = `${dataGroupingSettings.dataGroupingSettingsGroup}|${dataGroupingSettings.visualisationGuid}`;

            pretty[key] = Ren.DataGroupingSettingsTransformer.transform(
                tabularData,
                dataGroupingSettings,
                true
            );

            indented[key] = Ren.DataGroupingSettingsTransformer.transform(
                tabularData,
                dataGroupingSettings,
                false
            );

            raw[key] = dataGroupingSettings;
        }

        return { pretty, indented, raw };
    };

    const showDataGroupingSettingsCollectionDebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "data-grouping-settings-collection-debug-window",
            "Data Grouping Settings Collection",
            550 - 120,
            300,
            produceJson
        );

        debugWindow.updateOnStateChange(() => Ren.DataGroupingSettingsCollection);
    };

    Ren.Messages.Requests.dataGroupingSettingsCollectionDebugWindow.handle(() => {

        showDataGroupingSettingsCollectionDebugWindow();
    });
})();
