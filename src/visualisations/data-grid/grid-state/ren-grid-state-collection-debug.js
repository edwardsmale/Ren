/**
 * Shows a window that displays the current state of the grid state collection as JSON.
 */
Ren.GridStateCollection_Debug = (() => {

    const produceJson = () => {

        const pretty = {};
        const indented = {};
        const raw = {};

        for (let i = 0; i < Ren.GridStateCollection.entries.length; i++) {

            const gridState = Ren.GridStateCollection.entries[i];

            const tabularData = Ren.TabularDataPool.getByTabularDataGuid(
                gridState.tabularDataGuid
            );

            pretty[gridState.gridStateGroup] =
                Ren.GridStateTransformer.transform(tabularData, gridState, true);
            indented[gridState.gridStateGroup] =
                Ren.GridStateTransformer.transform(tabularData, gridState, false);
            raw[gridState.gridStateGroup] = gridState;
        }

        return { pretty, indented, raw };
    };

    const showGridStateCollectionDebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "ren-grid-state-collection-debug-window",
            "Grid State Collection",
            550 - 120,
            300,
            produceJson
        );

        debugWindow.updateOnStateChange(() => Ren.GridStateCollection);
    };

    Ren.Messages.Requests.gridStateCollectionDebugWindow.handle(() => {

        showGridStateCollectionDebugWindow();
    });
})();
