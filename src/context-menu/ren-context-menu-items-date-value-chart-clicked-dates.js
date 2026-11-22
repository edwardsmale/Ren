/**
 * The date/value chart's "Show ... on calendar", offered on a date axis tick or a data series
 * item, which shows the period right-clicked on a calendar: the quarter a chart grouped by quarter
 * plots there, say.
 */
Ren.ContextMenuItems_DateValueChart_ClickedDates = (chart) => {

    const { props } = chart;

    /**
     * Gets the element of this chart the right-clicked element is within that matches the selector,
     * or null where there is none.
     */
    const getClickedElement = (selector) => {

        const target = Ren.LastRightClickTarget;
        const element = target && target.closest ? target.closest(selector) : null;
        const svgNode = props.svg || null;

        if (!element || !svgNode || !svgNode.contains(element)) return null;

        return element;
    };

    /**
     * Gets the date the x axis stands at where the chart was right-clicked.  The chart group
     * carries the margins but none of the plot's scaling, as Ren.DateValueChart_HoverDateLine
     * reads the pointer.
     */
    const getClickedPlotDate = () => {

        const clickPosition = Ren.LastRightClickPosition;

        if (!clickPosition || !props.xScale || !props.chartGroup) return null;

        const pointer = Ren.Svg.pointer(
            {
                clientX: clickPosition.x - window.scrollX,
                clientY: clickPosition.y - window.scrollY
            },
            props.chartGroup
        );

        const x = pointer[0] / (props.scaleX || 1);

        return props.xScale.getValue(Math.max(0, Math.min(props.innerWidth, x)));
    };

    /**
     * Gets a date in the period right-clicked: the one a date axis tick starts, or the one a data
     * series item is drawn in.  A line is drawn across many periods, so the period is read from
     * where it was clicked rather than from what it was drawn from.
     */
    const getClickedDate = () => {

        const tickElement = getClickedElement(".ren-x-axis.ren-date-axis g.tick");

        if (tickElement) return Ren.Svg.getDatum(tickElement) ?? null;

        return getClickedElement(".ren-data-series") ? getClickedPlotDate() : null;
    };

    /**
     * Gets the period right-clicked as a calendar's { start, end, label }, or null where no period
     * was right-clicked.  A period shorter than a day shows as the day it falls in.
     */
    const getClickedPeriod = () => {

        const date = getClickedDate();

        if (!date || !date.getTime || isNaN(date.getTime())) return null;

        // All time's one point covers the dates it was merged from, whichever was clicked.
        if (props.isAllTime) {

            const extent = props.allTimeExtent;

            return extent
                ? {
                    start: extent.from.substring(0, 10),
                    end: extent.toExclusive.substring(0, 10),
                    label: Ren.DateValueChart_DateTickFormat.getAllTimeLabel(props)
                }
                : null;
        }

        const datePeriod = props.datePeriod;
        const periodStart =
            Ren.DateValueChartCalculator.startOfAxisPeriod(date, datePeriod) || date;

        // Periods shorter than a day are plotted as UTC wall-clock times, and the rest in local
        // time.
        const isSubDay =
            Ren.DateValueChartCalculator.getSubDayPeriodMilliseconds(datePeriod) !== null;

        const start = isSubDay
            ? periodStart.toISOString().substring(0, 10)
            : Ren.DateUtils.toSortableDate(periodStart);

        const end = isSubDay
            ? Ren.DateUtils.addDaysToSortableDate(start, 1)
            : Ren.DateValueChart_DateRange.addPeriods(start, datePeriod, 1);

        const tickFormat = Ren.DateValueChart_DateTickFormat.getTickFormat(datePeriod);
        const label = tickFormat ? tickFormat(periodStart).split("\n").join(" ") : start;

        return { start, end, label };
    };

    const getClickedDates = () => {

        const period = getClickedPeriod();

        return period ? [period] : [];
    };

    const datesMenuItem = Ren.ContextMenuItems_Dates(
        () => getClickedPeriod() !== null,
        getClickedDates
    ).getMenuItems()[0];

    // The Dates submenu holds the one item, so it is offered directly, naming the period.
    const clickedDatesMenuItem = {
        text: () => {

            const period = getClickedPeriod();

            return period ? "Show " + period.label + " on calendar" : "Show on calendar";
        },
        id: "chart-show-clicked-period-on-calendar",
        visible: datesMenuItem.visible,
        action: datesMenuItem.submenu[0].action
    };

    return {
        getClickedPeriod,
        clickedDatesMenuItem
    };
};
