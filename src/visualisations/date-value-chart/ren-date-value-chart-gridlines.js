/**
 * Draws a chart's gridlines: faint horizontal lines across the plot at its value axis' ticks,
 * behind the series, for values to be read across to.  They follow the left axis' ticks, or the
 * right axis' where only the right axis is shown.
 *
 * The lines are a chart's own setting, showGridlines, off by default.
 */
Ren.DateValueChart_Gridlines = (() => {

    const GROUP_CLASS = "ren-gridlines";
    const LINE_COLOUR = "#E3E3E3";

    /**
     * Gets the axis the gridlines follow, or null where the chart has no value axis to follow.
     */
    const getAxis = (props) => {

        const axes = props.axes || {};
        const showsRightOnly = props.showLeftAxis === false
            && props.showRightAxis !== false
            && Ren.DateValueChart_YScales.hasRightAxis(props);
        const axis = showsRightOnly ? axes.rightAxis : axes.leftAxis;

        return axis && axis.yScale ? axis : null;
    };

    /**
     * Gets the pixel heights the gridlines are drawn at: one per tick, leaving out a tick on the
     * plot's bottom edge, where the date axis already runs.
     */
    const getLinePixels = (props, axis) => {

        const ticks = axis.yScale.getTicks(props.valueAxisTickCount);
        const pixels = [];

        for (let i = 0; i < ticks.length; i++) {

            const pixel = axis.yScale.getPixel(ticks[i]);

            if (isFinite(pixel) && pixel >= 0 && pixel < props.innerHeight - 0.5) {
                pixels.push(pixel);
            }
        }

        return pixels;
    };

    /**
     * Draws the gridlines afresh at the back of the plot, as the chart is drawn and whenever its
     * value axes are ticked again.
     */
    const render = (props) => {

        if (!props.chartGroup) return;

        const existing = props.chartGroup.querySelector(`:scope > .${GROUP_CLASS}`);

        if (existing) existing.remove();

        if (props.showGridlines !== true || Ren.DateValueChart_Pies.isShown(props)) return;

        const axis = getAxis(props);

        if (!axis) return;

        const pixels = getLinePixels(props, axis);
        const group = Ren.Svg.append(props.chartGroup, "g", {
            "class": GROUP_CLASS,
            "pointer-events": "none"
        });

        for (let i = 0; i < pixels.length; i++) {

            Ren.Svg.append(group, "line", {
                "class": "ren-gridline",
                "x1": 0,
                "y1": pixels[i],
                "x2": props.innerWidth,
                "y2": pixels[i],
                "stroke": LINE_COLOUR,
                "stroke-width": 1,
                "vector-effect": "non-scaling-stroke",
                "shape-rendering": "crispEdges"
            });
        }

        props.chartGroup.insertBefore(group, props.chartGroup.firstChild);
    };

    return {
        getAxis,
        getLinePixels,
        render
    };
})();
