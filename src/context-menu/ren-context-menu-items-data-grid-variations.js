/**
 * Adds a menu item to toggle the visibility of the data grid variations options.
 */
Ren.ContextMenuItems_DataGridVariations = (visualisation) =>
    Ren.ContextMenuItems_DataGridVisibilityToggle(
        visualisation,
        "variations",
        "Show variations",
        "layout-variations"
    );

