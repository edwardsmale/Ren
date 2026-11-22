/**
 * Keeps a date/value chart's value labels legible once the style updater has laid them out, as
 * only then are their on-screen sizes known.  A label stays where drawn if clear, moves to the
 * other side of its point if that is free, and is dropped otherwise.  Each label is measured once
 * and candidate positions are worked out from that rectangle, so a resize costs one layout.
 */
Ren.DateValueChart_DeclutterValueLabels = (() => {

    // Labels touching at the edges read as one word.
    const LABEL_GAP_PX = 2;

    // Matches the distance the style updater draws an unflipped label above its point.
    const FLIPPED_LABEL_OFFSET_PX = 12;

    // A bar's label has nowhere else to go, as inside and outside the bar are both already used, so
    // a crowded bar series thins instead.
    const FLIPPABLE_WRAPPER_CLASSES = ["ren-line-value-label-wrapper", "ren-point-value-label-wrapper"];

    // Keeps a flipped label's original transform, since the pass also runs when a series' values
    // are toggled, which does not have the style updater rewrite the transform.
    const BASE_TRANSFORM_ATTRIBUTE = "data-declutter-base-transform";

    // Exposed for QA, since a dropped label looks the same as one never drawn.
    let lastResult = { placed: 0, flipped: 0, hidden: 0 };

    const getDiagnostics = () => lastResult;

    /** Gets a value indicating whether two ranges are close enough to read as one. */
    const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
        aStart - LABEL_GAP_PX < bEnd && aEnd + LABEL_GAP_PX > bStart;

    /**
     * Gets a value indicating whether two labels are close enough to read as one.  Two slanted
     * labels are compared along and across their slant, as the screen rectangles around them are
     * far larger than they are.
     */
    const overlaps = (a, b) => {

        if (a.slanted && b.slanted) {

            return rangesOverlap(a.slanted[0], a.slanted[1], b.slanted[0], b.slanted[1])
                && rangesOverlap(a.slanted[2], a.slanted[3], b.slanted[2], b.slanted[3]);
        }

        return rangesOverlap(a.left, a.right, b.left, b.right)
            && rangesOverlap(a.top, a.bottom, b.top, b.bottom);
    };

    /** Gets a slanted bar label's extent along and across its slant, or null for any other. */
    const getSlantedExtent = (wrapperNode) => {

        const attribute = Ren.DateValueChart_BarValueLabelLayout.SLANTED_EXTENT_ATTRIBUTE;
        const value = wrapperNode.getAttribute(attribute);

        if (!value) return null;

        const parts = value.split(" ");
        const extent = [];

        for (let i = 0; i < parts.length; i++) {

            extent.push(parseFloat(parts[i]));
        }

        return extent.length === 4 ? extent : null;
    };

    /** Gets a rectangle moved down the screen by a number of pixels. */
    const translatedDown = (rect, deltaPx) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top + deltaPx,
        bottom: rect.bottom + deltaPx
    });

    /**
     * Gets a value indicating whether a label can be drawn either side of its point.  A shaded
     * line's label cannot, as either side of the label's own shading is another series'.
     */
    const isFlippable = (wrapperNode) => {

        const belowClass = Ren.DateValueChart_RenderValueLabels.LINE_LABEL_BELOW_WRAPPER_CLASS;

        if (wrapperNode.classList.contains(belowClass)) return false;

        for (let i = 0; i < FLIPPABLE_WRAPPER_CLASSES.length; i++) {

            if (wrapperNode.classList.contains(FLIPPABLE_WRAPPER_CLASSES[i])) return true;
        }

        return false;
    };

    /**
     * Gets a chart's label wrappers in placement order.  Estimate labels come first, as dropping
     * one would leave its mark unexplained; the rest keep drawing order, so a crowded series thins
     * evenly along its length.
     */
    const collectWrappers = (layer) => {

        // A series' names in its bars are placed after this pass, giving way to its labels.
        const nodes = layer.querySelectorAll(
            ".ren-text-wrapper:not(." + Ren.DateValueChart_BarSeriesNames.WRAPPER_CLASS + ")"
        );

        const estimates = [];
        const rest = [];

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];

            // Undoes the last pass before measuring, so a chart resized to make room shows a label
            // again.
            node.style.display = "";

            const baseTransform = node.getAttribute(BASE_TRANSFORM_ATTRIBUTE);

            if (baseTransform !== null) {

                node.setAttribute("transform", baseTransform);
                node.removeAttribute(BASE_TRANSFORM_ATTRIBUTE);
            }

            if (node.classList.contains("ren-estimate-value-label")) {
                estimates.push(node);
            }
            else {

                rest.push(node);
            }
        }

        return estimates.concat(rest);
    };

    /**
     * Measures a label as drawn, or returns null for one not shown (a series with its values turned
     * off still draws its labels).
     */
    const measure = (wrapperNode) => {

        const rect = wrapperNode.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return null;

        return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            slanted: getSlantedExtent(wrapperNode)
        };
    };

    /**
     * Moves a label down the screen by a number of pixels, as a second translate, keeping the
     * original transform so that the next pass can restore it.
     */
    const translateWrapperDown = (wrapperNode, deltaPx, scaleY) => {

        const baseTransform = wrapperNode.getAttribute("transform") || "";
        const deltaSvg = deltaPx / scaleY;

        wrapperNode.setAttribute(BASE_TRANSFORM_ATTRIBUTE, baseTransform);
        wrapperNode.setAttribute("transform", `${baseTransform} translate(0, ${deltaSvg})`);
    };

    /**
     * Shows a chart's value labels where drawn, ready for measuring: the first of the three steps
     * declutter takes.  The steps are offered apart so that a caller with labels of its own to
     * measure can have them all measured in one layout, writing nothing in between.
     * @returns {object} What measure and apply take, or null for a chart with no labels to place.
     */
    const prepare = (props) => {

        const result = { placed: 0, flipped: 0, hidden: 0 };
        lastResult = result;

        if (!props || !props.chartGroup || !props.scaleY) return null;

        const layer = props.chartGroup.querySelector(
            "." + Ren.DateValueChart_RenderValueLabels.LABELS_LAYER_CLASS
        );

        if (!layer) return null;

        const wrappers = collectWrappers(layer);
        if (!wrappers.length) return null;

        return { props, result, wrappers, rects: null };
    };

    /**
     * Measures the labels prepare showed, all before any is moved or hidden, so that this costs
     * one layout.
     */
    const measureLabels = (state) => {

        if (!state) return;

        state.rects = [];

        for (let i = 0; i < state.wrappers.length; i++) {

            state.rects.push(measure(state.wrappers[i]));
        }
    };

    /** Shows, moves or hides each label as measured, reading nothing from the page. */
    const apply = (state) => {

        if (!state) return;

        const { props, result, wrappers, rects } = state;
        const placedRects = [];

        for (let i = 0; i < wrappers.length; i++) {

            const rect = rects[i];
            if (!rect) continue;

            // Where it was drawn first, then the other side of its point.
            const candidates = [rect];

            if (isFlippable(wrappers[i])) {

                const flipDeltaPx = (rect.bottom - rect.top) + FLIPPED_LABEL_OFFSET_PX * 2;
                candidates.push(translatedDown(rect, flipDeltaPx));
            }

            let chosenIndex = -1;

            for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {

                let isClear = true;

                for (let j = 0; j < placedRects.length; j++) {

                    if (overlaps(candidates[candidateIndex], placedRects[j])) {

                        isClear = false;
                        break;
                    }
                }

                if (isClear) {

                    chosenIndex = candidateIndex;
                    break;
                }
            }

            if (chosenIndex === -1) {

                // The whole wrapper goes, taking any "EST" caption with it.
                wrappers[i].style.display = "none";
                result.hidden++;
                continue;
            }

            if (chosenIndex > 0) {

                translateWrapperDown(
                    wrappers[i],
                    candidates[chosenIndex].top - rect.top,
                    props.scaleY
                );

                result.flipped++;
            }

            placedRects.push(candidates[chosenIndex]);
            result.placed++;
        }
    };

    /**
     * Settles which of a chart's value labels are shown and where.
     * @returns {object} { placed, flipped, hidden }, for the QA hooks.
     */
    const declutter = (props) => {

        const state = prepare(props);

        measureLabels(state);
        apply(state);

        return lastResult;
    };

    return {
        declutter,
        prepare,
        measure: measureLabels,
        apply,
        getDiagnostics
    };
})();
