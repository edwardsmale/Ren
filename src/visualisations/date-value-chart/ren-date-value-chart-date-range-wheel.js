/**
 * Zooming a date/value chart's date axis with Ctrl + mouse wheel, about the date under the pointer,
 * and panning it left and right with Shift + wheel.  Both set the chart's own date range (see
 * Ren.DateValueChart_DateRange), so nothing is requeried, and the range moves in whole bins.
 */
Ren.DateValueChart_DateRangeWheel = (() => {

    // How much one notch of the wheel zooms by, and how far it pans as a share of the dates shown.
    const ZOOM_FACTOR_PER_NOTCH = 1.25;
    const PAN_SHARE_PER_NOTCH = 0.05;

    // Zooming out runs past the ends of the data, until the dates shown span this many times it.
    const MAX_ZOOM_OUT = 10;

    // The pixels one notch scrolls by, which line and page deltas are converted to.
    const PIXELS_PER_NOTCH = 100;
    const PIXELS_PER_LINE = 40;

    // A trackpad scrolls in small steps, so they are gathered up to half a notch before one is
    // applied, and anything left over from a scroll that has since stopped is dropped.
    const MIN_NOTCHES_APPLIED = 0.5;
    const GATHER_TIMEOUT_MS = 300;

    const toTime = (sortableDate) => Ren.DateValueChart_DateRange.toTime(sortableDate);

    /**
     * Gets a time as a range boundary, taken down to the whole second.
     */
    const toSortableSecond = (time) =>
        Ren.DateValueChart_DateRange.toSortableDateTime(Math.floor(time / 1000) * 1000);

    /**
     * Gets a time as a range boundary, taken up to the whole second.
     */
    const toSortableSecondCeiling = (time) =>
        Ren.DateValueChart_DateRange.toSortableDateTime(Math.ceil(time / 1000) * 1000);

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
     * Gets the chart's bins and dates as zooming reads them: the period the range is kept in, the
     * first and last bin boundary of all its data, and the stretch of time it is showing, which may
     * run past them, all as range boundaries with exclusive ends.  Null where the chart has no
     * dates to range over.
     */
    const getSpan = (props, cache) => {

        const DateRange = Ren.DateValueChart_DateRange;

        // Scanned once per draw, as the input data does not change between them.
        if (cache.rows !== props.rawInputData) {

            cache.rows = props.rawInputData;
            cache.extent = DateRange.getDataExtent(
                Ren.CreateDateValueChart_PrepareData.normaliseQuarterDates(
                    props.rawInputData,
                    props.dateHeading
                ),
                props.dateHeading
            );
        }

        if (!cache.extent) return null;

        const period = DateRange.getRangePeriod(
            Ren.DateValueChart_GroupingApplyer.getEffectiveBinPeriod(props)
        );

        const dataFrom = DateRange.floorToPeriod(cache.extent.min, period);
        const dataToExclusive = DateRange.addPeriods(
            DateRange.floorToPeriod(cache.extent.max, period),
            period,
            1
        );

        const shown = props.chartDateRange;

        return {
            period,
            dataFrom,
            dataToExclusive,
            from: shown?.from || dataFrom,
            toExclusive: shown?.toExclusive || dataToExclusive
        };
    };

    const floorToBin = (sortableDate, period) =>
        Ren.DateValueChart_DateRange.floorToPeriod(sortableDate, period);

    const ceilToBin = (sortableDate, period) =>
        Ren.DateValueChart_DateRange.ceilToPeriod(sortableDate, period);

    /**
     * Gets the earliest start and latest exclusive end zooming out can reach, as times:
     * MAX_ZOOM_OUT times the data's span wide and centred on it, or the dates shown where they run
     * wider still.
     */
    const getZoomOutLimits = (span) => {

        const dataFromTime = toTime(span.dataFrom);
        const dataToExclusiveTime = toTime(span.dataToExclusive);
        const margin = (dataToExclusiveTime - dataFromTime) * (MAX_ZOOM_OUT - 1) / 2;

        return {
            from: Math.min(toTime(span.from), dataFromTime - margin),
            toExclusive: Math.max(toTime(span.toExclusive), dataToExclusiveTime + margin)
        };
    };

    /**
     * Gets a value indicating whether zooming out can widen the dates shown any further.
     */
    const canZoomOut = (span) => {

        const limits = getZoomOutLimits(span);

        return ceilToBin(toSortableSecondCeiling(limits.from), span.period) < span.from
            || floorToBin(toSortableSecond(limits.toExclusive), span.period) > span.toExclusive;
    };

    /**
     * Counts the bins from one bin boundary up to another.  Bins finer than a day are all the one
     * length, so are counted without stepping through what may be millions of them.
     */
    const countBins = (from, toExclusive, period) => {

        const periodMs = Ren.DateValueChartCalculator.getSubDayPeriodMilliseconds(period);

        if (periodMs !== null) {

            return Math.max(0, Math.round((toTime(toExclusive) - toTime(from)) / periodMs));
        }

        let count = 0;

        for (let date = from; date < toExclusive; count++) {

            date = Ren.DateValueChart_DateRange.addPeriods(date, period, 1);
        }

        return count;
    };

    /**
     * Gets the range a zoom about a date leaves shown, as { from, toExclusive }.  Zooming in
     * rounds the ends inwards and zooming out rounds them outwards, so that every notch moves at
     * least one end by a bin, and the pointer's own bin is always kept.  Zooming out runs past the
     * ends of the data, as far as getZoomOutLimits allows.
     */
    const zoom = (span, pointerTime, factor) => {

        const addPeriods = Ren.DateValueChart_DateRange.addPeriods;
        const period = span.period;
        const fromTime = toTime(span.from);
        const toExclusiveTime = toTime(span.toExclusive);
        const time = Math.max(fromTime, Math.min(toExclusiveTime - 1, pointerTime));

        const newFromTime = time - (time - fromTime) * factor;
        const newToTime = time + (toExclusiveTime - time) * factor;

        if (factor > 1) {

            const limits = getZoomOutLimits(span);
            const fromLimit = ceilToBin(toSortableSecondCeiling(limits.from), period);
            const toExclusiveLimit = floorToBin(toSortableSecond(limits.toExclusive), period);

            let from = floorToBin(toSortableSecond(newFromTime), period);
            let toExclusive = ceilToBin(toSortableSecondCeiling(newToTime), period);

            // A notch too small to cross a bin boundary widens both ends by a bin instead.
            if (from === span.from && toExclusive === span.toExclusive) {

                from = addPeriods(from, period, -1);
                toExclusive = addPeriods(toExclusive, period, 1);
            }

            if (from < fromLimit) from = fromLimit < span.from ? fromLimit : span.from;

            if (toExclusive > toExclusiveLimit) {

                toExclusive = toExclusiveLimit > span.toExclusive
                    ? toExclusiveLimit
                    : span.toExclusive;
            }

            return { from, toExclusive };
        }

        const pointerBin = floorToBin(toSortableSecond(time), period);
        const pointerBinEnd = addPeriods(pointerBin, period, 1);

        let from = ceilToBin(toSortableSecondCeiling(newFromTime), period);
        let toExclusive = floorToBin(toSortableSecond(newToTime), period);

        if (from > pointerBin) from = pointerBin;

        if (toExclusive < pointerBinEnd) toExclusive = pointerBinEnd;

        // A notch too small to cross a bin boundary takes a bin off the end further from the
        // pointer instead.
        if (from === span.from && toExclusive === span.toExclusive) {

            if (time - fromTime > toExclusiveTime - time) {

                from = from < pointerBin ? addPeriods(from, period, 1) : from;
            }
            else {

                toExclusive = toExclusive > pointerBinEnd
                    ? addPeriods(toExclusive, period, -1)
                    : toExclusive;
            }
        }

        return { from, toExclusive };
    };

    /**
     * Gets the range a pan by a number of notches leaves shown, as { from, toExclusive }, moved by
     * whole bins.  Panning runs past the ends of the data until they reach the middle of the
     * chart, or until the data would start to leave the chart where it is narrower than that.
     */
    const pan = (span, notches) => {

        const addPeriods = Ren.DateValueChart_DateRange.addPeriods;
        const period = span.period;
        const binsShown = countBins(span.from, span.toExclusive, period);
        const binsToMove = Math.max(
            1,
            Math.round(binsShown * PAN_SHARE_PER_NOTCH * Math.abs(notches))
        );

        const direction = notches > 0 ? 1 : -1;

        const halfBins = Math.floor(binsShown / 2);

        // The data in view from end to end, and the data's first or last bin in the middle.
        const fromAtDataEnd = addPeriods(span.dataToExclusive, period, -binsShown);
        const fromAtDataStartMiddle = addPeriods(span.dataFrom, period, -halfBins);
        const fromAtDataEndMiddle = addPeriods(span.dataToExclusive, period, -halfBins - 1);

        const lowestFrom = fromAtDataEnd < fromAtDataStartMiddle
            ? fromAtDataEnd
            : fromAtDataStartMiddle;
        const highestFrom = span.dataFrom > fromAtDataEndMiddle
            ? span.dataFrom
            : fromAtDataEndMiddle;

        let from = addPeriods(span.from, period, binsToMove * direction);

        // Dates already past a stop, as zooming out can leave them, are not pulled back to it.
        if (direction < 0 && from < lowestFrom) {

            from = lowestFrom < span.from ? lowestFrom : span.from;
        }
        else if (direction > 0 && from > highestFrom) {

            from = highestFrom > span.from ? highestFrom : span.from;
        }

        return { from, toExclusive: addPeriods(from, period, binsShown) };
    };

    /**
     * Gets what panning holds still across the pans of one run: the value axes' heights, as
     * { leftAxis, rightAxis, hiddenAxis }, and the marker labels' lanes (see
     * Ren.DateValueChart_MarkerLabels.captureLanes).  Null where the chart hasn't been panned, or
     * its range has since been changed some other way, which ends the run.
     */
    const getPanHold = (props) => {

        const hold = props.panHold;

        if (!hold) return null;

        const range = Ren.DateValueChart_DateRange.getRange(
            props.visualisation?.chartDataGroupingSettings
        );

        const isSameRange = range && hold.range
            ? range.from === hold.range.from && range.to === hold.range.to
            : !range && !hold.range;

        if (!isSameRange) {

            props.panHold = null;
            return null;
        }

        return hold;
    };

    /**
     * Gets the stored range a resolved one is kept as: null where it shows exactly the dates the
     * data holds, or else inclusive ends (see Ren.DateValueChart_DateRange.getInclusiveTo).
     */
    const toStoredRange = (span, resolved) => {

        if (resolved.from === span.dataFrom && resolved.toExclusive === span.dataToExclusive) {

            return null;
        }

        return {
            from: resolved.from,
            to: Ren.DateValueChart_DateRange.getInclusiveTo(resolved.toExclusive)
        };
    };

    /**
     * Ends the run of wheeling a chart is in, so that the next notch is the start of an undo of
     * its own.  Called where the chart's range is changed some other way - picked by a drag, or
     * put back by a double-click - as that run is no longer what the chart is showing.
     */
    const endBurst = (props) => {

        props.dateRangeWheelBurst = null;
    };

    /**
     * Gets a value indicating whether a wheel event starts a fresh run rather than carrying on the
     * one before it: a run ends where the wheel stops for a moment, or where it changes from
     * zooming to panning or back.
     */
    const isStartOfBurst = (props, event, isPan) => {

        const burst = props.dateRangeWheelBurst;

        return !burst
            || burst.isPan !== isPan
            || event.timeStamp - burst.time > GATHER_TIMEOUT_MS;
    };

    /**
     * Starts a chart zooming with Ctrl + wheel over it and panning with Shift + wheel over its
     * plot, leaving the plain wheel to scroll the page.  Consecutive wheel events are gathered up
     * and applied once per frame, as each applies by rebuilding the chart.
     *
     * A run of notches is one undo rather than one per notch, so the range the chart was showing
     * when the run began is put on the zoom stack as the run's first change is applied.  The run
     * is held on the props, which outlive the redraw every change brings with it.
     *
     * @param {object} props - The chart's props, holding the svg drawn into, the x scale the axis
     *     was drawn from, and the plot's size in its own coordinates.
     */
    const attach = (props) => {

        if (!props.svg || !props.chartGroup || !props.xScale || !props.visualisation) return;

        // All time draws a single point, so there is nothing to zoom into or pan across, and one of
        // a multi-chart's charts keeps to its own period.
        if (props.isAllTime || props.multiChartRange) return;

        const DateRange = Ren.DateValueChart_DateRange;
        const settings = props.visualisation.chartDataGroupingSettings;

        if (!DateRange.canHoldRange(settings)) return;

        const chartGroupNode = props.chartGroup;
        const cache = props.dateRangeWheelCache || (props.dateRangeWheelCache = {});

        let pendingNotches = 0;
        let pendingIsPan = false;
        let pendingPlotX = 0;
        let isFrameRequested = false;

        const apply = () => {

            isFrameRequested = false;

            const notches = pendingNotches;

            pendingNotches = 0;

            if (notches === 0) return;

            const span = getSpan(props, cache);

            if (!span) return;

            const resolved = pendingIsPan
                ? pan(span, notches)
                : zoom(
                    span,
                    props.xScale.getValue(pendingPlotX).getTime(),
                    Math.pow(ZOOM_FACTOR_PER_NOTCH, notches)
                );

            const range = toStoredRange(span, resolved);
            const current = DateRange.getRange(settings);

            if (!range && !current) return;

            if (range && current && range.from === current.from && range.to === current.to) {

                return;
            }

            const burst = props.dateRangeWheelBurst;

            // Remembered at the run's first change, so that a double-click puts the chart back to
            // where the run began rather than to the notch before last.
            if (burst && !burst.isPushed) {

                DateRange.pushZoom(props.visualisation, current);
                burst.isPushed = true;
            }

            if (pendingIsPan) {

                const hold = getPanHold(props) || {
                    yMaxes: {
                        leftAxis: props.axes.leftAxis.maxY,
                        rightAxis: props.axes.rightAxis.maxY,
                        hiddenAxis: props.axes.hiddenAxis.maxY
                    },
                    markerLanes: Ren.DateValueChart_MarkerLabels.captureLanes(props)
                };

                hold.range = range;
                props.panHold = hold;
            }
            else {

                props.panHold = null;
            }

            DateRange.applyToChart(props.visualisation, props, range);
            DateRange.notifyRangeChanged(props.visualisation, range);
        };

        props.svg.onwheel = (event) => {

            const isPan = !event.ctrlKey && event.shiftKey;

            if (!event.ctrlKey && !isPan) return;

            const pointer = Ren.Svg.pointer(event, chartGroupNode);
            const plotX = pointer[0] / (props.scaleX || 1);

            // Ctrl + wheel over the chart zooms it rather than any popup it is in, even where there
            // is no zooming left to do.
            if (event.ctrlKey) {

                event.preventDefault();
                event.stopPropagation();
            }
            else {

                if (plotX < 0 || plotX > props.innerWidth) return;

                if (pointer[1] < 0 || pointer[1] > props.innerHeight * (props.scaleY || 1)) return;
            }

            // Browsers turn a Shift + wheel into a horizontal scroll, so either delta is read.
            const delta = isPan ? (event.deltaY || event.deltaX) : event.deltaY;

            if (!delta) return;

            if (!isPan && delta > 0) {

                const span = getSpan(props, cache);

                if (!span || !canZoomOut(span)) return;
            }

            event.preventDefault();

            if (isStartOfBurst(props, event, isPan)) {

                pendingNotches = 0;
                props.dateRangeWheelBurst = { isPan, time: event.timeStamp, isPushed: false };
            }
            else {

                props.dateRangeWheelBurst.time = event.timeStamp;
            }

            pendingIsPan = isPan;
            pendingPlotX = plotX;
            pendingNotches += getNotches(event, delta);

            if (Math.abs(pendingNotches) < MIN_NOTCHES_APPLIED) return;

            if (!isFrameRequested) {

                isFrameRequested = true;
                requestAnimationFrame(apply);
            }
        };
    };

    return {
        attach,
        endBurst,
        getPanHold
    };
})();
