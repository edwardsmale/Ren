/**
 * Function for getting the menu item for showing and hiding a datagrid's stat bar.
 */
Ren.ContextMenuItems_DataGridStatBar = (gridSetVisualisation) => {

    const toggleDataGridStatBarVisibility = () => {

        if (!gridSetVisualisation.statBarVisualisationGuid) return;

        gridSetVisualisation.statBar = !gridSetVisualisation.statBar;

        const statBarVisualisation = Ren.VisualisationCollection.getVisualisationByVisualisationGuid(
            gridSetVisualisation.statBarVisualisationGuid
        );

        // The stat bar's own visualisation is committed so that it restyles itself, and the grid
        // set's because the setting lives on that: it is the one whose settings group carries the
        // change to the other grids, and the one the report settings save it from.
        Ren.VisualisationSettingsSynchroniser.commitChange(statBarVisualisation);
        Ren.VisualisationSettingsSynchroniser.commitChange(gridSetVisualisation);
    };

    const getMenuItem = () => {

        return {
            text: "Show stat bar",
            id: "layout-stat-bar",
            ticked: () => !!gridSetVisualisation.statBar,
            action: toggleDataGridStatBarVisibility
        };
    };

    return {
        getMenuItem
    };
};
