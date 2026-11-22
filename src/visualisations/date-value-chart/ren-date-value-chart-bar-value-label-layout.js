/**
 * Places a date/value chart's bar value labels once the style updater has scaled the chart, as only
 * then are the bars' and labels' on-screen sizes known.  A label is written horizontally, turned to
 * run up the bar or slanted, and put inside its bar where it fits or beyond its end where it does
 * not.  A label left inside a bar it does not fit is marked as overflowing, so that the contrast
 * pass colours it for what it spills onto.  Runs before the declutter pass.
 */
Ren.DateValueChart_BarValueLabelLayout = (() => {

    const LAYOUTS = {
        Auto: "auto",
        Horizontal: "horizontal",
        Above: "above",
        Vertical: "vertical",
        Diagonal: "diagonal"
    };

    const ORIENTATIONS = {
        Horizontal: "horizontal",
        Vertical: "vertical",
        Diagonal: "diagonal"
    };

    // Below this share of labels fitting across their bars, "auto" moves them all beyond the bars'
    // ends, as one chart mixing the two reads badly.
    const MIN_HORIZONTAL_FIT_FRACTION = 0.75;

    // A slanted label rises at 45 degrees, so each pixel along it is this far across and up.
    const DIAGONAL_COMPONENT = Math.SQRT1_2;

    const LABEL_PADDING_PX = 4;

    // From a bar's top to an inside horizontal label's baseline.
    const INSIDE_BASELINE_OFFSET_PX = 16;

    const CAPTION_GAP_PX = 3;

    // Glyphs are a little thinner than the line box getBBox reports.
    const GLYPH_HEIGHT_FRACTION = 0.85;

    const WRAPPER_SELECTOR = ".ren-bar-value-labels > .ren-text-wrapper";
    const CAPTION_CLASS = "ren-estimate-period-label";
    const VERTICAL_CLASS = "ren-bar-value-label--vertical";
    const DIAGONAL_CLASS = "ren-bar-value-label--diagonal";
    const OVERFLOWING_CLASS = "ren-bar-value-label--overflowing";
    const INSIDE_CLASS = "ren-bar-value-label--inside";
    const OUTSIDE_CLASS = "ren-bar-value-label--outside";
    const INSIDE_WRAPPER_CLASS = "ren-bar-value-label-wrapper--inside";
    const OUTSIDE_WRAPPER_CLASS = "ren-bar-value-label-wrapper--outside";

    // Keeps the caption's dy as drawn, since a turned label's caption follows it along the bar.
    const CAPTION_DY_ATTRIBUTE = "data-caption-dy";

    // A slanted label's extent along and across its slant, in plot pixels, for the declutter pass:
    // the screen rectangle around one is far larger than the label, so would collide with every
    // neighbour.
    const SLANTED_EXTENT_ATTRIBUTE = "data-slanted-extent";

    let lastResult = { layout: LAYOUTS.Horizontal, inside: 0, outside: 0, overflowing: 0 };

    const getDiagnostics = () => lastResult;

    /** Gets the layout a chart is set to, "auto" where it is unset or unknown. */
    const getLayout = (props) => {

        const layout = props.barValueLabelLayout;

        if (layout === LAYOUTS.Horizontal || layout === LAYOUTS.Above
            || layout === LAYOUTS.Vertical || layout === LAYOUTS.Diagonal) {

            return layout;
        }

        return LAYOUTS.Auto;
    };

    /** Gets the length a label and its caption take along the line they are written on. */
    const getTextLength = (label) => {

        const captionLength = label.captionNode && label.captionSize.width
            ? CAPTION_GAP_PX + label.captionSize.width
            : 0;

        return label.labelSize.width + captionLength;
    };

    /** Gets a text's size in its own (screen pixel) units, or zeros where it is not shown. */
    const measureText = (textNode) => {

        if (!textNode) return { width: 0, height: 0 };

        try {

            const box = textNode.getBBox();
            return { width: box.width, height: box.height };
        }
        catch (error) {

            return { width: 0, height: 0 };
        }
    };

    /** Gathers a chart's bar labels with their bars' extents and their own measured sizes. */
    const collectLabels = (props) => {

        const nodes = props.chartGroup.querySelectorAll(WRAPPER_SELECTOR);
        const labels = [];

        for (let i = 0; i < nodes.length; i++) {

            const wrapperNode = nodes[i];
            const labelNode = wrapperNode.querySelector("text:not(." + CAPTION_CLASS + ")");
            const captionNode = wrapperNode.querySelector("text." + CAPTION_CLASS);

            if (!labelNode) continue;

            labels.push({
                wrapperNode: wrapperNode,
                labelNode: labelNode,
                captionNode: captionNode,
                x: parseFloat(wrapperNode.getAttribute("data-x")),
                barEnd: parseFloat(wrapperNode.getAttribute("data-bar-end")),
                barBase: parseFloat(wrapperNode.getAttribute("data-bar-base")),
                barWidth: parseFloat(wrapperNode.getAttribute("data-bar-width")) || 0,
                isStacked: wrapperNode.getAttribute("data-bar-stacked") === "true",
                labelSize: measureText(labelNode),
                captionSize: measureText(captionNode)
            });
        }

        return labels;
    };

    /**
     * Gets the layout "auto" settles on: horizontal while most shown labels fit across their bars,
     * and above the bars otherwise.
     */
    const resolveAutoLayout = (props, labels) => {

        let measuredCount = 0;
        let fittingCount = 0;

        for (let i = 0; i < labels.length; i++) {

            const label = labels[i];

            if (!label.labelSize.width) continue;

            measuredCount++;

            if (label.labelSize.width + LABEL_PADDING_PX <= label.barWidth * props.scaleX) {
                fittingCount++;
            }
        }

        if (!measuredCount || fittingCount / measuredCount >= MIN_HORIZONTAL_FIT_FRACTION) {
            return LAYOUTS.Horizontal;
        }

        return LAYOUTS.Above;
    };

    /**
     * Works out a horizontal label's placement, as the offset of its baseline from its bar's end
     * in screen pixels.  A caption is a second line beneath it.
     */
    const placeHorizontal = (label, layout, barLengthPx, barWidthPx) => {

        const lineHeight = label.labelSize.height;
        const captionLinePx = label.captionNode ? lineHeight : 0;
        const isUp = label.barEnd <= label.barBase;

        if (label.isStacked) {

            const fits = label.labelSize.width <= barWidthPx
                && lineHeight + captionLinePx <= barLengthPx;

            // Centred on the segment, the caption's line sharing the room.
            return {
                isInside: true,
                isOverflowing: !fits,
                offsetPx: (isUp ? barLengthPx : -barLengthPx) / 2
                    + lineHeight * 0.3 - captionLinePx / 2
            };
        }

        const isInside = layout === LAYOUTS.Horizontal
            && barLengthPx >= INSIDE_BASELINE_OFFSET_PX + LABEL_PADDING_PX + captionLinePx;

        if (isInside) {

            return {
                isInside: true,
                isOverflowing: label.labelSize.width > barWidthPx,
                offsetPx: isUp
                    ? INSIDE_BASELINE_OFFSET_PX
                    : -LABEL_PADDING_PX - captionLinePx
            };
        }

        // Beyond the bar's end, lifted clear of it by the caption's line too.
        return {
            isInside: false,
            isOverflowing: false,
            reachPx: LABEL_PADDING_PX + captionLinePx + lineHeight,
            offsetPx: isUp
                ? -LABEL_PADDING_PX - captionLinePx
                : LABEL_PADDING_PX + lineHeight * 0.8
        };
    };

    /**
     * Works out a turned label's placement: the offset of its anchor from its bar's end in screen
     * pixels, and which end of the text the anchor is.  The text reads up the bar, its caption
     * following on along it.
     */
    const placeVertical = (props, label, barLengthPx, barWidthPx) => {

        const textLength = getTextLength(label);
        const isTooThick = label.labelSize.height * GLYPH_HEIGHT_FRACTION > barWidthPx;
        const isUp = label.barEnd <= label.barBase;

        if (label.isStacked) {

            return {
                isInside: true,
                isOverflowing: isTooThick || textLength + LABEL_PADDING_PX * 2 > barLengthPx,
                offsetPx: (isUp ? barLengthPx : -barLengthPx) / 2,
                anchor: "middle"
            };
        }

        const fitsInside = textLength + LABEL_PADDING_PX * 2 <= barLengthPx;

        // Beyond the end of the tallest bars a label would run off the plot, so it stays inside.
        const endPx = label.barEnd * props.scaleY;
        const plotHeightPx = props.innerHeight * props.scaleY;
        const fitsOutside = isUp
            ? endPx - LABEL_PADDING_PX - textLength >= 0
            : endPx + LABEL_PADDING_PX + textLength <= plotHeightPx;

        const isInside = fitsInside || !fitsOutside;

        // The text's start is its bottom, so inside a bar standing up it ends near the top.
        let anchor;

        if (isInside) {
            anchor = isUp ? "end" : "start";
        }
        else {

            anchor = isUp ? "start" : "end";
        }

        const isOffsetDown = anchor === "end";

        return {
            isInside: isInside,
            isOverflowing: isInside && (isTooThick || !fitsInside),
            reachPx: LABEL_PADDING_PX + textLength,
            offsetPx: isOffsetDown ? LABEL_PADDING_PX : -LABEL_PADDING_PX,
            anchor: anchor
        };
    };

    /**
     * Works out a slanted label's placement, as placeVertical does.  The text rises to the right at
     * 45 degrees from just beyond its bar's end, its caption following on along it.  Where that
     * would run off the plot, it runs back from the bar's end across the bar and its neighbours.
     */
    const placeDiagonal = (props, label, barLengthPx, barWidthPx) => {

        const textLength = getTextLength(label);
        const halfThicknessPx = label.labelSize.height * GLYPH_HEIGHT_FRACTION / 2;

        // Centred on its line, so the first glyph's corner reaches back towards the bar.
        const clearancePx = LABEL_PADDING_PX + halfThicknessPx * DIAGONAL_COMPONENT;
        const isUp = label.barEnd <= label.barBase;

        if (label.isStacked) {

            const spanPx = (textLength + halfThicknessPx * 2) * DIAGONAL_COMPONENT;

            return {
                isInside: true,
                isOverflowing: spanPx > barWidthPx || spanPx > barLengthPx,
                offsetPx: (isUp ? barLengthPx : -barLengthPx) / 2,
                anchor: "middle"
            };
        }

        const risePx = textLength * DIAGONAL_COMPONENT + clearancePx;
        const endPx = label.barEnd * props.scaleY;
        const plotHeightPx = props.innerHeight * props.scaleY;
        const fitsOutside = isUp
            ? endPx - risePx >= 0
            : endPx + risePx <= plotHeightPx;

        // Rising from its start, a label above its point starts there, and one below ends there.
        const isAbove = isUp === fitsOutside;

        return {
            isInside: !fitsOutside,
            isOverflowing: !fitsOutside,
            reachPx: risePx + halfThicknessPx,
            offsetPx: isAbove ? -clearancePx : clearancePx,
            anchor: isAbove ? "start" : "end"
        };
    };

    /**
     * Gets a slanted label's extent along its slant and across it, in plot pixels, as
     * "alongStart alongEnd acrossStart acrossEnd".
     */
    const getSlantedExtent = (props, label, placement) => {

        const anchorX = label.x * props.scaleX;
        const anchorY = label.barEnd * props.scaleY + placement.offsetPx;

        // Along runs up and to the right, across down and to the right.
        const along = (anchorX - anchorY) * DIAGONAL_COMPONENT;
        const across = (anchorX + anchorY) * DIAGONAL_COMPONENT;

        const textLength = getTextLength(label);
        const halfThicknessPx = label.labelSize.height * GLYPH_HEIGHT_FRACTION / 2;

        let alongStart = along;

        if (placement.anchor === "end") {
            alongStart = along - textLength;
        }
        else if (placement.anchor === "middle") {

            alongStart = along - textLength / 2;
        }

        return [
            alongStart,
            alongStart + textLength,
            across - halfThicknessPx,
            across + halfThicknessPx
        ].join(" ");
    };

    /** Sets a class on a label's texts, its caption's included, or takes it off. */
    const setTextClass = (label, className, isSet) => {

        label.labelNode.classList.toggle(className, isSet);

        if (label.captionNode) label.captionNode.classList.toggle(className, isSet);
    };

    const applyPlacement = (props, label, placement, orientation) => {

        const wrapperNode = label.wrapperNode;
        const y = label.barEnd + placement.offsetPx / props.scaleY;
        const isVertical = orientation === ORIENTATIONS.Vertical;
        const isDiagonal = orientation === ORIENTATIONS.Diagonal;

        wrapperNode.setAttribute("transform", `translate(${label.x}, ${y})`);
        wrapperNode.classList.toggle(INSIDE_WRAPPER_CLASS, placement.isInside);
        wrapperNode.classList.toggle(OUTSIDE_WRAPPER_CLASS, !placement.isInside);

        if (placement.isInside) {
            wrapperNode.removeAttribute(Ren.DateValueChart_Extremes.OUTSIDE_REACH_ATTRIBUTE);
        }
        else {

            wrapperNode.setAttribute(
                Ren.DateValueChart_Extremes.OUTSIDE_REACH_ATTRIBUTE,
                placement.reachPx
            );
        }

        if (isDiagonal) {

            wrapperNode.setAttribute(
                SLANTED_EXTENT_ATTRIBUTE,
                getSlantedExtent(props, label, placement)
            );
        }
        else {

            wrapperNode.removeAttribute(SLANTED_EXTENT_ATTRIBUTE);
        }

        setTextClass(label, INSIDE_CLASS, placement.isInside);
        setTextClass(label, OUTSIDE_CLASS, !placement.isInside);
        setTextClass(label, OVERFLOWING_CLASS, placement.isOverflowing);
        setTextClass(label, VERTICAL_CLASS, isVertical);
        setTextClass(label, DIAGONAL_CLASS, isDiagonal);

        const isAlongText = isVertical || isDiagonal;
        const anchor = isAlongText ? placement.anchor : "middle";
        label.labelNode.setAttribute("text-anchor", anchor);

        const captionNode = label.captionNode;

        if (!captionNode) {

            label.labelNode.setAttribute("x", 0);
            return;
        }

        if (!captionNode.hasAttribute(CAPTION_DY_ATTRIBUTE)) {
            captionNode.setAttribute(CAPTION_DY_ATTRIBUTE, captionNode.getAttribute("dy") || "");
        }

        captionNode.setAttribute("text-anchor", anchor);

        if (!isAlongText) {

            label.labelNode.setAttribute("x", 0);
            captionNode.setAttribute("x", 0);
            captionNode.setAttribute("dy", captionNode.getAttribute(CAPTION_DY_ATTRIBUTE));
            return;
        }

        // Along turned or slanted text, x runs the way it reads.
        const labelLength = label.labelSize.width + CAPTION_GAP_PX;
        const captionLength = label.captionSize.width + CAPTION_GAP_PX;
        let labelX = 0;
        let captionX;

        if (anchor === "end") {
            captionX = -labelLength;
        }
        else if (anchor === "start") {

            captionX = labelLength;
        }
        else {

            labelX = captionLength / 2;
            captionX = -labelLength / 2;
        }

        label.labelNode.setAttribute("x", labelX);
        captionNode.setAttribute("x", captionX);
        captionNode.setAttribute("dy", 0);
    };

    /**
     * Places a chart's bar value labels for the layout it is set to.  All measuring is done before
     * any label is moved, so the pass costs a single layout.
     *
     * @returns {object} { layout, inside, outside, overflowing }, for the QA hooks.
     */
    const layout = (props) => {

        const result = { layout: LAYOUTS.Horizontal, inside: 0, outside: 0, overflowing: 0 };
        lastResult = result;

        if (!props || !props.chartGroup || !props.scaleX || !props.scaleY) return result;

        const labels = collectLabels(props);

        if (!labels.length) {

            Ren.DateValueChart_Extremes.clearBarValueLabels(props);
            return result;
        }

        let resolvedLayout = getLayout(props);

        if (resolvedLayout === LAYOUTS.Auto) {
            resolvedLayout = resolveAutoLayout(props, labels);
        }

        result.layout = resolvedLayout;

        let orientation = ORIENTATIONS.Horizontal;

        if (resolvedLayout === LAYOUTS.Vertical) {
            orientation = ORIENTATIONS.Vertical;
        }
        else if (resolvedLayout === LAYOUTS.Diagonal) {

            orientation = ORIENTATIONS.Diagonal;
        }

        for (let i = 0; i < labels.length; i++) {

            const label = labels[i];
            const barLengthPx = Math.abs(label.barBase - label.barEnd) * props.scaleY;
            const barWidthPx = label.barWidth * props.scaleX;
            let placement;

            if (orientation === ORIENTATIONS.Vertical) {
                placement = placeVertical(props, label, barLengthPx, barWidthPx);
            }
            else if (orientation === ORIENTATIONS.Diagonal) {

                placement = placeDiagonal(props, label, barLengthPx, barWidthPx);
            }
            else {

                placement = placeHorizontal(label, resolvedLayout, barLengthPx, barWidthPx);
            }

            applyPlacement(props, label, placement, orientation);

            if (placement.isInside) {
                result.inside++;
            }
            else {

                result.outside++;
            }

            if (placement.isOverflowing) result.overflowing++;
        }

        // The highest and lowest bars' marks go beyond any value labels now outside them.
        Ren.DateValueChart_Extremes.clearBarValueLabels(props);

        return result;
    };

    return {
        LAYOUTS,
        VERTICAL_CLASS,
        DIAGONAL_CLASS,
        OVERFLOWING_CLASS,
        SLANTED_EXTENT_ATTRIBUTE,
        getLayout,
        layout,
        getDiagnostics
    };
})();
