/**
 * Picks a date/value chart's date range on a calendar (see ren-calendar-window.js).  The range
 * picked comes back as an event rather than to the menu item that opened the calendar, since the
 * chart's menu is rebuilt on every draw.
 */
Ren.DateValueChart_DateRange_Calendar = (() => {

    const getCalendarGroup = (visualisation) =>
        visualisation.visualisationGuid + "|ChartDateRange";

    /**
     * Gets the days a range covers, as the calendar takes them: yyyy-MM-dd with an exclusive end.
     */
    const getCalendarRange = (props) => {

        const DateRange = Ren.DateValueChart_DateRange;
        const resolvedRange = props.chartDateRange;
        const extent = DateRange.getDataExtent(props.rawInputData, props.dateHeading);

        const start = resolvedRange?.from ?? extent?.min ?? null;
        const toExclusive = resolvedRange?.toExclusive ?? null;

        let end = null;

        if (toExclusive) {

            end = DateRange.ceilToPeriod(toExclusive, Ren.DatePeriodEnum.Day);
        }
        else if (extent) {

            end = Ren.DateUtils.addDaysToSortableDate(extent.max.substring(0, 10), 1);
        }

        return {
            start: start ? start.substring(0, 10) : null,
            end: end ? end.substring(0, 10) : null
        };
    };

    /**
     * Subscribes a chart to the ranges picked on its calendar.  Called as the chart is
     * initialised, so the subscription lasts as long as the chart does.
     */
    const followCalendar = (visualisation, props) => {

        const DateRange = Ren.DateValueChart_DateRange;

        Ren.Messages.Events.calendarDateRangeSelected.handle((calendarGroup, startDate, endDate) => {

            if (visualisation.isDestroyed) return false;

            if (calendarGroup !== getCalendarGroup(visualisation)) return;

            const range = { from: startDate, to: DateRange.getInclusiveTo(endDate) };

            DateRange.applyToChart(visualisation, props, range);
            DateRange.notifyRangeChanged(visualisation, range);
        });
    };

    /**
     * Tells an open calendar the range the chart has been given some other way.
     */
    const notifyCalendar = (visualisation, props) => {

        const range = getCalendarRange(props);

        Ren.Messages.Events.dateSelectorDateRangeChanged.notify(
            getCalendarGroup(visualisation),
            range.start ?? "2000-01-01",
            range.end ?? "2100-01-01"
        );
    };

    /**
     * Opens the chart's calendar where the menu was opened, unless it is open already.
     */
    const openCalendar = (visualisation, props) => {

        const calendarGroup = getCalendarGroup(visualisation);
        const calendars = Ren.VisualisationCollection.getVisualisations("Calendar");

        for (let index = 0; index < calendars.length; index++) {

            if (calendars[index].calendarGroup === calendarGroup && !calendars[index].isDestroyed) {
                return;
            }
        }

        const range = getCalendarRange(props);
        const clickPosition = Ren.LastRightClickPosition || { x: 0, y: 0 };

        // The calendar opens beneath its anchor, which here is the point clicked.
        const anchor = {
            getBoundingClientRect: () => ({
                left: clickPosition.x - window.scrollX,
                bottom: clickPosition.y - window.scrollY
            })
        };

        Ren.Messages.Requests.calendarWindow.notify(
            calendarGroup,
            "Chart date range",
            range.start,
            range.end,
            anchor,
            false
        );
    };

    return {
        followCalendar,
        notifyCalendar,
        openCalendar
    };
})();
