/**
 * Function for getting the menu item for turning on and off the auto preview in the function
 * editors opened from a datagrid's cells (see Ren.FunctionEditorAutoPreview).  It is on unless the
 * setting is false, so that a grid whose setting has never been set has it.
 */
Ren.ContextMenuItems_DataGridAutoPreview = (visualisation) => {

    const isAutoPreviewEnabled = () => visualisation.autoPreviewEnabled !== false;

    const toggleAutoPreview = () => {

        visualisation.autoPreviewEnabled = !isAutoPreviewEnabled();

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    const getMenuItem = () => {

        return {
            text: "Auto preview",
            id: "layout-auto-preview",
            ticked: isAutoPreviewEnabled,
            action: toggleAutoPreview
        };
    };

    return {
        getMenuItem
    };
};
