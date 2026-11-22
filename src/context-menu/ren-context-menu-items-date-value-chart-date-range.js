/**
 * The date/value chart context menu's "Date range" submenu: the client-side reduction of the dates
 * the chart draws (see Ren.DateValueChart_DateRange).  Nothing is requeried - the range is stored
 * on the chart's own date grouping and applied as its data is binned - so it leaves the grid it
 * was drawn from, and every visualisation but a chart sharing its date range group, as they are.
 *
 * The ranges offered are the date selector's (see Ren.DateSelector_ContextMenu_Options), and a
 * custom range is picked on a calendar.  Below them, "Exclude partial" holds the toggles that leave
 * out a partly covered first or last period.
 */
Ren.ContextMenuItems_DateValueChart_DateRange = (chart) => {

    const { visualisation, props, regroupData, commitRedraw } = chart;

    const DateRange = Ren.DateValueChart_DateRange;
    const Calendar = Ren.DateValueChart_DateRange_Calendar;

    const getSettings = () => visualisation.chartDataGroupingSettings;

    const getCurrentRange = () => DateRange.getRange(getSettings());

    /**
     * Stores a range on the chart and re-aggregates its data through it, so the chart narrows as
     * soon as the range is picked.  A null range restores every date.
     */
    const applyRange = (range) => {

        if (!getSettings()) return;

        DateRange.setRange(getSettings(), range);

        regroupData();
        commitRedraw();

        // The charts sharing this one's date range group narrow with it.
        DateRange.notifyRangeChanged(visualisation, range);
        Calendar.notifyCalendar(visualisation, props);
    };

    const isRangeSet = () => !!getCurrentRange();

    // Whether the current range is one of the options, set as the submenu is built, so that
    // "Custom..." is not ticked beside it.
    let isOptionRangeCurrent = false;

    const createDateRangeMenuItem = (target, text, startDate, endDate, presetKey) => {

        const range = DateRange.fromDateSelectorOption(startDate, endDate, presetKey);

        if (DateRange.isSameRange(range, getCurrentRange())) isOptionRangeCurrent = true;

        return {
            text: () => text,
            className: "qa-ren-chart-date-range-menu-item-" + text,
            action: () => applyRange(range),
            ticked: () => DateRange.isSameRange(range, getCurrentRange())
        };
    };

    const buildOptionMenuItems = () => {

        const items = [];

        isOptionRangeCurrent = false;

        Ren.DateSelector_ContextMenu_Options.pushMenuOptions("Date", items, createDateRangeMenuItem);

        return items;
    };

    const allDatesMenuItem = {
        text: "All dates",
        id: "chart-date-range-all",
        action: () => applyRange(null),
        ticked: () => !isRangeSet()
    };

    const customRangeMenuItem = {
        text: "Custom...",
        id: "chart-date-range-custom",
        action: () => Calendar.openCalendar(visualisation, props),
        ticked: () => {

            const range = getCurrentRange();

            return !!range
                && !range.lastPeriodCount
                && !range.preset
                && !range.acronym
                && !isOptionRangeCurrent;
        }
    };

    const setExcludePartialPeriod = (isLeading, isExcluded) => {

        if (!getSettings()) return;

        DateRange.setExcludePartialPeriod(getSettings(), isLeading, isExcluded);

        regroupData();
        commitRedraw();
    };

    const createExcludePartialPeriodMenuItem = (isLeading) => {

        const isExcluded = () => DateRange.getExcludePartialPeriod(getSettings(), isLeading);

        return {
            text: isLeading ? "Leading period" : "Trailing period",
            id: isLeading
                ? "chart-exclude-partial-leading-period"
                : "chart-exclude-partial-trailing-period",
            action: () => setExcludePartialPeriod(isLeading, !isExcluded()),
            ticked: () => isExcluded()
        };
    };

    const excludePartialMenuItem = {
        text: "Exclude partial",
        id: "chart-exclude-partial",
        submenu: [
            createExcludePartialPeriodMenuItem(true),
            createExcludePartialPeriodMenuItem(false)
        ]
    };

    // Getter so the options are rebuilt against today's date.
    const dateRangeMenuItem = {
        section: "Dates",
        text: () => {

            const description = DateRange.describe(getCurrentRange(), props.chartDateRange);

            return description ? `Date range (${description})` : "Date range";
        },
        id: "chart-date-range",

        // A chart with no grouping settings of its own has nowhere to keep a range, and one without
        // a date column has no dates for it to choose among.
        visible: () => DateRange.canHoldRange(getSettings()),
        get submenu() {

            return [allDatesMenuItem, Ren.MENU_SEPARATOR]
                .concat(buildOptionMenuItems())
                .concat([
                    Ren.MENU_SEPARATOR,
                    customRangeMenuItem,
                    Ren.MENU_SEPARATOR,
                    excludePartialMenuItem
                ]);
        }
    };

    return {
        dateRangeMenuItem
    };
};
