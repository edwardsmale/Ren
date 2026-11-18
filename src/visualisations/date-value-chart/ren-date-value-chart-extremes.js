/**
 * Marks the highest and lowest values of each series set to show them, with a ring at each and a
 * label beside it, in the series' colour.  The label sits to the ring's side, as the series' own
 * value labels sit above their points, and gives the value only where the series' value labels
 * are hidden, so that it doesn't repeat them.  A bar's mark is its label alone, over the end of
 * the bar itself rather than the middle of its period, or of its whole stack where bars are
 * stacked, and beyond the value label there where that is outside the bar.  Marks at one bar's
 * end stand one beyond another.  The marks take no clicks, so the series beneath them still can.
 */
Ren.DateValueChart_Extremes = (() => {

    const GROUP_CLASS = "ren-extremes";
    const MARKER_RADIUS = 5;
    const LABEL_FONT_SIZE = 11;
    const LABEL_GAP = 3;
    const VALUE_CLASS = "ren-extreme-value";
    const BAR_MARK_CLASS = "ren-extreme-bar-mark";

    // A label nearer the plot's right edge than this goes on the ring's left instead.
    const LABEL_ROOM = 70;

    // Set by the bar layout pass on a bar value label outside its bar: how far it reaches beyond
    // the bar's end, in screen pixels.
    const OUTSIDE_REACH_ATTRIBUTE = "data-outside-reach";

    const isNumber = value => typeof value === "number" && isFinite(value);

    /**
     * Gets the indexes of the highest and lowest values, as { highest, lowest }, the first of any
     * that tie.  Either is null where there are no values, and lowest is null where every value
     * is the same, as there is then nothing lower to mark.
     */
    const getExtremeIndexes = (values) => {

        let highest = null;
        let lowest = null;

        for (let i = 0; i < values.length; i++) {

            if (!isNumber(values[i])) continue;

            if (highest === null || values[i] > values[highest]) highest = i;

            if (lowest === null || values[i] < values[lowest]) lowest = i;
        }

        if (highest !== null && values[highest] === values[lowest]) lowest = null;

        return { highest, lowest };
    };

    /**
     * Marks one value: a ring, and a label beside it, level with the highest value, clear of the
     * value label above it, and a little below the lowest.  Both are counter-scaled about the
     * value's point within their wrapper to keep their size.
     */
    const renderMark = (props, group, x, y, mark, valueText, seriesIndex, colour) => {

        const wrapper = Ren.Svg.append(group, "g", {
            "class": "ren-text-wrapper",
            "transform": `translate(${x}, ${y})`
        });

        Ren.Svg.append(wrapper, "circle", {
            "class": "ren-extreme-marker",
            "cx": 0,
            "cy": 0,
            "r": MARKER_RADIUS,
            "fill": "none",
            "stroke": colour,
            "stroke-width": 2
        });

        const isOnLeft = x > props.innerWidth - LABEL_ROOM;
        const offset = MARKER_RADIUS + LABEL_GAP;

        appendLabel(wrapper, mark, valueText, seriesIndex, colour, {
            "x": isOnLeft ? -offset : offset,
            "y": mark.kind === "highest" ? LABEL_FONT_SIZE / 2 - 1 : LABEL_FONT_SIZE - 2,
            "text-anchor": isOnLeft ? "end" : "start"
        });
    };

    /**
     * Marks one bar's value with a label centred beyond the end of the bar, or of its stack, which
     * clearBarValueLabels moves further out past whatever else is there.  The end series is the
     * one whose bar the end is.
     */
    const renderBarMark = (
        group,
        x,
        y,
        isUp,
        mark,
        valueText,
        seriesIndex,
        endSeriesIndex,
        colour
    ) => {

        const wrapper = Ren.Svg.append(group, "g", {
            "class": `ren-text-wrapper ${BAR_MARK_CLASS}`,
            "data-x": x,
            "data-up": isUp,
            "data-end-series": endSeriesIndex + 1,
            "transform": `translate(${x}, ${y})`
        });

        appendLabel(wrapper, mark, valueText, seriesIndex, colour, {
            "x": 0,
            "y": getBarLabelY(isUp, 0),
            "text-anchor": "middle"
        });
    };

    /**
     * Gets a bar mark's label's baseline, from the bar's end, beyond anything already there.
     */
    const getBarLabelY = (isUp, clearancePx) => isUp
        ? -(LABEL_GAP + clearancePx)
        : LABEL_GAP + clearancePx + LABEL_FONT_SIZE - 2;

    /**
     * Appends a mark's label, in the series' colour with a halo, its value in a part of its own.
     */
    const appendLabel = (wrapper, mark, valueText, seriesIndex, colour, placement) => {

        const label = Ren.Svg.append(wrapper, "text", Object.assign({
            "class": "ren-extreme-label",
            "data-extreme": mark.kind,
            "data-extreme-series": seriesIndex + 1,
            "font-family": "sans-serif",
            "font-size": LABEL_FONT_SIZE,
            "fill": colour,
            "stroke": "#FFFFFF",
            "stroke-width": 3,
            "stroke-linejoin": "round",
            "paint-order": "stroke"
        }, placement));

        Ren.Svg.append(label, "tspan").textContent = mark.text;
        Ren.Svg.append(label, "tspan", { "class": VALUE_CLASS }).textContent = " " + valueText;
    };

    /**
     * Moves each bar mark beyond the value label at its bar's end, where the bar layout pass put
     * that outside the bar and its series shows its value labels, and beyond the marks before it
     * at the same end.  The pass gives each outside label's reach beyond the bar's end, so
     * nothing is measured here.
     */
    const clearBarValueLabels = (props) => {

        if (!props?.chartGroup) return;

        const marks = props.chartGroup.querySelectorAll(`.${BAR_MARK_CLASS}`);

        // How many marks stand at each bar end so far, keyed by its x and direction.
        const marksAtEnds = new Map();

        for (let i = 0; i < marks.length; i++) {

            const label = marks[i].querySelector(".ren-extreme-label");
            const seriesNumber = marks[i].getAttribute("data-end-series");
            const series = props.series[seriesNumber - 1];
            const x = parseFloat(marks[i].getAttribute("data-x"));
            const isUp = marks[i].getAttribute("data-up") === "true";
            const endKey = `${Math.round(x * 2)} ${isUp}`;
            const marksBefore = marksAtEnds.get(endKey) || 0;
            let clearancePx = 0;

            marksAtEnds.set(endKey, marksBefore + 1);

            if (series && (series.showValueLabels ?? true)) {

                const valueLabels = props.chartGroup.querySelectorAll(
                    `.ren-value-labels-layer .ren-series-${seriesNumber} `
                    + ".ren-bar-value-labels > .ren-text-wrapper"
                );

                for (let j = 0; j < valueLabels.length; j++) {

                    const reach = valueLabels[j].getAttribute(OUTSIDE_REACH_ATTRIBUTE);

                    if (reach !== null
                        && Math.abs(parseFloat(valueLabels[j].getAttribute("data-x")) - x) < 0.5) {

                        clearancePx = parseFloat(reach);
                        break;
                    }
                }
            }

            label.setAttribute(
                "y",
                getBarLabelY(isUp, clearancePx + marksBefore * (LABEL_FONT_SIZE + LABEL_GAP))
            );
        }
    };

    /**
     * Gets the style rule showing or hiding the value in a series' labels, hidden while the
     * series' own value labels give it.  The series number starts at 1.
     */
    const buildValueStyle = (seriesNumber, isValueLabelShown) =>
        `.ren-extreme-label[data-extreme-series="${seriesNumber}"] .${VALUE_CLASS} `
        + `{ display: ${isValueLabelShown ? "none" : "inline"}; }`;

    /**
     * Marks the highest and lowest values of the chart's shown series that are set to show them,
     * which are marked afresh with the rest of the chart on every redraw.
     */
    const render = (props, rows) => {

        if (!rows || rows.length === 0 || !props.xScale) return;

        let group = null;

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!series || series.isEnabled === false || series.markExtremes !== true) continue;
            if (Ren.DateValueChart_Pies.isPieSeries(props, i)) continue;

            const axis = props.axes[series.valueAxis || "leftAxis"];

            if (!axis?.yScale) continue;

            const heading = props.valueHeadings[i];
            const values = rows.map(row => row[heading]);
            const indexes = getExtremeIndexes(values);

            if (indexes.highest === null) continue;

            if (!group) {

                group = Ren.Svg.append(props.chartGroup, "g", {
                    "class": GROUP_CLASS,
                    "pointer-events": "none"
                });
            }

            const formatValue = Ren.DateValueChart_Axes.makeAxisTickFormatter(axis);
            const marks = [
                { index: indexes.highest, kind: "highest", text: "High" },
                { index: indexes.lowest, kind: "lowest", text: "Low" }
            ];

            for (let j = 0; j < marks.length; j++) {

                const mark = marks[j];

                if (mark.index === null) continue;

                const row = rows[mark.index];
                const valueText = formatValue(values[mark.index]);
                const bar = props.barPlacements?.[i];

                if (bar) {

                    const isUp = values[mark.index] >= 0;
                    const end = bar.getEnd(row, mark.index, isUp);

                    renderBarMark(
                        group,
                        props.xScale.getPixel(bar.crossValueFn(row)),
                        axis.yScale.getPixel(end.value),
                        isUp,
                        mark,
                        valueText,
                        i,
                        end.seriesIndex ?? i,
                        series.colour
                    );

                    continue;
                }

                const date = Ren.DateValueChartCalculator.periodCentre(
                    props,
                    row[props.dateHeading]
                );

                renderMark(
                    props,
                    group,
                    props.xScale.getPixel(date),
                    axis.yScale.getPixel(values[mark.index]),
                    mark,
                    valueText,
                    i,
                    series.colour
                );
            }
        }
    };

    return {
        OUTSIDE_REACH_ATTRIBUTE,
        buildValueStyle,
        clearBarValueLabels,
        getExtremeIndexes,
        render
    };
})();
