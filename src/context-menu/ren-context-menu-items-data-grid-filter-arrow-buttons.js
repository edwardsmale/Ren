/**
 * Factory for a ticked menu item that toggles a single boolean property on a visualisation.
 */
Ren.ContextMenuItems_DataGridVisibilityToggle = (visualisation, propertyName, text, id) => {

    const getMenuItem = () => {

        const toggleVisibility = () => {

            visualisation[propertyName] = !visualisation[propertyName];

            Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
        };

        return {
            text,
            id,
            ticked: () => !!visualisation[propertyName],
            action: toggleVisibility
        };
    };

    return {
        getMenuItem
    };
};

/**
 * Adds a menu item to toggle the visibility of the data grid filter arrow buttons.
 */
Ren.ContextMenuItems_DataGridColumnHeaderDownArrows = (visualisation) =>
    Ren.ContextMenuItems_DataGridVisibilityToggle(
        visualisation,
        "showColumnHeaderDownArrows",
        "Show filter arrow buttons",
        "layout-filter-arrow-buttons"
    );

