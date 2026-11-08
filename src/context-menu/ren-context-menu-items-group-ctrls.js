/**
 * Functions for setting options for the group controls (the buttons that appear on the left hand
 * side, when groupings are in effect, to expand/collapse groups and display the number of rows in
 * each group).
 */
Ren.ContextMenuItems_GroupCtrls = (tabularData, dataGroupingSettings) => {

    const getMenuItems = () => {

        const setGroupCtrlsCountMode = (countMode) => {

            if (countMode === dataGroupingSettings.layout.groupCtrlsCountMode) return;

            dataGroupingSettings.layout.groupCtrlsCountMode = countMode;

            dataGroupingSettings.fireChangedEvent(false);
            Ren.Messages.Events.columnsMoved.notify();
        };

        return [
            {
                section: "Group Controls",
                text: "Group Count Mode",
                id: "group-count-mode",
                submenu: [{
                    text: "None",
                    actionParameters: [Ren.GroupCtrlsCountModeEnum.NoCounts],
                    action: setGroupCtrlsCountMode
                },
                {
                    text: "Count immediate children",
                    actionParameters: [Ren.GroupCtrlsCountModeEnum.CountChildRows],
                    action: setGroupCtrlsCountMode
                },
                {
                    text: "Count all descendants",
                    actionParameters: [Ren.GroupCtrlsCountModeEnum.CountAllDescendantRows],
                    action: setGroupCtrlsCountMode
                },
                {
                    text: "Collapsed",
                    actionParameters: [Ren.GroupCtrlsCountModeEnum.Collapsed],
                    action: setGroupCtrlsCountMode
                }]
            }
        ];
    };

    return {
        getMenuItems
    };
};
