/**
 * Adds a menu item to toggle the visibility of the data grid quick links ('Columns' and 'Export
 * data').
 */
Ren.ContextMenuItems_DataGridQuickLinks = (visualisation) =>
    Ren.ContextMenuItems_DataGridVisibilityToggle(
        visualisation,
        "quickLinks",
        "Show quick links",
        "layout-quick-links"
    );

