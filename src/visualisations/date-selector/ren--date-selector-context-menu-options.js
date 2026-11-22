/**
 * The date selector's Month, Quarter, Year and Since ranges, for any menu offering them (see
 * Ren.ContextMenuItems_DateValueChart_DateRange).  Each is made by the caller's
 * createDateRangeMenuItem(target, text, startDate, endDateExclusive, presetKey), where a range
 * counted from today has a presetKey it can be looked up by again another day.
 */
Ren.DateSelector_ContextMenu_Options = (() => {

    const pushMenuOptions = (target, menuItems, createDateRangeMenuItem) => {

        const utils = Ren.DateSelector_ContextMenu_Utils;

        Ren.DateSelector_ContextMenu_Month.pushMonthMenuOptions(
            target,
            menuItems,
            utils,
            createDateRangeMenuItem
        );

        Ren.DateSelector_ContextMenu_Quarter.pushQuarterMenuOptions(
            target,
            menuItems,
            utils,
            createDateRangeMenuItem
        );

        Ren.DateSelector_ContextMenu_Year.pushYearMenuOptions(
            target,
            menuItems,
            utils,
            createDateRangeMenuItem
        );
    };

    /**
     * Gets the range a preset key comes to today, as { text, startDate, endDate } with an
     * exclusive end, or null where no option has the key.
     */
    const getPreset = (presetKey) => {

        let preset = null;

        pushMenuOptions("Date", [], (target, text, startDate, endDate, key) => {

            if (key === presetKey) {
                preset = { text, startDate, endDate };
            }

            return {};
        });

        return preset;
    };

    return {
        getPreset,
        pushMenuOptions
    };
})();
