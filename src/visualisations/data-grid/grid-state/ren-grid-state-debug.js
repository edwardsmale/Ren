/**
 * Shows a window that displays the current grid state as syntax-highlighted JSON.
 */
Ren.GridState_Debug = (tabularData, gridState) => {

    const showGridStateDebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "ren-grid-state-debug-window",
            "Grid State",
            500 - 120,
            200,
            () => ({
                pretty: Ren.GridStateTransformer.transform(tabularData, gridState, true),
                indented: Ren.GridStateTransformer.transform(tabularData, gridState, false),
                raw: gridState
            })
        );

        Ren.Messages.Events.gridStateChanged.handle((newGridState) => {

            if (newGridState && newGridState.gridStateGroup !== gridState.gridStateGroup) return;

            debugWindow.update();
        });
    };

    Ren.Messages.Requests.gridStateDebugWindow.handle((guid) => {

        if (guid === gridState.dataGridGuid) {
            showGridStateDebugWindow();
        }
    });
};
