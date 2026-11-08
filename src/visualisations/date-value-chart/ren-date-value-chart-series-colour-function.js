/**
 * Colours a date/value chart series' bars, line and dots point by point with its colour function,
 * series[i].colourFunction, written in the series' Colour menu.  The function is a format function
 * handed a value and its row as rowVals, and returns a CSS colour, or nothing for the series' own.
 *
 * Where the chart's grouping aggregated a point from many rows, the function is run on each of
 * those rows and the colours mixed equally, a row left uncoloured counting in the series' colour.
 *
 * Each mark carries its colour in a custom property, which the stylesheet's series colour rules
 * read ahead of the series' colour, so selecting, previewing and estimating still restyle it.  A
 * line is one path, so is stroked with a gradient changing colour halfway between its points.
 *
 * The series' colour comes into a mark's colour as var(--series-colour), set by the stylesheet,
 * so changing or previewing the series' colour recolours the marks without running the function.
 */
Ren.DateValueChart_SeriesColourFunction = (() => {

    const MARK_COLOUR_PROPERTY = "--mark-colour";

    const SERIES_COLOUR_PROPERTY = "--series-colour";

    const SERIES_COLOUR_VALUE = `var(${SERIES_COLOUR_PROPERTY})`;

    const NEW_FUNCTION_TEMPLATE = "return value < 0 ? \"Red\" : null;";

    // Each group's merged colours, by function and value, held against the group's rows.
    const mergedColoursByRows = new WeakMap();

    /**
     * Gets the value a stylesheet rule colours a mark with: the mark's own colour where it has
     * one, otherwise the series colour passed.
     */
    const getMarkColourValue = (seriesColourValue) =>
        `var(${MARK_COLOUR_PROPERTY}, ${seriesColourValue})`;

    /**
     * Gets the colour the function gives a value and its row, or null where it gives none, throws
     * or returns something that isn't a colour.  An error is logged once per series drawn.
     */
    const callColourFunction = (context, value, rowVals) => {

        let colour;

        try {

            colour = context.colourFunction(value, rowVals, null, null, null);
        }
        catch (error) {

            if (!context.hasLoggedError) {

                context.hasLoggedError = true;
                Ren.GlobalErrorHandler.logError(
                    "[DateValueChart_SeriesColourFunction] Error executing colour function:",
                    error
                );
            }

            return null;
        }

        if (typeof colour !== "string") return null;

        colour = colour.trim();

        return colour !== "" && Ren.ColourMixer.isColour(colour) ? colour : null;
    };

    /**
     * Gets the colour of the rows aggregated into a point, mixed equally from the colours the
     * function gives them, with the series' colour making up the share of the rows it gives none.
     * Null where the function colours none of them.
     */
    const mergeRowColours = (context, rows, valueHeading) => {

        const mix = Ren.ColourMixer.createMix();

        for (let index = 0; index < rows.length; index++) {

            const row = rows[index];
            const colour = callColourFunction(context, row[valueHeading], row);

            if (colour) Ren.ColourMixer.addColour(mix, colour);
        }

        const colour = Ren.ColourMixer.getMixedColour(mix);

        if (!colour || mix.count === rows.length) return colour;

        const percentage = Math.round(mix.count / rows.length * 10000) / 100;

        return `color-mix(in srgb, ${colour} ${percentage}%, ${SERIES_COLOUR_VALUE})`;
    };

    /**
     * Gets a merged colour, held against the rows it was merged from for the next draw.
     */
    const getMergedColour = (context, rows, valueHeading) => {

        let coloursByKey = mergedColoursByRows.get(rows);

        if (!coloursByKey) {

            coloursByKey = new Map();
            mergedColoursByRows.set(rows, coloursByKey);
        }

        const key = context.specificationKey + "\n" + valueHeading;
        let colour = coloursByKey.get(key);

        if (colour === undefined) {

            colour = mergeRowColours(context, rows, valueHeading);
            coloursByKey.set(key, colour);
        }

        return colour;
    };

    /**
     * Gets the colour of a plotted row, merged from the rows aggregated into it where the chart's
     * grouping made it, otherwise the function's colour for the row it was plotted from.
     */
    const getPointColour = (context, row) => {

        if (!row) return null;

        const unpreparedRow = Ren.CreateDateValueChart_PrepareData.getUnpreparedRow(row);

        const aggregated = unpreparedRow
            ? Ren.DateValueChart_GroupingApplyer.getAggregatedRows(unpreparedRow, context.heading)
            : null;

        if (aggregated) return getMergedColour(context, aggregated.rows, aggregated.valueHeading);

        return callColourFunction(context, row[context.heading], unpreparedRow || row);
    };

    /**
     * Colours each of the marks a selector finds by the row bound to it.
     */
    const colourMarks = (seriesGroup, selector, context) => {

        const marks = seriesGroup.querySelectorAll(selector);

        for (let index = 0; index < marks.length; index++) {

            const colour = getPointColour(context, Ren.Svg.getDatum(marks[index]));

            if (colour) {
                marks[index].style.setProperty(MARK_COLOUR_PROPERTY, colour);
            }
            else {

                marks[index].style.removeProperty(MARK_COLOUR_PROPERTY);
            }
        }
    };

    /**
     * Gets the ID of the gradient a series' line is stroked with.  The gradient sits in the
     * chart's defs, outside the series' group, so the stylesheet sets its series colour by this.
     *
     * @param {number} seriesIndex - The 0-based index of the series.
     */
    const getLineGradientId = (props, seriesIndex) =>
        `line-colours-${props.guid}-series-${seriesIndex + 1}`;

    /**
     * Gets the gradient's stops: each point's colour runs to halfway to the next point's.
     */
    const getLineGradientStops = (xs, colours) => {

        const firstX = xs[0];
        const span = xs[xs.length - 1] - firstX;
        const stops = [{ offset: 0, colour: colours[0] }];

        for (let index = 1; index < xs.length; index++) {

            if (colours[index] === colours[index - 1]) continue;

            const offset = ((xs[index - 1] + xs[index]) / 2 - firstX) / span;

            stops.push({ offset, colour: colours[index - 1] });
            stops.push({ offset, colour: colours[index] });
        }

        stops.push({ offset: 1, colour: colours[colours.length - 1] });

        return stops;
    };

    /**
     * Strokes a series' line with a gradient of its points' colours, laid along the date axis in
     * the line's own coordinates, and colours its nodes.
     */
    const colourLine = (props, seriesIndex, seriesGroup, context, crossValueFn) => {

        colourMarks(seriesGroup, ".ren-data-series__line-node", context);

        const path = seriesGroup.querySelector(".ren-data-series__line-path");

        if (!path) return;

        const rows = Ren.Svg.getDatum(path) || [];
        const xs = [];
        const colours = [];
        let isAnyColoured = false;

        for (let index = 0; index < rows.length; index++) {

            const row = rows[index];
            const crossValue = crossValueFn(row);

            if (crossValue == null || row[context.heading] == null) continue;

            const colour = getPointColour(context, row);

            if (colour) isAnyColoured = true;

            xs.push(props.xScale.getPixel(crossValue));
            colours.push(colour || SERIES_COLOUR_VALUE);
        }

        // A shaded line's fill is coloured with the line, along the dates alone.
        const markNodes = [path];
        const areaNode = seriesGroup.querySelector(".ren-data-series__line-area");

        if (areaNode) markNodes.push(areaNode);

        const setMarkColour = (colour) => {

            for (let index = 0; index < markNodes.length; index++) {
                markNodes[index].style.setProperty(MARK_COLOUR_PROPERTY, colour);
            }
        };

        if (!isAnyColoured) {

            for (let index = 0; index < markNodes.length; index++) {
                markNodes[index].style.removeProperty(MARK_COLOUR_PROPERTY);
            }

            return;
        }

        if (xs.length < 2 || xs[xs.length - 1] <= xs[0]) {

            setMarkColour(colours[0]);
            return;
        }

        const gradientId = getLineGradientId(props, seriesIndex);
        const gradient = props.defs.querySelector("#" + gradientId)
            || Ren.Svg.append(props.defs, "linearGradient", { "id": gradientId });

        Ren.Svg.setAttrs(gradient, {
            "gradientUnits": "userSpaceOnUse",
            "x1": xs[0],
            "x2": xs[xs.length - 1],
            "y1": 0,
            "y2": 0
        });

        gradient.replaceChildren();

        const stops = getLineGradientStops(xs, colours);

        // Styled rather than given as attributes, which can't take var().
        for (let index = 0; index < stops.length; index++) {

            Ren.Svg.append(gradient, "stop", { "offset": stops[index].offset })
                .style.setProperty("stop-color", stops[index].colour);
        }

        setMarkColour(`url(#${gradientId})`);
    };

    /**
     * Colours the marks a series has just drawn into its group with its colour function, where it
     * has one.  An estimate keeps its pastel shade.
     *
     * @param {number} seriesIndex - The 0-based index of the series.
     * @param {Function} crossValueFn - Gets the date a row is plotted at.
     */
    const applyToSeries = (props, seriesIndex, seriesGroup, crossValueFn) => {

        const specification = props.series[seriesIndex]?.colourFunction;

        if (!specification) return;

        const colourFunction = Ren.FormatFunctions.createFunction(
            specification,
            Ren.ReportInputParameters.getInputParameters(props.visualisation?.containingReport)
        );

        if (!colourFunction) return;

        const context = {
            colourFunction,
            specificationKey: typeof specification === "string"
                ? specification
                : JSON.stringify(specification),
            heading: props.valueHeadings[seriesIndex],
            hasLoggedError: false
        };

        colourMarks(seriesGroup, ".ren-bar.ren-vertical:not(.ren-estimate-mark) .ren-data-series__bar", context);
        colourMarks(seriesGroup, ".ren-data-series__point:not(.ren-estimate-mark)", context);
        colourLine(props, seriesIndex, seriesGroup, context, crossValueFn);
    };

    /**
     * Gets a value indicating whether a series has a colour function.
     */
    const hasColourFunction = (props, seriesIndex) =>
        !!props.series?.[seriesIndex]?.colourFunction;

    return {
        MARK_COLOUR_PROPERTY,
        SERIES_COLOUR_PROPERTY,
        NEW_FUNCTION_TEMPLATE,
        getMarkColourValue,
        getLineGradientId,
        hasColourFunction,
        applyToSeries
    };
})();
