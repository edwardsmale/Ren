Ren.GroupCtrlsCountModeEnum = Ren.DefineEnum({
    NoCounts: 0,
    CountChildRows: 1,
    CountAllDescendantRows: 2,
    Collapsed: 3,
    Default: 1
});

/**
 * Function to add group controls to a datagrid.  These contain buttons to expand/collapse groups
 * and display the number of rows in the group.
 */
Ren.GroupCtrls = (() => {

    const renderGroupCtrls = (
        rowIndexesIncHeadingsToRender,
        frozenLeftSection,
        tabularData,
        dataGroupingSettings,
        expandedGroups,
        contextMenu,
        gridState
    ) => {

        rowIndexesIncHeadingsToRender.forEach(r => {

            renderGroupCtrlsForRow(
                r,
                frozenLeftSection,
                tabularData,
                dataGroupingSettings,
                expandedGroups,
                contextMenu,
                gridState
            );
        });
    };

    const renderGroupCtrlsForRow = (
        r,
        frozenLeftSection,
        tabularData,
        dataGroupingSettings,
        expandedGroups,
        contextMenu,
        gridState) => {

        const rowIndex = r - tabularData.HeadingCount;

        if (rowIndex < 0) return;

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

        if (!grouping || grouping.isOutermostGrouping) return;

        const group = dataGroupingSettings.groupings.getGroupWithRowIndex(rowIndex);

        appendGroupCtrls(
            tabularData,
            r,
            rowIndex,
            group,
            frozenLeftSection,
            dataGroupingSettings,
            expandedGroups,
            contextMenu,
            gridState
        );
    };

    const appendGroupCtrls = (
        tabularData,
        r,
        rowIndex,
        group,
        frozenLeftSection,
        dataGroupingSettings,
        expandedGroups,
        contextMenu,
        gridState) => {

        if (dataGroupingSettings.layout.groupCtrlsCountMode === Ren.GroupCtrlsCountModeEnum.Collapsed) {
            return;
        }

        const groupCtrls = document.createElement("div");
        groupCtrls.className = "ren-data-grid__group-ctrls ren-r-" + r;

        const button = document.createElement("div");
        button.className = "ren-data-grid__group-expand-collapse-button";

        groupCtrls.appendChild(button);

        if (dataGroupingSettings.layout.groupCtrlsCountMode !== Ren.GroupCtrlsCountModeEnum.NoCounts) {

            const count = document.createElement("div");
            count.className = "ren-data-grid__group-count";

            const countMode = dataGroupingSettings.layout.groupCtrlsCountMode;

            if (countMode === Ren.GroupCtrlsCountModeEnum.CountChildRows) {

                if (group.containedGroups.size) {

                    groupCtrls.title = "Number of immediate children in this group";
                    count.textContent = group.containedGroups.size;
                }
                else {

                    groupCtrls.title = "Number of rows in this group";
                    count.textContent = group.containedRowIndexCount;
                }
            }
            else if (countMode === Ren.GroupCtrlsCountModeEnum.CountAllDescendantRows) {

                groupCtrls.title = "Total number of rows under this group";
                count.textContent = group.containedRowIndexCount;
            }

            groupCtrls.appendChild(count);
        }

        const onClick = () => {

            Ren.Messages.Requests.groupExpandCollapse.notify(gridState.dataGridGuid, rowIndex);
        };

        button.addEventListener("click", onClick);
        frozenLeftSection.appendChild(groupCtrls);

        const contextMenuItems = Ren.ContextMenuItems_GroupCtrls(tabularData, dataGroupingSettings).getMenuItems();
        contextMenu.addMenuItems(groupCtrls, contextMenuItems);

        const groupingMenuItems = Ren.ContextMenuItems_Grouping(tabularData, dataGroupingSettings, expandedGroups, null)
            .getMenuItems(null, group, null);

        contextMenu.addMenuItems(groupCtrls, groupingMenuItems);
    };

    return {
        renderGroupCtrls
    };
})();
