/**
 * Shows a window that displays the current state of Ren.VisualisationCollection.
 */
Ren.VisualisationCollection_Debug = (() => {

    const showVisualisationCollection_DebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "ren-visualisation-collection-debug-window",
            "Visualisation Collection",
            200 - 120,
            200,
            () => ({
                pretty: Ren.VisualisationCollectionTransformer.transform(
                    Ren.VisualisationCollection,
                    true
                ),
                indented: Ren.VisualisationCollectionTransformer.transform(
                    Ren.VisualisationCollection,
                    false
                ),
                raw: Ren.VisualisationCollection
            })
        );

        debugWindow.updateOnStateChange(() => Ren.VisualisationCollection);
    };

    Ren.Messages.Requests.visualisationCollectionDebugWindow.handle(() => {

        showVisualisationCollection_DebugWindow();
    });
})();
