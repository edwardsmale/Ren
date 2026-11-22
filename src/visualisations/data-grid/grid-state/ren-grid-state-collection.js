/**
 * Maintains a list of the grid state objects that have been materialised.  Note this collection
 * contains fully-fledged grid state objects, not simply parsed settings JSON.
 */
Ren.GridStateCollection = (() => {

    const entries = [];

    /**
     * Adds a grid state object to the collection.
     */
    const addGridState = (gridState) => {

        if (entries.includes(gridState)) return;

        entries.push(gridState);
    };

    /**
     * Returns the first grid state object with the given group.
     */
    const getGridState = (gridStateGroup) => {

        return entries.find(r => r.gridStateGroup === gridStateGroup);
    };

    /**
     * Returns the grid state object for a specific data grid.
     */
    const getGridStateByDataGridGuid = (dataGridGuid) => {

        return entries.find(r => r.dataGridGuid === dataGridGuid);
    };

    /**
     * Returns the latest grid state with the given group made by the given visualisation, in
     * transformed format.  Recreating a visualisation leaves its replaced grids' states behind, so
     * the latest is the one in use when it was recreated.
     */
    const getGridStateTransformed = (gridStateGroup, visualisationGuid, tabularData) => {

        let gridState = null;

        for (let i = entries.length - 1; i >= 0; i--) {

            if (entries[i].gridStateGroup === gridStateGroup &&
                entries[i].visualisationGuid === visualisationGuid) {

                gridState = entries[i];
                break;
            }
        }

        if (!gridState) return null;

        // The grid state holds columns by index into its own tabular data, which is not the given
        // one when a transformer such as Duplicate Column has since added a column before them.
        const ownTabularData =
            Ren.TabularDataPool.getByTabularDataGuid(gridState.tabularDataGuid) ||
            Ren.DataSources.getTabularDataByTabularDataGuid(gridState.tabularDataGuid);

        return Ren.GridStateTransformer.transform(ownTabularData || tabularData, gridState);
    };

    /**
     * Deletes any grid states that are not used by any visualisations.
     */
    const garbageCollect = () => {

        for (let i = entries.length - 1; i >= 0; i--) {

            const key = entries[i].gridStateGroup;

            const isUsed = Ren.VisualisationCollection.hasVisualisationUsingSettingsGroup(
                key,
                vis => vis.gridStateGroup
            );

            if (!isUsed) entries.splice(i, 1);
        }
    };

    Ren.Messages.Events.visualisationDestroyed.handle(garbageCollect);

    const destroyAllGridState = () => {

        entries.forEach(gs => { gs.isDestroyed = true; });
        entries.length = 0;
    };

    return {
        addGridState,
        destroyAllGridState,
        getGridState,
        getGridStateByDataGridGuid,
        getGridStateTransformed,
        entries,
        garbageCollect
    };
})();
