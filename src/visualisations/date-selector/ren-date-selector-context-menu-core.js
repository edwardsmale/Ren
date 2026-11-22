Ren.DateSelector_ContextMenu = (() => {

    const initialise = (
        html,
        getCalendarGroup,
        state,
        showDateRange,
        onDateRangeEdited,
        onCompareDateRangeEdited) => {

        const createDateRangeMenuItem = (target, text, newStartDate, newEndDate) => {

            return {
                text: () => text,
                className: "qa-ren-date-selector-date-range-menu-item-" + text,
                action: () => {

                    if (target === "Date") {

                        state.startDate = newStartDate;
                        state.endDate = newEndDate;
                        onDateRangeEdited();
                    }
                    else {

                        state.compareStartDate = newStartDate;
                        state.compareEndDate = newEndDate;
                        onCompareDateRangeEdited();
                    }

                    showDateRange(true);
                }
            };
        };

        // The ranges picked in the calendar come back to the date selector as events, rather than
        // to this menu item, as the calendar outlives a date selector recreated by a reload.
        const createCustomDateRangeMenuItem = (target, text, button) => {

            return {
                text: () => text,
                className: "qa-ren-date-selector-date-range-menu-item-custom" + text,
                action: () => {

                    Ren.Messages.Requests.calendarWindow.notify(
                        getCalendarGroup(target),
                        target === "Date" ? "Date Filter" : "Compared to",
                        target === "Date" ? state.startDate : state.compareStartDate,
                        target === "Date" ? state.endDate : state.compareEndDate,
                        button,
                        false
                    );
                }
            };
        };

        const createContextMenu = (target) => {

            const buttonSelector = target === "Date" ?
                ".js-ren-date-range-edit-button" :
                ".js-ren-compare-date-range-edit-button";

            const button = html.querySelector(buttonSelector);

            // A report without a comparison date range has no button to hang the menu on.
            if (!button) return;

            const menuItems = [];

            Ren.DateSelector_ContextMenu_Options.pushMenuOptions(
                target,
                menuItems,
                createDateRangeMenuItem
            );

            menuItems.push(Ren.MENU_SEPARATOR);
            menuItems.push(createCustomDateRangeMenuItem(target, "Custom...", button));
            menuItems.push(Ren.MENU_SEPARATOR);
            menuItems.push(createDateRangeMenuItem(target, "Clear", "2000-01-01", "2100-01-01"));
            menuItems.push(Ren.MENU_SEPARATOR);
            menuItems.push(createDateRangeMenuItem(target, "Default", null, null));
            Ren.AddButtonMenuItems(button, menuItems);
        };

        createContextMenu("Date");
        createContextMenu("CompareDate");
    };

    return {
        initialise
    };
})();
