/**
 * Function for getting the menu item for turning on and off the highlighting of the row under the
 * mouse in a datagrid.  Highlighting is on unless the setting is false, as grids built without the
 * grid set's default options don't have it.
 */
Ren.ContextMenuItems_DataGridHighlightHoveredRow = (visualisation) => {

    const isHighlightingHoveredRow = () => visualisation.highlightHoveredRow !== false;

    const toggleHighlightHoveredRow = () => {

        visualisation.highlightHoveredRow = !isHighlightingHoveredRow();

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
    };

    const getMenuItem = () => {

        return {
            text: "Highlight hovered row",
            id: "layout-highlight-hovered-row",
            ticked: isHighlightingHoveredRow,
            action: toggleHighlightHoveredRow
        };
    };

    return {
        getMenuItem
    };
};
