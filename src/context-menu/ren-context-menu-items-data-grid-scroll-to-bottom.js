/**
 * Function for getting the menu item for turning on and off a datagrid's scrolling to its last row
 * when it is first shown.  Kept in the grid state, so it is shared by the grids of its grid state
 * group and saved with the report's settings.
 */
Ren.ContextMenuItems_DataGridScrollToBottom = (gridState) => {

    const isScrollingToBottom = () => !!gridState.scrollToBottom;

    const toggleScrollToBottom = () => {

        gridState.scrollToBottom = !isScrollingToBottom();

        // Syncs the change to the other grids in the grid state group.
        gridState.notifyColumnWidthChanged();
    };

    const getMenuItem = () => {

        return {
            text: "Scroll to bottom on load",
            id: "layout-scroll-to-bottom",
            ticked: isScrollingToBottom,
            action: toggleScrollToBottom
        };
    };

    return {
        getMenuItem
    };
};
