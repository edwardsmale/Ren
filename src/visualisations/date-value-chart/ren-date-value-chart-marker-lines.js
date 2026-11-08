/**
 * Vertical marker lines on a date/value chart: dotted gray labelled lines drawn at
 * particular dates, for annotating events that are points in time rather than series values - a
 * product being published or discontinued, a price list going live, today's date.
 *
 * They are declared on the visualisation as a markerLines array, each entry being either:
 *
 *     { "column": "Published", "label": "Published" }
 *
 *         A line at every date whose row has a non-empty, non-zero value in that column.  Where
 *         the value is text rather than a number it becomes the label, so a single column can
 *         carry several differently-labelled events.
 *
 *     { "date": "2024-01-15", "label": "Price rise" }   or   { "date": "today" }
 *
 *         A line at a fixed date, or at a time of day with one ("2024-01-15 14:30:00").
 *
 * Optional on any form: colour, lineStyle ("dashed" | "dotted" | "solid"), lineWidth ("thin" |
 * "normal" | "thick"), labelPosition ("top" | "bottom") and outOfRange ("clamp" | "hide").
 *
 * Column markers resolve against the chart's input rows rather than its plotted points, so a line
 * lands on its exact date even where the chart's own grouping bins those points into months.  A
 * marker whose date falls outside the plotted range pins to the edge it lies beyond and spells its
 * date out in its label behind an arrow; outOfRange: "hide" drops it instead.
 *
 * A chart can also be annotated with dates from a data source of its own, resolved in
 * ren-date-value-chart-date-markers.js and drawn alongside these in the same shape, additionally
 * carrying a flag and hover text.  A line is drawn past the top of the plot area into a band
 * reserved above it, with its label at its tip; how far it sticks out depends on the lane the label
 * is put in, settled by the marker labels module once the chart has been laid out.
 *
 * What a label says can be rewritten by a format function the chart declares as
 * markerLabelFormatFunction, handed the label and the row it came from.
 *
 * Note that those input rows are the source grid's group rows where its settings group by date, so
 * a marker column needs an aggregation that carries its value into the group row - SingleValuesOnly
 * for a column holding one repeated date, Max for a flag.  Without one the column is blank in every
 * group row and the marker silently resolves to nothing; Ren.QA.DateValueChart.getMarkerLines()
 * tells that case apart.
 */
