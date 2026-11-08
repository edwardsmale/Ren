/**
 * Gets the Dates menu, offered where what was right-clicked names dates: selected data grid cells,
 * or a date/value chart's date axis tick or data series item.
 *
 * @param {Function} hasDates - Gets a value indicating whether what was right-clicked names dates.
 * @param {Function} getDates - Gets the dates, in any form a calendar's highlightedDates takes.
 */
Ren.ContextMenuItems_Dates = (hasDates, getDates) => {

    /**
     * Opens a calendar at the point the menu was right-clicked, with the dates highlighted.
     */
    const showDatesOnCalendar = () => {

        const clickPosition = Ren.LastRightClickPosition;

        Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "Calendar",
            popupTitle: "📅 Selected dates",
            isPopup: true,
            popupLeft: clickPosition ? clickPosition.x : null,
            popupTop: clickPosition ? clickPosition.y : null,
            highlightedDates: getDates()
        });
    };

    const getMenuItems = () => [{
        text: "Dates",
        id: "selected-dates",
        visible: () => hasDates(),
        submenu: [
            {
                text: "Show dates on calendar",
                id: "show-dates-on-calendar",
                action: showDatesOnCalendar
            }
        ]
    }];

    return {
        getMenuItems
    };
};
