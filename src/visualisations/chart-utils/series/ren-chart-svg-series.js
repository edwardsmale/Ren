/**
 * Draws a data series' marks into an SVG group: a bar as a g.bar.vertical holding a path, a line as
 * a single path.line, straight, curved or stepped, and a point as a g.point holding a circle.
 * Each mark's group is bound to the datum it plots, and the chart's styling, selection and resize
 * code find the marks by this markup.
 *
 * A series is described by { crossValue, mainValue, xScale, yScale }, the scales being optional
 * for values that are already positions.  A datum either value of which is null is not plotted.
 */
Ren.ChartSvgSeries = (() => {

    const DEFAULT_POINT_SIZE = 64;

    const getPixel = (scale, value) => scale ? scale.getPixel(value) : value;

    const isDefined = (series, d, index) =>
        series.crossValue(d, index) != null && series.mainValue(d, index) != null;

    const getDefinedData = (series, data) => {

        const definedData = [];

        for (let index = 0; index < data.length; index++) {

            if (isDefined(series, data[index], index)) {
                definedData.push(data[index]);
            }
        }

        return definedData;
    };

    const getX = (series, d, index) => getPixel(series.xScale, series.crossValue(d, index));

    const getY = (series, d, index) => getPixel(series.yScale, series.mainValue(d, index));

    const getBaseY = (series, d, index) =>
        getPixel(series.yScale, series.baseValue(d, index));

    const translateTo = (series, d, index) =>
        `translate(${getX(series, d, index)}, ${getY(series, d, index)})`;

    /**
     * Gets the runs of consecutive plotted data, each as the data's indexes.
     */
    const getDefinedRuns = (series, data) => {

        const runs = [];
        let run = null;

        for (let index = 0; index < data.length; index++) {

            if (!isDefined(series, data[index], index)) {

                run = null;
                continue;
            }

            if (run === null) {

                run = [];
                runs.push(run);
            }

            run.push(index);
        }

        return runs;
    };

    /**
     * Gets the vertices of a stepped trace through a run of data: flat across each datum's step,
     * which series.stepEdges(d, index) gives as [startX, endX], and straight up or down to the
     * next datum's height at the start of its step.  A gap between steps is bridged at the height
     * of the step before it.
     */
    const getStepVertices = (series, data, run, getStepY) => {

        const vertices = [];
        let previousEndX = null;
        let previousY = null;

        for (let i = 0; i < run.length; i++) {

            const index = run[i];
            const edges = series.stepEdges(data[index], index);
            const y = getStepY(series, data[index], index);

            if (previousY !== null && edges[0] !== previousEndX) {
                vertices.push(`${edges[0]},${previousY}`);
            }

            vertices.push(`${edges[0]},${y}`);
            vertices.push(`${edges[1]},${y}`);

            previousEndX = edges[1];
            previousY = y;
        }

        return vertices;
    };

    const getSteppedLinePath = (series, data) => {

        const runs = getDefinedRuns(series, data);
        let path = "";

        for (let i = 0; i < runs.length; i++) {
            path += "M" + getStepVertices(series, data, runs[i], getY).join("L");
        }

        return path || null;
    };

    // Along the line's steps, then back along its base's, which step beneath them.
    const getSteppedAreaPath = (series, data) => {

        const runs = getDefinedRuns(series, data);
        let path = "";

        for (let i = 0; i < runs.length; i++) {

            const topVertices = getStepVertices(series, data, runs[i], getY);
            const baseVertices = getStepVertices(series, data, runs[i], getBaseY);

            path += "M" + topVertices.join("L") + "L" + baseVertices.reverse().join("L") + "Z";
        }

        return path || null;
    };

    /**
     * Draws a bar per datum, centred on its cross value and standing on the value scale's zero.
     *
     * @param {object} series - The series, whose bandwidth(d, index) gives each bar's width.
     * @returns {Array} The bars' groups.
     */
    const renderBars = (seriesGroup, data, series) => {

        const baseY = getPixel(series.yScale, 0);
        const definedData = getDefinedData(series, data);
        const bars = new Array(definedData.length);

        for (let index = 0; index < definedData.length; index++) {

            const d = definedData[index];
            const width = series.bandwidth(d, index);
            const height = baseY - getY(series, d, index);

            bars[index] = Ren.Svg.append(seriesGroup, "g", {
                "class": "ren-bar ren-vertical",
                "transform": translateTo(series, d, index),
                "fill": "#999"
            });

            // The path is coloured by its own datum, so it is given the bar's.
            Ren.Svg.setDatum(bars[index], d);
            Ren.Svg.setDatum(Ren.Svg.append(bars[index], "path", {
                "d": `M${-width / 2},0h${width}v${height}h${-width}Z`
            }), d);
        }

        return bars;
    };

    /**
     * Gets the runs of plotted data as points, each [x, y], or [x, y, baseY] with isArea.
     */
    const getRunPoints = (series, data, isArea) => {

        const runs = getDefinedRuns(series, data);

        for (let i = 0; i < runs.length; i++) {

            const run = runs[i];

            for (let j = 0; j < run.length; j++) {

                const index = run[j];
                const d = data[index];

                run[j] = isArea
                    ? [getX(series, d, index), getY(series, d, index), getBaseY(series, d, index)]
                    : [getX(series, d, index), getY(series, d, index)];
            }
        }

        return runs;
    };

    const getLinePath = (series, data) => {

        if (series.stepEdges) return getSteppedLinePath(series, data);

        return Ren.ChartPaths.getLinePath(getRunPoints(series, data, false), series.curve);
    };

    const getAreaPath = (series, data) => {

        if (series.stepEdges) return getSteppedAreaPath(series, data);

        return Ren.ChartPaths.getAreaPath(getRunPoints(series, data, true), series.curve);
    };

    /**
     * Draws the series as one line, broken wherever a datum is not plotted.
     *
     * @param {object} series - The series, whose optional curve is Ren.ChartPaths.LINEAR (the
     *     default) or BASIS, and whose optional stepEdges(d, index) gives the [startX, endX] a
     *     stepped line is flat across at each datum, in place of a curve.
     * @returns {Element} The line's path.
     */
    const renderLine = (seriesGroup, data, series) => Ren.Svg.setDatum(
        Ren.Svg.append(seriesGroup, "path", {
            "class": "ren-line",
            "fill": "none",
            "stroke": "#000",
            "d": getLinePath(series, data)
        }),
        data
    );

    /**
     * Draws the area between the series' line and its base, broken wherever a datum is not
     * plotted.
     *
     * @param {object} series - The series, whose baseValue(d, index) gives the value the area
     *     reaches down to beneath each datum, and whose optional curve or stepEdges shape it as
     *     for the line.
     * @returns {Element} The area's path.
     */
    const renderArea = (seriesGroup, data, series) => Ren.Svg.setDatum(
        Ren.Svg.append(seriesGroup, "path", {
            "class": "ren-area",
            "stroke": "none",
            "d": getAreaPath(series, data)
        }),
        data
    );

    /**
     * Draws a circle per datum.
     *
     * @param {object} series - The series, whose optional size is each circle's area in square
     *     pixels.
     * @returns {Array} The points' groups.
     */
    const renderPoints = (seriesGroup, data, series) => {

        const radius = Math.sqrt((series.size ?? DEFAULT_POINT_SIZE) / Math.PI);
        const definedData = getDefinedData(series, data);
        const points = new Array(definedData.length);

        for (let index = 0; index < definedData.length; index++) {

            points[index] = Ren.Svg.append(seriesGroup, "g", {
                "class": "ren-point",
                "transform": translateTo(series, definedData[index], index),
                "fill": "#ddd",
                "stroke": "#000"
            });

            Ren.Svg.setDatum(points[index], definedData[index]);
            Ren.Svg.append(points[index], "circle", { "r": radius });
        }

        return points;
    };

    return {
        renderBars,
        renderLine,
        renderArea,
        renderPoints
    };
})();
