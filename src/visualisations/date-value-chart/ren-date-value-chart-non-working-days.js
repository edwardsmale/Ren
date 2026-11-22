/**
 * Shades the days nobody works behind a chart's series, where it is set to: the weekends and the
 * holidays ren.config's workingDays names.  A run of such days, such as a weekend, is one shaded
 * stretch.  Only a chart binning its dates into days or shorter shades them, as a week or longer
 * is neither worked nor not.
 *
 * The axis' dates are UTC wall-clock times, so each day runs from one UTC midnight to the next.
 */
Ren.DateValueChart_NonWorkingDays = (() => {

    const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
    const COLOUR = "#7F8C8D";
    const OPACITY = 0.1;

    // Beyond this many days, the stretches would be too thin to see.
    const MAX_DAYS = 1000;

    /**
     * Gets a value indicating whether the chart could shade its non-working days: it bins its
     * dates into days or shorter, over a range of dates rather than all time.
     */
    const isAvailable = (props) => props.datePeriod <= Ren.DatePeriodEnum.Day
        && !props.isAllTime
        && !Ren.DateValueChart_Pies.isShown(props)
        && props.hasDateColumn !== false;

    /**
     * Gets a value indicating whether the chart shades its non-working days.
     */
    const isShown = (props) => props.visualisation?.shadeNonWorkingDays === true
        && isAvailable(props);

    /**
     * Gets the stretches of non-working days from the start of the domain to its end, each as
     * { start, end } Dates, cut to the domain, with a run of days as one stretch.
     */
    const getSpans = (domain) => {

        const spans = [];
        const start = domain[0].getTime();
        const end = domain[1].getTime();

        if (!(end > start) || (end - start) / DAY_MILLISECONDS > MAX_DAYS) return spans;

        let day = Math.floor(start / DAY_MILLISECONDS) * DAY_MILLISECONDS;
        let current = null;

        for (; day < end; day += DAY_MILLISECONDS) {

            if (Ren.WorkingDayUtils.isWorkingDay(new Date(day))) {

                current = null;
                continue;
            }

            const spanEnd = Math.min(day + DAY_MILLISECONDS, end);

            if (current) {
                current.end = new Date(spanEnd);
            }
            else {

                current = { start: new Date(Math.max(day, start)), end: new Date(spanEnd) };
                spans.push(current);
            }
        }

        return spans;
    };

    /**
     * Shades the stretches behind everything else in the plot, afresh on every redraw.
     */
    const render = (props) => {

        if (!isShown(props) || !props.chartGroup || !props.xScale) return;

        const spans = getSpans(props.xScale.getDomain());

        if (spans.length === 0) return;

        const group = Ren.Svg.append(props.chartGroup, "g", {
            "class": "ren-non-working-days",
            "pointer-events": "none"
        });

        props.chartGroup.insertBefore(group, props.chartGroup.firstChild);

        for (let i = 0; i < spans.length; i++) {

            const x = props.xScale.getPixel(spans[i].start);

            Ren.Svg.append(group, "rect", {
                "class": "ren-non-working-day",
                "x": x,
                "y": 0,
                "width": Math.max(0, props.xScale.getPixel(spans[i].end) - x),
                "height": props.innerHeight,
                "fill": COLOUR,
                "fill-opacity": OPACITY
            });
        }
    };

    return {
        isAvailable,
        isShown,
        getSpans,
        render
    };
})();
