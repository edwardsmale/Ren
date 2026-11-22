/**
 * Draws a dashed trend line over each series set to show one: a straight line fitted to its values
 * by least squares, the average of its last few periods, or a level line at its average over the
 * whole chart, labelled with it.  A trend line is drawn against the series' own values and axis
 * in a shade of its colour, over a white casing that parts it from its series' line or bars, and
 * takes no clicks, so the series beneath it still can.
 */
Ren.DateValueChart_TrendLines = (() => {

    const LINEAR = "linear";
    const MOVING_AVERAGE = "movingAverage";
    const AVERAGE = "average";
    const LABEL_FONT_SIZE = 11;
    const LABEL_GAP = 3;
    const DEFAULT_PERIODS = 3;

    // A dark series' trend line is lightened rather than darkened, so that it still stands apart.
    const DARK_LIGHTNESS = 0.25;
    const SHADE_FRACTION = 0.45;

    const isNumber = value => typeof value === "number" && isFinite(value);

    /**
     * Gets the straight line best fitting the points by least squares, as { slope, intercept }, or
     * null where fewer than two points, or all of them at the one x, leave no line to fit.
     *
     * @param {object[]} points - The points, as { x, y }.
     */
    const getLinearFit = (points) => {

        const count = points.length;

        if (count < 2) return null;

        let sumX = 0;
        let sumY = 0;

        for (let i = 0; i < count; i++) {

            sumX += points[i].x;
            sumY += points[i].y;
        }

        const meanX = sumX / count;
        const meanY = sumY / count;

        let sumXY = 0;
        let sumXX = 0;

        // Taken about the means, as dates in milliseconds squared would lose the precision.
        for (let i = 0; i < count; i++) {

            const dx = points[i].x - meanX;

            sumXY += dx * (points[i].y - meanY);
            sumXX += dx * dx;
        }

        if (sumXX === 0) return null;

        const slope = sumXY / sumXX;

        return { slope, intercept: meanY - slope * meanX };
    };

    /**
     * Gets each value's trailing average over the given number of periods, null until that many
     * periods have passed.  A period without a value is left out of its windows' averages.
     */
    const getMovingAverages = (values, periods) => {

        const averages = new Array(values.length);

        for (let i = 0; i < values.length; i++) {

            if (i < periods - 1) {

                averages[i] = null;
                continue;
            }

            let sum = 0;
            let count = 0;

            for (let j = i - periods + 1; j <= i; j++) {

                if (isNumber(values[j])) {

                    sum += values[j];
                    count++;
                }
            }

            averages[i] = count > 0 ? sum / count : null;
        }

        return averages;
    };

    /**
     * Gets the average of the values, leaving out periods without one, or null where none has one.
     */
    const getAverage = (values) => {

        let sum = 0;
        let count = 0;

        for (let i = 0; i < values.length; i++) {

            if (isNumber(values[i])) {

                sum += values[i];
                count++;
            }
        }

        return count > 0 ? sum / count : null;
    };

    /**
     * Gets the points a series' trend line passes through, as { date, value }, for the given
     * trend: its ends for a straight line or the average, and a point per period for a moving
     * average.  The average runs from the series' first value to its last.
     */
    const getTrendPoints = (rows, heading, getDate, trendLine, periods) => {

        if (trendLine === LINEAR) {

            const points = [];

            for (let i = 0; i < rows.length; i++) {

                const value = rows[i][heading];

                if (isNumber(value)) points.push({ x: getDate(rows[i]).getTime(), y: value });
            }

            const fit = getLinearFit(points);

            if (!fit) return [];

            const first = points[0].x;
            const last = points[points.length - 1].x;

            return [
                { date: new Date(first), value: fit.intercept + fit.slope * first },
                { date: new Date(last), value: fit.intercept + fit.slope * last }
            ];
        }

        if (trendLine === AVERAGE) {

            const valued = rows.filter(row => isNumber(row[heading]));
            const average = getAverage(valued.map(row => row[heading]));

            if (average === null) return [];

            return [
                { date: getDate(valued[0]), value: average },
                { date: getDate(valued[valued.length - 1]), value: average }
            ];
        }

        if (trendLine === MOVING_AVERAGE) {

            const values = rows.map(row => row[heading]);
            const averages = getMovingAverages(values, periods || DEFAULT_PERIODS);
            const points = [];

            for (let i = 0; i < rows.length; i++) {

                if (averages[i] !== null) {
                    points.push({ date: getDate(rows[i]), value: averages[i] });
                }
            }

            return points;
        }

        return [];
    };

    /**
     * Labels an average line with its value, just above its right-hand end.  The label is
     * counter-scaled about that end, within its wrapper, to keep its size.
     */
    const renderAverageLabel = (props, group, axis, points, seriesIndex, colour) => {

        const end = points[points.length - 1];
        const x = props.xScale.getPixel(end.date);
        const y = axis.yScale.getPixel(end.value);
        const wrapper = Ren.Svg.append(group, "g", {
            "class": "ren-text-wrapper",
            "transform": `translate(${x}, ${y})`
        });

        const label = Ren.Svg.append(wrapper, "text", {
            "class": "ren-trend-line-label",
            "data-trend-series": seriesIndex + 1,
            "x": -LABEL_GAP,
            "y": -LABEL_GAP,
            "text-anchor": "end",
            "font-family": "sans-serif",
            "font-size": LABEL_FONT_SIZE,
            "fill": colour,
            "stroke": "#FFFFFF",
            "stroke-width": 3,
            "stroke-linejoin": "round",
            "paint-order": "stroke"
        });

        const formatValue = Ren.DateValueChart_Axes.makeAxisTickFormatter(axis);

        label.textContent = "Average " + formatValue(end.value);
    };

    /**
     * Gets the colour a series' trend line is drawn in: a darker shade of the series' colour, or a
     * lighter one for a dark series, or the series' own where it can't be read.
     */
    const getTrendColour = (colour) => {

        const lightness = Ren.Colours.lightnessOfColour(colour);

        if (lightness === null) return colour;

        const towards = lightness < DARK_LIGHTNESS ? "#FFFFFF" : "#000000";

        return Ren.Colours.interpolateLab(colour, towards)(SHADE_FRACTION);
    };

    /**
     * Draws the trend lines of the chart's shown series, which are drawn afresh with the rest of
     * the chart on every redraw.
     */
    const render = (props, rows) => {

        if (!rows || rows.length === 0 || !props.xScale) return;

        const getDate = row => Ren.DateValueChartCalculator.periodCentre(
            props,
            row[props.dateHeading]
        );

        let group = null;

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!series || series.isEnabled === false || !series.trendLine) continue;
            if (Ren.DateValueChart_Pies.isPieSeries(props, i)) continue;

            const axis = props.axes[series.valueAxis || "leftAxis"];

            if (!axis?.yScale) continue;

            const points = getTrendPoints(
                rows,
                props.valueHeadings[i],
                getDate,
                series.trendLine,
                series.trendLinePeriods
            );

            if (points.length < 2) continue;

            const path = points.map((point, index) =>
                (index === 0 ? "M" : "L")
                + props.xScale.getPixel(point.date) + ","
                + axis.yScale.getPixel(point.value)).join("");

            if (!group) {

                group = Ren.Svg.append(props.chartGroup, "g", {
                    "class": "ren-trend-lines",
                    "pointer-events": "none"
                });
            }

            const colour = getTrendColour(series.colour);

            Ren.Svg.append(group, "path", {
                "class": "ren-trend-line-casing",
                "d": path,
                "fill": "none",
                "stroke": "#FFFFFF",
                "stroke-width": 5,
                "stroke-opacity": 0.85,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "vector-effect": "non-scaling-stroke"
            });

            Ren.Svg.append(group, "path", {
                "class": "ren-trend-line",
                "data-trend-series": i + 1,
                "data-trend": series.trendLine,
                "d": path,
                "fill": "none",
                "stroke": colour,
                "stroke-width": 2,
                "stroke-dasharray": "6,4",
                "vector-effect": "non-scaling-stroke"
            });

            if (series.trendLine === AVERAGE) {
                renderAverageLabel(props, group, axis, points, i, colour);
            }
        }
    };

    return {
        LINEAR,
        MOVING_AVERAGE,
        AVERAGE,
        DEFAULT_PERIODS,
        getAverage,
        getLinearFit,
        getMovingAverages,
        getTrendColour,
        getTrendPoints,
        render
    };
})();
