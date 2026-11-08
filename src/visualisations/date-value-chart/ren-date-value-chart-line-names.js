/**
 * Names a chart's lines on the plot, so that which line is which can be read without the legend.
 * A name is drawn in its line's colour, either in a column to the right of the plot, beside where
 * its line ends, or on the plot, just above or below its line where no other line passes.
 *
 * The names are drawn with the chart and placed once the style updater has scaled it, as only then
 * are the lines' and names' on-screen positions known.  They go into a layer of their own that is
 * not scaled with the plot, so are placed in the chart group's own (screen pixel) units.  A name
 * there is no room for is hidden rather than drawn over something else.
 */
Ren.DateValueChart_LineNames = (() => {

    const LAYOUTS = {
        Auto: "auto",
        AtEnds: "ends",
        AlongLines: "along",
        Off: "off"
    };

    const LAYER_CLASS = "ren-line-names-layer";
    const NAME_CLASS = "ren-line-name";
    const CONNECTOR_CLASS = "ren-line-name-connector";

    const DEFAULT_FONT_SIZE_PX = 12;

    // With more lines than this, the names would crowd the plot, so are left to the legend.
    const MAX_AUTO_LINE_COUNT = 8;

    // The column of names at the lines' ends is kept to this width, and a longer name shortened.
    const MAX_END_COLUMN_WIDTH_PX = 160;
    const END_GAP_PX = 8;
    const END_NAME_SPACING_PX = 2;

    // How far a name along a line sits clear of it, and of the other lines.
    const LINE_CLEARANCE_PX = 3;

    // How many places along its line a name is tried at.
    const CANDIDATE_COUNT = 40;

    // The side of the square drawn to read the names layer's position and zoom on the page.
    const PROBE_SIZE = 100;

    // A dark enough shade of a light colour for its name to read on a white plot.
    const MAX_NAME_BRIGHTNESS = 170;
    const LIGHT_COLOUR_DARKENING = 0.6;

    // Keeps the name whole, as the shown text may have been shortened by the last pass.
    const FULL_NAME_ATTRIBUTE = "data-full-name";

    const ELLIPSIS = "…";

    let lastResult = { layout: LAYOUTS.Off, placed: 0, hidden: 0, placements: [] };

    const getDiagnostics = () => lastResult;

    /** Gets the chart's chosen way of naming its lines, Auto where none is chosen. */
    const getLayout = (props) => {

        const keys = Object.keys(LAYOUTS);

        for (let i = 0; i < keys.length; i++) {

            if (LAYOUTS[keys[i]] === props.lineNames) return props.lineNames;
        }

        return LAYOUTS.Auto;
    };

    const getFontSizePx = (props) => props.lineNamesFontSize ?? DEFAULT_FONT_SIZE_PX;

    const getName = (props, seriesIndex) =>
        props.series[seriesIndex].label
            || (props.valueHeadings ? props.valueHeadings[seriesIndex] : "")
            || "";

    /** Gets the indexes of the series drawn as lines and shown, which have a name. */
    const getNamedLineIndexes = (props) => {

        const indexes = [];

        if (!props.series || Ren.DateValueChart_Pies.isShown(props)) return indexes;

        for (let i = 0; i < props.series.length; i++) {

            const series = props.series[i];

            if (series.chartType !== Ren.SeriesChartTypeEnum.Line) continue;
            if (series.isEnabled === false) continue;
            if (!getName(props, i)) continue;

            indexes.push(i);
        }

        return indexes;
    };

    /**
     * Gets how the lines are named as drawn: Auto resolved to a layout, or Off where there are no
     * lines to name.  The ends column would sit behind a right axis' labels, so with one shown the
     * names go along the lines instead.
     */
    const getEffectiveLayout = (props) => {

        const layout = getLayout(props);

        if (layout === LAYOUTS.Off) return LAYOUTS.Off;

        const count = getNamedLineIndexes(props).length;

        if (count === 0) return LAYOUTS.Off;

        if (layout === LAYOUTS.Auto && (count < 2 || count > MAX_AUTO_LINE_COUNT)) {
            return LAYOUTS.Off;
        }

        if (Ren.DateValueChart_YScales.hasRightAxis(props)) return LAYOUTS.AlongLines;

        return layout === LAYOUTS.Auto ? LAYOUTS.AtEnds : layout;
    };

    /**
     * Gets the room to keep right of the plot for the names at the lines' ends, from an estimate
     * of the longest name's width, as the names cannot be measured before the chart is drawn.
     */
    const getReservedWidthPx = (props) => {

        if (getEffectiveLayout(props) !== LAYOUTS.AtEnds) return 0;

        const indexes = getNamedLineIndexes(props);
        const fontScale = getFontSizePx(props) / 12;
        let widestPx = 0;

        for (let i = 0; i < indexes.length; i++) {

            const widthPx = Ren.TextUtils.measureText(getName(props, indexes[i])) * fontScale;

            if (widthPx > widestPx) widestPx = widthPx;
        }

        return END_GAP_PX + Math.ceil(Math.min(widestPx, MAX_END_COLUMN_WIDTH_PX));
    };

    /**
     * Keeps the course one line is drawn along, in plot coordinates, for its name to be placed by.
     * Each run of plotted points is a list of [x, y], and a stepped line's runs are flat across
     * each period, as it is drawn.
     *
     * @param {function} valueFn - Gets the height a row is drawn at, its stacked top if stacked.
     * @param {function} [stepEdgesFn] - Gets a row's period's [startX, endX], for a stepped line.
     */
    const recordLine = (props, seriesIndex, data, valueFn, crossValueFn, yScale, stepEdgesFn) => {

        if (!props.lineNamePaths) props.lineNamePaths = [];

        const runs = [];
        let run = null;

        for (let index = 0; index < data.length; index++) {

            const d = data[index];
            const crossValue = crossValueFn(d);
            const value = valueFn(d);

            if (crossValue == null || value == null) {

                run = null;
                continue;
            }

            if (run === null) {

                run = [];
                runs.push(run);
            }

            const y = yScale.getPixel(value);

            if (stepEdgesFn) {

                const edges = stepEdgesFn(d);
                run.push([edges[0], y]);
                run.push([edges[1], y]);
            }
            else {

                run.push([props.xScale.getPixel(crossValue), y]);
            }
        }

        props.lineNamePaths[seriesIndex] = runs;
    };

    /**
     * Draws the names, unplaced, of the lines there are to name.  Each goes into a group carrying
     * its series' class and number, so that it fades with its series, and clicking or hovering
     * it does what clicking or hovering the line does.
     */
    const render = (props) => {

        if (!props.chartGroup) return;

        props.chartGroup.querySelector("." + LAYER_CLASS)?.remove();

        if (getEffectiveLayout(props) === LAYOUTS.Off || !props.lineNamePaths) return;

        const indexes = getNamedLineIndexes(props);
        const layer = Ren.Svg.append(props.chartGroup, "g", { "class": LAYER_CLASS });

        for (let i = 0; i < indexes.length; i++) {

            const seriesIndex = indexes[i];
            const runs = props.lineNamePaths[seriesIndex];

            if (!runs || !runs.length) continue;

            const name = getName(props, seriesIndex);
            const seriesGroup = Ren.Svg.append(layer, "g", {
                "class": `ren-series-${seriesIndex + 1}`,
                "data-series": seriesIndex + 1
            });

            seriesGroup.style.display = "none";

            Ren.Svg.append(seriesGroup, "line", { "class": CONNECTOR_CLASS });

            const text = Ren.Svg.append(seriesGroup, "text", {
                "class": NAME_CLASS,
                [FULL_NAME_ATTRIBUTE]: name
            });

            text.textContent = name ?? "";

            Ren.DateValueChart_OtherSeries.addTooltip(text, props, seriesIndex);
        }
    };

    /** Raises the names above the value labels, as a name is placed clear of them. */
    const raiseLayer = (props) => {

        if (!props.chartGroup) return;

        const layer = props.chartGroup.querySelector("." + LAYER_CLASS);
        if (layer) layer.parentNode.appendChild(layer);
    };

    /**
     * Builds the unscoped rules colouring a series' name and its connector.  A light colour is
     * darkened for the name, which would otherwise be hard to read on the plot.
     */
    const buildColourStyles = (seriesClass, colour) => {

        const brightness = Ren.Colours.brightnessOfColour(colour);
        const nameColour = brightness !== null && brightness > MAX_NAME_BRIGHTNESS
            ? Ren.Colours.scaleBrightness(colour, LIGHT_COLOUR_DARKENING)
            : colour;

        return [
            `.${LAYER_CLASS} > ${seriesClass} .${NAME_CLASS} { fill: ${nameColour} }`,
            `.${LAYER_CLASS} > ${seriesClass} .${CONNECTOR_CLASS} { stroke: ${colour} }`
        ];
    };

    /** Builds the unscoped rules styling every name and connector. */
    const buildStyles = (props) => [
        `.${NAME_CLASS} { font-size: ${getFontSizePx(props)}px; font-weight: 600; `
            + "dominant-baseline: central; paint-order: stroke; stroke: white; "
            + "stroke-width: 3px; stroke-linejoin: round; cursor: pointer }",
        `.${CONNECTOR_CLASS} { stroke-width: 1px; stroke-opacity: 0.6; pointer-events: none }`
    ];

    /**
     * Measures a name, drawn in full with an ellipsis after it: its height, its whole width, and
     * the length of each leading run of its characters with the ellipsis, where prefixLengths[n]
     * is the length of the first n characters and an ellipsis.  Gets null where it is not shown.
     */
    const measureName = (textNode, fullName) => {

        try {

            const box = textNode.getBBox();

            if (!box.width) return null;

            const ellipsisLength = textNode.getSubStringLength(fullName.length, 1);
            const prefixLengths = [];

            for (let i = 1; i < fullName.length; i++) {

                prefixLengths[i] = textNode.getSubStringLength(0, i) + ellipsisLength;
            }

            prefixLengths[fullName.length] = box.width - ellipsisLength;

            return { height: box.height, prefixLengths: prefixLengths };
        }
        catch (error) {

            return null;
        }
    };

    /**
     * Gets the text to show for a name in a width, shortened to end in an ellipsis where the whole
     * name is too long, or null where not even one character and an ellipsis fit.
     */
    const fitName = (fullName, prefixLengths, availableWidthPx) => {

        if (prefixLengths[fullName.length] <= availableWidthPx) return fullName;

        for (let count = fullName.length - 1; count >= 1; count--) {

            if (prefixLengths[count] <= availableWidthPx) {

                return fullName.substring(0, count).replace(/\s+$/, "") + ELLIPSIS;
            }
        }

        return null;
    };

    /** Gets a line's runs moved into the chart group's units. */
    const scaleRuns = (runs, scaleX, scaleY) => {

        const scaledRuns = [];

        for (let i = 0; i < runs.length; i++) {

            const scaledRun = [];

            for (let j = 0; j < runs[i].length; j++) {

                scaledRun.push([runs[i][j][0] * scaleX, runs[i][j][1] * scaleY]);
            }

            scaledRuns.push(scaledRun);
        }

        return scaledRuns;
    };

    /**
     * Gets the lowest and highest y a line reaches between two x positions, or null where it does
     * not pass between them.  A run of a single point is taken as reaching only its own x.
     */
    const getYRangeBetween = (runs, left, right) => {

        let minY = Infinity;
        let maxY = -Infinity;

        const include = (y) => {

            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        };

        for (let i = 0; i < runs.length; i++) {

            const run = runs[i];

            if (run.length === 1) {

                if (run[0][0] >= left && run[0][0] <= right) include(run[0][1]);
                continue;
            }

            for (let j = 1; j < run.length; j++) {

                const x0 = run[j - 1][0];
                const y0 = run[j - 1][1];
                const x1 = run[j][0];
                const y1 = run[j][1];
                const segmentLeft = Math.min(x0, x1);
                const segmentRight = Math.max(x0, x1);

                if (segmentRight < left || segmentLeft > right) continue;

                // A vertical step reaches its whole height at its x.
                if (x0 === x1) {

                    include(y0);
                    include(y1);
                    continue;
                }

                const clippedLeft = Math.max(left, segmentLeft);
                const clippedRight = Math.min(right, segmentRight);
                const slope = (y1 - y0) / (x1 - x0);

                include(y0 + (clippedLeft - x0) * slope);
                include(y0 + (clippedRight - x0) * slope);
            }
        }

        return minY === Infinity ? null : { min: minY, max: maxY };
    };

    /** Gets a value indicating whether two rectangles overlap. */
    const rectsOverlap = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    /**
     * Gets the shown value labels' boxes in the chart group's units.  They are read off the page,
     * so are moved into the names layer's units by a probe drawn in it, which also undoes any
     * zoom the chart is shown at.
     */
    const getValueLabelRects = (props, layerNode) => {

        const labelsLayer = props.chartGroup.querySelector(
            "." + Ren.DateValueChart_RenderValueLabels.LABELS_LAYER_CLASS
        );

        if (!labelsLayer) return [];

        const probe = Ren.Svg.append(layerNode, "rect", {
            "width": PROBE_SIZE,
            "height": PROBE_SIZE
        });

        probe.style.visibility = "hidden";

        const probeRect = probe.getBoundingClientRect();
        probe.remove();

        if (!probeRect.width || !probeRect.height) return [];

        const unitsPerPxX = PROBE_SIZE / probeRect.width;
        const unitsPerPxY = PROBE_SIZE / probeRect.height;
        const wrapperNodes = labelsLayer.querySelectorAll(".ren-text-wrapper");
        const rects = [];

        for (let i = 0; i < wrapperNodes.length; i++) {

            const rect = wrapperNodes[i].getBoundingClientRect();

            if (!rect.width || !rect.height) continue;

            rects.push({
                left: (rect.left - probeRect.left) * unitsPerPxX,
                right: (rect.right - probeRect.left) * unitsPerPxX,
                top: (rect.top - probeRect.top) * unitsPerPxY,
                bottom: (rect.bottom - probeRect.top) * unitsPerPxY
            });
        }

        return rects;
    };

    const showName = (name, text, x, y, anchor) => {

        name.groupNode.style.display = "";
        name.textNode.textContent = text;
        name.textNode.setAttribute("x", x);
        name.textNode.setAttribute("y", y);
        name.textNode.setAttribute("text-anchor", anchor);
    };

    const hideConnector = (name) => {

        name.connectorNode.style.display = "none";
    };

    /**
     * Places the names in a column right of the plot, each as near level with its line's last
     * point as the others let it be, with a faint connector from that point where the name does
     * not sit right beside it.  Names that cannot all be stacked in the plot's height are hidden,
     * the lowest first.
     */
    const layoutAtEnds = (props, names, result) => {

        const plotWidthPx = props.innerWidth * props.scaleX;
        const plotHeightPx = props.innerHeight * props.scaleY;
        const nameX = plotWidthPx + END_GAP_PX;
        const availableWidthPx = props.margin.right - END_GAP_PX;
        const stacked = [];

        for (let i = 0; i < names.length; i++) {

            const name = names[i];
            const runs = name.runs;
            const lastRun = runs[runs.length - 1];
            const lastPoint = lastRun[lastRun.length - 1];
            const text = fitName(name.fullName, name.measurement.prefixLengths, availableWidthPx);

            if (text === null) {

                result.hidden++;
                continue;
            }

            name.text = text;
            name.endX = lastPoint[0];
            name.endY = lastPoint[1];
            name.centreY = lastPoint[1];
            stacked.push(name);
        }

        stacked.sort((a, b) => a.endY - b.endY);

        const getSpacing = (a, b) => (a.measurement.height + b.measurement.height) / 2
            + END_NAME_SPACING_PX;

        // Drops the lowest name while the rest are too tall for the plot together.
        while (stacked.length) {

            let totalHeight = 0;

            for (let i = 0; i < stacked.length; i++) {
                totalHeight += stacked[i].measurement.height + END_NAME_SPACING_PX;
            }

            if (totalHeight <= plotHeightPx + END_NAME_SPACING_PX) break;

            stacked.pop();
            result.hidden++;
        }

        if (!stacked.length) return;

        // Pushed down clear of the name above, then back up clear of the plot's foot and the
        // name below, then down clear of its top.
        const first = stacked[0];
        first.centreY = Math.max(first.centreY, first.measurement.height / 2);

        for (let i = 1; i < stacked.length; i++) {

            stacked[i].centreY = Math.max(
                stacked[i].centreY,
                stacked[i - 1].centreY + getSpacing(stacked[i - 1], stacked[i])
            );
        }

        const last = stacked[stacked.length - 1];
        last.centreY = Math.min(last.centreY, plotHeightPx - last.measurement.height / 2);

        for (let i = stacked.length - 2; i >= 0; i--) {

            stacked[i].centreY = Math.min(
                stacked[i].centreY,
                stacked[i + 1].centreY - getSpacing(stacked[i], stacked[i + 1])
            );
        }

        first.centreY = Math.max(first.centreY, first.measurement.height / 2);

        for (let i = 0; i < stacked.length; i++) {

            const name = stacked[i];

            showName(name, name.text, nameX, name.centreY, "start");

            const connectorNode = name.connectorNode;
            const startX = name.endX + LINE_CLEARANCE_PX;
            const endX = nameX - LINE_CLEARANCE_PX;

            if (endX - startX > LINE_CLEARANCE_PX || Math.abs(name.centreY - name.endY) > 1) {

                connectorNode.style.display = "";
                connectorNode.setAttribute("x1", startX);
                connectorNode.setAttribute("y1", name.endY);
                connectorNode.setAttribute("x2", endX);
                connectorNode.setAttribute("y2", name.centreY);
            }
            else {

                hideConnector(name);
            }

            result.placed++;
            result.placements.push({
                seriesIndex: name.seriesIndex,
                text: name.text,
                x: nameX,
                y: name.centreY
            });
        }
    };

    /**
     * Gets the best box for a name along its own line, just above or below it, that no other line
     * crosses and that runs into no value label or name already placed, or null where it fits
     * nowhere.  A box is better the further it stands from the other lines, and the flatter its
     * own line runs beneath it, and a little better the further right it is, as a line is usually
     * read for where it has got to.
     */
    const findPlaceAlongLine = (name, otherRuns, obstacles, plotWidthPx, plotHeightPx) => {

        const width = name.width;
        const height = name.measurement.height;
        const runs = name.runs;

        let lineLeft = Infinity;
        let lineRight = -Infinity;

        for (let i = 0; i < runs.length; i++) {

            for (let j = 0; j < runs[i].length; j++) {

                lineLeft = Math.min(lineLeft, runs[i][j][0]);
                lineRight = Math.max(lineRight, runs[i][j][0]);
            }
        }

        lineLeft = Math.max(lineLeft, 0);
        lineRight = Math.min(lineRight, plotWidthPx);

        if (lineRight - lineLeft < width) return null;

        const steps = Math.max(1, CANDIDATE_COUNT - 1);
        const stride = (lineRight - lineLeft - width) / steps;
        let best = null;

        for (let step = 0; step <= steps; step++) {

            const left = lineLeft + stride * step;
            const right = left + width;
            const own = getYRangeBetween(runs, left, right);

            if (own === null) continue;

            const candidates = [
                { top: own.min - LINE_CLEARANCE_PX - height, bottom: own.min - LINE_CLEARANCE_PX },
                { top: own.max + LINE_CLEARANCE_PX, bottom: own.max + LINE_CLEARANCE_PX + height }
            ];

            for (let c = 0; c < candidates.length; c++) {

                const box = {
                    left: left,
                    right: right,
                    top: candidates[c].top,
                    bottom: candidates[c].bottom
                };

                if (box.top < 0 || box.bottom > plotHeightPx) continue;

                let isBlocked = false;
                let nearestGap = height * 3;

                for (let k = 0; k < otherRuns.length && !isBlocked; k++) {

                    const other = getYRangeBetween(otherRuns[k], left, right);

                    if (other === null) continue;

                    const gap = other.min >= box.bottom
                        ? other.min - box.bottom
                        : (other.max <= box.top ? box.top - other.max : -1);

                    if (gap < LINE_CLEARANCE_PX) {

                        isBlocked = true;
                        break;
                    }

                    if (gap < nearestGap) nearestGap = gap;
                }

                for (let k = 0; k < obstacles.length && !isBlocked; k++) {

                    if (rectsOverlap(box, obstacles[k])) isBlocked = true;
                }

                if (isBlocked) continue;

                const score = nearestGap
                    - (own.max - own.min) * 0.5
                    + (left / plotWidthPx) * height * 0.5;

                if (best === null || score > best.score) {

                    best = { box: box, score: score };
                }
            }
        }

        return best ? best.box : null;
    };

    /** Places each name on the plot, beside its own line, where it is clear of everything else. */
    const layoutAlongLines = (props, names, unnamedRuns, layerNode, result) => {

        const plotWidthPx = props.innerWidth * props.scaleX;
        const plotHeightPx = props.innerHeight * props.scaleY;
        const obstacles = getValueLabelRects(props, layerNode);

        for (let i = 0; i < names.length; i++) {

            const name = names[i];
            name.width = name.measurement.prefixLengths[name.fullName.length];

            const otherRuns = [];

            for (let j = 0; j < names.length; j++) {

                if (j !== i) otherRuns.push(names[j].runs);
            }

            // A line with no name shown still has to be kept clear of.
            for (let j = 0; j < unnamedRuns.length; j++) {
                otherRuns.push(unnamedRuns[j]);
            }

            const box = findPlaceAlongLine(name, otherRuns, obstacles, plotWidthPx, plotHeightPx);

            hideConnector(name);

            if (box === null) {

                result.hidden++;
                continue;
            }

            const x = (box.left + box.right) / 2;
            const y = (box.top + box.bottom) / 2;

            showName(name, name.fullName, x, y, "middle");
            obstacles.push(box);

            result.placed++;
            result.placements.push({
                seriesIndex: name.seriesIndex,
                text: name.fullName,
                x: x,
                y: y
            });
        }
    };

    /**
     * Places a chart's line names.  All measuring is done before any name is placed.
     *
     * @returns {object} { layout, placed, hidden, placements }, for the QA hooks.
     */
    const layout = (props) => {

        const result = { layout: LAYOUTS.Off, placed: 0, hidden: 0, placements: [] };
        lastResult = result;

        if (!props || !props.chartGroup || !props.scaleX || !props.scaleY) return result;

        const layerNode = props.chartGroup.querySelector("." + LAYER_CLASS);

        if (!layerNode || !props.lineNamePaths) return result;

        const groupNodes = layerNode.querySelectorAll(":scope > g[data-series]");

        if (!groupNodes.length) return result;

        result.layout = getEffectiveLayout(props);

        const names = [];

        for (let i = 0; i < groupNodes.length; i++) {

            const groupNode = groupNodes[i];
            const textNode = groupNode.querySelector("." + NAME_CLASS);
            const fullName = textNode.getAttribute(FULL_NAME_ATTRIBUTE);

            // Shown to be measured, and with the ellipsis after the full name so that one layout
            // measures both.
            groupNode.style.display = "";
            textNode.textContent = fullName + ELLIPSIS;

            names.push({
                seriesIndex: Number(groupNode.getAttribute("data-series")) - 1,
                groupNode: groupNode,
                textNode: textNode,
                connectorNode: groupNode.querySelector("." + CONNECTOR_CLASS),
                fullName: fullName
            });
        }

        for (let i = 0; i < names.length; i++) {

            names[i].measurement = measureName(names[i].textNode, names[i].fullName);
            names[i].groupNode.style.display = "none";
        }

        const namedIndexes = {};
        const measuredNames = [];

        for (let i = 0; i < names.length; i++) {

            const name = names[i];
            const runs = props.lineNamePaths[name.seriesIndex];

            namedIndexes[name.seriesIndex] = true;

            if (!name.measurement || !runs || !runs.length) {

                result.hidden++;
                continue;
            }

            name.runs = scaleRuns(runs, props.scaleX, props.scaleY);
            measuredNames.push(name);
        }

        const unnamedRuns = [];

        for (let i = 0; i < props.lineNamePaths.length; i++) {

            const runs = props.lineNamePaths[i];

            if (runs && !namedIndexes[i]) {
                unnamedRuns.push(scaleRuns(runs, props.scaleX, props.scaleY));
            }
        }

        if (result.layout === LAYOUTS.AtEnds) {

            layoutAtEnds(props, measuredNames, result);
        }
        else if (result.layout === LAYOUTS.AlongLines) {

            layoutAlongLines(props, measuredNames, unnamedRuns, layerNode, result);
        }

        return result;
    };

    return {
        LAYOUTS,
        LAYER_CLASS,
        NAME_CLASS,
        DEFAULT_FONT_SIZE_PX,
        getLayout,
        getEffectiveLayout,
        getReservedWidthPx,
        recordLine,
        render,
        raiseLayer,
        buildColourStyles,
        buildStyles,
        layout,
        getDiagnostics
    };
})();
