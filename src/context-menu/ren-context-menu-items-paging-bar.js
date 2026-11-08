/**
 * Function for getting the menu items shown when a datagrid's paging bar is right-clicked.
 */
Ren.ContextMenuItems_PagingBar = (dataGrid, gridSetVisualisation) => {

    const paging = dataGrid.dataGroupingSettings.paging;

    const openJumpToPagePopup = () => {

        Ren.CreateNumberEditorPopupWindow(
            "Jump To Page",
            paging.pageIndex + 1,
            pageNumber => {

                const pageIndex = Math.round(pageNumber) - 1;

                if (pageIndex === paging.pageIndex) return;

                dataGrid.setPageIndex(pageIndex);
            },
            {
                label: "Page",
                min: 1,
                max: paging.pageCount,
                width: 160,
                height: 60,
                centredOnPoint: Ren.LastRightClickPosition,
                applyTypedValuesOnEnter: true
            }
        );
    };

    const getMenuItems = () => {

        return [
            {
                text: "Disable paging",
                id: "paging-bar-disable-paging",
                action: () => Ren.DataGridPaging.disablePaging(gridSetVisualisation)
            },
            {
                text: "Page size...",
                id: "paging-bar-page-size",
                action: () => Ren.DataGridPaging.openCustomPageSizePopup(
                    gridSetVisualisation,
                    Ren.LastRightClickPosition
                )
            },
            {
                text: "Jump to page...",
                id: "paging-bar-jump-to-page",
                action: openJumpToPagePopup
            }
        ];
    };

    return {
        getMenuItems
    };
};
