/**
 * Draws a chart's value lines: horizontal lines across the plot at set values, such as a target
 * or a threshold, each labelled at its right-hand end.  A line is drawn against the axis it names,
 * the left by default, and holds that axis open to its value, so that a target above every value
 * plotted is still shown.
 *
 * The lines are a chart's own setting, valueLines, each { value, label, axis }.  Value bands,
 * valueBands, each { from, to, label, axis }, shade the plot between two values, such as a target
 * range, behind the series, and hold their axis open to both ends in the same way.
 */
Ren.DateValueChart_ValueLines = (() => {

    const LINE_COLOUR = "#C0392B";
    const BAND_COLOUR = "#27AE60";
    const BAND_OPACITY = 0.12;
    const LABEL_FONT_SIZE = 11;
    const LABEL_GAP = 3;

    const isNumber = value => typeof value === "number" && isFinite(value);

    /**
     * Gets the chart's value lines that have a value to be drawn at.
     */
    const getLines = (props) => {

        const lines = Array.isArray(props.valueLines) ? props.valueLines : [];

        return lines.filter(line => line && isNumber(line.value));
    };

    /**
     * Gets the chart's value bands that have both ends, each with from the lower end.
     */
    const getBands = (props) => {

        const bands = Array.isArray(props.valueBands) ? props.valueBands : [];
        const result = [];

        for (let i = 0; i < bands.length; i++) {

            const band = bands[i];

            if (!band || !isNumber(band.from) || !isNumber(band.to)) continue;

            result.push(Object.assign({}, band, {
                from: Math.min(band.from, band.to),
                to: Math.max(band.from, band.to)
            }));
        }

        return result;
    };

    const getAxisName = (line) => line.axis === "rightAxis" ? "rightAxis" : "leftAxis";

    /**
     * Raises each axis' max to the highest line drawn against it.
     */
    const extendAxisMaxes = (props, axisMaxes) => {

        const lines = getLines(props);

        for (let i = 0; i < lines.length; i++) {

            const axisName = getAxisName(lines[i]);

            axisMaxes[axisName] = Math.max(axisMaxes[axisName] || 0, lines[i].value);
        }

        const bands = getBands(props);

        for (let i = 0; i < bands.length; i++) {

            const axisName = getAxisName(bands[i]);

            axisMaxes[axisName] = Math.max(axisMaxes[axisName] || 0, bands[i].to);
        }
    };

    /**
     * Lowers each axis' min to the lowest line drawn against it.
     */
    const extendAxisMins = (props, axisMins) => {

        const lines = getLines(props);

        for (let i = 0; i < lines.length; i++) {

            const axisName = getAxisName(lines[i]);

            axisMins[axisName] = Math.min(axisMins[axisName] ?? Infinity, lines[i].value);
        }

        const bands = getBands(props);

        for (let i = 0; i < bands.length; i++) {

            const axisName = getAxisName(bands[i]);

            axisMins[axisName] = Math.min(axisMins[axisName] ?? Infinity, bands[i].from);
        }
    };

    /**
     * Gets the text a line is labelled with: its own label, or else its value in its axis' format.
     */
    const getLabel = (line, formatValue) => {

        if (line.label) return String(line.label);

        return formatValue ? formatValue(line.value) : String(line.value);
    };

    /**
     * Gets the line's value read from a text typed in, ignoring thousands separators and a
     * currency sign, or null where the text holds no number.  A percentage is read as a fraction.
     */
    const parseValue = (text) => {

        if (text === null || text === undefined) return null;

        const trimmed = String(text).trim();
        const isPercentage = trimmed.endsWith("%");
        const cleaned = trimmed.replace(/[,%£$€\s]/g, "");

        if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return null;

        const value = Number(cleaned);

        return isPercentage ? value / 100 : value;
    };

    const getDrawnAxis = (props, item) => {

        const axisName = getAxisName(item);

        return props.axes[axisName]?.yScale ? props.axes[axisName] : props.axes.leftAxis;
    };

    /**
     * Shades the bands behind everything else in the plot.  A band reaching beyond its axis'
     * range is cut off at it, and one wholly beyond it is left out.
     */
    const renderBands = (props) => {

        const bands = getBands(props);
        let group = null;

        for (let i = 0; i < bands.length; i++) {

            const axis = getDrawnAxis(props, bands[i]);

            if (!axis?.yScale) continue;

            const domain = axis.yScale.getDomain();
            const domainMin = Math.min(domain[0], domain[1]);
            const domainMax = Math.max(domain[0], domain[1]);

            if (bands[i].to < domainMin || bands[i].from > domainMax) continue;

            const top = axis.yScale.getPixel(Math.min(bands[i].to, domainMax));
            const bottom = axis.yScale.getPixel(Math.max(bands[i].from, domainMin));

            if (!group) {

                group = Ren.Svg.append(props.chartGroup, "g", {
                    "class": "ren-value-bands",
                    "pointer-events": "none"
                });

                props.chartGroup.insertBefore(group, props.chartGroup.firstChild);
            }

            Ren.Svg.append(group, "rect", {
                "class": "ren-value-band",
                "data-value-band": i,
                "x": 0,
                "y": Math.min(top, bottom),
                "width": props.innerWidth,
                "height": Math.abs(bottom - top),
                "fill": BAND_COLOUR,
                "fill-opacity": BAND_OPACITY
            });

            if (!bands[i].label) continue;

            const wrapper = Ren.Svg.append(group, "g", {
                "class": "ren-text-wrapper",
                "transform": `translate(0, ${Math.min(top, bottom)})`
            });

            const label = Ren.Svg.append(wrapper, "text", {
                "class": "ren-value-band-label",
                "x": LABEL_GAP,
                "y": LABEL_FONT_SIZE + LABEL_GAP,
                "font-family": "sans-serif",
                "font-size": LABEL_FONT_SIZE,
                "fill": BAND_COLOUR
            });

            label.textContent = String(bands[i].label);
        }
    };

    /**
     * Draws the lines over the plot, afresh on every redraw.  A line beyond its axis' range, as
     * where the axis' scale has been set below it, is left out.
     */
    const render = (props) => {

        if (!props.chartGroup) return;

        renderBands(props);

        const lines = getLines(props);

        if (lines.length === 0) return;

        let group = null;

        for (let i = 0; i < lines.length; i++) {

            const axis = getDrawnAxis(props, lines[i]);

            if (!axis?.yScale) continue;

            const domain = axis.yScale.getDomain();
            const value = lines[i].value;

            if (value < Math.min(domain[0], domain[1]) || value > Math.max(domain[0], domain[1])) {
                continue;
            }

            const y = axis.yScale.getPixel(value);

            if (!group) {

                group = Ren.Svg.append(props.chartGroup, "g", {
                    "class": "ren-value-lines",
                    "pointer-events": "none"
                });
            }

            Ren.Svg.append(group, "line", {
                "class": "ren-value-line",
                "data-value-line": i,
                "x1": 0,
                "y1": y,
                "x2": props.innerWidth,
                "y2": y,
                "stroke": LINE_COLOUR,
                "stroke-width": 1.5,
                "stroke-dasharray": "4,3",
                "vector-effect": "non-scaling-stroke"
            });

            // The label is counter-scaled about the line's end, within its wrapper, to keep its
            // size.
            const wrapper = Ren.Svg.append(group, "g", {
                "class": "ren-text-wrapper",
                "transform": `translate(${props.innerWidth}, ${y})`
            });

            const label = Ren.Svg.append(wrapper, "text", {
                "class": "ren-value-line-label",
                "x": -LABEL_GAP,
                "y": -LABEL_GAP,
                "text-anchor": "end",
                "font-family": "sans-serif",
                "font-size": LABEL_FONT_SIZE,
                "fill": LINE_COLOUR
            });

            label.textContent = getLabel(
                lines[i],
                Ren.DateValueChart_Axes.makeAxisTickFormatter(axis)
            );
        }
    };

    return {
        getLines,
        getBands,
        extendAxisMaxes,
        extendAxisMins,
        getLabel,
        parseValue,
        render
    };
})();
