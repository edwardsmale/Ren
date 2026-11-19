Ren.DateValueChartCalculator = (() => {

    /**
     * The stretch of the x axis a period covers, as { start, end } dates, clipped to the ends of
     * the axis itself.  A period the data only partly fills - the axis stopping part way through
     * the quarter the last month of data falls in, say - covers only the part the axis shows, so
     * the bar drawn across it is narrower than a whole period's in proportion to what it holds.
     */
    const periodSpan = (props, date) =>
        spanFromPeriodStart(props, Ren.DateUtils.startOfPeriod(date, props.datePeriod));

    const spanFromPeriodStart = (props, start) => {

        const end = Ren.DateUtils.addPeriod(start, props.datePeriod);
        const domain = props.xScale ? props.xScale.getDomain() : null;

        if (!domain) return { start, end };

        return {
            start: start < domain[0] ? domain[0] : start,
            end: end > domain[1] ? domain[1] : end
        };
    };

    /**
     * Gets the length of a period finer than a day in milliseconds, or null for any other period.
     */
    const getSubDayPeriodMilliseconds = (datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second: return 1000;
            case Ren.DatePeriodEnum.Minute: return 60 * 1000;
            case Ren.DatePeriodEnum.QuarterHour: return 15 * 60 * 1000;
            case Ren.DatePeriodEnum.Hour: return 60 * 60 * 1000;
            default: return null;
        }
    };

    /**
     * Gets the start of the period one of the axis' own dates (a tick, or an end of its domain)
     * falls in.  Those are UTC wall-clock times, where the data's dates read the wall clock in
     * local time, so a period shorter than a day is cut in UTC: read the other way, it would come
     * out an hour late through British Summer Time.  A day or longer starts at the same point
     * either way.
     */
    const startOfAxisPeriod = (date, datePeriod) => {

        const periodMilliseconds = getSubDayPeriodMilliseconds(datePeriod);

        if (!periodMilliseconds || !date || !date.getTime) {
            return Ren.DateUtils.startOfPeriod(date, datePeriod);
        }

        return new Date(Math.floor(date.getTime() / periodMilliseconds) * periodMilliseconds);
    };

    /**
     * The stretch of the x axis the period one of the axis' own dates falls in covers, as
     * periodSpan gives for a data date.
     */
    const axisPeriodSpan = (props, date) =>
        spanFromPeriodStart(props, startOfAxisPeriod(date, props.datePeriod));

    /**
     * Calculates the horizontal width of a period based on the date and x scale, which is the
     * width of the part of the period the axis shows.
     */
    const periodWidth = (props, date) => {

        const span = periodSpan(props, date);

        // A period lying wholly outside the axis clips to nothing rather than to a width the wrong
        // way round, which would draw a bar backwards from where it belongs.
        return Math.max(0, props.xScale.getPixel(span.end) - props.xScale.getPixel(span.start));
    };

    /**
     * The width of a period the bars standing for it share: the period's width less the gap the
     * chart leaves between periods (periodGap, in screen pixels), half of it at either side, so
     * that one period's bars stand clear of the next's.
     */
    const paddedPeriodWidth = (props, date) => {

        const gapPx = Number(props.periodGap) || 0;
        const gap = gapPx > 0 ? gapPx / (props.scaleX || 1) : 0;

        return Math.max(0, periodWidth(props, date) - gap);
    };

    /**
     * The date halfway through the part of a period the axis shows, which is where the mark drawn
     * for that period is centred.
     */
    const periodCentre = (props, date) => {

        const span = periodSpan(props, date);

        return new Date((span.start.getTime() + span.end.getTime()) / 2);
    };

    /**
     * Returns the time interval function for the specified date period.
     *
     * The intervals are UTC ones, since the chart's dates are built as UTC midnights and plotted
     * on a UTC scale (see Ren.DateUtils.createDate).  A local-time interval would put each period
     * start an hour out through British Summer Time, which is enough for the period after the last
     * one drawn to fall just inside the axis and be ticked as a period of its own.
     */
    const getTimeInterval = (datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second:
                return Ren.ChartDateTime.utcSecond;

            case Ren.DatePeriodEnum.Minute:
                return Ren.ChartDateTime.utcMinute;

            case Ren.DatePeriodEnum.QuarterHour:
                return Ren.ChartDateTime.utcQuarterHour;

            case Ren.DatePeriodEnum.Hour:
                return Ren.ChartDateTime.utcHour;

            case Ren.DatePeriodEnum.Day:
                return Ren.ChartDateTime.utcDay;

            case Ren.DatePeriodEnum.Week:
                return Ren.ChartDateTime.utcWeek;

            case Ren.DatePeriodEnum.Month:
                return Ren.ChartDateTime.utcMonth;

            case Ren.DatePeriodEnum.Quarter:
                return Ren.ChartDateTime.utcQuarter;

            case Ren.DatePeriodEnum.Year:
                return Ren.ChartDateTime.utcYear;
        }
    };

    /**
     * Gets the number of data series the chart plots.
     */
    const getSeriesCount = (props) => {

        return props.series ? props.series.length : (props.seriesCount || 0);
    };

    /**
     * Gets a value indicating whether the chart's series are split from more than one value
     * column, which is what the per-split bar layouts need to group the series of a split value.
     */
    const isSplitFromSeveralColumns = (props) => {

        const sourceHeadings = props.seriesSourceHeadings;

        if (!props.seriesSplit || !sourceHeadings) return false;

        for (let i = 1; i < sourceHeadings.length; i++) {

            if (sourceHeadings[i] !== sourceHeadings[0]) return true;
        }

        return false;
    };

    /**
     * Gets the layout the chart's bars are drawn in.  A chart of a single data series has no other
     * series to lay its bars out against, so it is always drawn side-by-side, whatever layout the
     * setting was left holding from when the chart had more than one series.  Likewise a per-split
     * layout falls back to its plain one where the series are no longer split from several columns.
     */
    const getBarLayout = (props) => {

        if (getSeriesCount(props) < 2) return Ren.BarLayoutEnum.SideBySide;

        const barLayout = props.barLayout ?? Ren.BarLayoutEnum.SideBySide;

        if (!isSplitFromSeveralColumns(props)) {

            if (barLayout === Ren.BarLayoutEnum.OverlayedPerSplit) {
                return Ren.BarLayoutEnum.Overlayed;
            }

            if (barLayout === Ren.BarLayoutEnum.StackedPerSplit) return Ren.BarLayoutEnum.Stacked;
        }

        return barLayout;
    };

    /**
     * Gets the layout the chart's lines are drawn in.
     */
    const getLineLayout = (props) => props.lineLayout ?? Ren.LineLayoutEnum.Overlayed;

    /**
     * Gets the shape a series' line is drawn in: "straight", "curved" or "stepped", flat across
     * each period.  Settings that pre-date the shape have only a curved flag.
     */
    const getLineShape = (series) =>
        series?.lineShape || (series?.curved === true ? "curved" : "straight");

    /**
     * Gets a value indicating whether a bar layout stacks the bars it draws together.
     */
    const isStackedBarLayout = (barLayout) =>
        barLayout === Ren.BarLayoutEnum.Stacked || barLayout === Ren.BarLayoutEnum.StackedPerSplit;

    /**
     * Gets a value indicating whether a bar layout overlays the bars it draws together.
     */
    const isOverlayedBarLayout = (barLayout) =>
        barLayout === Ren.BarLayoutEnum.Overlayed
            || barLayout === Ren.BarLayoutEnum.OverlayedPerSplit;

    /**
     * Gets where each of the given bar series is drawn within its period, as { slotBySeriesIndex,
     * slotCount }: the period is divided side-by-side into slotCount slots, and the series sharing
     * a slot are overlayed or stacked.  Side-by-side, each series has a slot of its own; per
     * split, the series of each split value share one; otherwise every series shares the one.
     */
    const getBarSlots = (props, barSeriesIndexes, barLayout) => {

        const slotBySeriesIndex = {};
        const isPerSplit = barLayout === Ren.BarLayoutEnum.OverlayedPerSplit
            || barLayout === Ren.BarLayoutEnum.StackedPerSplit;
        const slotBySplitValue = new Map();
        let slotCount = 0;

        for (let i = 0; i < barSeriesIndexes.length; i++) {

            const seriesIndex = barSeriesIndexes[i];

            if (barLayout === Ren.BarLayoutEnum.SideBySide) {

                slotBySeriesIndex[seriesIndex] = slotCount;
                slotCount++;
            }
            else if (isPerSplit) {

                const splitValue = props.seriesSplit
                    .splitValueBySeriesHeading[props.valueHeadings[seriesIndex]];

                if (!slotBySplitValue.has(splitValue)) {
                    slotBySplitValue.set(splitValue, slotBySplitValue.size);
                }

                slotBySeriesIndex[seriesIndex] = slotBySplitValue.get(splitValue);
                slotCount = slotBySplitValue.size;
            }
            else {

                slotBySeriesIndex[seriesIndex] = 0;
                slotCount = 1;
            }
        }

        return { slotBySeriesIndex, slotCount };
    };

    return {
        periodSpan,
        axisPeriodSpan,
        startOfAxisPeriod,
        periodWidth,
        paddedPeriodWidth,
        periodCentre,
        getTimeInterval,
        getSubDayPeriodMilliseconds,
        getBarLayout,
        getLineLayout,
        getLineShape,
        isSplitFromSeveralColumns,
        isStackedBarLayout,
        isOverlayedBarLayout,
        getBarSlots,
        getSeriesCount
    };
})();
