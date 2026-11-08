/**
 * Subdivides a date/value chart's bars and pie slices by a further column, each value of it a band
 * of the bar or slice, in the series' colour, with narrow grooves between them. The bars and slices
 * are drawn as ever, with the bands and grooves over them, so their colours, tooltips and menus
 * carry on working and the bands always fill them exactly. A band's size is its share of the bar or
 * slice, which for an aggregation that doesn't add up, such as an average, is only a share of the
 * bands' total.
 *
 * Bands are left out where a transform has changed what a bar's height means, and for an "Other"
 * series, as it has no rows of its own.
 *
 * The bands can be labelled with their names, values or both.  The labels are drawn with the chart
 * and placed once the style updater has scaled it, as only then are the on-screen sizes known.
 * They go into a layer of their own that is not scaled with the plot, so are placed in the chart
 * group's own (screen pixel) units.  A label too long for its band is shortened with an ellipsis,
 * and one that won't fit, or would run into a value label or a pie label, is hidden.  A pie's
 * labels can instead be stacked around it, which Ren.DateValueChart_PieLabels does with the
 * slices' own labels.
 */
Ren.DateValueChart_SeriesSubdivisions = (() => {

    const BAR_MARK_CLASS = "ren-bar-subdivision";
    const PIE_MARK_CLASS = "ren-pie-subdivision";
    const GROOVE_CLASS = "ren-subdivision-groove";
    const GROOVE_HIGHLIGHT_CLASS = "ren-subdivision-groove-highlight";
    const PIE_OUTLINE_CLASS = "ren-subdivision-pie-outline";
    const LAYER_CLASS = "ren-subdivision-labels-layer";
    const LABEL_CLASS = "ren-subdivision-label";

    const LABEL_CONTENTS = {
        None: "none",
        Names: "names",
        Values: "values",
        Both: "both"
    };

    // Where a pie's subdivision labels go: inside their bands, or stacked either side of the pie
    // with the slices' own labels, joined to their bands by connectors.  A bar's always go inside.
    const LABEL_PLACEMENTS = {
        Inside: "inside",
        Around: "around"
    };

    // Any smaller bands are gathered into one, as they would be too thin to tell apart.
    const MAX_SUBDIVISIONS = 20;

    const NO_SUBDIVISIONS = [];

    const ELLIPSIS = "…";

    const LABEL_PADDING_PX = 3;

    // Glyphs are a little thinner than the line box getBBox reports.
    const GLYPH_HEIGHT_FRACTION = 0.85;

    // A pie's label is tried at these shares of the way from its hole (or centre) to its rim, then
    // cut by this share of its length at a time, down to a few characters.
    const PIE_LABEL_DISTANCE_SHARES = [0.7, 0.55, 0.85];
    const PIE_LABEL_LENGTH_STEP = 0.75;
    const PIE_LABEL_MIN_CHARACTERS = 3;

    // How much darker a groove's crease is than its series' colour, and its highlight lighter, in
    // CIELAB lightness (out of 100).
    const GROOVE_LIGHTNESS_SHIFT = 16;

    // A light series colour takes dark labels.
    const MAX_WHITE_LABEL_BRIGHTNESS = 160;

    // A bar's path starts at its far end, and runs along it and back to the baseline.
    const BAR_PATH_PATTERN = /^M\s*([-\d.e]+)[ ,]([-\d.e]+)\s*h\s*([-\d.e]+)\s*v\s*([-\d.e]+)/;

    // Each group's subdivisions, by grouping, column and value, held against the group's rows.
    const subdivisionsByRows = new WeakMap();

    // The subdivision each band drawn shows, for what opens the rows behind a band clicked.
    const subdivisionByMark = new WeakMap();

    const round = (value) => Math.round(value * 10000) / 10000;

    /**
     * Gets the entry the chart's rows were grouped by.  A chart that has grouped its rows clears
     * chartGroupingEntry, so that they aren't grouped twice, but keeps it for the previous year.
     */
    const getGroupingEntry = (props) => props.chartGroupingEntry ?? props.previousYearGroupingEntry;

    /**
     * Gets a value indicating whether the chart's bars and slices are subdivided.
     */
    const isActive = (props) => {

        const column = props.subdivideColumn;

        return !!column
            && column !== props.dateHeading
            && column !== getGroupingEntry(props)?.splitColumnKey
            && !Ren.DateValueChart_ValueTransforms.hasTransforms(props);
    };

    /**
     * Gets what the chart's subdivision labels say, which is one of LABEL_CONTENTS.
     */
    const getLabelContent = (props) => {

        const content = props.subdivisionLabels;

        return content === LABEL_CONTENTS.None
            || content === LABEL_CONTENTS.Values
            || content === LABEL_CONTENTS.Both
            ? content
            : LABEL_CONTENTS.Names;
    };

    /**
     * Gets where the chart's pies' subdivision labels go, which is one of LABEL_PLACEMENTS.
     */
    const getLabelPlacement = (props) =>
        props.subdivisionLabelPlacement === LABEL_PLACEMENTS.Around
            ? LABEL_PLACEMENTS.Around
            : LABEL_PLACEMENTS.Inside;

    /**
     * Gets a value indicating whether the chart's subdivision labels are stacked around its pies.
     */
    const areLabelsAround = (props) => Ren.DateValueChart_Pies.isShown(props)
        && isActive(props)
        && getLabelContent(props) !== LABEL_CONTENTS.None
        && getLabelPlacement(props) === LABEL_PLACEMENTS.Around;

    /**
     * Gathers the smallest of the subdivisions, which are in order of size, into one where there
     * are more than are drawn.
     */
    const gatherSmallest = (subdivisions) => {

        if (subdivisions.length <= MAX_SUBDIVISIONS) return subdivisions;

        const kept = subdivisions.slice(0, MAX_SUBDIVISIONS - 1);
        const otherColumnValues = [];
        let otherValue = 0;

        for (let i = MAX_SUBDIVISIONS - 1; i < subdivisions.length; i++) {

            otherValue += subdivisions[i].value;
            otherColumnValues.push(subdivisions[i].columnValues[0]);
        }

        kept.push({
            label: Ren.DateValueChart_SeriesSplit.OTHER_LABEL,
            value: otherValue,
            columnValues: otherColumnValues
        });

        return kept;
    };

    /**
     * Aggregates rows by the column's values, keeping the values on the same side of nothing as
     * their total, as a bar runs only one way from its baseline.  Largest first.
     */
    const buildSubdivisions = (rows, groupingEntry, column, valueHeading, binnedDate) => {

        const rowsByValue = new Map();

        for (let i = 0; i < rows.length; i++) {

            const value = Ren.DateValueChart_SeriesSplit.readSplitValue(rows[i], column, null);
            const groupRows = rowsByValue.get(value);

            if (groupRows) {
                groupRows.push(rows[i]);
            }
            else {

                rowsByValue.set(value, [rows[i]]);
            }
        }

        const aggregated = [];
        let total = 0;

        rowsByValue.forEach((groupRows, columnValue) => {

            const value = Number(
                Ren.DateValueChart_GroupingApplyer.aggregateRows(
                    groupRows,
                    groupingEntry,
                    binnedDate
                )[valueHeading]
            );

            if (!Number.isFinite(value)) return;

            // A numeric column's NULL is held as null, but filters as the sentinel.
            const filterValue = Ren.IsNull(groupRows[0][column])
                ? Ren.NullSentinel
                : columnValue;

            aggregated.push({
                label: Ren.ValueDisplayLabel(filterValue),
                value: value,
                columnValues: [filterValue]
            });

            total += value;
        });

        const sign = total < 0 ? -1 : 1;
        const kept = [];
        let keptTotal = 0;

        for (let i = 0; i < aggregated.length; i++) {

            if (aggregated[i].value * sign <= 0) continue;

            kept.push(aggregated[i]);
            keptTotal += aggregated[i].value;
        }

        kept.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

        const subdivisions = gatherSmallest(kept);

        for (let i = 0; i < subdivisions.length; i++) {

            subdivisions[i].share = subdivisions[i].value / keptTotal;
        }

        return subdivisions;
    };

    /**
     * Gets the subdivisions of a plotted row's bar or slice, largest first, each with its label,
     * value, share of them all and the column values it covers, as a filter on the column names
     * them.  There are none where the bar or slice isn't subdivided.
     */
    const getSubdivisions = (props, row, seriesIndex) => {

        if (!isActive(props)) return NO_SUBDIVISIONS;

        const groupingEntry = getGroupingEntry(props);
        const heading = props.valueHeadings[seriesIndex];
        const aggregatedRow = Ren.CreateDateValueChart_PrepareData.getUnpreparedRow(row);

        if (!groupingEntry || !aggregatedRow) return NO_SUBDIVISIONS;

        const aggregated = Ren.DateValueChart_GroupingApplyer.getAggregatedRows(
            aggregatedRow,
            heading
        );

        if (!aggregated || aggregated.rows.length === 0) return NO_SUBDIVISIONS;

        const rows = aggregated.rows;
        const column = props.subdivideColumn;
        const valueHeading = aggregated.valueHeading;

        if (column === valueHeading || !(column in rows[0])) return NO_SUBDIVISIONS;

        let subdivisionsByKey = subdivisionsByRows.get(rows);

        if (!subdivisionsByKey) {

            subdivisionsByKey = new Map();
            subdivisionsByRows.set(rows, subdivisionsByKey);
        }

        const key = groupingEntry.groupingSignature + "\n" + column + "\n" + valueHeading;
        let subdivisions = subdivisionsByKey.get(key);

        if (!subdivisions) {

            subdivisions = buildSubdivisions(
                rows,
                groupingEntry,
                column,
                valueHeading,
                aggregatedRow[groupingEntry.dateHeading]
            );

            subdivisionsByKey.set(key, subdivisions);
        }

        return subdivisions;
    };

    /**
     * Gets the bar a path draws, or null where it isn't the plain rectangle bars are drawn as.
     */
    const parseBarPath = (pathData) => {

        const match = BAR_PATH_PATTERN.exec(pathData);

        if (!match) return null;

        return {
            x: Number(match[1]),
            y: Number(match[2]),
            width: Number(match[3]),
            height: Number(match[4])
        };
    };

    /**
     * Gets the path of the band of a bar between two shares of it, measured from its baseline, the
     * far end of its path's height whichever way the bar runs.
     */
    const getBarMarkPath = (bar, startShare, endShare) => {

        const baseline = bar.y + bar.height;
        const near = baseline - bar.height * startShare;
        const far = baseline - bar.height * endShare;

        return `M${round(bar.x)},${round(far)}h${round(bar.width)}`
            + `V${round(near)}h${round(-bar.width)}Z`;
    };

    /**
     * Gets the path of the grooves across a bar at each of the shares of it between its bands.
     */
    const getBarGroovePath = (bar, shares) => {

        const baseline = bar.y + bar.height;
        let path = "";

        for (let i = 0; i < shares.length; i++) {

            path += `M${round(bar.x)},${round(baseline - bar.height * shares[i])}`
                + `h${round(bar.width)}`;
        }

        return path;
    };

    /**
     * Gets the groove from a pie's hole (or centre) to its rim at an angle between a slice's bands,
     * which run clockwise from 12 o'clock: its path, and the unit normal to it on the side away
     * from the light, which falls from the top left.
     */
    const getPieGroove = (angle, holeRadius) => {

        const x = Math.sin(angle);
        const y = -Math.cos(angle);
        const sign = x - y < 0 ? -1 : 1;

        return {
            path: `M${round(x * holeRadius)},${round(y * holeRadius)}L${round(x)},${round(y)}`,
            normalX: round(-y * sign),
            normalY: round(x * sign)
        };
    };

    /**
     * Draws a groove along a path: a dark crease, with a highlight beside it on the side away from
     * the light, on its normal, which by default points down, as across a bar.
     */
    const appendGroove = (parentNode, pathData, normalX, normalY) => {

        if (!pathData) return;

        const highlight = Ren.Svg.append(parentNode, "path", {
            "class": GROOVE_HIGHLIGHT_CLASS,
            "d": pathData
        });

        if (normalX !== undefined) {

            highlight.setAttribute(
                "style",
                `--ren-groove-x: ${normalX}; --ren-groove-y: ${normalY}`
            );
        }

        Ren.Svg.append(parentNode, "path", { "class": GROOVE_CLASS, "d": pathData });
    };

    const formatValue = (props, seriesIndex, value) =>
        Ren.ValueFormatter.formatValueSimple(value, props.valueColumnFormats[seriesIndex]);

    /**
     * Gets a subdivision's label text, or null where the chart's subdivisions aren't labelled.
     */
    const getLabelText = (props, seriesIndex, subdivision) => {

        const content = getLabelContent(props);

        if (content === LABEL_CONTENTS.None) return null;
        if (content === LABEL_CONTENTS.Names) return subdivision.label;

        const value = formatValue(props, seriesIndex, subdivision.value);

        return content === LABEL_CONTENTS.Values ? value : `${subdivision.label} ${value}`;
    };

    const getMarkTitle = (props, context, subdivision) => {

        const value = formatValue(props, context.seriesIndex, subdivision.value);
        const share = Ren.DateValueChart_PieLabels.formatShare(subdivision.share);

        return `${context.dateLabel}\n${context.seriesLabel}\n`
            + `${subdivision.label}: ${value} (${share})`;
    };

    const appendMark = (props, parentNode, className, pathData, context, subdivision) => {

        const mark = Ren.Svg.append(parentNode, "path", { "class": className, "d": pathData });

        // The row, as a bar's own path has, for what looks up the data behind a mark clicked.
        Ren.Svg.setDatum(mark, context.row);

        subdivisionByMark.set(mark, subdivision);

        Ren.Svg.append(mark, "title").textContent = getMarkTitle(props, context, subdivision);
    };

    /**
     * Gets the subdivision a band drawn, or its label, shows, or null where the element is neither.
     */
    const getMarkSubdivision = (element) => subdivisionByMark.get(element) ?? null;

    /**
     * Makes a click on an element drawn for a band's label, such as one around its pie, one on
     * the band.
     */
    const setMarkSubdivision = (element, subdivision) =>
        subdivisionByMark.set(element, subdivision);

    /**
     * Keeps a subdivision's label for renderLabels, where it has any label to show.
     */
    const addPendingLabel = (props, seriesIndex, subdivision, placement) => {

        const fullText = getLabelText(props, seriesIndex, subdivision);

        if (!fullText) return;

        placement.seriesIndex = seriesIndex;
        placement.subdivision = subdivision;
        placement.fullText = fullText;

        if (!props.subdivisionPendingLabels) props.subdivisionPendingLabels = [];

        props.subdivisionPendingLabels.push(placement);
    };

    /**
     * Draws the bands over each of a series' bars, after any bar's title, so that the bar's first
     * path and title are still its own.
     */
    const renderBarMarks = (props, seriesGroup, seriesIndex) => {

        if (!isActive(props)) return;

        const barNodes = seriesGroup.querySelectorAll(".ren-bar.ren-vertical");
        const dateTickFormat = Ren.DateValueChart_DateTickFormat.getChartTickFormat(props);
        const seriesLabel = Ren.DateValueChart_Pies.getSeriesName(props, seriesIndex);

        for (let barIndex = 0; barIndex < barNodes.length; barIndex++) {

            const barNode = barNodes[barIndex];
            const row = Ren.Svg.getDatum(barNode);
            const subdivisions = row
                ? getSubdivisions(props, row, seriesIndex)
                : NO_SUBDIVISIONS;

            if (subdivisions.length === 0) continue;

            const pathNode = barNode.querySelector(".ren-data-series__bar");
            const bar = pathNode ? parseBarPath(pathNode.getAttribute("d")) : null;

            if (!bar || !bar.width || !bar.height) continue;

            const context = {
                row,
                seriesIndex,
                seriesLabel,
                dateLabel: dateTickFormat(row[props.dateHeading]).replace(/\n/g, " ")
            };

            const grooveShares = [];
            let startShare = 0;

            for (let i = 0; i < subdivisions.length; i++) {

                const endShare = startShare + subdivisions[i].share;

                if (i > 0) grooveShares.push(startShare);

                appendMark(
                    props,
                    barNode,
                    BAR_MARK_CLASS,
                    getBarMarkPath(bar, startShare, endShare),
                    context,
                    subdivisions[i]
                );

                addPendingLabel(props, seriesIndex, subdivisions[i], {
                    barNode,
                    isDown: bar.height < 0,
                    startShare,
                    endShare
                });

                startShare = endShare;
            }

            appendGroove(barNode, getBarGroovePath(bar, grooveShares));
        }
    };

    /**
     * Draws the bands over a pie's slice, which is drawn from one angle to another.
     */
    const renderPieMarks = (props, sliceGroup, row, seriesIndex, slice, dateLabel) => {

        const subdivisions = getSubdivisions(props, row, seriesIndex);

        if (subdivisions.length === 0) return;

        const holeRadius = Ren.DateValueChart_Pies.getHoleRadius(props);
        const sweep = slice.endAngle - slice.startAngle;

        const context = {
            row,
            seriesIndex,
            dateLabel,
            seriesLabel: Ren.DateValueChart_Pies.getSeriesName(props, seriesIndex)
        };

        // A slice of the whole pie has no edges of its own, so its first band needs a groove at
        // its start too.
        const isWholePie = sweep >= Math.PI * 2 - 1e-9;
        const grooveAngles = [];
        let startAngle = slice.startAngle;

        for (let i = 0; i < subdivisions.length; i++) {

            const endAngle = startAngle + subdivisions[i].share * sweep;

            if (i > 0 || (isWholePie && subdivisions.length > 1)) grooveAngles.push(startAngle);

            appendMark(
                props,
                sliceGroup,
                PIE_MARK_CLASS,
                Ren.DateValueChart_Pies.getSlicePath(startAngle, endAngle, holeRadius),
                context,
                subdivisions[i]
            );

            // The pie, row and title are for a label stacked around the pie (see takeAroundLabels).
            addPendingLabel(props, seriesIndex, subdivisions[i], {
                centreX: slice.centreX,
                centreY: slice.centreY,
                startAngle,
                endAngle,
                pie: slice.pie,
                row,
                title: getMarkTitle(props, context, subdivisions[i])
            });

            startAngle = endAngle;
        }

        for (let i = 0; i < grooveAngles.length; i++) {

            const groove = getPieGroove(grooveAngles[i], holeRadius);

            appendGroove(sliceGroup, groove.path, groove.normalX, groove.normalY);
        }

        // The slice's outline straddles its rim and hole, where the grooves end, so is drawn again
        // over them, or their ends would poke into it.
        if (grooveAngles.length > 0) {

            Ren.Svg.append(sliceGroup, "path", {
                "class": PIE_OUTLINE_CLASS,
                "d": Ren.DateValueChart_Pies.getSlicePath(
                    slice.startAngle,
                    slice.endAngle,
                    holeRadius
                )
            });
        }
    };

    /**
     * Takes the pies' subdivision labels kept so far for Ren.DateValueChart_PieLabels to stack
     * around the pies, where they go there, leaving none for renderLabels.  Gets none otherwise.
     */
    const takeAroundLabels = (props) => {

        const pendingLabels = props.subdivisionPendingLabels;

        if (!pendingLabels || !areLabelsAround(props)) return NO_SUBDIVISIONS;

        props.subdivisionPendingLabels = null;

        return pendingLabels;
    };

    /**
     * Draws the labels kept while the series were drawn, unplaced, a group per series, so that they
     * fade with their series.  Runs once every series is drawn, as what looks for a series' group
     * finds the first in the document, which has to be the one holding its bars.
     */
    const renderLabels = (props) => {

        const pendingLabels = props.subdivisionPendingLabels;

        props.subdivisionPendingLabels = null;
        props.subdivisionLabelNodes = [];

        if (!pendingLabels) return;

        const layer = Ren.Svg.append(props.chartGroup, "g", { "class": LAYER_CLASS });
        const seriesGroups = new Map();

        for (let i = 0; i < pendingLabels.length; i++) {

            const label = pendingLabels[i];
            let seriesGroup = seriesGroups.get(label.seriesIndex);

            if (!seriesGroup) {

                seriesGroup = Ren.Svg.append(layer, "g", {
                    "class": `ren-series-${label.seriesIndex + 1}`,
                    "data-series": label.seriesIndex + 1
                });

                seriesGroups.set(label.seriesIndex, seriesGroup);
            }

            label.textNode = Ren.Svg.append(seriesGroup, "text", { "class": LABEL_CLASS });
            label.textNode.textContent = label.fullText;

            // A click on the label is one on its band.
            subdivisionByMark.set(label.textNode, label.subdivision);

            props.subdivisionLabelNodes.push(label);
        }
    };

    /**
     * Gets how a bar's band shows its label: whole and level where it can, then whole and reading
     * up the bar, then whichever way shortening it leaves the most of it, or null where neither
     * does.  Level comes first between the two, being the easier to read.
     */
    const chooseBarLabelFit = ({
        fullText,
        prefixLengths,
        thickness,
        bandWidthPx,
        bandHeightPx
    }) => {

        const fitName = Ren.DateValueChart_BarSeriesNames.fitName;
        const levelLength = bandWidthPx - LABEL_PADDING_PX * 2;
        const uprightLength = bandHeightPx - LABEL_PADDING_PX * 2;

        const level = thickness <= bandHeightPx
            ? fitName(fullText, prefixLengths, levelLength)
            : null;

        if (level === fullText) return { text: level, isVertical: false };

        const upright = thickness <= bandWidthPx
            ? fitName(fullText, prefixLengths, uprightLength)
            : null;

        if (upright === fullText) return { text: upright, isVertical: true };

        if (level === null && upright === null) return null;

        return upright !== null && (level === null || upright.length > level.length)
            ? { text: upright, isVertical: true }
            : { text: level, isVertical: false };
    };

    /**
     * Gets a label's text and width at each length it may be tried at, whole first, for a slice.
     */
    const getPieTextOptions = (fullText, prefixLengths) => {

        const length = fullText.length;
        const options = [{ text: fullText, width: prefixLengths[length] }];

        let count = Math.floor(length * PIE_LABEL_LENGTH_STEP);

        while (count >= PIE_LABEL_MIN_CHARACTERS) {

            options.push({
                text: fullText.substring(0, count).replace(/\s+$/, "") + ELLIPSIS,
                width: prefixLengths[count]
            });

            count = Math.floor(count * PIE_LABEL_LENGTH_STEP);
        }

        return options;
    };

    const boxesOverlap = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    const overlapsAny = (box, boxes) => {

        for (let i = 0; i < boxes.length; i++) {

            if (boxesOverlap(box, boxes[i])) return true;
        }

        return false;
    };

    /**
     * Gets where a slice's band shows its label: at the middle of the band's angle, at the longest
     * length and the first distance that it fits inside the band without running into the boxes
     * passed.  Null where it fits nowhere.
     */
    const choosePieLabelFit = ({
        textOptions,
        thickness,
        centre,
        slice,
        holePx,
        radiusPx,
        boxes
    }) => {

        const middleAngle = (slice.startAngle + slice.endAngle) / 2;

        for (let i = 0; i < textOptions.length; i++) {

            const halfWidth = textOptions[i].width / 2;

            for (let j = 0; j < PIE_LABEL_DISTANCE_SHARES.length; j++) {

                const distance = holePx + (radiusPx - holePx) * PIE_LABEL_DISTANCE_SHARES[j];
                const x = centre.x + distance * Math.sin(middleAngle);
                const y = centre.y - distance * Math.cos(middleAngle);

                const box = {
                    left: x - halfWidth,
                    right: x + halfWidth,
                    top: y - thickness / 2,
                    bottom: y + thickness / 2
                };

                if (Ren.DateValueChart_PieLabels.isBoxInSlice(box, centre, slice, holePx, radiusPx)
                    && !overlapsAny(box, boxes)) {

                    return { text: textOptions[i].text, x, y, box };
                }
            }
        }

        return null;
    };

    const placeLabel = (label, text, x, y, isVertical) => {

        label.textNode.textContent = text;
        label.textNode.setAttribute("x", round(x));
        label.textNode.setAttribute("y", round(y));

        if (isVertical) {
            label.textNode.setAttribute("transform", `rotate(-90 ${round(x)} ${round(y)})`);
        }
        else {

            label.textNode.removeAttribute("transform");
        }
    };

    const hideLabel = (label, result) => {

        label.textNode.style.display = "none";
        result.hidden++;
    };

    /**
     * Measures each different text once, as a chart may repeat a few names many times over.  Every
     * text is written with an ellipsis after it first, for one layout to measure them all.
     */
    const measureLabels = (labels) => {

        const measurements = new Map();

        for (let i = 0; i < labels.length; i++) {

            labels[i].textNode.style.display = "";
            labels[i].textNode.textContent = labels[i].fullText + ELLIPSIS;
        }

        for (let i = 0; i < labels.length; i++) {

            const fullText = labels[i].fullText;

            if (measurements.has(fullText)) continue;

            measurements.set(
                fullText,
                Ren.DateValueChart_BarSeriesNames.measureName(labels[i].textNode, fullText)
            );
        }

        return measurements;
    };

    const layoutBarLabels = (props, labels, measurements, result) => {

        const extents = new Map();

        for (let i = 0; i < labels.length; i++) {

            const barNode = labels[i].barNode;

            if (!extents.has(barNode)) {

                extents.set(
                    barNode,
                    Ren.DateValueChart_BarSeriesNames.getBarExtent(barNode, props.chartGroup)
                );
            }
        }

        const placedNodes = [];

        for (let i = 0; i < labels.length; i++) {

            const label = labels[i];
            const extent = extents.get(label.barNode);
            const measurement = measurements.get(label.fullText);

            if (!extent || !measurement) {

                hideLabel(label, result);
                continue;
            }

            const left = extent.left * props.scaleX;
            const bandWidthPx = (extent.right - extent.left) * props.scaleX;
            const top = extent.top * props.scaleY;
            const bottom = extent.bottom * props.scaleY;
            const middleShare = (label.startShare + label.endShare) / 2;

            const fit = chooseBarLabelFit({
                fullText: label.fullText,
                prefixLengths: measurement.prefixLengths,
                thickness: measurement.thickness * GLYPH_HEIGHT_FRACTION,
                bandWidthPx,
                bandHeightPx: (label.endShare - label.startShare) * (bottom - top)
            });

            if (!fit) {

                hideLabel(label, result);
                continue;
            }

            const y = label.isDown
                ? top + middleShare * (bottom - top)
                : bottom - middleShare * (bottom - top);

            placeLabel(label, fit.text, left + bandWidthPx / 2, y, fit.isVertical);
            placedNodes.push(label.textNode);
        }

        const valueLabelsLayer = props.chartGroup.querySelector(
            "." + Ren.DateValueChart_RenderValueLabels.LABELS_LAYER_CLASS
        );

        const hiddenCount = valueLabelsLayer
            ? Ren.DateValueChart_BarSeriesNames.hideNamesUnderValueLabels(
                valueLabelsLayer,
                placedNodes
            )
            : 0;

        result.placed = placedNodes.length - hiddenCount;
        result.hidden += hiddenCount;
    };

    /**
     * Gets the boxes of the shown labels of a chart's slices, in the units of the layer passed.
     */
    const getPieLabelBoxes = (props, layerNode) => {

        const matrix = layerNode.getScreenCTM();
        const boxes = [];

        if (!matrix) return boxes;

        const addBoxes = (labels) => {

            for (let i = 0; i < (labels ? labels.length : 0); i++) {

                const rect = labels[i].groupNode.getBoundingClientRect();

                if (!rect.width || !rect.height) continue;

                boxes.push({
                    left: (rect.left - matrix.e) / matrix.a,
                    right: (rect.right - matrix.e) / matrix.a,
                    top: (rect.top - matrix.f) / matrix.d,
                    bottom: (rect.bottom - matrix.f) / matrix.d
                });
            }
        };

        addBoxes(props.pieShareNodes);
        addBoxes(props.pieLabelNodes);

        return boxes;
    };

    const layoutPieLabels = (props, labels, measurements, result) => {

        const radiusPx = Ren.DateValueChart_Pies.getRadiusPx(props, props.scaleX, props.scaleY);
        const holePx = radiusPx * Ren.DateValueChart_Pies.getHoleRadius(props);
        const boxes = getPieLabelBoxes(props, labels[0].textNode.parentNode.parentNode);

        for (let i = 0; i < labels.length; i++) {

            const label = labels[i];
            const measurement = measurements.get(label.fullText);

            if (!measurement) {

                hideLabel(label, result);
                continue;
            }

            const fit = choosePieLabelFit({
                textOptions: getPieTextOptions(label.fullText, measurement.prefixLengths),
                thickness: measurement.thickness * GLYPH_HEIGHT_FRACTION,
                centre: { x: label.centreX * props.scaleX, y: label.centreY * props.scaleY },
                slice: { startAngle: label.startAngle, endAngle: label.endAngle },
                holePx,
                radiusPx,
                boxes
            });

            if (!fit) {

                hideLabel(label, result);
                continue;
            }

            placeLabel(label, fit.text, fit.x, fit.y, false);
            boxes.push(fit.box);
            result.placed++;
        }
    };

    /**
     * Places the chart's subdivision labels on its bands.  Runs after the value labels and the
     * pies' own labels are placed, which take priority over them.
     *
     * @returns {object} { placed, hidden }, for the QA hooks.
     */
    const layout = (props) => {

        const result = { placed: 0, hidden: 0 };
        const labels = props?.subdivisionLabelNodes;

        if (!labels || !labels.length || !props.scaleX || !props.scaleY) return result;

        const measurements = measureLabels(labels);

        if (Ren.DateValueChart_Pies.isShown(props)) {
            layoutPieLabels(props, labels, measurements, result);
        }
        else {

            layoutBarLabels(props, labels, measurements, result);
        }

        return result;
    };

    /**
     * Gets the rules colouring a series' labels to stand out on its colour, and its grooves in a
     * darker and a lighter shade of the colour drawn, after any filter.  Where the colour can't
     * be read, the grooves keep their translucent black and white.
     */
    const buildColourStyles = (seriesClass, colour, filter) => {

        const brightness = Ren.Colours.brightnessOfColour(colour);
        const labelColour = brightness !== null && brightness > MAX_WHITE_LABEL_BRIGHTNESS
            ? "#222"
            : "white";

        const rules = [`.${LAYER_CLASS} > ${seriesClass} .${LABEL_CLASS} { fill: ${labelColour} }`];
        const drawnColour = Ren.Colours.applyFilter(colour, filter);
        const creaseColour = Ren.Colours.shiftLightness(drawnColour, -GROOVE_LIGHTNESS_SHIFT);
        const highlightColour = Ren.Colours.shiftLightness(drawnColour, GROOVE_LIGHTNESS_SHIFT);

        if (creaseColour !== null) {

            rules.push(`${seriesClass} .${GROOVE_CLASS} { stroke: ${creaseColour} }`);
            rules.push(`${seriesClass} .${GROOVE_HIGHLIGHT_CLASS} { stroke: ${highlightColour} }`);
        }

        return rules;
    };

    /**
     * Gets the rules styling every band, groove and label.  A band's fill is kept transparent even
     * from the rules that colour a selected bar's paths, which would hide the bands of a selected
     * bar.  The grooves are given shades of their series' colour by buildColourStyles, and until
     * then are translucent black and white.  A bar's grooves run level, so are kept sharp on whole
     * pixels.
     */
    const buildStyles = (props) => {

        const fontSizePx = Ren.DateValueChart_Pies.isShown(props)
            ? props.pieLabelFontSize ?? Ren.DateValueChart_PieLabels.DEFAULT_FONT_SIZE_PX
            : props.seriesNamesInBarsFontSize
                ?? Ren.DateValueChart_StyleUpdater.defaultLabelFontSizes.seriesNamesInBars;

        const markDeclarations = "{ fill: transparent !important; stroke: none }";
        const grooveDeclarations = "fill: none !important; pointer-events: none; "
            + "vector-effect: non-scaling-stroke; stroke-linecap: butt; stroke-width: 1px";

        return [
            `.${BAR_MARK_CLASS} ${markDeclarations}`,
            `.${PIE_MARK_CLASS} ${markDeclarations}`,
            `.${GROOVE_HIGHLIGHT_CLASS} { ${grooveDeclarations}; `
                + "stroke: rgba(255, 255, 255, 0.35) }",
            `.${GROOVE_CLASS} { ${grooveDeclarations}; stroke: rgba(0, 0, 0, 0.3) }`,
            `.ren-bar .${GROOVE_HIGHLIGHT_CLASS} { shape-rendering: crispEdges }`,
            `.ren-bar .${GROOVE_CLASS} { shape-rendering: crispEdges }`,
            `.${PIE_OUTLINE_CLASS} { fill: none !important; pointer-events: none; stroke: white; `
                + "stroke-width: 1px; vector-effect: non-scaling-stroke; stroke-linejoin: round }",
            `.${LAYER_CLASS} { pointer-events: none }`,
            `.${LABEL_CLASS} { font-size: ${fontSizePx}px; text-anchor: middle; `
                + "dominant-baseline: central }"
        ];
    };

    /**
     * Gets the rule moving each groove's highlight a screen pixel along its normal, off its
     * crease.  A translation is in the units of the highlight's parent, which the series groups
     * scale to the plot.
     */
    const buildScaleStyles = (scaleX, scaleY) => {

        if (!(scaleX > 0) || !(scaleY > 0)) return [];

        return [
            `.${GROOVE_HIGHLIGHT_CLASS} { translate: `
                + `calc(var(--ren-groove-x, 0) * ${1 / scaleX}px) `
                + `calc(var(--ren-groove-y, 1) * ${1 / scaleY}px) }`
        ];
    };

    return {
        BAR_MARK_CLASS,
        PIE_MARK_CLASS,
        GROOVE_CLASS,
        GROOVE_HIGHLIGHT_CLASS,
        PIE_OUTLINE_CLASS,
        LAYER_CLASS,
        LABEL_CLASS,
        LABEL_CONTENTS,
        LABEL_PLACEMENTS,
        MAX_SUBDIVISIONS,
        isActive,
        getLabelContent,
        getLabelPlacement,
        areLabelsAround,
        getSubdivisions,
        getMarkSubdivision,
        setMarkSubdivision,
        takeAroundLabels,
        parseBarPath,
        getBarMarkPath,
        getBarGroovePath,
        getPieGroove,
        getLabelText,
        chooseBarLabelFit,
        getPieTextOptions,
        choosePieLabelFit,
        renderBarMarks,
        renderPieMarks,
        renderLabels,
        layout,
        buildColourStyles,
        buildStyles,
        buildScaleStyles
    };
})();
