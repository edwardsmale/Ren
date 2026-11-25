/**
 * Places each pie's total in its hole, and, where the labels are outside the pies, each slice's
 * share inside the slice, on a background of the slice's colour.
 */
Ren.DateValueChart_PieLabelTotalsAndShares = (() => {

    const { getFontSizePx, formatShare } = Ren.DateValueChart_PieLabelContent;

    const { writeLines, showLabel } = Ren.DateValueChart_PieLabelDrawing;

    const {
        LABEL_PADDING_PX,
        measure,
        getBox,
        getFurthestDistanceToBox,
        findPlaceInside
    } = Ren.DateValueChart_PieLabelGeometry;

    // Within LABEL_PADDING_PX, so that a share's background stays inside its slice.
    const SHARE_BACKGROUND_PADDING_PX = 2;

    // The sizes a total too big for its hole is tried at, as a share of its own.
    const TOTAL_FONT_SCALES = [1, 0.85, 0.7];

    // A share inside its slice is tried at these shares of the way from the hole (or the centre)
    // to the rim, and where it fits at none, smaller, by these shares of its size.
    const SHARE_DISTANCE_SHARES = [0.55, 0.65, 0.74, 0.82, 0.88, 0.45];
    const SHARE_FONT_SCALES = [0.85, 0.72];

    /**
     * Gets how a total may be written in its hole, from the best to the most squeezed: as it is,
     * then smaller, then abbreviated, then abbreviated and smaller.
     */
    const getTotalCandidates = (total) => {

        const candidates = [];

        for (let i = 0; i < total.texts.length; i++) {

            total.textNode.textContent = total.texts[i];

            const size = measure(total.textNode);

            if (size === null) continue;

            TOTAL_FONT_SCALES.forEach(fontScale => candidates.push({
                text: total.texts[i],
                fontScale,
                size: { width: size.width * fontScale, height: size.height * fontScale }
            }));
        }

        return candidates;
    };

    /** Writes each pie's total in its hole, the best way it fits, and leaves it out otherwise. */
    const layoutTotals = (props, holePx, result) => {

        const totals = props.pieTotalNodes || [];
        let fontSizePx = null;

        for (let i = 0; i < totals.length; i++) {

            const total = totals[i];

            total.textNode.style.display = "";
            total.textNode.style.fontSize = "";
            fontSizePx ??= parseFloat(getComputedStyle(total.textNode).fontSize);

            const candidate = getTotalCandidates(total).find(c =>
                getFurthestDistanceToBox(0, 0, getBox(0, 0, c.size)) <= holePx - LABEL_PADDING_PX);

            if (!candidate) {

                total.textNode.textContent = total.texts[0];
                total.textNode.style.display = "none";
                continue;
            }

            total.textNode.textContent = candidate.text;

            if (candidate.fontScale !== 1) {
                total.textNode.style.fontSize = fontSizePx * candidate.fontScale + "px";
            }

            total.textNode.setAttribute("x", total.pie.centreX * props.scaleX);
            total.textNode.setAttribute("y", total.pie.centreY * props.scaleY);
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

    return {
        layoutTotals,
        getShareCandidates,
        layoutShares
    };
})();
