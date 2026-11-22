/**
 * Shows a window that displays the current data grouping settings as syntax-highlighted JSON.
 */
Ren.DataGroupingSettings_Debug = (tabularData, dataGridGuid, dataGroupingSettings) => {

    const showDataGroupingSettingsDebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "data-grouping-settings-debug-window",
            "Data Grouping Settings",
            400 - 120,
            200,
            () => ({
                pretty: Ren.DataGroupingSettingsTransformer.transform(
                    tabularData,
                    dataGroupingSettings,
                    true
                ),
                indented: Ren.DataGroupingSettingsTransformer.transform(
                    tabularData,
                    dataGroupingSettings,
                    false
                ),
                raw: dataGroupingSettings
            })
        );

        let lastProcessedDebugSignifier = null;

        Ren.Messages.Events.dataGroupingSettingsChanged.handle((settings) => {

            if (!Ren.ReportContextMatch.isSameDataGroupingSettingsGroup(
                settings,
                dataGroupingSettings
            )) return;

            if (settings.signifier === lastProcessedDebugSignifier) return;

            lastProcessedDebugSignifier = settings.signifier;
            debugWindow.update();
        });
    };

    Ren.Messages.Requests.dataGroupingSettingsDebugWindow.handle((guid) => {

        if (guid === dataGridGuid) {
            showDataGroupingSettingsDebugWindow();
        }
    });
};
