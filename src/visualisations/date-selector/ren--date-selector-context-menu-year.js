Ren.DateSelector_ContextMenu_Year = (() => {

    const pushYearMenuOptions = (target, menuItems, utils, createDateRangeMenuItem) => {

        const yearMenuItems = [];
        let y = 2018;

        while (utils.isPastOrCurrent(y, 1)) {

            const text = y.toString();
            const newStartDate = utils.getStartDate(y, 1);
            const newEndDate = utils.getEndDate(y + 1, 1);
            yearMenuItems.push(createDateRangeMenuItem(target, text, newStartDate, newEndDate));
            y++;

            if (y === 0) {
                yearMenuItems.push(Ren.MENU_SEPARATOR);
            }
        }

        // The loop leaves y at next year, so the previous whole year is two before it.
        const prevY = y - 2;
        yearMenuItems.unshift(Ren.MENU_SEPARATOR);
        yearMenuItems.unshift(
            createDateRangeMenuItem(
                target,
                "YTD",
                utils.getStartDate(new Date().getFullYear(), 1),
                Ren.DateUtils.todayAsSortableDate(),
                "ytd"
            )
        );

        yearMenuItems.unshift(createDateRangeMenuItem(
            target,
            "Last 3 years",
            Ren.DateUtils.addYears(Ren.DateUtils.todayAsSortableDate(), -3),
            Ren.DateUtils.todayAsSortableDate(),
            "last-3-years"
        ));

        yearMenuItems.unshift(createDateRangeMenuItem(
            target,
            "Last 2 years",
            Ren.DateUtils.addYears(Ren.DateUtils.todayAsSortableDate(), -2),
            Ren.DateUtils.todayAsSortableDate(),
            "last-2-years"
        ));

        yearMenuItems.unshift(createDateRangeMenuItem(
            target,
            "Last 12 months",
            Ren.DateUtils.addDaysToSortableDate(Ren.DateUtils.todayAsSortableDate(), -365),
            Ren.DateUtils.todayAsSortableDate(),
            "last-12-months"
        ));

        yearMenuItems.unshift(createDateRangeMenuItem(
            target,
            "Previous whole year",
            utils.getStartDate(prevY, 1),
            utils.getStartDate(prevY + 1, 1),
            "previous-whole-year"
        ));
        menuItems.push({
            text: "Year",
            id: "date-selector-year",
            className: "qa-ren-date-selector-year-menu-item",
            submenu: yearMenuItems
        });

        menuItems.push(Ren.MENU_SEPARATOR);

        const sinceMenuItems = [];
        const currentYear = new Date().getFullYear();

        for (let sinceY = 2020; sinceY <= currentYear; sinceY++) {

            sinceMenuItems.push(createDateRangeMenuItem(
                target,
                sinceY.toString(),
                utils.getStartDate(sinceY, 1),
                Ren.DateUtils.todayAsSortableDate(),
                "since-" + sinceY
            ));
        }
        menuItems.push({
            text: "Since",
            id: "date-selector-since",
            className: "qa-ren-date-selector-since-menu-item",
            submenu: sinceMenuItems
        });
    };

    return {
        pushYearMenuOptions
    };
})();
