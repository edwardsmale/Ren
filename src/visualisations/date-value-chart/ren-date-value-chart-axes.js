Ren.DateValueChart_Axes = (() => {

    /**
     * Moves each tick's text into a <g class="ren-text-wrapper"> of its own.
     */
    const wrapAllTickTextElementsInGElements = props => {

        const texts = props.svg.querySelectorAll("g.tick text:not(.ren-text-wrapper text)");

        for (let index = 0; index < texts.length; index++) {

            Ren.Svg.append(texts[index].parentNode, "g", { "class": "ren-text-wrapper" })
                .appendChild(texts[index]);
        }
    };

    /**
     * Wraps tick text elements in <g> elements for the purpose of maintaining text size when the
     * chart is scaled.
     */
    const wrapTickTextElements = props => {

        wrapAllTickTextElementsInGElements(props);

        const ticks = props.chartGroup.querySelectorAll(".ren-x-axis g.tick");

        for (let index = 0; index < ticks.length; index++) {

            const wrapper = ticks[index].querySelector(".ren-text-wrapper");

            // A tick drawn as a mark alone has no label to place.
            if (!wrapper) continue;

            // Centre the x-axis labels based on each period's length (periods vary in length).
            const periodWidth = Ren.DateValueChartCalculator.periodWidth(
                props,
                Ren.Svg.getDatum(ticks[index])
            );

            wrapper.setAttribute("transform", `translate(${periodWidth / 2} 0)`);

            // Convert \n to line breaks in text (e.g. date axis labels).  Which of the labels are
            // actually shown, and whether each still carries its year, is settled by the declutter
            // pass once the style updater has laid the axis out at the size it is read at.
            const text = wrapper.querySelector("text");

            Ren.DateValueChart_DeclutterDateAxisLabels.setTickLabelLines(
                text,
                text.textContent.split("\n")
            );

            text.setAttribute("transform", "translate(0 15)");
        }
    };

    /**
     * The dates the x axis ticks at, one per period it shows: the start of each period, since the
     * label is centred across the period the tick starts rather than sitting under the tick.
     *
     * A period the data only partly fills is drawn from where the axis starts rather than from the
     * period's own start, so the axis' start stands in as that period's tick and its bar is
     * labelled like any other.  Nothing is ticked at the axis' end: no period starts there.
     */
    const getTickDates = (props, timeInterval) => {

        const domain = props.xScale.getDomain();

        // A date that does not begin a period begins no bar either, so ticking it would label a
        // period the chart does not draw - and label it wherever that stray date happens to fall.
        // Only the axis' own start, standing in for a part-filled first period, is ticked without
        // beginning one.
        const startsPeriod = date => {

            const start = Ren.DateValueChartCalculator.startOfAxisPeriod(date, props.datePeriod);

            return !start || start.getTime() === date.getTime();
        };

        const tickDates = timeInterval.getPeriodStarts(domain[0], domain[1]).filter(startsPeriod);

        if (tickDates.length === 0 || tickDates[0] > domain[0]) tickDates.unshift(domain[0]);

        return tickDates;
    };

    /**
     * Hides an axis the chart is drawn without, through the chart's visibility stylesheet, so an
     * axis turned back on is shown again.  The axis is drawn and then hidden rather than left
     * undrawn: its ticks are where the periods the chart plots are read from - by the hint
     * that follows the pointer, and by the pass that thins the date labels - so a chart missing
     * them is a chart missing those, whereas a chart carrying them unseen is only that.
     *
     * The room the axis took is not left empty: the margins are worked out from what is shown, so
     * the plot is drawn across the space instead (see setChartDimensions).
     */
    const setAxisShown = (props, axisSelector, isShown) => {

        Ren.DateValueChart_Visibility.setShown(props, axisSelector, isShown);
    };

    // How far apart (in visual pixels) a value axis' ticks are wanted, and the most it ticks at.
    const VALUE_TICK_SPACING_PX = 40;
    const MAX_VALUE_TICK_COUNT = 10;

    /**
     * Gets about how many ticks the value axes are drawn with: as many as the plot's height on
     * screen leaves room for, so a short chart ticks at 0, 500, 1k rather than every 200.
     */
    const getValueTickCount = props => {

        if (!(props.scaleY > 0)) return MAX_VALUE_TICK_COUNT;

        const heightPx = props.innerHeight * props.scaleY;

        return Math.min(
            Math.max(Math.floor(heightPx / VALUE_TICK_SPACING_PX), 2),
            MAX_VALUE_TICK_COUNT
        );
    };

    // A format that does not apply to a number (a date format, say) hands the tick value back
    // as it is, so it is made a string before trimming.
    const makeYAxisFormatter = (format, formatFunction) =>
        v => String(Ren.ValueFormatter.formatValue(
            v,
            null,
            format,
            formatFunction ?? null
        ) ?? "").replace(".00", "");

    // See Ren.DateValueChart_ValueFormats for the formats an axis' ticks are shown in.
    const makeAxisTickFormatter = (axis) => {

        const tickFormats = axis.tickFormats ?? axis;

        return makeYAxisFormatter(tickFormats.format, tickFormats.formatFunction);
    };

    /**
     * Draws a value axis into its group, emptied first, so that the group (and the context menu
     * on it) is kept when the axis is ticked again at a new size.
     */
    const drawValueAxis = (props, axisGroup, axis, isRight) => {

        axisGroup.replaceChildren();

        const options = {
            tickValues: axis.yScale.getTicks(props.valueAxisTickCount),
            tickFormat: makeAxisTickFormatter(axis)
        };

        if (isRight) {

            Ren.ChartSvgAxis.renderRightAxis(axisGroup, axis.yScale, options);
        }
        else {

            Ren.ChartSvgAxis.renderLeftAxis(axisGroup, axis.yScale, options);
        }
    };

    /**
     * Ticks the value axes again where the chart has been resized to a height wanting more or
     * fewer ticks than they were drawn with.
     */
    const updateValueAxisTicks = props => {

        if (!props.chartGroup) return;

        const tickCount = getValueTickCount(props);

        if (tickCount === props.valueAxisTickCount) return;

        props.valueAxisTickCount = tickCount;

        const leftAxisGroup = props.chartGroup.querySelector(".ren-value-axis:not(.ren-y-axis-2)");
        const rightAxisGroup = props.chartGroup.querySelector(".ren-y-axis-2");

        if (leftAxisGroup && props.axes.leftAxis.yScale) {

            drawValueAxis(props, leftAxisGroup, props.axes.leftAxis, false);
        }

        if (rightAxisGroup && props.axes.rightAxis.yScale) {

            drawValueAxis(props, rightAxisGroup, props.axes.rightAxis, true);
        }

        wrapAllTickTextElementsInGElements(props);
        Ren.DateValueChart_Gridlines.render(props);
    };

    const renderAxes = props => {

        Ren.DateValueChart_Render_AxisLabel.renderDateValueChartAxisLabel(props);

        // A tick standing in for a part-filled period sits at the axis' start rather than at the
        // period's, so what it is labelled with is the period it starts, not the date it is at.
        const tickFormat = Ren.DateValueChart_DateTickFormat.getAxisTickFormat(props);
        const timeInterval = Ren.DateValueChartCalculator.getTimeInterval(props.datePeriod);

        const xAxisGroup = Ren.Svg.append(props.chartGroup, "g", {
            "class": "ren-axis ren-x-axis ren-date-axis",
            "transform": `translate(0,${props.innerHeight})`
        });

        // Without an interval there are no periods to tick, so the scale's own ticks are used.
        const tickDates = timeInterval ? getTickDates(props, timeInterval) : null;

        // A tick is drawn per period whether or not it can be labelled - the periods are read off
        // the ticks - but an axis ticking at thousands of them has room for a few dozen labels, so
        // the rest are drawn as marks alone rather than as labels to be measured and then dropped.
        const labellable = tickDates
            ? Ren.DateValueChart_DeclutterDateAxisLabels.getLabellableDates(
                tickDates,
                props.datePeriod,
                props.innerWidth * (props.scaleX || 1)
            )
            : null;
        const labelledTimes = labellable ? labellable.times : null;

        props.dateAxisLabelLevelIndex = labellable ? labellable.levelIndex : -1;

        Ren.ChartSvgAxis.renderBottomAxis(xAxisGroup, props.xScale, {
            tickValues: tickDates,

            // The style updater carries the marks a set number of pixels further down from this
            // length once the chart's scale is known (see setDateAxisTickLength).
            tickSizeInner: Ren.DateValueChart_StyleUpdater.DATE_AXIS_TICK_SIZE,

            // Null for a tick that is not labelled, which is drawn without a label at all.
            tickFormat: date => labelledTimes && !labelledTimes.has(date.getTime())
                ? null
                : tickFormat(
                    Ren.DateValueChartCalculator.startOfAxisPeriod(date, props.datePeriod) || date
                )
        });

        setAxisShown(props, ".ren-date-axis", props.showDateAxis !== false);

        props.valueAxisTickCount = getValueTickCount(props);

        // Render left axis.
        const leftAxis = props.axes.leftAxis;

        if (leftAxis && leftAxis.yScale) {

            const leftAxisGroup = Ren.Svg.append(props.chartGroup, "g", {
                "class": "ren-axis ren-y-axis ren-value-axis",
                "transform": "translate(0,0)"
            });

            drawValueAxis(props, leftAxisGroup, leftAxis, false);

            setAxisShown(
                props,
                ".ren-value-axis:not(.ren-y-axis-2)",
                props.showLeftAxis !== false && !Ren.DateValueChart_Pies.isShown(props)
            );
        }

        // Render right axis (if using dual axes).
        if (Ren.DateValueChart_YScales.hasRightAxis(props)) {

            const rightAxis = props.axes.rightAxis;

            if (rightAxis && rightAxis.yScale) {

                const rightAxisGroup = Ren.Svg.append(props.chartGroup, "g", {
                    "class": "ren-axis ren-y-axis ren-y-axis-2 ren-value-axis",
                    "transform": `translate(${props.innerWidth},0)`
                });

                drawValueAxis(props, rightAxisGroup, rightAxis, true);

                setAxisShown(
                    props,
                    ".ren-y-axis-2",
                    props.showRightAxis !== false && !Ren.DateValueChart_Pies.isShown(props)
                );
            }
        }

        wrapTickTextElements(props);
    };

    /**
     * Builds a value axis' props from its saved settings, where it has any.
     */
    const buildValueAxis = (savedAxis) => {

        const axis = savedAxis || {};

        return {
            maxY: axis.maxY,
            label: axis.label,
            yExtent: axis.yExtent || [0, axis.maxY || 0],
            format: axis.format,
            formatFunction: axis.formatFunction,
            showValueLabels: axis.showValueLabels !== undefined ? axis.showValueLabels : true,
            fromSettings: axis.fromSettings !== undefined ? axis.fromSettings : false,
            updateYScaleBehaviour: axis.updateYScaleBehaviour,
            startAtZero: axis.startAtZero !== false,
            logScale: axis.logScale === true
        };
    };

    /**
     * Gets the value axis a series is drawn on unless set: the right for a percentage shown
     * when there are also other units present, so the left axis keeps their scale, and otherwise
     * the left.
     *
     * @param {number} format - The series' value column format.
     * @param {Array} valueColumnFormats - The formats of all the chart's value columns.
     */
    const getDefaultValueAxis = (format, valueColumnFormats) => {

        const Percentage = Ren.SpreadsheetColumnFormatEnum.Percentage;

        return format === Percentage && valueColumnFormats.some(other => other !== Percentage)
            ? "rightAxis"
            : "leftAxis";
    };

    return {
        buildValueAxis,
        getDefaultValueAxis,
        getValueTickCount,
        makeAxisTickFormatter,
        renderAxes,
        updateValueAxisTicks
    };
})();
