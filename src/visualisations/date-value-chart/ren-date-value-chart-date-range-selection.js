/**
 * Picking a date/value chart's date range by dragging across its plot: a press on an empty part of
 * the chart, a drag left or right, and the chart narrows to the dates the drag covered.
 *
 * The band is drawn snapped to whole days, or to whole bins where the chart is binned finer than a
 * day, so that what is released on is what is asked for rather than a fraction of one either end.
 * The range applied is the chart's own client-side reduction (see Ren.DateValueChart_DateRange),
 * so nothing is requeried.
 *
 * Each drag puts the range the chart was showing onto a stack, and a double-click on the same empty
 * space takes the top of it back off, so that several zooms in a row are undone one at a time.  A
 * narrowed chart carries a "Reset" button above its plot, which drops the stack and puts every date
 * back at once, and, while the stack has anything on it, an "Undo" button before it that does what
 * a double-click does.  Neither the way out nor the fact that dates are being left out is left to
 * be guessed at.  "Every date" is the chart's default range where it was given one - its initial
 * range, or a defaultDateRange of its own - so Reset takes it back to that rather than to all time.
 */
Ren.DateValueChart_DateRangeSelection = (() => {

    // How far the pointer travels before a press reads as a range being picked rather than as a
    // click on the chart.
    const DRAG_THRESHOLD_PX = 10;

    // The band and the edges that give it a definite start and end.
    const BAND_COLOUR = "#4A90D9";
    const BAND_OPACITY = 0.18;
    const EDGE_COLOUR = "#2A6099";
    const EDGE_OPACITY = 0.7;
    const EDGE_WIDTH_PX = 1;

    // The buttons a narrowed chart is put back from: the size they are drawn at, and what they are
    // drawn in.  They are kept small and plain, being undos rather than something to reach for.
    const UNDO_TEXT = "Undo";
    const RESET_TEXT = "Reset";
    const BUTTON_HEIGHT_PX = 18;
    const BUTTON_PADDING_X_PX = 8;
    const BUTTON_GAP_PX = 4;
    const BUTTON_FONT_SIZE_PX = 11;
    const BUTTON_FILL_COLOUR = "#FFFFFF";
    const BUTTON_EDGE_COLOUR = "#C8C8C8";
    const BUTTON_TEXT_COLOUR = "#333333";
    const BUTTON_OFFSET_X_PX = 8;
    const BUTTON_OFFSET_Y_PX = 1;

    // The font size Ren.TextUtils.measureText measures at.
    const MEASURED_FONT_SIZE_PX = 12;

    // What a press belongs to already: a bar or point and its handles, an axis, a marker line, a
    // value label, or the Undo and Reset buttons.  Everything else on the plot is empty space.
    const OCCUPIED_SELECTOR = "[data-series], .ren-axis, .ren-marker-lines, .ren-value-labels-layer,"
        + " .ren-bar-resize-handle, .ren-date-range-undo, .ren-date-range-reset";

    // The range the last drag picked, as the chart was asked to apply it.
    let lastResult = { shown: false, from: null, to: null, depth: 0 };

    const getDiagnostics = () => lastResult;

    /**
     * Gets a value indicating whether a press went down on empty space rather than on something
     * the chart draws.
     */
    const isOnEmptySpace = (target) =>
        !target || !target.closest || !target.closest(OCCUPIED_SELECTOR);

    /**
     * Draws one button with its left edge at a given x, and returns how wide it was drawn.
     */
    const drawButton = (props, className, label, leftPx, topPx, onClick) => {

        const group = Ren.Svg.append(props.chartGroup, "g", {
            "class": `${className} ${Ren.DateValueChart_ImageExport.LEAVE_OUT_CLASS}`
        });

        group.style.cursor = "pointer";
        group.addEventListener("click", () => onClick());

        const ground = Ren.Svg.append(group, "rect", {
            "class": className + "-ground",
            "x": leftPx,
            "y": topPx,
            "height": BUTTON_HEIGHT_PX,
            "rx": 2,
            "fill": BUTTON_FILL_COLOUR,
            "stroke": BUTTON_EDGE_COLOUR
        });

        const text = Ren.Svg.append(group, "text", {
            "class": className + "-label",
            "x": leftPx + BUTTON_PADDING_X_PX,
            "y": topPx + BUTTON_HEIGHT_PX / 2,
            "dominant-baseline": "central",
            "font-size": BUTTON_FONT_SIZE_PX,
            "fill": BUTTON_TEXT_COLOUR
        });

        text.style.userSelect = "none";
        text.textContent = label;

        // A chart redrawn by a zoom is drawn before it is laid out, where the text measures as
        // nothing, so its width is estimated instead.
        const textWidthPx = text.getComputedTextLength()
            || Ren.TextUtils.measureText(label) * BUTTON_FONT_SIZE_PX / MEASURED_FONT_SIZE_PX;
        const widthPx = textWidthPx + BUTTON_PADDING_X_PX * 2;

        ground.setAttribute("width", widthPx);

        return widthPx;
    };

    /**
     * Draws the Undo and Reset buttons above the plot's top left corner, where the chart is
     * showing other than its default range.  They sit in the strip at the very top of the chart
     * rather than directly over the plot, which is where a chart with date markers draws their
     * labels.  Undo is drawn only while there is a zoom to go back from.
     */
    const drawZoomButtons = (props, onUndo, onReset) => {

        const DateRange = Ren.DateValueChart_DateRange;

        if (!DateRange.isAwayFromDefault(props.visualisation)
            && !DateRange.getZoomStackDepth(props.visualisation)) {

            return;
        }

        const topPx = -(props.margin ? props.margin.top : BUTTON_HEIGHT_PX) + 1
            - BUTTON_OFFSET_Y_PX;

        let leftPx = BUTTON_OFFSET_X_PX;

        if (DateRange.getZoomStackDepth(props.visualisation)) {

            leftPx += drawButton(props, "ren-date-range-undo", UNDO_TEXT, leftPx, topPx, onUndo)
                + BUTTON_GAP_PX;
        }

        drawButton(props, "ren-date-range-reset", RESET_TEXT, leftPx, topPx, onReset);
    };

    /**
     * Draws the band between two plot x positions, both already snapped to a boundary.
     */
    const draw = (props, elements, lowPlotX, highPlotX) => {

        const scaleX = props.scaleX || 1;
        const leftPx = lowPlotX * scaleX;
        const widthPx = Math.max(1, highPlotX * scaleX - leftPx);
        const heightPx = props.innerHeight * (props.scaleY || 1);

        Ren.DateValueChart_Visibility.setShown(props, ".ren-date-range-selection", true);

        Ren.Svg.setAttrs(elements.band, {
            "x": leftPx,
            "y": 0,
            "width": widthPx,
            "height": heightPx
        });

        Ren.Svg.setAttrs(elements.leftEdge, {
            "x": leftPx,
            "y": 0,
            "width": EDGE_WIDTH_PX,
            "height": heightPx
        });

        Ren.Svg.setAttrs(elements.rightEdge, {
            "x": leftPx + widthPx - EDGE_WIDTH_PX,
            "y": 0,
            "width": EDGE_WIDTH_PX,
            "height": heightPx
        });
    };

    /**
     * Starts a chart listening for a range dragged across its plot.  The band belongs to the chart
     * group and the press handler to the svg, so both go with the chart when it is drawn again.
     *
     * @param {object} props - The chart's props, holding the svg and chart group drawn into, the x
     *     scale the axis was drawn from, and the plot's size in its own coordinates.
     */
    const attach = (props) => {

        // All time draws a single point, so there is no stretch of dates to drag across, and one of
        // a multi-chart's charts keeps to its own period.
        if (!props.svg || !props.chartGroup || !props.xScale || props.isAllTime) return;

        if (props.multiChartRange) return;

        // Left out of hit testing, so the band does not take the pointer off the chart underneath
        // it while the drag is still running.
        const group = Ren.Svg.append(props.chartGroup, "g", {
            "class": "ren-date-range-selection"
        });

        group.style.pointerEvents = "none";

        Ren.DateValueChart_Visibility.setShown(props, ".ren-date-range-selection", false);

        const edgeAttrs = {
            "class": "ren-date-range-selection-edge",
            "fill": EDGE_COLOUR,
            "fill-opacity": EDGE_OPACITY,
            "shape-rendering": "crispEdges"
        };

        const elements = {
            group,
            band: Ren.Svg.append(group, "rect", {
                "class": "ren-date-range-selection-band",
                "fill": BAND_COLOUR,
                "fill-opacity": BAND_OPACITY
            }),
            leftEdge: Ren.Svg.append(group, "rect", edgeAttrs),
            rightEdge: Ren.Svg.append(group, "rect", edgeAttrs)
        };

        const chartGroupNode = props.chartGroup;

        // Where the press went down, and whether it has travelled far enough to be a range.
        let anchorPlotX = null;
        let anchorClientX = 0;
        let isDragging = false;
        let selection = null;

        /**
         * Reads a pointer position as a plot x, kept within the plot so that a drag carried off
         * the chart picks the first or last day rather than a date the axis does not show.
         */
        const toPlotX = (event) => {

            const pointer = Ren.Svg.pointer(event, chartGroupNode);
            const plotX = pointer[0] / (props.scaleX || 1);

            return Math.max(0, Math.min(props.innerWidth, plotX));
        };

        /**
         * Gets a value indicating whether a press went down on the plot itself, rather than on the
         * margins the axes and labels are drawn in.
         */
        const isOnPlot = (event) => {

            const pointer = Ren.Svg.pointer(event, chartGroupNode);
            const yPx = pointer[1];

            return yPx >= 0 && yPx <= props.innerHeight * (props.scaleY || 1);
        };

        /**
         * Narrows the chart to a range, or restores every date where the range is null, and tells
         * the charts sharing this one's date range group to follow.
         */
        const applyRange = (range) => {

            lastResult = {
                shown: !!range,
                from: range ? range.from : null,
                to: range ? range.to : null,
                depth: Ren.DateValueChart_DateRange.getZoomStackDepth(props.visualisation)
            };

            // So that wheeling on from here is an undo of its own rather than the tail of the run
            // this range has just replaced.
            Ren.DateValueChart_DateRangeWheel.endBurst(props);

            Ren.DateValueChart_DateRange.applyToChart(props.visualisation, props, range);
            Ren.DateValueChart_DateRange.notifyRangeChanged(props.visualisation, range);
        };

        const finish = () => {

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);

            anchorPlotX = null;
            isDragging = false;
            Ren.DateValueChart_Visibility.setShown(props, ".ren-date-range-selection", false);
        };

        /**
         * Gets the interval a drag is snapped to: the chart's bins where they are finer than a
         * day, or else days, which the range then snaps outwards to the bins.
         */
        const getSnapInterval = () => {

            const period = Ren.DateValueChart_DateRange.getRangePeriod(
                Ren.DateValueChart_GroupingApplyer.getEffectiveBinPeriod(props)
            );

            return Ren.DateValueChartCalculator.getTimeInterval(
                Math.min(period, Ren.DatePeriodEnum.Day)
            );
        };

        /**
         * Draws the band over the periods the drag has covered so far.  The low side is taken down
         * to the start of its period and the high side up to the start of the next, so that a drag
         * within one period still picks that whole period.
         */
        const onMouseMove = (event) => {

            if (anchorPlotX === null) return;

            if (!isDragging) {

                if (Math.abs(event.clientX - anchorClientX) < DRAG_THRESHOLD_PX) return;

                isDragging = true;
            }

            const plotX = toPlotX(event);
            const lowPlotX = Math.min(anchorPlotX, plotX);
            const highPlotX = Math.max(anchorPlotX, plotX);
            const interval = getSnapInterval();
            const from = interval.getPeriodStartAtOrBefore(props.xScale.getValue(lowPlotX));
            const toExclusive = interval.getPeriodStartAtOrAfter(props.xScale.getValue(highPlotX));

            selection = { from, toExclusive };

            draw(props, elements, props.xScale.getPixel(from), props.xScale.getPixel(toExclusive));
        };

        /**
         * Narrows the chart to the periods the drag covered, over the range it was showing, which
         * a double-click then takes it back to.  A press that never reached the threshold is a
         * click on empty space, which the legend's chart clicks act on.
         */
        const onMouseUp = () => {

            const picked = isDragging ? selection : null;

            finish();

            if (!picked || !props.visualisation) return;

            const DateRange = Ren.DateValueChart_DateRange;
            const toExclusive = DateRange.toSortableDateTime(picked.toExclusive.getTime());

            DateRange.pushZoom(
                props.visualisation,
                DateRange.getRange(props.visualisation.chartDataGroupingSettings)
            );

            applyRange({
                from: DateRange.toSortableDateTime(picked.from.getTime()),
                to: DateRange.getInclusiveTo(toExclusive)
            });
        };

        props.svg.onmousedown = (event) => {

            if (event.button !== 0 || !isOnEmptySpace(event.target) || !isOnPlot(event)) return;

            anchorPlotX = toPlotX(event);
            anchorClientX = event.clientX;
            isDragging = false;
            selection = null;

            // So the drag does not also select the text around the chart as it goes.
            event.preventDefault();

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        };

        // Undoes a zoom, so a chart narrowed by mistake is put back where it was narrowed, one
        // zoom at a time.  With nothing left on the stack - a range picked from the menu, say - it
        // puts the default range back, and a chart already showing that is left alone rather than
        // redrawn for nothing.
        props.svg.ondblclick = (event) => {

            if (!isOnEmptySpace(event.target) || !isOnPlot(event)) return;

            if (!props.visualisation) return;

            const DateRange = Ren.DateValueChart_DateRange;

            if (DateRange.getZoomStackDepth(props.visualisation)) {

                applyRange(DateRange.popZoom(props.visualisation));

                return;
            }

            if (!DateRange.isAwayFromDefault(props.visualisation)) return;

            applyRange(DateRange.getDefaultRange(props.visualisation));
        };

        // Undo takes back the last zoom, as a double-click does.  Reset is the way out of every
        // zoom at once, so it drops the stack rather than leaving zooms behind for a double-click
        // to walk back into.
        drawZoomButtons(
            props,
            () => {

                const DateRange = Ren.DateValueChart_DateRange;

                if (!DateRange.getZoomStackDepth(props.visualisation)) return;

                applyRange(DateRange.popZoom(props.visualisation));
            },
            () => {

                const DateRange = Ren.DateValueChart_DateRange;

                DateRange.clearZoomStack(props.visualisation);

                applyRange(DateRange.getDefaultRange(props.visualisation));
            }
        );
    };

    return {
        DRAG_THRESHOLD_PX,
        attach,
        getDiagnostics,
        isOnEmptySpace
    };
})();
