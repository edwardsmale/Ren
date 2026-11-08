/**
 * Function for getting the menu items for setting the totals row position.
 */
Ren.ContextMenuItems_TotalsRow = (dataGroupingSettings) => {

    const getMenuItems = () => {

        const setTotalsRowPosition = (position) => {

            if (position === dataGroupingSettings.totalsRow.position) return;

            dataGroupingSettings.sortFilterGroup.setTotalsRowPosition(position);
        };

        return [
            {
                text: "Top",
                actionParameters: [Ren.DataGridTotalsRowPositionEnum.Top],
                action: setTotalsRowPosition
            },
            {
                text: "Top - Fixed",
                actionParameters: [Ren.DataGridTotalsRowPositionEnum.TopFixed],
                action: setTotalsRowPosition
            },
            {
                text: "Bottom",
                actionParameters: [Ren.DataGridTotalsRowPositionEnum.Bottom],
                action: setTotalsRowPosition
            },
            {
                text: "Bottom - Fixed",
                actionParameters: [Ren.DataGridTotalsRowPositionEnum.BottomFixed],
                action: setTotalsRowPosition
            },
            Ren.MENU_SEPARATOR,
            {
                text: "None",
                actionParameters: [Ren.DataGridTotalsRowPositionEnum.None],
                action: setTotalsRowPosition
            }
        ];
    };

    return {
        getMenuItems
    };
};
