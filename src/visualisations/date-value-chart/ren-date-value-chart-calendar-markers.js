/**
 * Calendar markers on a date/value chart: a line at the start of every year ("2025"), quarter
 * ("Q2 2025") and/or month ("Feb 2025") in the charted range, as chosen by the chart's
 * calendarMarkers option, e.g. ["years", "quarters"].  "today" adds a line at today's date.
 *
 * A date starting more than one chosen period gets only the least granular marker, so 1 January
 * is marked "2025" rather than also "Q1 2025" and "Jan 2025".  They are drawn alongside the
 * chart's other markers, on a green flag rather than a blue one.
 */
Ren.DateValueChart_CalendarMarkers = (() => {

    const PERIODS = { today: "today", years: "years", quarters: "quarters", months: "months" };

    // Least granular first, which is the order a date's marker is chosen in.
    const PERIOD_ORDER = [PERIODS.today, PERIODS.years, PERIODS.quarters, PERIODS.months];

    // Past this, the most granular period is dropped: months over ten years is noise.
    const MAX_MARKERS = 60;

    const COLOUR = "#338877";

    const formatYear = Ren.ChartDateTime.createUtcFormat("yyyy");
    const formatMonth = Ren.ChartDateTime.createUtcFormat("MMM yyyy");

    /**
     * Gets the periods the chart is marked with, least granular first.
     */
    const getPeriods = (visualisation) => {

        let periods = visualisation ? visualisation.calendarMarkers : null;

        if (typeof periods === "string") {

            try {

                periods = JSON.parse(periods);
            }
            catch (error) {

                periods = null;
            }
        }

        if (!Array.isArray(periods)) return [];

        return PERIOD_ORDER.filter(period => periods.indexOf(period) !== -1);
    };

    const hasPeriod = (visualisation, period) => getPeriods(visualisation).indexOf(period) !== -1;

    /**
     * Turns one period's markers on or off, saving the choice with the chart.
     */
    const setPeriodShown = (visualisation, period, shown, props) => {

        const periods = getPeriods(visualisation).filter(existing => existing !== period);

        if (shown) periods.push(period);

        const orderedPeriods = PERIOD_ORDER.filter(existing => periods.indexOf(existing) !== -1);

        visualisation.calendarMarkers = orderedPeriods.length ? orderedPeriods : null;

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, props.redrawChart);
    };

    /**
     * Gets the least granular of the periods that start on the first of a month, or null where
     * none of them does.
     */
    const getPeriodStartingOn = (periods, monthIndex) => {

        for (let i = 0; i < periods.length; i++) {

            const period = periods[i];

            if (period === PERIODS.years && monthIndex === 0) return period;
            if (period === PERIODS.quarters && monthIndex % 3 === 0) return period;
            if (period === PERIODS.months) return period;
        }

        return null;
    };

    const getLabel = (period, date) => {

        if (period === PERIODS.today) return "Today";

        if (period === PERIODS.years) return formatYear(date);

        if (period === PERIODS.quarters) {
            return "Q" + (Math.floor(date.getUTCMonth() / 3) + 1) + " " + date.getUTCFullYear();
        }

        return formatMonth(date);
    };

    const createMarker = (period, date) => ({
        date,
        label: getLabel(period, date),
        row: null,
        calendarPeriod: period,
        colour: COLOUR,
        flagColour: COLOUR,
        lineStyle: "dashed",
        lineWidth: "thin",
        labelPosition: "top",
        outOfRange: "hide"
    });

    /**
     * Gets a marker at the start of every chosen period within the domain.  The domain's end is
     * where the period after the chart's last starts, which the chart does not show, so a marker
     * there is left off.
     */
    const resolveMarkers = (periods, domain) => {

        const markers = [];
        const start = domain[0];
        const end = domain[1];

        let year = start.getUTCFullYear();
        let monthIndex = start.getUTCMonth();

        for (;;) {

            const date = new Date(Date.UTC(year, monthIndex, 1));

            if (date >= end) break;

            if (date >= start) {

                const period = getPeriodStartingOn(periods, monthIndex);

                if (period) markers.push(createMarker(period, date));
            }

            monthIndex++;

            if (monthIndex === 12) {

                monthIndex = 0;
                year++;
            }
        }

        return markers;
    };

    /**
     * Gets the chart's calendar markers within its charted range, in the shape the marker-line
     * renderer draws.
     */
    /**
     * Gets a marker at today's date, or null where today is outside the domain.
     */
    const resolveTodayMarker = (domain) => {

        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        if (today < domain[0] || today >= domain[1]) return null;

        return createMarker(PERIODS.today, today);
    };

    const resolvePeriodMarkers = (periods, domain) => {

        while (periods.length) {

            const markers = resolveMarkers(periods, domain);

            if (markers.length <= MAX_MARKERS) return markers;

            periods = periods.slice(0, periods.length - 1);
        }

        return [];
    };

    const getMarkers = (props) => {

        const periods = getPeriods(props.visualisation);

        if (!periods.length || !props.xScale || props.isAllTime) return [];

        const domain = props.xScale.getDomain();

        if (!(domain[0] instanceof Date) || !(domain[1] instanceof Date)) return [];

        const markers = resolvePeriodMarkers(
            periods.filter(period => period !== PERIODS.today),
            domain
        );

        const todayMarker = periods[0] === PERIODS.today ? resolveTodayMarker(domain) : null;

        if (todayMarker) {

            let insertIndex = 0;

            while (insertIndex < markers.length && markers[insertIndex].date <= todayMarker.date) {
                insertIndex++;
            }

            markers.splice(insertIndex, 0, todayMarker);
        }

        return markers;
    };

    return {
        PERIODS,
        getPeriods,
        hasPeriod,
        setPeriodShown,
        getMarkers
    };
})();
