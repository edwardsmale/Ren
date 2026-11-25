/**
 * Labels the slices of a chart drawn as pies, with any of each slice's series name, value and
 * share of its pie, and writes each pie's total in its hole.  The value and share go after the
 * name, on a line below it, or, where the labels are outside the pies, inside the slice, on a
 * background of the slice's colour, so that they stay legible across any bands subdividing it.  A
 * label goes inside its slice where it fits, or outside the pie at the end of a short connector,
 * where it runs into nothing else.
 * Around, the labels are stacked in a column either side of each pie instead, each joined to its
 * slice by an elbowed connector, and the pies are shrunk to leave the columns room.  A label
 * there is no room for is hidden.  The labels of the bands subdividing the slices can be stacked
 * with them, joined to their bands.
 *
 * The labels are drawn with the pies and placed once the style updater has scaled the chart, as
 * only then are the pies' on-screen sizes known.  They go into a layer of their own that is not
 * scaled with the plot, so are placed in the chart group's own (screen pixel) units.
 */
Ren.DateValueChart_PieLabels = (() => {

    const {
        PLACEMENTS, VALUE_POSITIONS, DEFAULT_FONT_SIZE_PX, getPlacement, getContent, areLabelsShown,
        areTotalsShown, canPutSharesInside, areSharesInside, getValuePosition, areValuesInside,
        isStackedPlacement, getFontSizePx, formatShare, formatValue, addTooltip, getLabelText,
        getLabelLines
    } = Ren.DateValueChart_PieLabelContent;

    const {
        INSIDE_CLASS, ELLIPSIS, writeLines, setFirstLine, showLabel, showConnector, fitText,
        measureForShortening
    } = Ren.DateValueChart_PieLabelDrawing;

    const {
        measure, isBoxInSlice, findPlaceInside, findPlaceOutside
    } = Ren.DateValueChart_PieLabelGeometry;

    const {
        toCalloutWidthPx, getMinCalloutWidthPx, getRadiusPx, getHuggingEdgeX, layoutStacked
    } = Ren.DateValueChart_PieLabelStacks;

    const {
        layoutTotals, getShareCandidates, layoutShares
    } = Ren.DateValueChart_PieLabelTotalsAndShares;

    const LAYER_CLASS = "ren-pie-labels-layer";
    const LABEL_CLASS = "ren-pie-label";
    const SUBDIVISION_CLASS = "ren-pie-label--subdivision";
    const CONNECTOR_CLASS = "ren-pie-label-connector";
    const TOTAL_CLASS = "ren-pie-total";
    const OTHER_CLASS = "ren-pie-labels--other";
    const SHARE_BACKGROUND_CLASS = "ren-pie-share-background";

    const SHARE_BACKGROUND_RADIUS_PX = 2;

    // A light series colour takes dark labels inside its slices.
    const MAX_WHITE_LABEL_BRIGHTNESS = 160;

    /**
     * Draws the labels and totals, unplaced.  Each label goes into a group carrying its series'
     * class and number, so that it fades with its series.
     */
    const render = (props, pies) => {

        const subdivisionLabels = Ren.DateValueChart_SeriesSubdivisions.takeAroundLabels(props);

        if (!props.chartGroup) return;

        props.chartGroup.querySelector("." + LAYER_CLASS)?.remove();
        props.pieLabelNodes = [];
        props.pieShareNodes = [];
        props.pieTotalNodes = [];
        props.pieCalloutWidthPx = 0;
        props.pieCalloutMinWidthPx = null;
        props.pieCalloutMinWidthEstimatePx = 0;

        const showLabels = areLabelsShown(props);
        const showTotals = areTotalsShown(props);

        if (!showLabels && !showTotals && !subdivisionLabels.length) return;

        const layer = Ren.Svg.append(props.chartGroup, "g", { "class": LAYER_CLASS });
        const seriesGroups = {};
        const content = getContent(props);
        const sharesInside = areSharesInside(props);
        const valuesInside = areValuesInside(props);

        // The value and share are left off the label outside where they are written inside.
        const outsideContent = {
            names: content.names,
            values: content.values && !valuesInside,
            percentages: content.percentages && !sharesInside
        };

        const getSeriesGroup = (seriesIndex) => {

            if (!seriesGroups[seriesIndex]) {

                const OtherSeries = Ren.DateValueChart_OtherSeries;
                const isOther = OtherSeries.isOtherSeries(props, seriesIndex + 1);

                seriesGroups[seriesIndex] = Ren.Svg.append(layer, "g", {
                    "class": `ren-series-${seriesIndex + 1}` + (isOther ? " " + OTHER_CLASS : ""),
                    "data-series": seriesIndex + 1
                });

                OtherSeries.addTooltip(seriesGroups[seriesIndex], props, seriesIndex);
            }

            return seriesGroups[seriesIndex];
        };

        // The first series' format stands for the total's, the series being split from one value.
        const totalFormat = pies.length && pies[0].slices.length
            ? props.valueColumnFormats[pies[0].slices[0].seriesIndex]
            : undefined;

        const totalFormats = Ren.DateValueChart_ValueFormats.getPieTotalFormats(props, totalFormat);

        const formatTotal = (total) => totalFormats
            ? String(Ren.ValueFormatter.formatValue(
                total,
                null,
                totalFormats.format,
                totalFormats.formatFunction
            ) ?? "")
            : Ren.ValueFormatter.formatValueSimple(total, totalFormat);

        // Tried where a total doesn't fit its hole as it is.  A total is a number, whatever the
        // format of the column it's summed from.
        const shownTotalFormat = totalFormats?.format ?? totalFormat;
        const shortTotalFormats = Ren.DateValueChart_ValueFormats.getAbbreviatedFormats(
            props,
            shownTotalFormat === undefined || shownTotalFormat === Ren.SpreadsheetColumnFormatEnum.General
                ? Ren.SpreadsheetColumnFormatEnum.Number
                : shownTotalFormat
        );

        const formatShortTotal = (total) => shortTotalFormats
            ? String(Ren.ValueFormatter.formatValue(
                total,
                null,
                shortTotalFormats.format,
                shortTotalFormats.formatFunction
            ) ?? "")
            : null;

        const isStacked = showLabels && isStackedPlacement(getPlacement(props));
        const fontScale = getFontSizePx(props) / 12;
        let widestTextPx = 0;
        let widestRestTextPx = 0;

        for (let pieIndex = 0; pieIndex < pies.length; pieIndex++) {

            const pie = pies[pieIndex];

            if (showTotals) {

                const totalNode = Ren.Svg.append(layer, "text", { "class": TOTAL_CLASS });

                const text = formatTotal(pie.total);
                const shortText = formatShortTotal(pie.total);

                totalNode.textContent = text;
                totalNode.style.display = "none";

                props.pieTotalNodes.push({
                    pie,
                    textNode: totalNode,
                    texts: shortText && shortText !== text ? [text, shortText] : [text]
                });
            }

            if (!showLabels) continue;

            for (let i = 0; i < pie.slices.length; i++) {

                const slice = pie.slices[i];

                // In a group of its own, so that it is kept where the label outside is dropped.
                if (sharesInside || valuesInside) {

                    const shareGroupNode = Ren.Svg.append(getSeriesGroup(slice.seriesIndex), "g");
                    const backgroundNode = Ren.Svg.append(shareGroupNode, "rect", {
                        "class": SHARE_BACKGROUND_CLASS,
                        "rx": SHARE_BACKGROUND_RADIUS_PX
                    });
                    const shareNode = Ren.Svg.append(shareGroupNode, "text", {
                        "class": LABEL_CLASS
                    });

                    shareGroupNode.style.display = "none";
                    addTooltip(shareGroupNode, props, slice);

                    props.pieShareNodes.push({
                        pie,
                        slice,
                        groupNode: shareGroupNode,
                        backgroundNode,
                        textNode: shareNode,
                        valueText: valuesInside ? formatValue(props, slice) : null,
                        hasShare: sharesInside
                    });
                }

                const lines = getLabelLines(props, outsideContent, slice);

                if (!lines.length) continue;

                const groupNode = Ren.Svg.append(getSeriesGroup(slice.seriesIndex), "g");
                const connectorNode = Ren.Svg.append(groupNode, "polyline", {
                    "class": CONNECTOR_CLASS
                });
                const textNode = Ren.Svg.append(groupNode, "text", { "class": LABEL_CLASS });

                writeLines(textNode, lines);

                if (isStacked) {

                    for (let j = 0; j < lines.length; j++) {

                        const widthPx = Ren.TextUtils.measureText(lines[j]);

                        widestTextPx = Math.max(widestTextPx, widthPx);

                        if (j > 0) widestRestTextPx = Math.max(widestRestTextPx, widthPx);
                    }
                }

                groupNode.style.display = "none";
                addTooltip(groupNode, props, slice);

                props.pieLabelNodes.push({
                    pie,
                    slice,
                    groupNode,
                    connectorNode,
                    textNode,
                    lines
                });
            }
        }

        for (let i = 0; i < subdivisionLabels.length; i++) {

            const label = subdivisionLabels[i];
            const groupNode = Ren.Svg.append(getSeriesGroup(label.seriesIndex), "g");
            const connectorNode = Ren.Svg.append(groupNode, "polyline", {
                "class": CONNECTOR_CLASS
            });
            const textNode = Ren.Svg.append(groupNode, "text", {
                "class": `${LABEL_CLASS} ${SUBDIVISION_CLASS}`
            });

            writeLines(textNode, [label.fullText]);
            groupNode.style.display = "none";
            Ren.Svg.append(groupNode, "title").textContent = label.title;

            // A click on the label is one on its band, as a click inside its pie would be.
            Ren.Svg.setDatum(groupNode, label.row);
            Ren.DateValueChart_SeriesSubdivisions.setMarkSubdivision(textNode, label.subdivision);

            widestTextPx = Math.max(widestTextPx, Ren.TextUtils.measureText(label.fullText));

            props.pieLabelNodes.push({
                pie: label.pie,
                slice: {
                    seriesIndex: label.seriesIndex,
                    share: (label.endAngle - label.startAngle) / (Math.PI * 2),
                    startAngle: label.startAngle,
                    endAngle: label.endAngle
                },
                isSubdivision: true,
                groupNode,
                connectorNode,
                textNode,
                lines: [label.fullText]
            });
        }

        // An estimate, as the labels cannot be measured before the chart is drawn, of the room
        // the pies are to leave either side for the labels stacked beside them.
        if ((isStacked || subdivisionLabels.length) && widestTextPx > 0) {

            props.pieCalloutWidthPx = toCalloutWidthPx(widestTextPx * fontScale);

            // The least room that leaves the lines after the first, which can't be shortened,
            // estimated until they can be measured (see getMinCalloutWidthPx).
            props.pieCalloutMinWidthEstimatePx = widestRestTextPx > 0
                ? toCalloutWidthPx(widestRestTextPx * fontScale)
                : 0;
        }
    };

    /**
     * Places a chart's slice labels and pie totals.  All measuring is done before any label is
     * placed.  Auto puts each label inside its slice where it fits and outside otherwise, the
     * biggest slices' first.  Subdivision labels stacked around the pies are placed first, with
     * the slices' own where those are stacked too, and the rest kept clear of them.
     *
     * @returns {object} { placement, inside, outside, subdivisions, hidden, totals }.
     */
    const layout = (props) => {

        const result = {
            placement: PLACEMENTS.Off,
            inside: 0,
            outside: 0,
            subdivisions: 0,
            hidden: 0,
            totals: 0
        };

        if (!props || !props.chartGroup || !props.scaleX || !props.scaleY) return result;
        if (!Ren.DateValueChart_Pies.hasPies(props)) return result;

        const radiusPx = Ren.DateValueChart_Pies.getRadiusPx(props, props.scaleX, props.scaleY);
        const holePx = radiusPx * Ren.DateValueChart_Pies.getHoleRadius(props);

        layoutTotals(props, holePx, result);
        layoutShares(props, holePx, radiusPx, result);

        const labelNodes = props.pieLabelNodes || [];

        if (!labelNodes.length) return result;

        result.placement = getPlacement(props);

        // Stacked, a label's first line may be shortened, so is measured with the ellipsis after
        // it.  Subdivision labels are always stacked.
        const isStacked = isStackedPlacement(result.placement);
        const isLabelStacked = (label) => isStacked || label.isSubdivision === true;

        const labels = [];

        // Shown to be measured, then hidden until placed.  A series' labels are left hidden
        // where its value labels are turned off, though not its subdivisions'.
        for (let i = 0; i < labelNodes.length; i++) {

            const label = labelNodes[i];

            if (!label.isSubdivision
                && props.series[label.slice.seriesIndex].showValueLabels === false) {

                label.groupNode.style.display = "none";
                continue;
            }

            label.groupNode.style.display = "";
            labels.push(label);
        }

        for (let i = 0; i < labels.length; i++) {

            const suffix = isLabelStacked(labels[i]) ? ELLIPSIS : "";

            setFirstLine(labels[i].textNode, labels[i].lines[0] + suffix);
        }

        for (let i = 0; i < labels.length; i++) {

            labels[i].size = isLabelStacked(labels[i])
                ? measureForShortening(labels[i].textNode, labels[i].lines[0])
                : measure(labels[i].textNode);
        }

        for (let i = 0; i < labels.length; i++) {

            setFirstLine(labels[i].textNode, labels[i].lines[0]);
            labels[i].groupNode.style.display = "none";
        }

        const centres = [];
        const pies = props.pieLayout || [];

        for (let i = 0; i < pies.length; i++) {

            pies[i].screenCentre = {
                x: pies[i].centreX * props.scaleX,
                y: pies[i].centreY * props.scaleY
            };
            centres.push(pies[i].screenCentre);
        }

        const stackedLabels = [];
        const unstackedLabels = [];

        for (let i = 0; i < labels.length; i++) {

            if (labels[i].size === null) {
                result.hidden++;
            }
            else if (isLabelStacked(labels[i])) {

                stackedLabels.push(labels[i]);
            }
            else {

                unstackedLabels.push(labels[i]);
            }
        }

        // Stacked labels hug the pies, but where the slices' own are around them, in columns.
        const placedBoxes = [];

        layoutStacked(
            props,
            stackedLabels,
            radiusPx,
            result.placement !== PLACEMENTS.Around,
            result,
            placedBoxes
        );

        const outsideLabels = [];

        for (let i = 0; i < unstackedLabels.length; i++) {

            const label = unstackedLabels[i];

            if (result.placement !== PLACEMENTS.Outside) {

                const box = findPlaceInside(label, label.pie.screenCentre, holePx, radiusPx);

                if (box !== null) {

                    showLabel(label, box, true);
                    label.connectorNode.style.display = "none";
                    result.inside++;
                    continue;
                }

                if (result.placement === PLACEMENTS.Inside) {

                    result.hidden++;
                    continue;
                }
            }

            outsideLabels.push(label);
        }

        outsideLabels.sort((a, b) => b.slice.share - a.slice.share);

        const plotWidthPx = props.innerWidth * props.scaleX;
        const plotHeightPx = Ren.DateValueChart_Pies.getBandHeight(props) * props.scaleY;

        for (let i = 0; i < outsideLabels.length; i++) {

            const label = outsideLabels[i];
            const place = findPlaceOutside(
                label,
                label.pie.screenCentre,
                centres,
                radiusPx,
                placedBoxes,
                plotWidthPx,
                plotHeightPx
            );

            if (place === null) {

                result.hidden++;
                continue;
            }

            showLabel(label, place.box, false);
            showConnector(label, [[place.startX, place.startY], [place.endX, place.endY]]);

            placedBoxes.push(place.box);
            result.outside++;
        }

        return result;
    };

    /**
     * Builds the unscoped rules colouring a series' labels inside its slices, dark on a light
     * colour, their backgrounds, as the slices are coloured, and its connectors.
     */
    const buildColourStyles = (seriesClass, colour, filter) => {

        const brightness = Ren.Colours.brightnessOfColour(colour);
        const insideColour = brightness !== null && brightness > MAX_WHITE_LABEL_BRIGHTNESS
            ? "#222"
            : "white";

        return [
            `.${LAYER_CLASS} > ${seriesClass} .${INSIDE_CLASS} { fill: ${insideColour} }`,
            `.${LAYER_CLASS} > ${seriesClass} .${SHARE_BACKGROUND_CLASS} `
                + `{ fill: ${colour}; filter: ${filter || "none"} }`,
            `.${LAYER_CLASS} > ${seriesClass} .${CONNECTOR_CLASS} { stroke: ${colour} }`
        ];
    };

    /** Builds the unscoped rules styling every label, connector and total. */
    const buildStyles = (props) => {

        const fontSizePx = getFontSizePx(props);

        return [
            `.${LABEL_CLASS}, .${TOTAL_CLASS} { font-size: ${fontSizePx}px; `
                + "dominant-baseline: central; text-anchor: middle; pointer-events: none; "
                + "fill: #333; paint-order: stroke; stroke: white; stroke-width: 3px; "
                + "stroke-linejoin: round }",
            // Hovered for their tooltips (see addTooltip).
            `.${LABEL_CLASS} { pointer-events: auto }`,
            `.${TOTAL_CLASS} { font-size: ${Math.round(fontSizePx * 1.2)}px; font-weight: 600 }`,
            `.${LABEL_CLASS} tspan { dominant-baseline: central }`,
            `.${LABEL_CLASS}.${INSIDE_CLASS} { stroke: none; fill: white }`,
            `.${SHARE_BACKGROUND_CLASS} { pointer-events: none }`,
            `.${CONNECTOR_CLASS} { fill: none; stroke-width: 1px; stroke-opacity: 0.7; `
                + "stroke-linejoin: round; pointer-events: none }"
        ];
    };

    return {
        PLACEMENTS,
        VALUE_POSITIONS,
        LAYER_CLASS,
        DEFAULT_FONT_SIZE_PX,
        getPlacement,
        getContent,
        areLabelsShown,
        areTotalsShown,
        canPutSharesInside,
        areSharesInside,
        getValuePosition,
        areValuesInside,
        formatShare,
        getShareCandidates,
        getLabelText,
        getLabelLines,
        isBoxInSlice,
        fitText,
        getHuggingEdgeX,
        render,
        getRadiusPx,
        layout,
        buildColourStyles,
        buildStyles
    };
})();
