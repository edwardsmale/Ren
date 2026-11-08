/**
 * Keeps track of which data grid on the page is the currently-active one.
 *
 * A data grid is not a visualisation in its own right - it belongs to a grid set, which is - so
 * "active" means the grid showing in the selected tab of the grid set that was focussed most
 * recently.  The focussed grid set is remembered rather than the grid itself, so that switching
 * tabs, or a grid being rebuilt, is followed automatically.
 *
 * Focus moves away from the grid set as soon as the user clicks anything else (the Find window, for
 * instance), so the last grid set to have had focus stays the active one until another one takes
 * it.  That is what lets a visualisation opened from a data grid go on acting on that grid.
 */
Ren.ActiveDataGrid = (() => {

    let focussedGridSetVisualisation = null;

    /**
     * Gets the grid set visualisation the active data grid belongs to, or null if there isn't one.
     */
    const getActiveGridSetVisualisation = () => {

        const visualisation = focussedGridSetVisualisation;

        if (!visualisation || visualisation.isDestroyed) return null;
        if (!visualisation.instance?.getActiveDataGridGuid) return null;

        return visualisation;
    };

    /**
     * Gets the currently-active data grid, or null if there isn't one.
     */
    const getActiveDataGrid = () => {

        const visualisation = getActiveGridSetVisualisation();

        if (!visualisation) return null;

        const dataGridGuid = visualisation.instance.getActiveDataGridGuid();
        const dataGrids = visualisation.instance.dataGrids;

        for (let i = 0; i < dataGrids.length; i++) {

            if (dataGrids[i].dataGridGuid === dataGridGuid) return dataGrids[i];
        }

        return null;
    };

    /**
     * Gets the GUID of the currently-active data grid, or null if there isn't one.
     */
    const getActiveDataGridGuid = () => {

        const visualisation = getActiveGridSetVisualisation();

        return visualisation ? visualisation.instance.getActiveDataGridGuid() : null;
    };

    /**
     * Gets a value indicating whether the specified data grid is the currently-active one.
     */
    const isActive = (dataGridGuid) => getActiveDataGridGuid() === dataGridGuid;

    Ren.Messages.Events.focusChanged.handle((focussedVisualisation) => {

        // Only a grid set displaces the grid set that is currently remembered; focussing anything
        // else (a popup opened from the grid, say) leaves the active data grid as it was.
        if (!focussedVisualisation?.instance?.getActiveDataGridGuid) return;

        focussedGridSetVisualisation = focussedVisualisation;
    });

    return {
        getActiveDataGrid,
        getActiveDataGridGuid,
        isActive
    };
})();
