/**
 * Function for getting the menu item for turning a datagrid's paging on and off.
 */
Ren.ContextMenuItems_DataGridPaging = (gridSetVisualisation) => {

    const isPaged = () => Ren.DataGridPaging.getPageSize(gridSetVisualisation) !== null;

    const togglePaging = () => {

        if (isPaged()) {
            Ren.DataGridPaging.disablePaging(gridSetVisualisation);
        }
        else {

            Ren.DataGridPaging.enablePaging(gridSetVisualisation);
        }
    };

    const getMenuItem = () => {

        return {
            text: "Paging",
            id: "layout-paging",
            ticked: () => isPaged(),
            action: togglePaging
        };
    };

    return {
        getMenuItem
    };
};
