/**
 * Shows a window displaying the visualisation's settings as syntax-highlighted JSON.
 */
Ren.VisualisationSettings_Debug = (visualisation) => {

    const visualisationSettingsTransformer = Ren.VisualisationSettingsDebugTransformer();

    const showVisualisationSettingsDebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "ren-visualisation-settings-debug-window",
            "Visualisation Settings",
            600 - 120,
            200,
            () => ({
                pretty: visualisationSettingsTransformer.transform(visualisation, true),
                indented: visualisationSettingsTransformer.transform(visualisation, false),
                raw: visualisation
            })
        );

        debugWindow.updateOnStateChange(() => visualisation);
    };

    if (visualisation.visualisationTypeName === "StatBar") return;
    if (visualisation.visualisationTypeName === "PagingBar") return;

    Ren.Messages.Requests.visualisationSettingsDebugWindow.handle((guid) => {

        if (guid === visualisation.visualisationGuid) {
            showVisualisationSettingsDebugWindow();
        }
    });
};
