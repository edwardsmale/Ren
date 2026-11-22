Ren.DateValueChart_RenderChartSetup = (() => {

    // Margins for an axis' tick labels, for a heading shown without its axis, and for a bare edge.
    const LEFT_AXIS_MARGIN_PX = 80;
    const RIGHT_AXIS_MARGIN_PX = 50;
    const DATE_AXIS_MARGIN_PX = 38;
    const AXIS_HEADING_MARGIN_PX = 30;
    const EDGE_GAP_PX = 10;

    /**
     * Gets the room to keep at one side of the plot for a value axis. A hidden axis gives its space
     * to the plot rather than having it held empty.
     */
    const getValueAxisMarginPx = (isAxisShown, isHeadingShown, axisMarginPx) => {

        if (isAxisShown) return axisMarginPx;

        return isHeadingShown ? AXIS_HEADING_MARGIN_PX : EDGE_GAP_PX;
    };

    /**
     * Gets the room each side of the plot keeps, worked out from what the chart is showing.
     */
    const getAxisMarginsPx = props => {

        const hasRightAxis = Ren.DateValueChart_YScales.hasRightAxis(props);

        // Pies are not read off a value axis, so the axes and their headings are left out.
        const isPies = Ren.DateValueChart_Pies.isShown(props);

        const dateAxisMargin = props.showDateAxis !== false
            ? DATE_AXIS_MARGIN_PX
            : EDGE_GAP_PX;

        return {
            left: getValueAxisMarginPx(
                props.showLeftAxis !== false && !isPies,
                props.showLeftAxisHeading !== false && !isPies,
                LEFT_AXIS_MARGIN_PX
            ),
            right: hasRightAxis
                ? getValueAxisMarginPx(
                    props.showRightAxis !== false && !isPies,
                    props.showRightAxisHeading !== false && !isPies,
                    RIGHT_AXIS_MARGIN_PX
                )
                : EDGE_GAP_PX
                + Ren.DateValueChart_LineNames.getReservedWidthPx(props),

            // A strip is kept beneath the axis labels for the hovered date hint and the values
            // box, so that they don't cover them.
            bottom: dateAxisMargin + Ren.DateValueChart_HoverDateLine.getReservedHeightPx(props)
        };
    };

    const setChartDimensions = props => {

        props.width = 2000;
        props.height = 1000;

        const margins = getAxisMarginsPx(props);

        Ren.ChartProps.setMargin(
            props,
            { top: 20, right: margins.right, bottom: margins.bottom, left: margins.left }
        );

        props.innerWidth = props.width - props.margin.left - props.margin.right;
        props.innerHeight = props.height - props.margin.top - props.margin.bottom;
    };

    /**
     * Measures the margins again and hands the plot whatever they no longer need, as a redraw does
     * not go back through the chart's setup.  The top margin is left to the marker band, which runs
     * after this.
     */
    const updateAxisMargins = props => {

        if (!props.margin) return;

        const margins = getAxisMarginsPx(props);

        if (props.margin.left === margins.left
            && props.margin.right === margins.right
            && props.margin.bottom === margins.bottom) {

            return;
        }

        Ren.ChartProps.setMargin(props, {
            top: props.margin.top,
            right: margins.right,
            bottom: margins.bottom,
            left: margins.left
        });

        props.innerWidth = props.width - props.margin.left - props.margin.right;
        props.innerHeight = props.height - props.margin.top - props.margin.bottom;

        // The scale is made once and kept, so is re-ranged here.
        if (props.xScale) props.xScale.setRange([0, props.innerWidth]);

        if (props.chartGroup) {

            props.chartGroup.setAttribute(
                "transform",
                `translate(${props.margin.left},${props.margin.top})`
            );
        }
    };

    /** Gets a value indicating whether any series is estimating the last period's total. */
    const isLastPeriodEstimated = props => {

        const estimates = props.lastPeriodEstimates;
        if (!estimates) return false;

        for (let i = 0; i < estimates.length; i++) {

            if (estimates[i]) return true;
        }

        return false;
    };

    /**
     * Gets the stretch of time the x axis runs across: the periods the data falls in rather than
     * its dates, as each row is drawn across its whole period. A first or last period the data only
     * partly fills ends the axis where the data ends, unless a series is estimating the last one.
     * One of a multi-chart's charts runs across the whole of its period, data or not.
     */
    const getXDomain = props => {

        const multiChartXDomain = props.multiChartRange
            ? Ren.DateValueChart_MultiChart.getXDomain(props)
            : null;

        if (multiChartXDomain) return multiChartXDomain;

        const coverage = props.dataDateCoverage;
        const startOfPeriod = date => Ren.DateUtils.startOfPeriod(date, props.datePeriod) || date;

        const firstPeriodStart = startOfPeriod(props.xExtent[0]);
        const firstPeriodEnd = Ren.DateUtils.addPeriod(firstPeriodStart, props.datePeriod);
        const lastPeriodStart = startOfPeriod(props.xExtent[1]);
        const lastPeriodEnd = Ren.DateUtils.addPeriod(lastPeriodStart, props.datePeriod);

        // The coverage only shortens the end periods, so an axis widened beyond the data (by
        // ratcheting, say) keeps the whole periods it is held open to.
        const startsPartWayIn = coverage
            && coverage.start > firstPeriodStart
            && coverage.start < firstPeriodEnd;

        const endsPartWayIn = coverage
            && coverage.end > lastPeriodStart
            && coverage.end < lastPeriodEnd
            && !isLastPeriodEstimated(props);

        let start = startsPartWayIn ? coverage.start : firstPeriodStart;
        let end = endsPartWayIn ? coverage.end : lastPeriodEnd;

        // A date range zoomed out past the data holds the axis open to it.
        const range = props.isAllTime ? null : props.chartDateRange;

        if (range?.from) {

            const from = Ren.DateValueChart_DateRange.toDate(range.from);

            if (from < start) start = from;
        }

        if (range?.toExclusive) {

            const toExclusive = Ren.DateValueChart_DateRange.toDate(range.toExclusive);

            if (toExclusive > end) end = toExclusive;
        }

        return [start, end];
    };

    /**
     * Sets the stretch of time the axis runs across.  A redraw does this even where the extents are
     * unchanged, as the domain follows the last-period estimates, which every redraw refreshes.
     */
    const setXDomain = props => {

        if (!props.xExtent || !props.xExtent[0] || !props.xExtent[1]) return;

        props.xExtentPlusPeriod = getXDomain(props);
    };

    /**
     * Gets the extent a ratcheting axis is holding open with either end the chart's date range no
     * longer shows dropped from it, as [start, end] with a dropped end null.  The ratchet is there
     * to hold the axis still as the data changes beneath it, not to hold it against the range the
     * chart is panned or zoomed to, which would leave the axis running past the dates drawn.
     */
    const dropHeldExtentOutsideRange = (heldExtent, range) => {

        if (!heldExtent || !heldExtent[0] || !heldExtent[1]) return [null, null];

        if (!range) return heldExtent;

        const from = Ren.DateValueChart_DateRange.toDate(range.from);
        const toExclusive = Ren.DateValueChart_DateRange.toDate(range.toExclusive);

        return [
            from && heldExtent[0] < from ? null : heldExtent[0],
            toExclusive && heldExtent[1] >= toExclusive ? null : heldExtent[1]
        ];
    };

    /**
     * Sets the dates the axis runs between from the data, under the behaviour the x axis is set to.
     * Kept apart from the value extents, as a user-set value scale is left alone while the dates
     * the chart covers still follow its data.
     */
    const setXExtent = (props, data) => {

        const calculatedXExtent = Ren.ArrayUtils.extent(data, d => d[props.dateHeading]);

        if (!props.lastCalculatedXExtent) {
            props.lastCalculatedXExtent = calculatedXExtent;
        }

        // All time's one point is not held against the dates a finer grouping drew.
        const updateXScaleBehaviour = props.isAllTime
            ? "AlwaysUpdate"
            : props.axes.xAxis?.updateXScaleBehaviour || "AlwaysUpdate";

        if (calculatedXExtent[0] && calculatedXExtent[1]) {

            if (updateXScaleBehaviour === "AlwaysUpdate") {

                props.xExtent = calculatedXExtent;
            }
            else if (updateXScaleBehaviour === "Ratchet") {

                const heldExtent = dropHeldExtentOutsideRange(
                    props.xExtent,
                    props.chartDateRange
                );

                if (heldExtent[0] || heldExtent[1]) {

                    props.xExtent = [
                        heldExtent[0]
                            ? Ren.DateUtils.minDate(heldExtent[0], calculatedXExtent[0])
                            : calculatedXExtent[0],
                        heldExtent[1]
                            ? Ren.DateUtils.maxDate(heldExtent[1], calculatedXExtent[1])
                            : calculatedXExtent[1]
                    ];
                }
                else {

                    props.xExtent = calculatedXExtent;
                }
            }

            props.lastCalculatedXExtent = calculatedXExtent;
        }

        // None of the rows carry a usable date (e.g. the chart's date column is blank because the
        // grid is grouped by a different column), so there is no extent to derive a period from.
        // Any extent from a previous draw is kept; the caller checks for one before rendering.
        if (props.xExtent && props.xExtent[0] && props.xExtent[1]) {

            setXDomain(props);
        }
    };

    /**
     * Gets the height the tallest bar stack reaches on each axis, as { leftAxis, rightAxis,
     * hiddenAxis }, or zeroes where nothing is stacked.  Lines, dots and series switched off in the
     * legend are left out.
     */
    const getStackedAxisMaxes = (props, data) => {

        const maxes = { leftAxis: 0, rightAxis: 0, hiddenAxis: 0 };
        const barLayout = Ren.DateValueChartCalculator.getBarLayout(props);

        if (!Ren.DateValueChartCalculator.isStackedBarLayout(barLayout)) return maxes;

        const stackedSeriesIndexes = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const chartType = props.series[i].chartType ?? Ren.SeriesChartTypeEnum.Bar;

            if (chartType !== Ren.SeriesChartTypeEnum.Bar) continue;
            if (props.series[i].isEnabled === false) continue;

            stackedSeriesIndexes.push(i);
        }

        // A stacked series draws its estimate for the last period, so the stack there totals that.
        const plottedValue = (row, seriesIndex) => {

            const estimate = Ren.DateValueChart_LastPeriodEstimate
                .getRefreshedEstimate(props, seriesIndex);

            return estimate && estimate.row === row
                ? estimate.estimatedValue
                : row[props.valueHeadings[seriesIndex]];
        };

        // Per split, each split value's series make a stack of their own.
        const barSlots = Ren.DateValueChartCalculator.getBarSlots(
            props,
            stackedSeriesIndexes,
            barLayout
        );

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {

            const row = data[rowIndex];
            const slotTotals = [];

            for (let slot = 0; slot < barSlots.slotCount; slot++) {
                slotTotals.push({ leftAxis: 0, rightAxis: 0, hiddenAxis: 0 });
            }

            for (let i = 0; i < stackedSeriesIndexes.length; i++) {

                const seriesIndex = stackedSeriesIndexes[i];
                const value = plottedValue(row, seriesIndex);
                const axis = props.series[seriesIndex].valueAxis || "leftAxis";
                const totals = slotTotals[barSlots.slotBySeriesIndex[seriesIndex]];

                if (typeof value === "number" && isFinite(value)) totals[axis] += value;
            }

            for (let slot = 0; slot < slotTotals.length; slot++) {

                maxes.leftAxis = Math.max(maxes.leftAxis, slotTotals[slot].leftAxis);
                maxes.rightAxis = Math.max(maxes.rightAxis, slotTotals[slot].rightAxis);
                maxes.hiddenAxis = Math.max(maxes.hiddenAxis, slotTotals[slot].hiddenAxis);
            }
        }

        return maxes;
    };

    const setChartExtents = (props, data) => {

        if (!props.lastCalculatedMaxes) props.lastCalculatedMaxes = [];

        const axisMaxes = { leftAxis: 0, rightAxis: 0, hiddenAxis: 0 };
        const seriesMaxes = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const colName = props.valueHeadings[i];

            // A last-period estimate above the data so far becomes the axis' max.
            const maxVal = Ren.DateValueChart_LastPeriodEstimate.getExtentValue(
                props,
                i,
                Ren.ArrayUtils.max(data, d => d[colName])
            );

            seriesMaxes[i] = maxVal;

            // A series switched off in the legend is not plotted, so must not hold its axis open,
            // and nor is a pie's slice read off it.
            if (props.series[i].isEnabled === false) continue;
            if (Ren.DateValueChart_Pies.isPieSeries(props, i)) continue;

            const axis = props.series[i].valueAxis;
            axisMaxes[axis] = Math.max(axisMaxes[axis], maxVal || 0);
        }

        const stackedMaxes = getStackedAxisMaxes(props, data);
        const lineStackMaxes = Ren.DateValueChart_LineStack.getAxisMaxes(props, data);

        stackedMaxes.leftAxis = Math.max(stackedMaxes.leftAxis, lineStackMaxes.leftAxis);
        stackedMaxes.rightAxis = Math.max(stackedMaxes.rightAxis, lineStackMaxes.rightAxis);
        stackedMaxes.hiddenAxis = Math.max(stackedMaxes.hiddenAxis, lineStackMaxes.hiddenAxis);

        axisMaxes.leftAxis = Math.max(axisMaxes.leftAxis, stackedMaxes.leftAxis);
        axisMaxes.rightAxis = Math.max(axisMaxes.rightAxis, stackedMaxes.rightAxis);
        axisMaxes.hiddenAxis = Math.max(axisMaxes.hiddenAxis, stackedMaxes.hiddenAxis);

        Ren.DateValueChart_ValueLines.extendAxisMaxes(props, axisMaxes);
        Ren.DateValueChart_PreviousYear.extendAxisMaxes(props, axisMaxes);

        // A multi-chart's charts share their value scales.
        Ren.DateValueChart_MultiChart.shareAxisMaxes(props, axisMaxes);

        // Tracked so that a ratcheting axis expands for a stack growing taller even where no one
        // series in it has.
        seriesMaxes.push(stackedMaxes.leftAxis, stackedMaxes.rightAxis, stackedMaxes.hiddenAxis);

        const dataMaxChanged = props.lastCalculatedMaxes.length > 0 &&
                              seriesMaxes.some((max, i) => max !== props.lastCalculatedMaxes[i]);
        props.lastCalculatedMaxes = seriesMaxes;

        const updateAxisMax = (axis, calculatedMax) => {

            // Panning only moves along the dates, leaving the value axes as they were.
            const heldMax = Ren.DateValueChart_DateRangeWheel.getPanHold(props)?.yMaxes[axis];

            if (heldMax !== undefined) {

                props.axes[axis].maxY = heldMax;
                return;
            }

            const updateYScaleBehaviour = props.axes[axis].updateYScaleBehaviour
                || Ren.DateValueChart_Pies.getDefaultScaleBehaviour(props);

            if (updateYScaleBehaviour === "AlwaysUpdate") {

                props.axes[axis].maxY = calculatedMax;
            }
            else if (updateYScaleBehaviour === "AlwaysUpdateHalfway") {

                // So that the highest value fills half the height.
                props.axes[axis].maxY = calculatedMax * 2;
            }
            else if (updateYScaleBehaviour === "AlwaysUpdateOneThird") {

                props.axes[axis].maxY = calculatedMax * 3;
            }
            else if (updateYScaleBehaviour === "AlwaysUpdateTwoThirds") {

                props.axes[axis].maxY = calculatedMax * 3 / 2;
            }

            // "Unaltered" is the old name of "Fixed", still held by saved settings.
            else if (updateYScaleBehaviour === "Fixed" || updateYScaleBehaviour === "Unaltered") {

                if (props.axes[axis].maxY === undefined) {
                    props.axes[axis].maxY = calculatedMax;
                }
            }
            else {

                // Ratchet: respects user-set scales, and otherwise only ever expands.
                if (!props.axes[axis].fromSettings) {

                    if (dataMaxChanged) {

                        if (props.axes[axis].maxY === undefined) {

                            props.axes[axis].maxY = calculatedMax;
                        }
                        else {

                            props.axes[axis].maxY = Math.max(props.axes[axis].maxY, calculatedMax);
                        }
                    }
                    else {

                        if (props.axes[axis].maxY === undefined) {
                            props.axes[axis].maxY = calculatedMax;
                        }
                    }
                }
            }
        };

        updateAxisMax("leftAxis", axisMaxes.leftAxis);
        updateAxisMax("rightAxis", axisMaxes.rightAxis);
        updateAxisMax("hiddenAxis", axisMaxes.hiddenAxis);

        // The hidden axis always scales its own series alone, never sharing a scale.
        props.axes.hiddenAxis.yExtent = [0, props.axes.hiddenAxis.maxY || 1];

        setXExtent(props, data);

        if (props.seriesCount >= 2) {

            // Multi-column mode: determine whether dual axes are needed.
            const hasNullValues = axisMaxes.leftAxis === 0 || axisMaxes.rightAxis === 0;

            if (hasNullValues) {

                props.useDualAxes = false;
            }
            else {

                // Use dual axes when the two axes have different type categories OR when user has
                // assigned series to right axis.
                const getTypeCategory = format => {

                    if (format === Ren.SpreadsheetColumnFormatEnum.Currency) return "currency";
                    if (format === Ren.SpreadsheetColumnFormatEnum.Percentage) return "percentage";
                    return "number";
                };

                const leftCategory = getTypeCategory(props.axes.leftAxis.format);
                const rightCategory = getTypeCategory(props.axes.rightAxis.format);
                const differentCategories = props.axes.rightAxis.format !== undefined && leftCategory !== rightCategory;
                const userAssignedToRightAxis = axisMaxes.rightAxis > 0;
                // Use dual axes if right axis has different category OR if user has assigned series
                // to right axis.
                props.useDualAxes = differentCategories || userAssignedToRightAxis;
            }

            // Set yExtent on each axis.
            props.axes.leftAxis.yExtent = [0, props.axes.leftAxis.maxY || 1];

            if (props.useDualAxes) {

                props.axes.rightAxis.yExtent = [0, props.axes.rightAxis.maxY || 1];
            }
            else {

                // Both axes share the max of all series.
                const maxOfAll = Math.max(props.axes.leftAxis.maxY || 0, props.axes.rightAxis.maxY || 0);
                props.axes.leftAxis.yExtent = [0, maxOfAll];
                props.axes.rightAxis.yExtent = [0, maxOfAll];
            }
        }
        else {

            // Single-column mode: use simple extent.
            props.axes.leftAxis.yExtent = [0, props.axes.leftAxis.maxY || 1];
        }

        Ren.DateValueChart_ValueAxisFit.setAxisMins(props, data);
    };

    // Gradient ids must be scoped with props.guid: SVG ids are document-global, so unscoped ids
    // collide across multiple chart instances on the same page and url(#...) can resolve to the
    // wrong chart's gradient.
    const barGradientId = (props, seriesNum) => `bar-gradient-${props.guid}-series-${seriesNum}`;

    const gradientAngle = 10;

    // Creates (or updates, if it already exists) the bar gradient for one series, rotated 10
    // degrees clockwise from vertical: lighter at the top-right, darker at the bottom-left.
    const setBarGradientColour = (props, seriesNum, colour) => {

        const darkerColour = colour;
        const lighterColour = Ren.Colours.scaleBrightness(colour, 1.01);
        const gradientId = barGradientId(props, seriesNum);

        let gradient = props.defs.querySelector("#" + gradientId);

        if (!gradient) {

            gradient = Ren.Svg.append(props.defs, "linearGradient", {
                "id": gradientId,
                "x1": "0%",
                "y1": "0%",
                "x2": "0%",
                "y2": "100%",
                "gradientTransform": `rotate(${gradientAngle})`
            });

            Ren.Svg.append(gradient, "stop", {
                "class": "ren-gradient-stop-light",
                "offset": "0%"
            });
            Ren.Svg.append(gradient, "stop", {
                "class": "ren-gradient-stop-dark",
                "offset": "100%"
            });
        }

        gradient.querySelector(".ren-gradient-stop-light").setAttribute("stop-color", lighterColour);
        gradient.querySelector(".ren-gradient-stop-dark").setAttribute("stop-color", darkerColour);
    };

    const createBarGradients = props => {

        for (let i = 0; i < props.seriesCount; i++) {

            const colour = props.series[i].colour
                || Ren.DateValueChart_SeriesColours.getDefaultColour(
                    i,
                    props.visualisation?.colourScheme
                );

            setBarGradientColour(props, i + 1, colour);
        }
    };

    const setupSvgAndGroups = props => {

        const container = document.querySelector("." + props.guid);

        // A container gone from the page still gets a chart, left detached, so that what runs
        // after has one to work on.
        props.svg = document.createElementNS(Ren.Svg.NAMESPACE, "svg");

        if (container) {

            // Clear any previous render so that repeated calls don't produce duplicate SVGs.
            const previous = container.querySelectorAll("svg, .ren-date-value-chart-legend-html");

            for (let index = 0; index < previous.length; index++) {
                previous[index].remove();
            }

            Ren.Svg.setStyles(container, {
                "display": "flex",
                "flex-direction": "column",
                "padding": "0",
                "margin": "0",
                "box-sizing": "border-box",
                "height": "100%"
            });

            // Before any date slider, which is kept through a redraw so that a drag carries on.
            container.insertBefore(
                props.svg,
                container.querySelector(":scope > .ren-date-value-chart-period-slider")
            );

            Ren.DateValueChart_Title.render(props);
        }

        const xExtent = props.xExtent;

        // SVG takes remaining space, legend gets exact height needed.
        Ren.Svg.setAttrs(props.svg, {
            "width": "100%",
            "data-qa-date-value-chart-date-range": Ren.DateUtils.toSortableDate(xExtent[0])
                + " to " + Ren.DateUtils.toSortableDate(xExtent[1])
        });

        Ren.Svg.setStyles(props.svg, {
            "flex": "1",
            "min-height": "0",
            "margin": "0",
            "padding": "0"
        });

        props.defs = Ren.Svg.append(props.svg, "defs");

        createBarGradients(props);

        props.chartGroup = Ren.Svg.append(props.svg, "g", {
            "class": "ren-chart-group",
            "transform": `translate(${props.margin.left},${props.margin.top})`
        });
    };

    return {
        setChartDimensions,
        updateAxisMargins,
        setChartExtents,
        setXDomain,
        setXExtent,
        setupSvgAndGroups,
        barGradientId,
        setBarGradientColour,
        createBarGradients
    };
})();
