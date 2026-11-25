/**
 * Places the labels of a chart drawn as pies Around: stacked in a column either side of each pie,
 * each joined to its slice by an elbowed connector, the pies being shrunk to leave the columns
 * room.
 */
Ren.DateValueChart_PieLabelStacks = (() => {

    const { getPlacement, isStackedPlacement, getFontSizePx } = Ren.DateValueChart_PieLabelContent;

    const {
        INSIDE_CLASS, LINE_HEIGHT_EMS, setFirstLine, placeText, showConnector, fitText
    } = Ren.DateValueChart_PieLabelDrawing;

    const {
        CONNECTOR_START_PX, OUTSIDE_LABEL_GAP_PX, LABEL_PADDING_PX
    } = Ren.DateValueChart_PieLabelGeometry;

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

    return {
        toCalloutWidthPx,
        getMinCalloutWidthPx,
        getRadiusPx,
        getHuggingEdgeX,
        layoutStacked
    };
})();
