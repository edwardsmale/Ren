/**
 * Draws a chart axis into an SVG group: a "domain" path along the scale's range, then a g.tick per
 * tick holding its mark (a path) and its label, each tick bound to the value it marks.  The date
 * value chart's styling, decluttering and hover code find the ticks by this markup.
 */
Ren.ChartSvgAxis = (() => {

    const BOTTOM = "bottom";
    const LEFT = "left";
    const RIGHT = "right";

    const DEFAULT_TICK_COUNT = 10;
    const DEFAULT_TICK_SIZE = 6;
    const TICK_PADDING = 3;
    const STROKE_COLOUR = "#000";

    const getTextAnchor = orient => {

        switch (orient) {

            case LEFT:
                return "end";

            case RIGHT:
                return "start";

            default:
                return "middle";
        }
    };

    const getTicks = (scale, options) => {

        if (options.tickValues) return options.tickValues;

        return scale.getTicks ? scale.getTicks(DEFAULT_TICK_COUNT) : scale.getDomain();
    };

    const getTickFormat = options => options.tickFormat || (value => value);

    /**
     * Draws an axis into axisGroup.
     *
     * @param {Element} axisGroup - The SVG group to draw into.
     * @param {string} orient - BOTTOM, LEFT or RIGHT.
     * @param {Function} scale - The scale the axis is for (see Ren.ChartScales).
     * @param {object} [options] - { tickValues, tickFormat, tickSizeInner }, each optional. Without
     *     tickValues the scale's own ticks are used.
     */
    const renderAxis = (axisGroup, orient, scale, options = {}) => {

        const isVertical = orient === LEFT || orient === RIGHT;
        const sign = orient === BOTTOM || orient === RIGHT ? 1 : -1;
        const tickSizeInner = options.tickSizeInner ?? DEFAULT_TICK_SIZE;
        const tickSizeOuter = DEFAULT_TICK_SIZE;
        const pathLine = points => Ren.ChartPaths.getLinePath([points]);

        const transpose = point => isVertical ? [point[1], point[0]] : point;
        const translate = (x, y) => isVertical ? `translate(${y}, ${x})` : `translate(${x}, ${y})`;

        const getLabelDy = () => {

            if (isVertical) return "0.32em";

            return orient === BOTTOM ? "0.71em" : "0em";
        };

        Ren.Svg.setAttrs(axisGroup, {
            "fill": "none",
            "font-size": 10,
            "font-family": "sans-serif",
            "text-anchor": getTextAnchor(orient)
        });

        const range = scale.getRange();

        Ren.Svg.append(axisGroup, "path", {
            "class": "domain",
            "stroke": STROKE_COLOUR,
            "d": pathLine([
                transpose([range[0], sign * tickSizeOuter]),
                transpose([range[0], 0]),
                transpose([range[1], 0]),
                transpose([range[1], sign * tickSizeOuter])
            ])
        });

        const tickFormat = getTickFormat(options);
        const ticks = getTicks(scale, options);
        const tickPath = pathLine([[0, 0], transpose([0, sign * tickSizeInner])]);
        const labelTransform = translate(0, sign * (tickSizeInner + TICK_PADDING));
        const labelDy = getLabelDy();

        for (let index = 0; index < ticks.length; index++) {

            const tickGroup = Ren.Svg.append(axisGroup, "g", {
                "class": "tick",
                "transform": translate(scale.getPixel(ticks[index]), 0)
            });

            Ren.Svg.setDatum(tickGroup, ticks[index]);
            Ren.Svg.append(tickGroup, "path", { "stroke": STROKE_COLOUR, "d": tickPath });

            // A format giving null for a tick leaves it as a mark alone, with no label element at
            // all, so that an axis ticking at more periods than it can name does not draw - and
            // whatever reads the labels does not then measure - a label per tick.
            const label = tickFormat(ticks[index], index);

            if (label === null) continue;

            const text = Ren.Svg.append(tickGroup, "text", {
                "fill": STROKE_COLOUR,
                "transform": labelTransform,
                "dy": labelDy
            });

            text.textContent = label ?? "";
        }
    };

    const renderBottomAxis = (axisGroup, scale, options) =>
        renderAxis(axisGroup, BOTTOM, scale, options);

    const renderLeftAxis = (axisGroup, scale, options) =>
        renderAxis(axisGroup, LEFT, scale, options);

    const renderRightAxis = (axisGroup, scale, options) =>
        renderAxis(axisGroup, RIGHT, scale, options);

    return {
        renderBottomAxis,
        renderLeftAxis,
        renderRightAxis
    };
})();
