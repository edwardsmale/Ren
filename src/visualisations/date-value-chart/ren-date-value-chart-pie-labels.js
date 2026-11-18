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

    const PLACEMENTS = {
        Auto: "auto",
        Inside: "inside",
        Outside: "outside",
        Around: "around",
        Off: "off"
    };

    // Where a label's value goes: after its name, on a line of its own below it, or inside its
    // slice, apart from the rest of the label outside the pie.
    const VALUE_POSITIONS = {
        Inline: "inline",
        Below: "below",
        Inside: "inside"
    };

    const LAYER_CLASS = "ren-pie-labels-layer";
    const LABEL_CLASS = "ren-pie-label";
    const INSIDE_CLASS = "ren-pie-label--inside";
    const SUBDIVISION_CLASS = "ren-pie-label--subdivision";
    const CONNECTOR_CLASS = "ren-pie-label-connector";
    const TOTAL_CLASS = "ren-pie-total";
    const OTHER_CLASS = "ren-pie-labels--other";
    const SHARE_BACKGROUND_CLASS = "ren-pie-share-background";

    const DEFAULT_FONT_SIZE_PX = 11;

    // Within LABEL_PADDING_PX, so that a share's background stays inside its slice.
    const SHARE_BACKGROUND_PADDING_PX = 2;
    const SHARE_BACKGROUND_RADIUS_PX = 2;

    // An outside label's connector runs from just off the rim to where the label starts.
    const CONNECTOR_START_PX = 2;
    const OUTSIDE_LABEL_GAP_PX = 12;

    // How far a label is kept from its slice's edges, and from the other labels.
    const LABEL_PADDING_PX = 2;

    // Around, a connector bends this far out from the rim, and runs on level to the label's
    // column, which starts CALLOUT_GAP_PX from the rim.  The pies are shrunk to make room for
    // labels up to MAX_CALLOUT_WIDTH_PX wide, though to no less than MIN_RADIUS_SHARE of their
    // size, a label too long for the room left being shortened.  A label's value and share can't
    // be shortened, so the pies are shrunk further, to as little as MIN_SHRUNK_RADIUS_SHARE of
    // their size, where that's what it takes to leave room for them.
    const CALLOUT_ELBOW_PX = 8;
    const CALLOUT_GAP_PX = 18;
    const CALLOUT_TEXT_GAP_PX = 3;
    const MAX_CALLOUT_WIDTH_PX = 140;
    const MIN_RADIUS_SHARE = 0.85;
    const MIN_SHRUNK_RADIUS_SHARE = 0.5;
    const CALLOUT_SPACING_PX = 1;

    // The pies are shrunk by up to MAX_FIT_SHRINK of their radius, in FIT_SHRINK_STEPS steps,
    // where that brings the labels stacked beside them nearer level with their slices: to within
    // FIT_ALLOWED_DISPLACEMENT_EMS of it, or as near as any shrink does, give or take
    // FIT_TOLERANCE_EMS (see fitStackedLabels).
    const MAX_FIT_SHRINK = 0.15;
    const FIT_SHRINK_STEPS = 6;
    const FIT_ALLOWED_DISPLACEMENT_EMS = 1.5;
    const FIT_TOLERANCE_EMS = 0.5;

    const ELLIPSIS = "…";

    const LINE_HEIGHT_EMS = 1.15;

    // A share inside its slice is tried at these shares of the way from the hole (or the centre)
    // to the rim, and where it fits at none, smaller, by these shares of its size.
    const SHARE_DISTANCE_SHARES = [0.55, 0.65, 0.74, 0.82, 0.88, 0.45];
    const SHARE_FONT_SCALES = [0.85, 0.72];

    // A light series colour takes dark labels inside its slices.
    const MAX_WHITE_LABEL_BRIGHTNESS = 160;

    /** Gets the chart's chosen placement of its slices' labels, Outside where none is chosen. */
    const getPlacement = (props) => {

        const keys = Object.keys(PLACEMENTS);

        for (let i = 0; i < keys.length; i++) {

            if (PLACEMENTS[keys[i]] === props.pieLabels) return props.pieLabels;
        }

        return PLACEMENTS.Outside;
    };

    /** Gets what each slice's label says: its series' name, its value and its share. */
    const getContent = (props) => ({
        names: props.pieLabelNames !== false,
        values: props.pieLabelValues === true,
        percentages: props.pieLabelPercentages !== false
    });

    /** Gets a value indicating whether the slices are labelled. */
    const areLabelsShown = (props) => {

        if (!Ren.DateValueChart_Pies.hasPies(props)) return false;
        if (getPlacement(props) === PLACEMENTS.Off) return false;

        const content = getContent(props);

        return content.names || content.values || content.percentages;
    };

    /** Gets a value indicating whether each pie's total is written in its hole. */
    const areTotalsShown = (props) => Ren.DateValueChart_Pies.hasPies(props)
        && props.pieHoleTotals !== false
        && Ren.DateValueChart_Pies.getHoleRadius(props) > 0;

    /**
     * Gets a value indicating whether the shares can be put inside the slices apart from the rest
     * of the labels, which is so where the labels are put outside the pies.
     */
    const canPutSharesInside = (props) => {

        const placement = getPlacement(props);

        return placement === PLACEMENTS.Outside || placement === PLACEMENTS.Around;
    };

    /**
     * Gets a value indicating whether each slice's share is written inside it, apart from the
     * rest of its label, outside the pie.
     */
    const areSharesInside = (props) => props.pieSharesInside !== false
        && canPutSharesInside(props)
        && areLabelsShown(props)
        && getContent(props).percentages;

    /**
     * Gets where each slice's value goes in its label, Inline where none is chosen, or where
     * Inside is chosen but the labels are inside the slices anyway.
     */
    const getValuePosition = (props) => {

        if (props.pieValuePosition === VALUE_POSITIONS.Below) return VALUE_POSITIONS.Below;

        if (props.pieValuePosition === VALUE_POSITIONS.Inside && canPutSharesInside(props)) {
            return VALUE_POSITIONS.Inside;
        }

        return VALUE_POSITIONS.Inline;
    };

    /**
     * Gets a value indicating whether each slice's value is written inside it, apart from the
     * rest of its label, outside the pie.
     */
    const areValuesInside = (props) => getValuePosition(props) === VALUE_POSITIONS.Inside
        && areLabelsShown(props)
        && getContent(props).values;

    /**
     * Gets a value indicating whether a placement stacks every label outside the pies either side
     * of them, shrinking the pies to make room, so that none is dropped for want of space.
     */
    const isStackedPlacement = (placement) =>
        placement === PLACEMENTS.Outside || placement === PLACEMENTS.Around;

    const getFontSizePx = (props) => props.pieLabelFontSize ?? DEFAULT_FONT_SIZE_PX;

    /** Gets a share, from 0 to 1, as a percentage, to a decimal place where it is under 10%. */
    const formatShare = (share) => {

        const percentage = share * 100;

        if (percentage >= 9.95) return Math.round(percentage) + "%";

        if (percentage < 0.05) return "<0.1%";

        return Math.round(percentage * 10) / 10 + "%";
    };

    /**
     * Gets a slice's value in its series' format, format function and all, as plain text, a
     * format function being able to give HTML.
     */
    const formatValue = (props, slice) => {

        const formatted = Ren.ValueFormatter.formatValue(
            slice.value,
            null,
            props.valueColumnFormats[slice.seriesIndex],
            props.valueColumnFormatFunctions?.[slice.seriesIndex]
        );

        if (formatted === null || formatted === undefined) return "";

        const text = String(formatted);

        return text.indexOf("<") === -1 && text.indexOf("&") === -1
            ? text
            : Ren.HtmlUtils.parseHTML(text).body.textContent;
    };

    /** Gets what a label says after its name: its value, then its share. */
    const getDetailText = (props, content, slice) => {

        const parts = [];

        if (content.values) parts.push(formatValue(props, slice));

        if (content.percentages) {

            const share = formatShare(slice.share);
            parts.push(content.values ? `(${share})` : share);
        }

        return parts.join(" ");
    };

    /**
     * Gives a label's group a tooltip of its slice's whole name, value and share, the label
     * itself perhaps being cut short or leaving some of them out.  An "Other" slice's tooltip
     * goes on to list the series it gathers.
     */
    const addTooltip = (groupNode, props, slice) => {

        const name = Ren.DateValueChart_Pies.getSeriesName(props, slice.seriesIndex);
        const value = formatValue(props, slice);
        const share = formatShare(slice.share);

        Ren.Svg.append(groupNode, "title").textContent =
            name + "\n" + (value ? `${value} (${share})` : share);

        Ren.DateValueChart_OtherSeries.addTooltip(groupNode, props, slice.seriesIndex);
    };

    const getLabelText = (props, content, slice) => {

        const detail = getDetailText(props, content, slice);

        if (!content.names) return detail;

        const name = Ren.DateValueChart_Pies.getSeriesName(props, slice.seriesIndex);

        return detail ? `${name}: ${detail}` : name;
    };

    /**
     * Gets the lines of a label: one, or where the value and share go below the name, the name
     * and then them.  None where the label says nothing.
     */
    const getLabelLines = (props, content, slice) => {

        if (content.names && getValuePosition(props) === VALUE_POSITIONS.Below) {

            const detail = getDetailText(props, content, slice);

            if (detail) {

                return [Ren.DateValueChart_Pies.getSeriesName(props, slice.seriesIndex), detail];
            }
        }

        const text = getLabelText(props, content, slice);

        return text ? [text] : [];
    };

    /**
     * Writes a label's lines into its text node, a tspan each, stacked so that the block of them
     * is centred on the text node's y.
     */
    const writeLines = (textNode, lines) => {

        textNode.textContent = "";

        const firstDy = -(lines.length - 1) / 2 * LINE_HEIGHT_EMS;

        for (let i = 0; i < lines.length; i++) {

            const lineNode = Ren.Svg.append(textNode, "tspan", {
                "dy": (i === 0 ? firstDy : LINE_HEIGHT_EMS) + "em"
            });

            lineNode.textContent = lines[i];
        }
    };

    const toCalloutWidthPx = (textWidthPx) =>
        CALLOUT_GAP_PX + Math.ceil(Math.min(textWidthPx, MAX_CALLOUT_WIDTH_PX));

    /**
     * Gets the least room the pies are to leave either side for the labels stacked beside them:
     * enough for the lines after each label's first, which can't be shortened.  They're measured
     * as drawn, the first time they can be (not while the chart is hidden, say), and estimated
     * until then.  A chart just drawn may not have its labels' font size yet, so each is measured
     * in whatever it has, and scaled to the labels' own.
     */
    const getMinCalloutWidthPx = (props) => {

        if (props.pieCalloutMinWidthPx == null && props.pieCalloutMinWidthEstimatePx) {

            const labels = props.pieLabelNodes || [];
            const fontSizePx = getFontSizePx(props);
            let widestPx = 0;
            let isMeasured = true;

            for (let i = 0; i < labels.length && isMeasured; i++) {

                const label = labels[i];

                if (label.isSubdivision || label.lines.length < 2) continue;

                // Shown for a moment, as a hidden label measures nothing.
                const display = label.groupNode.style.display;

                label.groupNode.style.display = "";

                const drawnFontSizePx = parseFloat(getComputedStyle(label.textNode).fontSize);

                for (let j = 1; j < label.lines.length && isMeasured; j++) {

                    const widthPx = label.textNode.children[j]?.getComputedTextLength() || 0;

                    isMeasured = widthPx > 0 && drawnFontSizePx > 0;
                    widestPx = Math.max(widestPx, widthPx * fontSizePx / drawnFontSizePx);
                }

                label.groupNode.style.display = display;
            }

            if (isMeasured && widestPx > 0) props.pieCalloutMinWidthPx = toCalloutWidthPx(widestPx);
        }

        return props.pieCalloutMinWidthPx ?? props.pieCalloutMinWidthEstimatePx ?? 0;
    };

    /** Rewrites a label's first line, leaving any below it, as when it is shortened. */
    const setFirstLine = (textNode, text) => {

        textNode.firstElementChild.textContent = text;
    };

    /** Moves a label's text, every line of it, the x of each being its own. */
    const placeText = (textNode, x, y) => {

        textNode.setAttribute("x", x);
        textNode.setAttribute("y", y);

        for (let i = 0; i < textNode.children.length; i++) {
            textNode.children[i].setAttribute("x", x);
        }
    };

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

        const isStacked = showLabels && isStackedPlacement(getPlacement(props));
        const fontScale = getFontSizePx(props) / 12;
        let widestTextPx = 0;
        let widestRestTextPx = 0;

        for (let pieIndex = 0; pieIndex < pies.length; pieIndex++) {

            const pie = pies[pieIndex];

            if (showTotals) {

                const totalNode = Ren.Svg.append(layer, "text", { "class": TOTAL_CLASS });

                totalNode.textContent = formatTotal(pie.total);
                totalNode.style.display = "none";

                props.pieTotalNodes.push({ pie, textNode: totalNode });
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
     * Gets how far, at most, any label stacked beside the pies is from level with its connector's
     * bend, were the pies drawn at a radius, in a plot of a height.  The labels' heights are
     * estimated from their lines, so that the answer doesn't change once they're measured.
     */
    const getStackedDisplacementPx = (props, labels, radiusPx, plotHeightPx) => {

        const lineHeightPx = getFontSizePx(props) * LINE_HEIGHT_EMS;
        const centreY = plotHeightPx / 2;
        const columns = new Map();

        for (let i = 0; i < labels.length; i++) {

            const label = labels[i];
            const angle = (label.slice.startAngle + label.slice.endAngle) / 2;
            const key = label.pie;
            const side = Math.sin(angle) >= 0 ? 1 : 0;

            if (!columns.has(key)) columns.set(key, [[], []]);

            columns.get(key)[side].push({
                slice: label.slice,
                elbowY: centreY - Math.cos(angle) * (radiusPx + CALLOUT_ELBOW_PX),
                size: { height: (label.lines.length + 0.1) * lineHeightPx }
            });
        }

        const result = { hidden: 0 };
        let displacementPx = 0;

        columns.forEach(sides => {

            for (let s = 0; s < sides.length; s++) {

                const stacked = stackColumn(sides[s], plotHeightPx, result);

                for (let i = 0; i < stacked.length; i++) {

                    displacementPx = Math.max(
                        displacementPx,
                        Math.abs(stacked[i].centreY - stacked[i].elbowY)
                    );
                }
            }
        });

        return displacementPx;
    };

    /**
     * Shrinks the pies, by as small a fraction as does it, where that lets the labels stacked
     * beside them sit nearer level with their slices: where there are more of them near the top
     * or the foot of a pie than fit beside it there, so that they are spread further round it,
     * beside slices not their own.  Every pie shrinks alike, by what the most crowded needs, and
     * by no more than MAX_FIT_SHRINK of its radius.
     */
    const fitStackedLabels = (props, radiusPx, plotHeightPx) => {

        if (!(plotHeightPx > 0) || !(radiusPx > 0)) return radiusPx;

        const isStacked = isStackedPlacement(getPlacement(props));
        const labels = (props.pieLabelNodes || []).filter(label =>
            (isStacked || label.isSubdivision)
            && (label.isSubdivision
                || props.series?.[label.slice.seriesIndex]?.showValueLabels !== false));

        if (labels.length < 2) return radiusPx;

        const cache = props.pieRadiusFit;
        const key = `${radiusPx}|${plotHeightPx}|${getFontSizePx(props)}|${labels.length}`;

        if (cache && cache.labels === props.pieLabelNodes && cache.key === key) {
            return cache.radiusPx;
        }

        const displacements = [];
        let leastPx = Infinity;

        for (let step = 0; step <= FIT_SHRINK_STEPS; step++) {

            const candidatePx = radiusPx * (1 - MAX_FIT_SHRINK * step / FIT_SHRINK_STEPS);
            const displacementPx =
                getStackedDisplacementPx(props, labels, candidatePx, plotHeightPx);

            displacements.push({ radiusPx: candidatePx, displacementPx });
            leastPx = Math.min(leastPx, displacementPx);
        }

        // The least shrinking that brings the labels about as near their slices as any does, or
        // near enough, a shrink that gains them only a few pixels not being worth having.
        const fontSizePx = getFontSizePx(props);
        const acceptablePx = Math.max(leastPx, fontSizePx * FIT_ALLOWED_DISPLACEMENT_EMS)
            + fontSizePx * FIT_TOLERANCE_EMS;
        let fittedPx = radiusPx;

        for (let i = 0; i < displacements.length; i++) {

            if (displacements[i].displacementPx <= acceptablePx) {

                fittedPx = displacements[i].radiusPx;
                break;
            }
        }

        props.pieRadiusFit = { labels: props.pieLabelNodes, key, radiusPx: fittedPx };

        return fittedPx;
    };

    /**
     * Gets the radius the pies are drawn at, in screen pixels, given their widest, which is
     * narrowed to leave room either side for the columns of labels around them, and shrunk a
     * little further where that keeps the labels nearer their slices (see fitStackedLabels).
     */
    const getRadiusPx = (props, widestRadiusPx, periodWidthPx, plotHeightPx) => fitStackedLabels(
        props,
        getColumnRadiusPx(props, widestRadiusPx, periodWidthPx),
        plotHeightPx
    );

    /**
     * Gets the radius the pies are drawn at, in screen pixels, given their widest, narrowed to
     * leave room either side for the columns of labels around them.
     */
    const getColumnRadiusPx = (props, widestRadiusPx, periodWidthPx) => {

        const calloutWidthPx = props.pieCalloutWidthPx || 0;

        if (!calloutWidthPx) return widestRadiusPx;

        const roomyRadiusPx = periodWidthPx / 2 - calloutWidthPx - LABEL_PADDING_PX;
        const minCalloutWidthPx = getMinCalloutWidthPx(props);
        let smallestRadiusPx = widestRadiusPx * MIN_RADIUS_SHARE;

        // Shrunk further where that's what it takes to leave room for the lines that can't be
        // shortened, so that the labels aren't all dropped.
        if (minCalloutWidthPx) {

            smallestRadiusPx = Math.min(
                smallestRadiusPx,
                Math.max(
                    periodWidthPx / 2 - minCalloutWidthPx - LABEL_PADDING_PX,
                    widestRadiusPx * MIN_SHRUNK_RADIUS_SHARE
                )
            );
        }

        return Math.min(widestRadiusPx, Math.max(roomyRadiusPx, smallestRadiusPx));
    };

    /** Measures a label, and the length of each of its lines. */
    const measure = (textNode) => {

        try {

            const box = textNode.getBBox();

            if (!box.width) return null;

            const lineWidths = [];

            for (let i = 0; i < textNode.children.length; i++) {
                lineWidths.push(textNode.children[i].getComputedTextLength());
            }

            return { width: box.width, height: box.height, lineWidths };
        }
        catch (error) {

            return null;
        }
    };

    /** Gets an angle, clockwise from 12 o'clock, from 0 to 2π, of an offset from a centre. */
    const getAngle = (dx, dy) => {

        const angle = Math.atan2(dx, -dy);

        return angle < 0 ? angle + Math.PI * 2 : angle;
    };

    const getBox = (centreX, centreY, size) => ({
        left: centreX - size.width / 2,
        right: centreX + size.width / 2,
        top: centreY - size.height / 2,
        bottom: centreY + size.height / 2
    });

    /** Gets the distance from a point to the nearest point of a box, 0 where it is inside it. */
    const getDistanceToBox = (x, y, box) => {

        const dx = Math.max(box.left - x, 0, x - box.right);
        const dy = Math.max(box.top - y, 0, y - box.bottom);

        return Math.sqrt(dx * dx + dy * dy);
    };

    /** Gets the distance from a point to the furthest corner of a box. */
    const getFurthestDistanceToBox = (x, y, box) => {

        const dx = Math.max(Math.abs(box.left - x), Math.abs(box.right - x));
        const dy = Math.max(Math.abs(box.top - y), Math.abs(box.bottom - y));

        return Math.sqrt(dx * dx + dy * dy);
    };

    /**
     * Gets a value indicating whether a box lies within a slice, clear of its edges: within the
     * pie's rim, outside its hole, and, for a slice short of the whole pie, with its corners and
     * the middles of its sides all between the slice's two straight edges.
     */
    const isBoxInSlice = (box, centre, slice, holePx, radiusPx) => {

        if (getFurthestDistanceToBox(centre.x, centre.y, box) > radiusPx - LABEL_PADDING_PX) {
            return false;
        }

        const isWhole = slice.endAngle - slice.startAngle >= Math.PI * 2 - 1e-9;
        const innerPx = holePx > 0 || !isWhole ? holePx + LABEL_PADDING_PX : 0;

        if (getDistanceToBox(centre.x, centre.y, box) < innerPx) return false;

        if (isWhole) return true;

        const middleX = (box.left + box.right) / 2;
        const middleY = (box.top + box.bottom) / 2;
        const points = [
            [box.left, box.top], [middleX, box.top], [box.right, box.top],
            [box.right, middleY], [box.right, box.bottom], [middleX, box.bottom],
            [box.left, box.bottom], [box.left, middleY]
        ];

        for (let i = 0; i < points.length; i++) {

            const angle = getAngle(points[i][0] - centre.x, points[i][1] - centre.y);

            if (angle < slice.startAngle || angle > slice.endAngle) return false;
        }

        return true;
    };

    /**
     * Gets the box a label fits in inside its slice, at the middle of the slice's angle, or null
     * where it fits nowhere tried.  A slice of a pie with no hole is tried a little further in
     * and further out too, unless the distances from the centre to try are given.
     */
    const findPlaceInside = (label, centre, holePx, radiusPx, distances) => {

        const slice = label.slice;
        const isWhole = slice.endAngle - slice.startAngle >= Math.PI * 2 - 1e-9;

        if (isWhole && holePx === 0) {

            const box = getBox(centre.x, centre.y, label.size);

            return isBoxInSlice(box, centre, slice, holePx, radiusPx) ? box : null;
        }

        const angle = (slice.startAngle + slice.endAngle) / 2;

        if (!distances) {

            distances = holePx > 0
                ? [(holePx + radiusPx) / 2]
                : [radiusPx * 0.6, radiusPx * 0.45, radiusPx * 0.72];
        }

        for (let i = 0; i < distances.length; i++) {

            const box = getBox(
                centre.x + Math.sin(angle) * distances[i],
                centre.y - Math.cos(angle) * distances[i],
                label.size
            );

            if (isBoxInSlice(box, centre, slice, holePx, radiusPx)) return box;
        }

        return null;
    };

    const boxesOverlap = (a, b) => a.left < b.right + LABEL_PADDING_PX
        && a.right > b.left - LABEL_PADDING_PX
        && a.top < b.bottom + LABEL_PADDING_PX
        && a.bottom > b.top - LABEL_PADDING_PX;

    /**
     * Gets the box a label fits in outside its pie, beyond the middle of its slice's rim, and
     * where its connector starts and ends, or null where it would leave the plot or run into a
     * pie or a label already placed.
     */
    const findPlaceOutside = (label, centre, centres, radiusPx, placedBoxes, plotWidthPx,
        plotHeightPx) => {

        const slice = label.slice;
        const angle = (slice.startAngle + slice.endAngle) / 2;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const endDistance = radiusPx + OUTSIDE_LABEL_GAP_PX;
        const endX = centre.x + sin * endDistance;
        const endY = centre.y - cos * endDistance;

        // Stood off from the connector's end on the side facing away from the pie.
        const box = getBox(
            endX + sin * label.size.width / 2,
            endY - cos * label.size.height / 2,
            label.size
        );

        if (box.left < 0 || box.right > plotWidthPx || box.top < 0 || box.bottom > plotHeightPx) {
            return null;
        }

        for (let i = 0; i < centres.length; i++) {

            const distance = getDistanceToBox(centres[i].x, centres[i].y, box);

            if (distance < radiusPx + LABEL_PADDING_PX) return null;
        }

        for (let i = 0; i < placedBoxes.length; i++) {

            if (boxesOverlap(box, placedBoxes[i])) return null;
        }

        return {
            box,
            startX: centre.x + sin * (radiusPx + CONNECTOR_START_PX),
            startY: centre.y - cos * (radiusPx + CONNECTOR_START_PX),
            endX,
            endY
        };
    };

    const showLabel = (label, box, isInside) => {

        label.groupNode.style.display = "";
        placeText(label.textNode, (box.left + box.right) / 2, (box.top + box.bottom) / 2);
        label.textNode.style.textAnchor = "";
        label.textNode.classList.toggle(INSIDE_CLASS, isInside);
    };

    const showConnector = (label, points) => {

        label.connectorNode.style.display = "";
        label.connectorNode.setAttribute("points", points.map(point => point.join(",")).join(" "));
    };

    /**
     * Gets the text to show for a label in a width, shortened to end in an ellipsis where the
     * whole label is too long, or null where not even one character and an ellipsis fit.
     * prefixLengths[n] is the length of the first n characters and an ellipsis.
     */
    const fitText = (fullText, prefixLengths, availableWidthPx) => {

        if (prefixLengths[fullText.length] <= availableWidthPx) return fullText;

        for (let count = fullText.length - 1; count >= 1; count--) {

            if (prefixLengths[count] <= availableWidthPx) {

                return fullText.substring(0, count).replace(/\s+$/, "") + ELLIPSIS;
            }
        }

        return null;
    };

    /**
     * Measures a label drawn in full with an ellipsis after its first line, for that line to be
     * shortened by: its height, the length of each leading run of the first line's characters
     * with the ellipsis, as for fitText, and the length of the longest line below it, which is
     * never shortened.  Gets null where it is not shown.
     */
    const measureForShortening = (textNode, firstLine) => {

        try {

            const box = textNode.getBBox();

            if (!box.width) return null;

            const ellipsisLength = textNode.getSubStringLength(firstLine.length, 1);
            const prefixLengths = [];

            for (let i = 1; i < firstLine.length; i++) {

                prefixLengths[i] = textNode.getSubStringLength(0, i) + ellipsisLength;
            }

            prefixLengths[firstLine.length] =
                textNode.firstElementChild.getComputedTextLength() - ellipsisLength;

            let restWidth = 0;

            for (let i = 1; i < textNode.children.length; i++) {

                restWidth = Math.max(restWidth, textNode.children[i].getComputedTextLength());
            }

            return {
                width: Math.max(prefixLengths[firstLine.length], restWidth),
                height: box.height,
                prefixLengths,
                restWidth
            };
        }
        catch (error) {

            return null;
        }
    };

    /**
     * Stacks the labels on one side of one pie in a column, each as near level with where its
     * connector bends as the others let it be, a crowd of them spread above and below their
     * bends.  Where they cannot all be stacked in the plot's height, the smallest slices' are
     * dropped.  Gets the labels kept, each with its centreY.
     */
    const stackColumn = (labels, plotHeightPx, result) => {

        const stacked = labels.slice();

        stacked.sort((a, b) => a.elbowY - b.elbowY);

        const getTotalHeight = () => {

            let totalHeight = 0;

            for (let i = 0; i < stacked.length; i++) {
                totalHeight += stacked[i].size.height + CALLOUT_SPACING_PX;
            }

            return totalHeight;
        };

        while (stacked.length && getTotalHeight() > plotHeightPx + CALLOUT_SPACING_PX) {

            let smallestIndex = 0;

            for (let i = 1; i < stacked.length; i++) {

                if (stacked[i].slice.share < stacked[smallestIndex].slice.share) {
                    smallestIndex = i;
                }
            }

            stacked.splice(smallestIndex, 1);
            result.hidden++;
        }

        if (!stacked.length) return stacked;

        const getSpacing = (a, b) => (a.size.height + b.size.height) / 2 + CALLOUT_SPACING_PX;

        // Labels that would overlap are gathered into blocks, each as near level with its
        // labels' bends as it can be, so that a crowd of them spreads up as well as down, rather
        // than every label after the first being pushed down, further and further from its slice.
        const blocks = [];

        for (let i = 0; i < stacked.length; i++) {

            const label = stacked[i];
            let block = {
                labels: [label],
                height: label.size.height,
                targetTopSum: label.elbowY - label.size.height / 2
            };

            while (blocks.length) {

                const previous = blocks[blocks.length - 1];
                const previousTop = previous.targetTopSum / previous.labels.length;
                const top = block.targetTopSum / block.labels.length;

                if (previousTop + previous.height + CALLOUT_SPACING_PX <= top) break;

                const shift = previous.height + CALLOUT_SPACING_PX;

                block = {
                    labels: previous.labels.concat(block.labels),
                    height: shift + block.height,
                    targetTopSum: previous.targetTopSum + block.targetTopSum
                        - shift * block.labels.length
                };

                blocks.pop();
            }

            blocks.push(block);
        }

        for (let b = 0; b < blocks.length; b++) {

            let y = blocks[b].targetTopSum / blocks[b].labels.length;

            for (let i = 0; i < blocks[b].labels.length; i++) {

                const label = blocks[b].labels[i];

                label.centreY = y + label.size.height / 2;
                y += label.size.height + CALLOUT_SPACING_PX;
            }
        }

        // Pushed down clear of the plot's top and the label above, then back up clear of the
        // plot's foot and the label below, then down clear of its top.
        for (let i = 0; i < stacked.length; i++) {

            const label = stacked[i];
            const minY = i === 0
                ? label.size.height / 2
                : stacked[i - 1].centreY + getSpacing(stacked[i - 1], label);

            label.centreY = Math.max(label.centreY, minY);
        }

        const last = stacked[stacked.length - 1];
        last.centreY = Math.min(last.centreY, plotHeightPx - last.size.height / 2);

        for (let i = stacked.length - 2; i >= 0; i--) {

            stacked[i].centreY = Math.min(
                stacked[i].centreY,
                stacked[i + 1].centreY - getSpacing(stacked[i], stacked[i + 1])
            );
        }

        stacked[0].centreY = Math.max(stacked[0].centreY, stacked[0].size.height / 2);

        return stacked;
    };

    /**
     * Gets how far across from its pie's centre a label stacked hugging the pie is put, so that
     * its nearest corner is clear of the rim, and it is no nearer than its connector's bend.
     */
    const getHuggingOffset = (label, centre, radiusPx) => {

        const clearancePx = radiusPx + OUTSIDE_LABEL_GAP_PX;
        const nearestDy = Math.max(0, Math.abs(label.centreY - centre.y) - label.size.height / 2);
        const offsetPx = nearestDy < clearancePx
            ? Math.sqrt(clearancePx * clearancePx - nearestDy * nearestDy)
            : 0;

        return Math.max(offsetPx, Math.abs(label.elbowX - centre.x));
    };

    /**
     * Gets how far a label hugging its pie may run, as the x it must stop short of: the chart's
     * edge, margin and all, or, where there is a pie beyond it that way, that pie's centre, and
     * short of that pie's rim, by as much as a label is kept from its own, where the label is
     * level with it.  It stops short too of any label already placed in its way, so that labels
     * between two pies share the room there.
     */
    const getHuggingEdgeX = (props, label, textX, direction, radiusPx, placedBoxes) => {

        const nearer = (a, b) => direction > 0 ? Math.min(a, b) : Math.max(a, b);
        const top = label.centreY - label.size.height / 2;
        const bottom = label.centreY + label.size.height / 2;
        const clearancePx = radiusPx + OUTSIDE_LABEL_GAP_PX;
        const ownX = label.pie.screenCentre.x;
        const pies = props.pieLayout || [];

        let edgeX = direction > 0
            ? props.innerWidth * props.scaleX + (props.margin ? props.margin.right : 0)
            : -(props.margin ? props.margin.left : 0);

        for (let i = 0; i < pies.length; i++) {

            const centre = pies[i].screenCentre;

            if ((centre.x - ownX) * direction <= 0) continue;

            edgeX = nearer(edgeX, centre.x);

            const dy = Math.max(0, top - centre.y, centre.y - bottom);

            if (dy < clearancePx) {

                edgeX = nearer(
                    edgeX,
                    centre.x - direction * Math.sqrt(clearancePx * clearancePx - dy * dy)
                );
            }
        }

        for (let i = 0; i < placedBoxes.length; i++) {

            const box = placedBoxes[i];

            // Only a label it would run into is in its way, not one stacked just above or below
            // it in the same column, CALLOUT_SPACING_PX apart, as one nearer the pie's middle is
            // further out from its centre, so would otherwise be taken to block the one beside
            // it nearer the top or foot, leaving that label shortened or hidden.
            if (box.bottom <= top || box.top >= bottom) continue;

            const nearSideX = direction > 0 ? box.left : box.right;
            const farSideX = direction > 0 ? box.right : box.left;

            if ((farSideX - textX) * direction > 0) edgeX = nearer(edgeX, nearSideX);
        }

        return edgeX;
    };

    /**
     * Places the labels stacked either side of each pie, on the side its slice is on, each joined
     * to the middle of its slice's rim by a connector running out from the pie, then level to the
     * label.  Around, the labels are lined up in a column, each running no further than halfway
     * to the next pie.  Otherwise each hugs the pie, and may run on towards the next pie as far
     * as it is clear of it, the biggest slices' labels taking their room first.  The box of each
     * label placed is added to any placedBoxes passed.
     */
    const layoutStacked = (props, labels, radiusPx, hugsPie, result, placedBoxes) => {

        const plotHeightPx = Ren.DateValueChart_Pies.getBandHeight(props) * props.scaleY;
        const periodWidthPx = (props.piePeriodWidth ?? props.innerWidth) * props.scaleX;
        const columns = new Map();
        let leftmostX = Infinity;
        let rightmostX = -Infinity;

        for (let i = 0; i < labels.length; i++) {

            const label = labels[i];
            const centre = label.pie.screenCentre;
            const angle = (label.slice.startAngle + label.slice.endAngle) / 2;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            leftmostX = Math.min(leftmostX, centre.x);
            rightmostX = Math.max(rightmostX, centre.x);
            label.isRight = sin >= 0;
            label.rimX = centre.x + sin * (radiusPx + CONNECTOR_START_PX);
            label.rimY = centre.y - cos * (radiusPx + CONNECTOR_START_PX);
            label.elbowX = centre.x + sin * (radiusPx + CALLOUT_ELBOW_PX);
            label.elbowY = centre.y - cos * (radiusPx + CALLOUT_ELBOW_PX);

            let column = columns.get(label.pie);

            if (!column) {

                column = { left: [], right: [] };
                columns.set(label.pie, column);
            }

            column[label.isRight ? "right" : "left"].push(label);
        }

        // Around, a label may run on into the chart's margin beside the outermost pies, but no
        // further than halfway to a pie beside it.
        const getEdgeX = (pie, direction) => {

            const centreX = pie.screenCentre.x;

            if (direction < 0 && centreX <= leftmostX) {
                return -(props.margin ? props.margin.left : 0);
            }

            if (direction > 0 && centreX >= rightmostX) {
                return props.innerWidth * props.scaleX + (props.margin ? props.margin.right : 0);
            }

            return centreX + direction * periodWidthPx / 2;
        };

        // Each column is stacked first, so that every label's height is known before any takes
        // its room across.
        const entries = [];

        columns.forEach((column, pie) => {

            const sides = [column.left, column.right];

            for (let s = 0; s < sides.length; s++) {

                const stacked = stackColumn(sides[s], plotHeightPx, result);

                for (let i = 0; i < stacked.length; i++) {

                    const label = stacked[i];
                    const direction = label.isRight ? 1 : -1;
                    const offsetPx = hugsPie
                        ? getHuggingOffset(label, pie.screenCentre, radiusPx)
                        : radiusPx + CALLOUT_GAP_PX;
                    const columnX = pie.screenCentre.x + direction * offsetPx;

                    entries.push({
                        label,
                        pie,
                        direction,
                        columnX,
                        textX: columnX + direction * CALLOUT_TEXT_GAP_PX
                    });
                }
            }
        });

        if (hugsPie) entries.sort((a, b) => b.label.slice.share - a.label.slice.share);

        const boxes = placedBoxes || [];

        for (let i = 0; i < entries.length; i++) {

            const { label, pie, direction, columnX, textX } = entries[i];
            const edgeX = hugsPie
                ? getHuggingEdgeX(props, label, textX, direction, radiusPx, boxes)
                : getEdgeX(pie, direction);
            const availableWidthPx = (edgeX - textX) * direction - LABEL_PADDING_PX;
            const text = label.size.restWidth <= availableWidthPx
                ? fitText(label.lines[0], label.size.prefixLengths, availableWidthPx)
                : null;

            if (text === null) {

                result.hidden++;
                continue;
            }

            label.groupNode.style.display = "";
            setFirstLine(label.textNode, text);
            label.textNode.classList.remove(INSIDE_CLASS);
            placeText(label.textNode, textX, label.centreY);
            label.textNode.style.textAnchor = label.isRight ? "start" : "end";

            showConnector(label, [
                [label.rimX, label.rimY],
                [label.elbowX, label.elbowY],
                [columnX, label.centreY]
            ]);

            const widthPx = Math.min(label.size.width, availableWidthPx);
            const boxLeft = label.isRight ? textX : textX - widthPx;

            boxes.push({
                left: boxLeft,
                right: boxLeft + widthPx,
                top: label.centreY - label.size.height / 2,
                bottom: label.centreY + label.size.height / 2
            });

            if (label.isSubdivision) {
                result.subdivisions++;
            }
            else {

                result.outside++;
            }
        }
    };

    /** Writes each pie's total in its hole, where it fits. */
    const layoutTotals = (props, holePx, result) => {

        const totals = props.pieTotalNodes || [];

        for (let i = 0; i < totals.length; i++) {

            const total = totals[i];
            total.textNode.style.display = "";

            const size = measure(total.textNode);
            const x = total.pie.centreX * props.scaleX;
            const y = total.pie.centreY * props.scaleY;

            if (size === null
                || getFurthestDistanceToBox(0, 0, getBox(0, 0, size))
                    > holePx - LABEL_PADDING_PX) {

                total.textNode.style.display = "none";
                continue;
            }

            total.textNode.setAttribute("x", x);
            total.textNode.setAttribute("y", y);
            result.totals++;
        }
    };

    /** Gets the lines written inside a slice: its value, its share, or both, the value on top. */
    const getShareLines = (share, shareText) => {

        const lines = [];

        if (share.valueText !== null && share.valueText !== undefined) lines.push(share.valueText);
        if (share.hasShare !== false) lines.push(shareText);

        return lines;
    };

    /**
     * Gets the ways what is written inside a slice may be written, from the best to the most
     * squeezed: as it is, then smaller, then with the share rounded to a whole percentage, then
     * rounded and smaller still.  Its size written otherwise is estimated from its measured size,
     * a share's digits being much of its length.
     */
    const getShareCandidates = (share) => {

        const hasShare = share.hasShare !== false;
        const fullText = formatShare(share.slice.share);
        const roundedText = hasShare && share.slice.share >= 0.005
            ? Math.round(share.slice.share * 100) + "%"
            : fullText;
        const lineWidths = share.size.lineWidths?.length
            ? share.size.lineWidths
            : [share.size.width];
        const shareWidth = hasShare ? lineWidths[lineWidths.length - 1] : 0;
        const valueWidth = lineWidths.length > 1 || !hasShare ? lineWidths[0] : 0;
        const candidates = [];
        const add = (text, fontScale) => {

            const width = Math.max(valueWidth, shareWidth * text.length / fullText.length);

            candidates.push({
                lines: getShareLines(share, text),
                fontScale,
                size: {
                    width: width * fontScale,
                    height: share.size.height * fontScale
                }
            });
        };

        add(fullText, 1);

        for (let i = 0; i < SHARE_FONT_SCALES.length; i++) {
            add(fullText, SHARE_FONT_SCALES[i]);
        }

        if (roundedText !== fullText) {

            add(roundedText, 1);

            for (let i = 0; i < SHARE_FONT_SCALES.length; i++) {
                add(roundedText, SHARE_FONT_SCALES[i]);
            }
        }

        return candidates;
    };

    /**
     * Gets the distances from a pie's centre a share is tried at, from the middle of its slice
     * outwards, where the slice is wider, then a little further in.
     */
    const getShareDistances = (holePx, radiusPx) => {

        const distances = [];

        for (let i = 0; i < SHARE_DISTANCE_SHARES.length; i++) {
            distances.push(holePx + (radiusPx - holePx) * SHARE_DISTANCE_SHARES[i]);
        }

        return distances;
    };

    const placeShareBackground = (backgroundNode, box) => {

        backgroundNode.setAttribute("x", box.left - SHARE_BACKGROUND_PADDING_PX);
        backgroundNode.setAttribute("y", box.top);
        backgroundNode.setAttribute(
            "width",
            box.right - box.left + SHARE_BACKGROUND_PADDING_PX * 2
        );

        backgroundNode.setAttribute("height", box.bottom - box.top);
    };

    /**
     * Writes each slice's share, value or both inside it, where they are written apart from the
     * rest of its label and fit, squeezed if need be.  A series' are left hidden where its value
     * labels are turned off.
     */
    const layoutShares = (props, holePx, radiusPx, result) => {

        const shares = [];
        const shareNodes = props.pieShareNodes || [];

        for (let i = 0; i < shareNodes.length; i++) {

            const share = shareNodes[i];

            if (props.series[share.slice.seriesIndex].showValueLabels === false) {

                share.groupNode.style.display = "none";
                continue;
            }

            share.groupNode.style.display = "";
            writeLines(share.textNode, getShareLines(share, formatShare(share.slice.share)));
            share.textNode.style.fontSize = "";
            shares.push(share);
        }

        for (let i = 0; i < shares.length; i++) {

            shares[i].size = measure(shares[i].textNode);
        }

        const distances = getShareDistances(holePx, radiusPx);
        const fontSizePx = getFontSizePx(props);

        for (let i = 0; i < shares.length; i++) {

            const share = shares[i];
            const centre = {
                x: share.pie.centreX * props.scaleX,
                y: share.pie.centreY * props.scaleY
            };
            const candidates = share.size === null ? [] : getShareCandidates(share);
            let box = null;
            let candidate = null;

            for (let c = 0; c < candidates.length && box === null; c++) {

                candidate = candidates[c];
                box = findPlaceInside(
                    { slice: share.slice, size: candidate.size },
                    centre,
                    holePx,
                    radiusPx,
                    distances
                );
            }

            if (box === null) {

                share.groupNode.style.display = "none";
                result.hidden++;
                continue;
            }

            writeLines(share.textNode, candidate.lines);

            if (candidate.fontScale !== 1) {
                share.textNode.style.fontSize = fontSizePx * candidate.fontScale + "px";
            }

            showLabel(share, box, true);
            placeShareBackground(share.backgroundNode, box);
            result.inside++;
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
