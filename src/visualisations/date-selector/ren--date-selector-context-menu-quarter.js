Ren.DateSelector_ContextMenu_Quarter = (() => {

    const pushQuarterMenuOptions = (target, menuItems, utils, createDateRangeMenuItem) => {

        const quarterMenuItems = [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentQuarter = Ren.DateUtils.quarterNumber(now);
        const startYear = 2020;

        let prevQ = currentQuarter - 1 === 0 ? 4 : currentQuarter - 1;
        let prevY = currentQuarter - 1 === 0 ? currentYear - 1 : currentYear;

        const nextQuarterM = currentQuarter === 4 ? 1 : currentQuarter * 3 + 1;
        const nextQuarterY = currentQuarter === 4 ? currentYear + 1 : currentYear;
        const today = Ren.DateUtils.todayAsSortableDate();

        quarterMenuItems.push(createDateRangeMenuItem(
            target,
            "Last 90 days",
            Ren.DateUtils.addDaysToSortableDate(today, -90),
            today,
            "last-90-days"
        ));
        quarterMenuItems.push(createDateRangeMenuItem(
            target,
            "Previous whole quarter",
            utils.getStartDate(prevY, (prevQ - 1) * 3 + 1),
            utils.getEndDate(currentYear, (currentQuarter - 1) * 3 + 1),
            "previous-whole-quarter"
        ));
        quarterMenuItems.push(createDateRangeMenuItem(
            target,
            "QTD",
            utils.getStartDate(currentYear, (currentQuarter - 1) * 3 + 1),
            utils.getEndDate(nextQuarterY, nextQuarterM),
            "qtd"
        ));
        quarterMenuItems.push(Ren.MENU_SEPARATOR);

        for (let y = startYear; y <= currentYear; y++) {

            const yearQuarters = [];
            const lastQuarter = (y === currentYear) ? currentQuarter : 4;

            for (let q = 1; q <= lastQuarter; q++) {

                const quarterName = Ren.DateUtils.quarterName(y, q);
                const qn = q + 1 > 4 ? 1 : q + 1;
                const yn = q + 1 > 4 ? y + 1 : y;
                const m = (q - 1) * 3 + 1;
                const mn = (qn - 1) * 3 + 1;
                const newStartDate = utils.getStartDate(y, m);
                const newEndDate = utils.getEndDate(yn, mn);
                yearQuarters.push(createDateRangeMenuItem(target, quarterName, newStartDate, newEndDate));
            }
            quarterMenuItems.push({
                text: y.toString(),
                id: `date-selector-quarter-year-${y}`,
                className: `qa-ren-date-selector-quarter-menu-item-year-${y}`,
                submenu: yearQuarters
            });
        }

        menuItems.push({
            text: "Quarter",
            id: "date-selector-quarter",
            className: "qa-ren-date-selector-quarter-menu-item",
            submenu: quarterMenuItems
        });
    };

    return {
        pushQuarterMenuOptions
    };
})();
