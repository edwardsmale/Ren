/**
 * Zooming a multi-chart with Ctrl + mouse wheel, which draws it as fewer or more charts, and
 * panning it with Shift + wheel, which steps the periods its charts show back and forth.  Both
 * move in whole periods: the charts' count is kept as multiChartMaxCount, and the periods shown
 * as the chart's date range, just as the slider beneath them keeps them (see
 * Ren.DateValueChart_PeriodSlider), so the two always agree.
 */
Ren.DateValueChart_MultiChartWheel = (() => {

    // The most charts zooming out draws, as many more leave each too small to read.
    const MAX_CHART_COUNT = 24;

    // The pixels one notch scrolls by, which line and page deltas are converted to.
    const PIXELS_PER_NOTCH = 100;
    const PIXELS_PER_LINE = 40;

    // A trackpad scrolls in small steps, so they are gathered up to half a notch before one is
    // applied, and anything left over from a scroll that has since stopped is dropped.
    const MIN_NOTCHES_APPLIED = 0.5;
    const GATHER_TIMEOUT_MS = 300;

    /**
     * Gets a wheel event's movement in notches, positive for down (or right).
     */
    const getNotches = (event, delta) => {

        const pixels = event.deltaMode === 1
            ? delta * PIXELS_PER_LINE
            : event.deltaMode === 2 ? delta * PIXELS_PER_NOTCH * 3 : delta;

        return pixels / PIXELS_PER_NOTCH;
    };

    /**
     * Gets the periods a multi-chart steps through, as the slider's stops: "All" first, then
     * every period from the first the data holds to the last.  Worked out again only once its rows
     * or period change.
     */
    const getStops = (props, datePeriod) => {

        const cached = props.multiChartWheelStops;
        const rows = Ren.DateValueChart_MultiChart.getPeriodRows(props);

        if (cached
            && cached.rows === rows
            && cached.datePeriod === datePeriod
            && cached.dateHeading === props.dateHeading) {

            return cached.stops;
        }

        const stops = Ren.DateValueChart_PeriodSlider.getStops(
            rows,
            props.dateHeading,
            datePeriod,
            true
        );

        props.multiChartWheelStops = {
            rows,
            datePeriod,
            dateHeading: props.dateHeading,
            stops
        };

        return stops;
    };

    /**
     * Gets the index of the stop the charts shown end at: the latest period starting within the
     * chart's date range, or the last where it has none.
     */
    const getEndIndex = (stops, chartDateRange) => {

        const last = stops.length - 1;

        if (!chartDateRange || !chartDateRange.toExclusive) return last;

        for (let index = last; index > 0; index--) {

            if (stops[index].range.from < chartDateRange.toExclusive) return index;
        }

        return Math.min(1, last);
    };

    /**
     * Gets the charts shown once zoomed by a number of steps, as { count, endIndex }: one chart
     * fewer for each step in, and one more for each step out, between one and as many periods as
     * the data holds.  The latest chart shown stays put, unless there are too few periods before
     * it, when the later periods are taken in.
     */
    const zoom = (stops, endIndex, count, steps) => {

        const periodCount = stops.length - 1;
        const newCount = Math.max(1, Math.min(count + steps, periodCount, MAX_CHART_COUNT));

        return { count: newCount, endIndex: Math.max(endIndex, newCount) };
    };

    /**
     * Gets the charts shown once panned by a number of steps, as { count, endIndex }: a period
     * later for each step forwards, and a period earlier for each step back, kept to the periods
     * the data holds.
     */
    const pan = (stops, endIndex, count, steps) => {

        const last = stops.length - 1;
        const shownCount = Math.min(count, last);

        return {
            count,
            endIndex: Math.max(shownCount, Math.min(endIndex + steps, last))
        };
    };

    /**
     * Gets the range stored for the charts shown: those periods' dates, or null where they are
     * the latest, so that the multi-chart keeps to the latest as the data moves on.
     */
    const toStoredRange = (stops, endIndex, count) => {

        if (endIndex >= stops.length - 1) return null;

        return {
            from: stops[Math.max(endIndex - count + 1, 1)].range.from,
            to: stops[endIndex].range.to
        };
    };

    /**
     * Applies a zoom or pan of a number of steps, storing the count of charts and the range they
     * cover, and redrawing the multi-chart where either changes.  Either is announced to the
     * charts sharing its date range group.
     */
    const apply = (props, isPan, steps) => {

        const DateRange = Ren.DateValueChart_DateRange;
        const MultiChart = Ren.DateValueChart_MultiChart;
        const visualisation = props.visualisation;
        const settings = visualisation?.chartDataGroupingSettings;
        const canHoldRange = DateRange.canHoldRange(settings);

        // Panning moves the chart's range, which there is nowhere to keep.
        if (isPan && (!canHoldRange || props.isAllTime)) return;

        const stops = getStops(props, Ren.DateValueChart_PeriodSlider.getPeriod(
            props.multiChartPeriod
        ));

        if (stops.length < 2) return;

        const count = Math.min(MultiChart.getMaxChartCount(props), stops.length - 1);
        const endIndex = getEndIndex(stops, props.chartDateRange);
        const moved = isPan
            ? pan(stops, endIndex, count, steps)
            : zoom(stops, endIndex, count, steps);

        const isCountChanged = moved.count !== count;
        const current = canHoldRange ? DateRange.getRange(settings) : null;

        // Zooming without a range kept to show the latest periods leaves it showing them.
        const range = canHoldRange && (isPan || current)
            ? toStoredRange(stops, moved.endIndex, moved.count)
            : current;

        const isRangeChanged = !DateRange.isSameRange(range, current);

        if (!isCountChanged && !isRangeChanged) return;

        const previousSignature = DateRange.getRangeSignature(visualisation);

        if (isCountChanged) MultiChart.setMaxChartCount(visualisation, props, moved.count);

        if (isRangeChanged) {

            DateRange.applyToChart(visualisation, props, range);
        }
        else {

            Ren.VisualisationSettingsSynchroniser.commitChange(
                visualisation,
                props.redrawVisualisation
            );
        }

        DateRange.notifyRangeChanged(visualisation, range, previousSignature);
    };

    /**
     * Starts a multi-chart zooming with Ctrl + wheel over its charts and panning with Shift +
     * wheel, leaving the plain wheel to scroll the page.  Wheel events are gathered up and applied
     * once per frame, as each applies by drawing the multi-chart again.  What is gathered is held
     * on the props, which outlive the grid each draw makes anew.
     *
     * @param {object} props - The multi-chart's props.
     * @param {HTMLElement} grid - The element its charts are laid out in.
     */
    const attach = (props, grid) => {

        if (!grid || !props.visualisation) return;

        grid.onwheel = (event) => {

            const isPan = !event.ctrlKey && event.shiftKey;

            if (!event.ctrlKey && !isPan) return;

            // Over the charts, Ctrl + wheel zooms them rather than any popup they are in, even
            // where there is no zooming left to do.
            event.preventDefault();

            if (event.ctrlKey) event.stopPropagation();

            // Browsers turn a Shift + wheel into a horizontal scroll, so either delta is read.
            const delta = isPan ? (event.deltaY || event.deltaX) : event.deltaY;

            if (!delta) return;

            const previous = props.multiChartWheel;
            const isStartOfBurst = !previous
                || previous.isPan !== isPan
                || event.timeStamp - previous.time > GATHER_TIMEOUT_MS;

            const wheel = isStartOfBurst
                ? { isPan, notches: 0, isFrameRequested: false }
                : previous;

            wheel.time = event.timeStamp;
            wheel.notches += getNotches(event, delta);
            props.multiChartWheel = wheel;

            if (Math.abs(wheel.notches) < MIN_NOTCHES_APPLIED || wheel.isFrameRequested) return;

            wheel.isFrameRequested = true;

            requestAnimationFrame(() => {

                wheel.isFrameRequested = false;

                const notches = wheel.notches;
                const steps = notches > 0
                    ? Math.max(1, Math.round(notches))
                    : Math.min(-1, Math.round(notches));

                wheel.notches = 0;

                apply(props, wheel.isPan, steps);
            });
        };
    };

    return {
        MAX_CHART_COUNT,
        attach,
        getEndIndex,
        pan,
        toStoredRange,
        zoom
    };
})();