Ren.DateValueChart_MarkerLines = (() => {

    // A flag column could in principle mark every row.  A chart carrying thousands of lines is
    // illegible, so a spec resolving to more markers than this is dropped rather than drawn.
    const MAX_MARKERS_PER_SPEC = 50;

    // A marker annotates the data rather than being part of it, so it is drawn as a fine line in a
    // colour of its own that no series is drawn in.
    const DEFAULT_COLOUR = "#5b1111";

    const DEFAULT_LINE_WIDTH = "thin";

    // The colour a flag is drawn in, whatever colour its line is drawn in, unless the marker names
    // a flagColour of its own (calendar markers are green).  Its label is white.
    const FLAG_COLOUR = "#1e50a3";

    // The white line drawn alongside every marker line, and how far to its right it stands, in
    // visual pixels.  A marker drawn over a bar of its own colour is lost; drawn as a pair,
    // whichever half disappears leaves the other showing.
    const CONTRAST_COLOUR = "#ffffff";

    const CONTRAST_OFFSET_PX = 2;

    // How wide, in visual pixels, the transparent line a marker is hovered by is.
    const HIT_LINE_WIDTH_PX = 9;

    const dashArrays = { dashed: "8 5", dotted: "2 4", solid: null };

    // Every marker line is drawn as a muted dotted gray line, whatever colour or style the marker
    // declares, so that the lines stay in the background of the chart.  A marker's own colour
    // still shows on its flag.
    const LINE_COLOUR = "#808080";

    const LINE_STYLE = "dotted";

    const LINE_OPACITY = 0.7;

    const lineWidths = { thin: 1, normal: 2, thick: 4 };

    /**
     * The value as a number where it is wholly numeric, and null where it is text.  Stricter than
     * Ren.TextUtils.parseFloat, which digs a number out of any text: here a value that is not
     * simply a number is an event name.
     */
    const asNumber = (value) => {

        if (typeof value === "number") return value;

        const text = String(value).trim();

        return text !== "" && !isNaN(Number(text)) ? Number(text) : null;
    };

    /**
     * True where a cell's value marks a date: anything present and not zero.  A numeric flag (1)
     * and a text event name both count; a zero, a blank or a null does not.
     */
    const isMarkerValue = (value) => {

        if (Ren.IsNullOrEmpty(value)) return false;

        const number = asNumber(value);

        return number === null || number !== 0;
    };

    /**
     * The label for a column marker: the spec's own label wins, then the cell's value where that is
     * text (letting one column carry differently-named events), and finally the column's name.
     */
    const getColumnMarkerLabel = (spec, value) => {

        if (spec.label) return spec.label;

        return asNumber(value) === null ? String(value).trim() : spec.column;
    };

    const parseMarkerDate = (value) => {

        if (value === "today") return Ren.DateUtils.today();

        return Ren.DateUtils.parseDateTimeUniversal(value);
    };

    const createMarker = (spec, date, label, row) => ({
        date,
        label,
        // The row the marker was resolved from, which a flag text function reads its other columns
        // from.  A marker declared at a fixed date has no row, and one is not invented for it.
        row: row ?? null,
        colour: spec.colour || DEFAULT_COLOUR,
        lineStyle: spec.lineStyle || "dashed",
        lineWidth: spec.lineWidth || DEFAULT_LINE_WIDTH,
        labelPosition: spec.labelPosition || "top",
        outOfRange: spec.outOfRange || "clamp"
    });

    const MILLISECONDS_PER_MINUTE = 60 * 1000;

    const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

    // Marker dates are parsed as UTC wall-clock times, as the chart's axis is, so they are written
    // out in UTC.
    const formatSortableDay = Ren.ChartDateTime.createUtcFormat("yyyy-MM-dd");
    const formatMinutes = Ren.ChartDateTime.createUtcFormat("HH:mm");
    const formatSeconds = Ren.ChartDateTime.createUtcFormat("HH:mm:ss");

    /**
     * Gets a marker date's time of day as written after its day, or "" at midnight, so that a
     * marker holding only a date is written as one.
     */
    const formatTimeOfDay = (date) => {

        const time = date.getTime();

        if (time % MILLISECONDS_PER_DAY === 0) return "";

        const isWholeMinute = time % MILLISECONDS_PER_MINUTE === 0;

        return " " + (isWholeMinute ? formatMinutes(date) : formatSeconds(date));
    };

    /** A marker's date as yyyy-MM-dd, followed by its time of day where it has one. */
    const toSortableMarkerDate = (date) => formatSortableDay(date) + formatTimeOfDay(date);

    /** A marker's date in the configured format, then its time of day where it has one. */
    const formatMarkerDate = (date) =>
        Ren.ValueFormatter.formatDate(formatSortableDay(date)) + formatTimeOfDay(date);

    /**
     * The text a marker's label carries.  A marker clamped to an edge no longer has its date shown
     * by its position, so the label states it, behind an arrow pointing off the chart.
     */
    const getLabelText = (marker, isBeforeRange, isAfterRange) => {

        if (isBeforeRange) return `◀ ${marker.label} ${formatMarkerDate(marker.date)}`;

        if (isAfterRange) return `${marker.label} ${formatMarkerDate(marker.date)} ▶`;

        return marker.label;
    };

    /**
     * The text a format function's result contributes to a label.  A format function returns HTML,
     * but a label is drawn as SVG text, so the tags are dropped and what they say is kept.
     */
    const asPlainText = (result) => {

        const text = String(result ?? "").trim();

        if (text.indexOf("<") === -1) return text;

        return Ren.TextUtils.extractTextFromHtml(text) || text;
    };

    /**
     * Puts every marker's label through the chart's flag text function, where it declares one:
     * visualisation.markerLabelFormatFunction, written in the chart's "Flag text..." editor.
     *
     * The function is a format function like any other, handed the label as its value and the
     * marker's row as its rowVals.  A blank result keeps the label the marker resolved to rather
     * than drawing an empty flag.
     *
     * Applied to the markers themselves, before any of them is drawn, so that the flag, the key a
     * numbered chart is read by and the QA diagnostics all say the same thing.  The hover text is
     * built from the source row and is not touched.
     */
    const formatMarkerLabels = (markers, props) => {

        const specification = props.visualisation?.markerLabelFormatFunction;

        if (!specification) return;

        const format = Ren.FormatFunctions.createFunction(
            specification,
            Ren.ReportInputParameters.getInputParameters(props.visualisation.containingReport)
        );

        if (!format) return;

        for (let i = 0; i < markers.length; i++) {

            const marker = markers[i];

            let formatted;

            try {

                formatted = format(marker.label, marker.row, null, null, null);
            }
            catch (error) {

                continue;
            }

            const text = asPlainText(formatted);

            if (text) marker.label = text;
        }
    };

    /**
     * Resolves a dateColumn spec: one marker per distinct date and time held in the named column.
     * The same one typically repeats on every row, so duplicates are collapsed.
     */
    const resolveDateColumn = (spec, rows) => {

        if (!rows) return [];

        const markers = [];
        const seen = {};

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][spec.dateColumn];

            if (Ren.IsNullOrEmpty(value)) continue;

            const date = Ren.DateUtils.parseDateTimeUniversal(value);

            if (!date) continue;

            const key = date.getTime();

            if (seen[key]) continue;

            seen[key] = true;
            markers.push(createMarker(spec, date, spec.label || spec.dateColumn, rows[i]));

            if (markers.length > MAX_MARKERS_PER_SPEC) {

                return [];
            }
        }

        return markers;
    };

    /**
     * Resolves one marker spec against the chart's raw rows into zero or more markers.  Rows are
     * scanned in order, so markers come out in date order for data that is itself date-ordered.
     */
    const resolveSpec = (spec, rows, dateHeading) => {

        if (!spec) return [];

        if (spec.date) {

            const date = parseMarkerDate(spec.date);

            return date
                ? [createMarker(spec, date, spec.label || formatMarkerDate(date))]
                : [];
        }

        if (spec.dateColumn) {

            // The column's values are themselves the dates, so a marker can sit at a date that has
            // no row of its own - a publication date, say, on a chart of daily prices.
            return resolveDateColumn(spec, rows);
        }

        if (!spec.column || !rows) return [];

        const markers = [];

        for (let i = 0; i < rows.length; i++) {

            const row = rows[i];
            const value = row[spec.column];

            if (!isMarkerValue(value)) continue;

            const date = Ren.DateUtils.parseDateTimeUniversal(row[dateHeading]);

            if (!date) continue;

            markers.push(createMarker(spec, date, getColumnMarkerLabel(spec, value), row));

            if (markers.length > MAX_MARKERS_PER_SPEC) {

                return [];
            }
        }

        return markers;
    };

    /**
     * The marker specs as an array.  Report settings hold them as one, but an element attribute
     * (marker-lines="...") can only carry a string, so JSON in that form is parsed here.
     */
    const parseSpecs = (markerLines) => {

        if (!markerLines) return null;

        if (typeof markerLines !== "string") return markerLines;

        try {

            return JSON.parse(markerLines);
        }
        catch (error) {

            return null;
        }
    };

    /**
     * Resolves every marker spec on the visualisation into markers, against the raw input data
     * held on props.  Returns an empty array where the chart declares no marker lines.
     */
    const getMarkers = (props) => {

        // All time draws no dates for a marker to stand at.
        if (props.isAllTime) return [];

        const specs = parseSpecs(props.markerLines);

        if (!specs || !specs.length) return [];

        const markers = [];

        for (let i = 0; i < specs.length; i++) {

            const specMarkers = resolveSpec(specs[i], props.rawInputData, props.dateHeading);

            for (let j = 0; j < specMarkers.length; j++) {

                // A marker at a date of its own can be removed by right-clicking it.
                if (specs[i].date) specMarkers[j].specIndex = i;

                markers.push(specMarkers[j]);
            }
        }

        return markers;
    };

    /**
     * Draws a marker's label, in a text wrapper so that the chart's counter-scaling keeps it at a
     * constant size.  Labels sit to the right of their line, flipping to the left near the right
     * hand edge so they are not clipped.  A label drawn at the top is put in the lowest lane of the
     * band above the plot area; the lane it belongs in is settled once every label can be measured.
     */
    const renderLabel = (group, marker, labelText, x, innerWidth, innerHeight) => {

        const isNearRightEdge = x > innerWidth * 0.9 || x >= innerWidth;
        const isAtTop = marker.labelPosition !== "bottom";
        const labelOffsetPx = 4;

        // A label at the top is drawn in the band above the plot area, in the lowest of its lanes;
        // which lane it ends up in is settled once the labels can be measured.
        const topOffsetPx = Ren.DateValueChart_MarkerLabels.getLaneBaselinePx(0);
        const bottomOffsetPx = -6;

        const wrapper = Ren.Svg.append(group, "g", {
            "class": "ren-text-wrapper",
            "transform": `translate(${x}, ${isAtTop ? 0 : innerHeight})`
        });

        // A label at the top is drawn on a flag: a filled tab against the line, sized with the
        // labels.  One at the bottom is not laid out with them, so is drawn without one.
        if (isAtTop) {

            styleFlag(
                Ren.Svg.append(wrapper, "rect", { "class": "ren-marker-line-flag" }),
                marker.flagColour || FLAG_COLOUR
            );
        }

        const text = Ren.Svg.append(wrapper, "text", {
            "class": "ren-marker-line-label",
            "x": isNearRightEdge ? -labelOffsetPx : labelOffsetPx,
            "y": isAtTop ? topOffsetPx : bottomOffsetPx,
            "text-anchor": isNearRightEdge ? "end" : "start",
            "fill": isAtTop ? "#ffffff" : marker.colour,
            "stroke": "none",
            // Set here rather than left to the document's default so that the room the band needs
            // can be worked out before the labels exist.
            "font-size": Ren.DateValueChart_MarkerLabels.LABEL_FONT_SIZE_PX
        });

        text.textContent = labelText ?? "";

        // Shown as the browser's own tooltip when the pointer rests on the marker's label.  A
        // native title needs no positioning, survives the chart's non-uniform scaling, and cannot
        // be clipped by the plot area.
        if (marker.tooltip) {

            Ren.Svg.append(group, "title").textContent = marker.tooltip;
        }
    };

    /**
     * The look of the flag a marker's label sits on: a filled tab against the line.
     *
     * Its size is not set here.  The flag has to match the label it sits behind, and what a label
     * occupies is known only once the chart has been laid out, so it is sized by the pass that
     * settles the labels.
     */
    const styleFlag = (flag, colour) => {

        Ren.Svg.setAttrs(flag, {
            "rx": 2,
            "fill": colour,
            "fill-opacity": 1,
            "stroke": "#ffffff",
            "stroke-width": 1,
            // The flag is drawn in the plot area's coordinates but has to come out the size of the
            // label it sits behind, which is counter-scaled against those.  The style updater
            // counter-scales the flag with it, so the box measured on the text is the one it gets.
            "vector-effect": "non-scaling-stroke"
        });

        flag.style.display = "none";
    };

    /**
     * A marker line that resolves to nothing is invisible by definition, which makes a mis-declared
     * one hard to tell apart from one whose date falls outside the charted range.  The last
     * render's workings are kept here and exposed as Ren.QA.DateValueChart.getMarkerLines().
     */
    let lastRenderDiagnostics = null;

    const getDiagnostics = () => lastRenderDiagnostics;

    /**
     * Renders the chart's marker lines into their own group inside the chart group.  Drawn after
     * the series and the axes, so that a line landing on the plot's left or right edge is not
     * hidden underneath the axis spine.
     */
    const renderMarkerLines = (props) => {

        // The chart's own declared marker lines, plus any read from a marker data source.  The two
        // are drawn identically from here on, arriving in the same shape.
        const dataSourceMarkers = Ren.DateValueChart_DateMarkers.getMarkers(props);
        const ownMarkers = getMarkers(props).concat(dataSourceMarkers);

        // Before anything is drawn or diagnosed, so that the flags, the key and the diagnostics
        // all report the labels as the chart actually says them.
        formatMarkerLabels(ownMarkers, props);

        // After the formatting, a flag text function reading data rows these have none of.  Drawn
        // first, so their lines pass behind the flags of the track beneath theirs.
        const calendarMarkers = Ren.DateValueChart_CalendarMarkers.getMarkers(props);
        const markers = calendarMarkers.concat(ownMarkers);

        const domain = props.xScale ? props.xScale.getDomain() : null;

        lastRenderDiagnostics = {
            specs: props.markerLines || null,
            dateHeading: props.dateHeading,
            rawRowCount: props.rawInputData ? props.rawInputData.length : 0,
            resolved: [],
            drawn: [],
            outOfRange: [],
            // The markers that came from a marker data source rather than from the chart's own
            // rows, so a chart showing none can be told apart from one still waiting on its source.
            dataSourceMarkerCount: dataSourceMarkers.length,
            calendarMarkerCount: calendarMarkers.length,
            dataSourceUri:
                Ren.DateValueChart_DateMarkers.getConfig(props.visualisation)?.dataSourceUri ?? null
        };

        for (let i = 0; i < markers.length; i++) {

            lastRenderDiagnostics.resolved.push(
                markers[i].label + " @ " + toSortableMarkerDate(markers[i].date)
            );
        }

        if (domain) {

            lastRenderDiagnostics.chartedRange =
                toSortableMarkerDate(domain[0]) + " to " + toSortableMarkerDate(domain[1]);
        }

        // Summarised onto the svg alongside data-qa-date-value-chart-date-range, so that a chart
        // showing no lines can be diagnosed from its markup alone.
        const setDiagnosticsAttribute = () => {

            if (!props.svg) return;

            props.svg.setAttribute(
                "data-qa-marker-lines",
                `specs: ${(lastRenderDiagnostics.specs || []).length}` +
                `, rows: ${lastRenderDiagnostics.rawRowCount}` +
                `, resolved: ${lastRenderDiagnostics.resolved.length}` +
                `, drawn: ${lastRenderDiagnostics.drawn.length}` +
                `, dateMarkers: ${lastRenderDiagnostics.dataSourceMarkerCount}` +
                `, range: ${lastRenderDiagnostics.chartedRange || "none"}`
            );
        };

        if (!markers.length) {

            setDiagnosticsAttribute();
            return;
        }

        const group = Ren.Svg.append(props.chartGroup, "g", { "class": "ren-marker-lines" });

        for (let i = 0; i < markers.length; i++) {

            const marker = markers[i];
            const markerDate = toSortableMarkerDate(marker.date);
            const isBeforeRange = marker.date < domain[0];
            const isAfterRange = marker.date > domain[1];
            const isOutOfRange = isBeforeRange || isAfterRange;

            // A marker outside the plotted range pins to the edge it lies beyond, with its real
            // date spelled out in the label behind an arrow.
            if (isOutOfRange) {

                lastRenderDiagnostics.outOfRange.push(marker.label + " @ " + markerDate);

                if (marker.outOfRange === "hide") continue;
            }

            lastRenderDiagnostics.drawn.push(marker.label + " @ " + markerDate);

            let x;

            if (isBeforeRange) {
                x = 0;
            }
            else if (isAfterRange) {

                x = props.innerWidth;
            }
            else {

                x = props.xScale.getPixel(marker.date);
            }

            const markerGroup = Ren.Svg.append(group, "g", {
                "class": isOutOfRange
                    ? "ren-marker-line ren-marker-line--clamped"
                    : "ren-marker-line",
                "data-qa-marker-line": marker.label,
                "data-marker-date": markerDate,
                // Read by the pass that lays the labels out, which stacks the ones drawn above the
                // plot and leaves the ones drawn beneath it where they are.
                "data-marker-label-position": marker.labelPosition,
                // Calendar markers are laid out in a track of their own, above the other markers.
                "data-marker-track": marker.calendarPeriod ? "calendar" : null,
                // Only a marker read from a marker data source can be hidden by right-clicking it.
                "data-date-marker-value": marker.dateValue,
                "data-marker-spec-index": marker.specIndex ?? null,
                "data-marker-out-of-range": isOutOfRange
                    ? (isBeforeRange ? "before" : "after")
                    : null
            });

            const strokeWidth = lineWidths[marker.lineWidth] ?? lineWidths.normal;
            const dashArray = dashArrays[LINE_STYLE];

            Ren.Svg.append(markerGroup, "line", {
                "class": "ren-marker-line__line",
                "x1": x,
                "y1": 0,
                "x2": x,
                "y2": props.innerHeight,
                "stroke": LINE_COLOUR,
                "stroke-opacity": LINE_OPACITY,
                "stroke-width": strokeWidth,
                "stroke-dasharray": dashArray,
                // Without this the chart's non-uniform scale would stretch the stroke width and
                // the dashes along with the plot area.
                "vector-effect": "non-scaling-stroke",
                // The line passes the pointer through to the chart's hover beneath it; the marker
                // is hovered and right-clicked by its label, or by its hit line (below).
                "pointer-events": "none"
            });

            // The same line again in white, a couple of pixels to its right, so that a marker still
            // reads where it is drawn over a bar of its own colour.  Its offset is converted
            // through the horizontal scale the plot is drawn at, the line's own coordinates being
            // plot units: a chart resized afterwards is rescaled rather than redrawn.
            //
            // It carries the same class as the line it stands beside, the labels pass drawing every
            // line in a group up to the lane its label landed in.  It is appended second, so
            // anything reading "the marker's line" still finds the coloured one first.
            const contrastX = x + CONTRAST_OFFSET_PX / (props.scaleX || 1);

            Ren.Svg.append(markerGroup, "line", {
                "class": "ren-marker-line__line ren-marker-line__line--contrast",
                "x1": contrastX,
                "y1": 0,
                "x2": contrastX,
                "y2": props.innerHeight,
                "stroke": CONTRAST_COLOUR,
                "stroke-width": strokeWidth,
                "stroke-dasharray": dashArray,
                "vector-effect": "non-scaling-stroke",
                "pointer-events": "none"
            });

            // A wide transparent line for the pointer to catch, so that a chart showing its labels
            // on hover shows a marker's label wherever its line is hovered.  It catches nothing
            // unless the hover layout's stylesheet says so (see setHoverLayoutStyles in
            // ren-date-value-chart-marker-labels.js), leaving the chart's own hover beneath it.
            Ren.Svg.append(markerGroup, "line", {
                "class": "ren-marker-line__line ren-marker-line__line--hit",
                "x1": x,
                "y1": 0,
                "x2": x,
                "y2": props.innerHeight,
                "stroke": "transparent",
                "stroke-width": HIT_LINE_WIDTH_PX,
                "vector-effect": "non-scaling-stroke",
                "pointer-events": "none"
            });

            renderLabel(
                markerGroup,
                marker,
                getLabelText(marker, isBeforeRange, isAfterRange),
                x,
                props.innerWidth,
                props.innerHeight
            );
        }

        // The labels are all drawn in the lowest lane of the band above the plot; which lane each
        // belongs in is settled here, now that they can be measured.  Settled again after every
        // restyle, a label's size on screen following the size the chart is drawn at.
        Ren.DateValueChart_MarkerLabels.layout(props);

        setDiagnosticsAttribute();
    };

    /**
     * Gets a chart's marker lines with a marker added at a date, left unlabelled where the label
     * is blank, so that it is labelled with its date.  The chart's own are left as they were.
     */
    const addDateSpec = (markerLines, date, label) => {

        const specs = (parseSpecs(markerLines) || []).slice();
        const spec = { date };
        const text = (label || "").trim();

        if (text) spec.label = text;

        specs.push(spec);

        return specs;
    };

    /**
     * Gets a chart's marker lines without the one at an index, the chart's own being left as
     * they were.
     */
    const removeSpec = (markerLines, index) => {

        const specs = (parseSpecs(markerLines) || []).slice();

        specs.splice(index, 1);

        return specs;
    };

    return {
        toSortableMarkerDate,
        formatMarkerDate,
        getMarkers,
        addDateSpec,
        removeSpec,
        getDiagnostics,
        renderMarkerLines
    };
})();
