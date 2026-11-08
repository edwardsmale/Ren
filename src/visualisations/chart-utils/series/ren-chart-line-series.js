Ren.ChartLineSeries = (() => {

    const EDGE_OPACITY = 0.8;
    const EDGE_FADE_STEPS = 8;

    const defaultOptions = {
        curved: false,
        stepEdgesFn: null,
        dropShadow: false,
        areaBaseValueFn: null,
        periodEdgesFn: null,
        edgeMaskId: null
    };

    /**
     * Gets the first and last points the line plots, each with the x its period's outer edge is
     * at, or null where it plots none.
     */
    const getEndPoints = (data, mainValueFn, crossValueFn, xScale, yScale, options) => {

        let first = null;
        let last = null;

        for (let index = 0; index < data.length; index++) {

            if (crossValueFn(data[index]) == null || mainValueFn(data[index]) == null) continue;

            if (first === null) first = data[index];

            last = data[index];
        }

        if (first === null) return null;

        const getPoint = (d, edgeIndex) => ({
            x: xScale.getPixel(crossValueFn(d)),
            y: yScale.getPixel(mainValueFn(d)),
            baseY: options.areaBaseValueFn ? yScale.getPixel(options.areaBaseValueFn(d)) : null,
            edgeX: options.periodEdgesFn(d)[edgeIndex]
        });

        return { first: getPoint(first, 0), last: getPoint(last, 1) };
    };

    /**
     * Carries the line, and its shading, on flat from its first and last points to their periods'
     * outer edges, faded out towards them by a mask, so the marks fill the periods they stand for.
     */
    const extendToPeriodEdges = (props, linePath, areaPath, ends, maskId) => {

        const first = ends.first;
        const last = ends.last;
        const lineD = linePath.getAttribute("d");

        if (lineD && lineD.charAt(0) === "M") {

            linePath.setAttribute(
                "d",
                `M${first.edgeX},${first.y}L${lineD.substring(1)}L${last.edgeX},${last.y}`
            );
        }

        if (areaPath) {

            areaPath.setAttribute(
                "d",
                `M${first.edgeX},${first.y}H${first.x}V${first.baseY}H${first.edgeX}Z`
                + `M${last.x},${last.y}H${last.edgeX}V${last.baseY}H${last.x}Z`
                + (areaPath.getAttribute("d") || "")
            );
        }

        const width = last.edgeX - first.edgeX;

        if (!(width > 0)) return;

        const defs = props.defs;
        let mask = defs.querySelector("#" + maskId);

        if (mask) {
            mask.replaceChildren();
        }
        else {

            mask = Ren.Svg.append(defs, "mask", { "id": maskId });
        }

        // An alpha mask, as a luminance one's linearRGB conversion fades it out much faster.
        Ren.Svg.setStyles(mask, { "mask-type": "alpha" });
        Ren.Svg.setAttrs(mask, {
            "maskUnits": "userSpaceOnUse",
            "x": first.edgeX,
            "y": -100000,
            "width": width,
            "height": 200000
        });

        const gradient = Ren.Svg.append(mask, "linearGradient", {
            "id": `${maskId}-fade`,
            "gradientUnits": "userSpaceOnUse",
            "x1": first.edgeX,
            "x2": last.edgeX,
            "y1": 0,
            "y2": 0
        });

        const firstOffset = (first.x - first.edgeX) / width;
        const lastOffset = (last.x - first.edgeX) / width;

        // Eased, so the fade has no corner where it meets the unfaded shading for the eye to see
        // a darker band at, and never above full opacity.
        for (let step = 0; step <= EDGE_FADE_STEPS; step++) {

            const t = step / EDGE_FADE_STEPS;
            const fade = (1 - EDGE_OPACITY) * (1 - Math.cos(Math.PI * t)) / 2;

            Ren.Svg.append(gradient, "stop", {
                "offset": firstOffset * t,
                "stop-color": "white",
                "stop-opacity": EDGE_OPACITY + fade
            });
        }

        for (let step = 0; step <= EDGE_FADE_STEPS; step++) {

            const t = step / EDGE_FADE_STEPS;
            const fade = (1 - EDGE_OPACITY) * (1 - Math.cos(Math.PI * t)) / 2;

            Ren.Svg.append(gradient, "stop", {
                "offset": lastOffset + (1 - lastOffset) * t,
                "stop-color": "white",
                "stop-opacity": 1 - fade
            });
        }

        Ren.Svg.append(mask, "rect", {
            "x": first.edgeX,
            "y": -100000,
            "width": width,
            "height": 200000,
            "fill": `url(#${maskId}-fade)`
        });

        linePath.setAttribute("mask", `url(#${maskId})`);

        if (areaPath) areaPath.setAttribute("mask", `url(#${maskId})`);
    };

    /**
     * Gets a line's dash pattern in proportion to its width, so both must be in the same units.
     * The round caps add half the width to each end of a dash, so a dotted line's zero-length
     * dashes are round dots, and a dashed line's gaps are a width narrower than they are set.
     */
    const getStrokeDasharray = (lineStyle, strokeWidth) => {

        switch (lineStyle) {

            case "dashed":
                return `${strokeWidth * 3} ${strokeWidth * 3}`;

            case "dotted":
                return `0 ${strokeWidth * 2}`;

            default:
                return "none";
        }
    };

    /**
     * Gets the width a line is drawn at.  Dotted lines are drawn half as thick again to make the
     * dots more visible.
     */
    const getStrokeWidth = (lineStyle, strokeWidth) =>
        lineStyle === "dotted" ? strokeWidth * 1.5 : strokeWidth;

    /**
     * Marks each plotted point of the line with a circle.  Its non-scaling stroke of
     * options.nodeOverhang pixels either side straddles the edge, so that part is in screen pixels
     * however the chart is scaled.  Its colour and radius are the chart's stylesheet's to set.
     */
    const renderNodes = (seriesGroup, data, mainValueFn, crossValueFn, xScale, yScale, options) => {

        for (let index = 0; index < data.length; index++) {

            const d = data[index];

            if (crossValueFn(d) == null || mainValueFn(d) == null) continue;

            Ren.Svg.setDatum(
                Ren.Svg.append(seriesGroup, "circle", {
                    "class": "ren-data-series__line-node",
                    "cx": xScale.getPixel(crossValueFn(d)),
                    "cy": yScale.getPixel(mainValueFn(d)),
                    "stroke-width": options.nodeOverhang * 2,
                    "vector-effect": "non-scaling-stroke",
                    "pointer-events": "none"
                }),
                d
            );
        }
    };

    const renderLineSeries = ({ props, data, mainValueFn, crossValueFn }, options = {}) => {

        Ren.ChartSeriesHelpers.applyDefaults(options, defaultOptions);

        const xScale = props.xScale;
        const yScale = options.yScale || Ren.ChartSeriesHelpers.getYScale(props, data, mainValueFn);
        const curve = options.curved ? Ren.ChartPaths.BASIS : Ren.ChartPaths.LINEAR;
        const dropShadow = options.dropShadow ?
            (typeof options.dropShadow === "string" ? options.dropShadow : "2px 4px 6px black") :
            null;

        const seriesGroup = Ren.ChartSeriesHelpers.createSeriesGroup(props, "ren-data-series ren-data-series--line");

        // Stepped, the line is flat across each period options.stepEdgesFn gives the x edges of.
        const stepEdges = options.stepEdgesFn;

        // Shaded down to options.areaBaseValueFn's value beneath each point, behind the line.  Its
        // colour and opacity are the chart's stylesheet's to set, as the line's are.
        let areaPath = null;

        if (options.areaBaseValueFn) {

            areaPath = Ren.ChartSvgSeries.renderArea(seriesGroup, data, {
                crossValue: d => crossValueFn(d),
                mainValue: d => mainValueFn(d),
                baseValue: d => options.areaBaseValueFn(d),
                xScale,
                yScale,
                curve,
                stepEdges
            });

            Ren.Svg.setAttrs(areaPath, {
                "class": "ren-data-series__line-area",
                "pointer-events": "none"
            });
        }

        // The line's colour, width and dash pattern are the chart's stylesheet's to set, so they
        // can be restyled without a redraw.
        const linePath = Ren.ChartSvgSeries.renderLine(seriesGroup, data, {
            crossValue: d => crossValueFn(d),
            mainValue: d => mainValueFn(d),
            xScale,
            yScale,
            curve,
            stepEdges
        });

        Ren.Svg.setAttrs(linePath, {
            "class": "ren-data-series__line-path",
            "fill": "none",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "filter": options.dropShadow ? `drop-shadow(${dropShadow})` : null
        });

        // A stepped line already reaches its periods' outer edges.
        if (options.periodEdgesFn && options.edgeMaskId && !stepEdges) {

            const ends = getEndPoints(data, mainValueFn, crossValueFn, xScale, yScale, options);

            if (ends) {
                extendToPeriodEdges(props, linePath, areaPath, ends, options.edgeMaskId);
            }
        }

        // Add invisible thick line for easier pointer events/clicks.
        Ren.Svg.insertBefore(
            seriesGroup,
            "path",
            {
                "d": linePath.getAttribute("d"),
                "class": "ren-data-series__line-path-hit",
                "fill": "none",
                "stroke": "transparent",
                "stroke-width": 70,
                "pointer-events": "stroke"
            },
            linePath
        );

        if (options.nodeOverhang) {

            renderNodes(
                seriesGroup,
                data,
                mainValueFn,
                crossValueFn,
                xScale,
                yScale,
                options
            );
        }
    };

    return {
        getStrokeDasharray,
        getStrokeWidth,
        renderLineSeries
    };
})();
