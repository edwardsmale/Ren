/**
 * Functions to get context menu items for the data sources window.
 */
Ren.ContextMenuItems_DataSourcesWindow = (() => {

    const getMenuItems = () => {

        return [
            {
                section: "Other",
                text: "Add Data Source",
                id: "add-data-source",
                action: () => {

                    Ren.Messages.Requests.addDataSourceWindow.notify(Ren.LastRightClickTarget);
                }
            }
        ];
    };

    return {
        getMenuItems
    };
})();
