/**
 * The small box a date/value chart lists the hovered period's value for each series in, drawn in
 * the strip beneath the date axis, under the hovered date where that is shown too.
 *
 * The hovered date says which period is being read but not what was plotted in it: a bar a shade
 * under a gridline, or a line crossing another, is read off the value axis by eye.  Each enabled
 * series gets a line of its own, marked with the shape and colour it is drawn in and named as the
 * legend names it, so a row can be read without looking across to the legend.  A long name is cut
 * short, the row's tooltip giving it in full.  More than four series are laid out in columns of
 * four at most, filled a line at a time.
 *
 * It is kept as short as it can be - a row is a line of text and no more - since every pixel it
 * takes is one the plot above it loses.
 *
 * Where the chart is set to, each value is followed by its change on the period before, as a
 * percentage coloured by which way it went.
 *
 * Drawn in the container's own pixels, as the hover band it hangs below is.
 */
Ren.DateValueChart_HoverValues = (() => {

    // A row: the text size, the height a row is given, and the marker drawn at its left.
    const FONT_SIZE_PX = 10;
    const ROW_HEIGHT_PX = 12;
    const MARKER_WIDTH_PX = 9;
    const MARKER_GAP_PX = 4;
    const NAME_GAP_PX = 8;

    // The widest a series' name is printed, beyond which it is cut short and left to its tooltip.
    const MAX_NAME_WIDTH_PX = 120;
    const ELLIPSIS = "…";

    // The most entries stacked in a column before the box is split into more, and the space
    // between one column and the next.
    const MAX_ENTRIES_PER_COLUMN = 4;
    const COLUMN_GAP_PX = 12;

    // The padding of the ground the rows are printed on.
    const PADDING_X_PX = 4;
    const PADDING_Y_PX = 2;

    // How thick a line series' marker is drawn, and how big a point series' is.
    const LINE_MARKER_WIDTH_PX = 2;
    const POINT_MARKER_RADIUS_PX = 3;

    const VALUE_COLOUR = "#333333";
    const RISE_COLOUR = "#2e7d32";
    const FALL_COLOUR = "#c62828";
    const NAME_COLOUR = "#666666";

    // What a period the chart has no row for is printed as.
    const NO_VALUE_TEXT = "-";

    /**
     * The indexes of the series the box lists: those the legend has left switched on, in the order
     * they are plotted.
     */
    const getShownSeriesIndexes = (props) => {

        const indexes = [];

        if (!props.series) return indexes;

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i] && props.series[i].isEnabled !== false) indexes.push(i);
        }

        return indexes;
    };

    /**
     * Gets the number of columns a box listing a number of entries is laid out in: as few as keep
     * each to MAX_ENTRIES_PER_COLUMN, so that a chart of many series does not take a tall strip
     * from its plot.
     */
    const getColumnCount = (entryCount) =>
        Math.max(1, Math.ceil(entryCount / MAX_ENTRIES_PER_COLUMN));

    /**
     * Gets the height, in visual pixels, of a box listing a number of entries.
     */
    const getHeightForEntryCountPx = (entryCount) => {

        if (entryCount === 0) return 0;

        const lineCount = Math.ceil(entryCount / getColumnCount(entryCount));

        return lineCount * ROW_HEIGHT_PX + PADDING_Y_PX * 2;
    };

    /**
     * Gets the height, in visual pixels, a chart showing the box has to leave beneath its date axis
     * for it: room for the tallest box any number of its series could be listed in, so that the
     * plot does not change size as series are switched on and off in the legend.  Fewer series can
     * take more lines, as four fit in one column where five are split over two.
     */
    const getHeightPx = (props) => {

        const seriesCount = props.series ? props.seriesCount : 0;
        let heightPx = 0;

        for (let count = 1; count <= seriesCount; count++) {

            heightPx = Math.max(heightPx, getHeightForEntryCountPx(count));
        }

        return heightPx;
    };

    /**
     * The chart's rows against where the mark drawn for each stands on the plot, in ascending
     * order.
     *
     * The row is found by where it is drawn rather than by binning its date the way the hover band
     * bins the pointer's: a chart whose rows do not sit where that binning puts them - the data
     * already grouped into periods of its own, say - would otherwise be read for one period and
     * report the value of another.
     */
    const buildRowPositions = (props) => {

        const positions = [];
        const data = props.plottedData ?? props.currentData;

        if (!data) return positions;

        for (let i = 0; i < data.length; i++) {

            const date = data[i][props.dateHeading];

            if (!date || !date.getTime) continue;

            positions.push({
                x: props.xScale.getPixel(Ren.DateValueChartCalculator.periodCentre(props, date)),
                row: data[i],
                previousRow: null
            });
        }

        positions.sort((a, b) => a.x - b.x);

        for (let i = 1; i < positions.length; i++) {
            positions[i].previousRow = positions[i - 1].row;
        }

        return positions;
    };

    /**
     * The position of the row drawn within a stretch of the plot, given in plot coordinates: the
     * one nearest its centre where a chart draws more than one there, and none where the stretch
     * is empty.
     */
    const rowWithin = (positions, leftX, rightX) => {

        const centreX = (leftX + rightX) / 2;
        let found = null;
        let foundDistance = 0;

        // The first row at or past the left edge, since a chart of a couple of years of days is
        // several hundred of them and the band holds one or two.
        let low = 0;
        let high = positions.length;

        while (low < high) {

            const middle = (low + high) >> 1;

            if (positions[middle].x < leftX) {

                low = middle + 1;
            }
            else {

                high = middle;
            }
        }

        for (let i = low; i < positions.length; i++) {

            if (positions[i].x > rightX) break;

            const distance = Math.abs(positions[i].x - centreX);

            if (found === null || distance < foundDistance) {

                found = positions[i];
                foundDistance = distance;
            }
        }

        return found;
    };

    /**
     * Appends the marker for a series, shaped as the series is drawn: a line for a line series, a
     * dot for a point series, and a square for a bar series, as the legend's markers are.
     */
    const appendMarker = (rowGroup, seriesType, colour) => {

        const centreY = ROW_HEIGHT_PX / 2;

        if (seriesType === "line") {

            return Ren.Svg.append(rowGroup, "line", {
                "x1": 0,
                "x2": MARKER_WIDTH_PX,
                "y1": centreY,
                "y2": centreY,
                "stroke": colour,
                "stroke-width": LINE_MARKER_WIDTH_PX
            });
        }

        if (seriesType === "point") {

            return Ren.Svg.append(rowGroup, "circle", {
                "cx": MARKER_WIDTH_PX / 2,
                "cy": centreY,
                "r": POINT_MARKER_RADIUS_PX,
                "fill": colour
            });
        }

        const size = Math.min(MARKER_WIDTH_PX, ROW_HEIGHT_PX - 4);

        return Ren.Svg.append(rowGroup, "rect", {
            "x": (MARKER_WIDTH_PX - size) / 2,
            "y": centreY - size / 2,
            "width": size,
            "height": size,
            "fill": colour
        });
    };

    /**
     * Prints text in a text element, cut short with an ellipsis where it would run wider than a
     * given width.  The longest start that fits is found by halving, as each try is a measurement.
     */
    const fitTextToWidth = (textElement, text, maxWidthPx) => {

        textElement.textContent = text;

        if (textElement.getComputedTextLength() <= maxWidthPx) return;

        let low = 0;
        let high = text.length - 1;

        while (low < high) {

            const middle = (low + high + 1) >> 1;

            textElement.textContent = text.substring(0, middle).trimEnd() + ELLIPSIS;

            if (textElement.getComputedTextLength() <= maxWidthPx) {

                low = middle;
            }
            else {

                high = middle - 1;
            }
        }

        textElement.textContent = text.substring(0, low).trimEnd() + ELLIPSIS;
    };

    /**
     * Gets a series' value in a row, or null where the row has none to show.
     */
    const getSeriesValue = (props, seriesIndex, row) => {

        if (!row) return null;

        const value = row[props.valueHeadings[seriesIndex]];

        return value === undefined || value === "" ? null : value;
    };

    const formatSeriesValue = (props, seriesIndex, row) => {

        const value = getSeriesValue(props, seriesIndex, row);

        if (value === null) return NO_VALUE_TEXT;

        return Ren.ValueFormatter.formatValue(
            value,
            null,
            props.valueColumnFormats ? props.valueColumnFormats[seriesIndex] : null,
            props.valueColumnFormatFunctions ? props.valueColumnFormatFunctions[seriesIndex] : null,
            null,
            null,
            null,
            null
        );
    };

    /**
     * Gets a value indicating whether the box gives each value's change on the period before.
     * Shares are left out, as a change in a share reads better in points than as a percentage, and
     * so are changes, which would be a change of a change.
     */
    const isShowingChange = (props) => props.showHoverChange === true
        && !Ren.DateValueChart_ValueTransforms.isShareOfTotal(props)
        && !Ren.DateValueChart_ValueTransforms.isAnyChange(props);

    /**
     * Gets a series' change from one row to the next as a fraction of where it was, or null where
     * either has no value or the first is zero, which no change is a fraction of.
     */
    const getChange = (props, seriesIndex, row, previousRow) => {

        const value = getSeriesValue(props, seriesIndex, row);
        const previousValue = getSeriesValue(props, seriesIndex, previousRow);

        if (typeof value !== "number" || !isFinite(value)) return null;
        if (typeof previousValue !== "number" || !isFinite(previousValue)) return null;
        if (previousValue === 0) return null;

        return (value - previousValue) / Math.abs(previousValue);
    };

    /**
     * Formats a change as a signed percentage: to a decimal place under 10%, where a tenth of a
     * percent still says something, and to a whole one from there.
     */
    const formatChange = (change) => {

        const percent = change * 100;
        const places = Math.abs(percent) < 10 ? 1 : 0;
        const text = Math.abs(percent).toFixed(places);

        if (Number(text) === 0) return "0%";

        return (percent > 0 ? "+" : "\u2212") + text + "%";
    };

    /**
     * Formats a series' value for its tooltip: in the source column's own format, as a bar's
     * tooltip gives it, rather than through the series' format function.
     */
    const formatSourceValue = (props, seriesIndex, row) => {

        const value = getSeriesValue(props, seriesIndex, row);

        if (value === null) return NO_VALUE_TEXT;

        return Ren.ValueFormatter.formatValueSimple(
            value,
            props.valueColumnFormats ? props.valueColumnFormats[seriesIndex] : null
        );
    };

    /**
     * Draws the box's ground and its rows, empty of values, and returns what is needed to fill them
     * in as the pointer moves.  The rows are built once per render, the series shown being fixed
     * for as long as the chart stands.
     *
     * @param {object} props - The chart's props, holding the series and the data plotted.
     * @param {object} parentGroup - The hover band's group, which the box is drawn into and hidden
     *     with.
     */
    const create = (props, parentGroup) => {

        const seriesIndexes = getShownSeriesIndexes(props);

        const group = Ren.Svg.append(parentGroup, "g", { "class": "ren-hover-values-box" });

        const ground = Ren.Svg.append(group, "rect", {
            "class": "ren-hover-values-ground",
            "fill": "#ffffff",
            "stroke": "#d0d0d0",
            "rx": 2
        });

        const rows = [];

        for (let i = 0; i < seriesIndexes.length; i++) {

            const seriesIndex = seriesIndexes[i];
            const seriesType = props.seriesTypeStrings
                ? props.seriesTypeStrings[seriesIndex]
                : "bar";

            const rowGroup = Ren.Svg.append(group, "g", {
                "class": `ren-hover-values-row ren-series-${seriesIndex + 1}`,
                "data-series": seriesIndex + 1
            });

            // The band's group takes no pointer events, so a row is given a ground that does, for
            // its tooltip to be shown over.
            const hitArea = Ren.Svg.append(rowGroup, "rect", {
                "class": "ren-hover-values-hit-area",
                "height": ROW_HEIGHT_PX,
                "fill": "transparent"
            });

            hitArea.style.pointerEvents = "all";

            const tooltip = Ren.Svg.append(rowGroup, "title");

            // Coloured as the legend's marker is: the visualisation's effects go on a wrapper, as
            // the marker's own filter is the series' colour variant.
            const markerWrapper = Ren.Svg.append(rowGroup, "g", {
                "class": Ren.VisualisationEffects.EFFECTS_APPLY_CLASS_NAME
            });

            const marker = appendMarker(
                markerWrapper,
                seriesType,
                Ren.DateValueChart_StyleUpdater.getSeriesColour(props, seriesIndex)
            );

            if (props.series[seriesIndex].colourFilter) {

                marker.style.filter = props.series[seriesIndex].colourFilter;
            }

            const name = props.series[seriesIndex].label || props.valueHeadings[seriesIndex];

            const nameText = Ren.Svg.append(rowGroup, "text", {
                "class": "ren-hover-values-name",
                "x": MARKER_WIDTH_PX + MARKER_GAP_PX,
                "dominant-baseline": "central",
                "y": ROW_HEIGHT_PX / 2,
                "font-size": FONT_SIZE_PX,
                "fill": NAME_COLOUR
            });

            nameText.style.userSelect = "none";
            nameText.textContent = name ?? "";

            const valueText = Ren.Svg.append(rowGroup, "text", {
                "class": "ren-hover-values-value",
                "text-anchor": "end",
                "dominant-baseline": "central",
                "y": ROW_HEIGHT_PX / 2,
                "font-size": FONT_SIZE_PX,
                "fill": VALUE_COLOUR
            });

            valueText.style.userSelect = "none";

            const otherTooltip = Ren.DateValueChart_OtherSeries.getTooltip(props, seriesIndex);

            rows.push({
                seriesIndex,
                rowGroup,
                hitArea,
                tooltip,
                otherTooltip,
                name,
                nameText,
                valueText
            });
        }

        // A chart with no series shown has nothing to list, so the box is left out altogether.
        Ren.DateValueChart_Visibility.setShown(props, ".ren-hover-values-box", rows.length > 0);

        // Read the first time a value is wanted, since a chart is drawn far more often than it is
        // hovered.
        let rowPositions = null;

        // The names are cut to length when the box is first shown, as text hidden with the band
        // measures nothing.
        let namesFitted = false;

        /**
         * Fills the box in for the period the band covers, given in plot coordinates, and lays it
         * out in columns sized to their widest entries, centred on the band and kept within the
         * plot as the date's own label is.  The values printed are returned, so a test can read
         * them without measuring the chart.
         */
        const showAtPeriod = (span, centrePx, topPx) => {

            if (rows.length === 0) return null;

            if (rowPositions === null) rowPositions = buildRowPositions(props);

            if (!namesFitted) {

                for (let i = 0; i < rows.length; i++) {

                    fitTextToWidth(rows[i].nameText, rows[i].name, MAX_NAME_WIDTH_PX);
                }

                namesFitted = true;
            }

            const position = rowWithin(rowPositions, span.leftX, span.rightX);
            const row = position ? position.row : null;
            const previousRow = position ? position.previousRow : null;
            const showsChange = isShowingChange(props);
            const values = [];

            // Entries run across a line before down to the next, so the column an entry falls in
            // is its index modulo the column count.
            const columnCount = getColumnCount(rows.length);
            const nameWidthsPx = [];
            const valueWidthsPx = [];

            for (let column = 0; column < columnCount; column++) {

                nameWidthsPx.push(0);
                valueWidthsPx.push(0);
            }

            for (let i = 0; i < rows.length; i++) {

                const text = formatSeriesValue(props, rows[i].seriesIndex, row);
                const column = i % columnCount;

                const change = showsChange
                    ? getChange(props, rows[i].seriesIndex, row, previousRow)
                    : null;
                const changeText = change === null ? null : formatChange(change);

                rows[i].valueText.textContent = text ?? "";

                if (changeText !== null) {

                    const changeSpan = Ren.Svg.append(rows[i].valueText, "tspan", {
                        "class": "ren-hover-values-change",
                        "fill": change > 0 ? RISE_COLOUR : change < 0 ? FALL_COLOUR : NAME_COLOUR
                    });

                    changeSpan.textContent = " " + changeText;
                }

                rows[i].tooltip.textContent =
                    `${rows[i].name}: ${formatSourceValue(props, rows[i].seriesIndex, row)}` +
                    (changeText !== null ? ` (${changeText} on the period before)` : "") +
                    (rows[i].otherTooltip ? "\n\n" + rows[i].otherTooltip : "");

                values.push({
                    seriesIndex: rows[i].seriesIndex,
                    name: rows[i].name,
                    text,
                    change: changeText
                });

                nameWidthsPx[column] = Math.max(
                    nameWidthsPx[column],
                    rows[i].nameText.getComputedTextLength()
                );

                valueWidthsPx[column] = Math.max(
                    valueWidthsPx[column],
                    rows[i].valueText.getComputedTextLength()
                );
            }

            // Each column is as wide as its own widest name and value, rather than every column
            // as wide as the widest of all.
            const columnLeftsPx = [];
            const columnWidthsPx = [];
            let contentWidthPx = 0;

            for (let column = 0; column < columnCount; column++) {

                if (column > 0) contentWidthPx += COLUMN_GAP_PX;

                columnLeftsPx.push(contentWidthPx);
                columnWidthsPx.push(MARKER_WIDTH_PX + MARKER_GAP_PX + nameWidthsPx[column]
                    + NAME_GAP_PX + valueWidthsPx[column]);

                contentWidthPx += columnWidthsPx[column];
            }

            const widthPx = PADDING_X_PX * 2 + contentWidthPx;
            const plotWidthPx = props.innerWidth * (props.scaleX || 1);
            const leftPx = Math.max(0, Math.min(plotWidthPx - widthPx, centrePx - widthPx / 2));

            Ren.Svg.setAttrs(ground, {
                "x": leftPx,
                "y": topPx,
                "width": widthPx,
                "height": getHeightForEntryCountPx(rows.length)
            });

            for (let i = 0; i < rows.length; i++) {

                const column = i % columnCount;
                const line = Math.floor(i / columnCount);
                const rowLeftPx = leftPx + PADDING_X_PX + columnLeftsPx[column];
                const rowTopPx = topPx + PADDING_Y_PX + line * ROW_HEIGHT_PX;

                rows[i].rowGroup.setAttribute("transform", `translate(${rowLeftPx}, ${rowTopPx})`);

                rows[i].hitArea.setAttribute("width", columnWidthsPx[column]);
                rows[i].valueText.setAttribute("x", columnWidthsPx[column]);
            }

            return values;
        };

        return {
            showAtPeriod
        };
    };

    return {
        create,
        getHeightPx,
        getShownSeriesIndexes,
        formatSeriesValue,
        getChange,
        formatChange
    };
})();
