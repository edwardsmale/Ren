Ren.DateSelector_ContextMenu_Month = (() => {

    const pushMonthMenuOptions = (target, menuItems, utils, createDateRangeMenuItem) => {

        const monthMenuItems = [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const startYear = 2020;

        let prevM = currentMonth - 1 === 0 ? 12 : currentMonth - 1;
        let prevY = currentMonth - 1 === 0 ? currentYear - 1 : currentYear;
        const nextM = currentMonth + 1 > 12 ? 1 : currentMonth + 1;
        const nextY = currentMonth + 1 > 12 ? currentYear + 1 : currentYear;
        const today = Ren.DateUtils.todayAsSortableDate();

        // The ranges counted from today carry a key, so a chart can save them as that rather than
        // as the dates they come to today (see Ren.DateSelector_ContextMenu_Options).
        monthMenuItems.push(createDateRangeMenuItem(
            target,
            "Last 30 days",
            Ren.DateUtils.addDaysToSortableDate(today, -30),
            today,
            "last-30-days"
        ));
        monthMenuItems.push(createDateRangeMenuItem(
            target,
            "Previous whole month",
            utils.getStartDate(prevY, prevM),
            utils.getEndDate(currentYear, currentMonth),
            "previous-whole-month"
        ));
        monthMenuItems.push(createDateRangeMenuItem(
            target,
            "MTD",
            utils.getStartDate(currentYear, currentMonth),
            utils.getEndDate(nextY, nextM),
            "mtd"
        ));
        monthMenuItems.push(Ren.MENU_SEPARATOR);

        for (let y = startYear; y <= currentYear; y++) {

            const yearMonths = [];
            const lastMonth = (y === currentYear) ? currentMonth : 12;

            for (let m = 1; m <= lastMonth; m++) {

                const text = `${Ren.DateUtils.getMonthNameAbbrv(m)} ${y}`;
                const mn = m + 1 > 12 ? 1 : m + 1;
                const yn = m + 1 > 12 ? y + 1 : y;
                const newStartDate = utils.getStartDate(y, m);
                const newEndDate = utils.getEndDate(yn, mn);
                yearMonths.push(createDateRangeMenuItem(target, text, newStartDate, newEndDate));
            }

            monthMenuItems.push({
                text: y.toString(),
                id: `date-selector-month-year-${y}`,
                className: `qa-ren-date-selector-month-menu-item-year-${y}`,
                submenu: yearMonths
            });
        }

        menuItems.push({
            text: "Month",
            id: "date-selector-month",
            className: "qa-ren-date-selector-month-menu-item",
            submenu: monthMenuItems
        });
    };

    return {
        pushMonthMenuOptions
    };
})();
