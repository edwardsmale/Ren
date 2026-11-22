/**
 * Previews a value-resize drag by rescaling the bars on the dragged handle's axis about the
 * baseline.  Positions are recomputed from the geometry captured at the start of the drag, so the
 * preview never compounds its own rounding.
 */
Ren.DateValueChart_ValueResizePreview = (() => {

    const translateRegex = /translate\(\s*([-\d.eE+]+)\s*[, ]\s*([-\d.eE+]+)\s*\)/;

    // Keeps bars dragged to or past the baseline visible.
    const minimumScaleFactor = 0.001;

    /**
     * Gets an element's translation, or null when it has none to scale.
     */
    const getTranslation = element => {

        const match = translateRegex.exec(element.getAttribute("transform") || "");

        if (!match) return null;

        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);

        return isNaN(x) || isNaN(y) ? null : { x: x, y: y };
    };

    /**
     * Gets the y the plot is scaled about: the pixel the value zero sits at.
     */
    const getBaselineY = (props, yScale) => {

        if (props && typeof props.innerHeight === "number") return props.innerHeight;

        const range = yScale.getRange();

        return Math.max(range[0], range[1]);
    };

    /**
     * Gets the 1-based series numbers of the bar series plotted against the scale being dragged.
     * Other series wait for the redraw when the drag ends.
     */
    const getBarSeriesNumbers = (props, axisNames) => {

        const numbers = [];
        const seriesTypeStrings = props.seriesTypeStrings || [];

        for (let i = 0; i < (props.seriesCount || 0); i++) {

            const series = props.series ? props.series[i] : null;

            if (!series || series.isEnabled === false) continue;
            if (seriesTypeStrings[i] && seriesTypeStrings[i] !== "bar") continue;
            if (axisNames.indexOf(series.valueAxis || "leftAxis") === -1) continue;

            numbers.push(i + 1);
        }

        return numbers;
    };

    /**
     * Adds the chart group's elements matching a selector to the items to be rescaled.  kind is
     * "bar" (moved and scaled), "handle" (height spans a bar), "tick" (hidden off the plot) or
     * "move" (translation only).
     */
    const captureSelection = (items, chartGroup, selector, kind, excludeNode) => {

        const nodes = chartGroup.querySelectorAll(selector);

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];

            if (node === excludeNode) continue;

            const translation = getTranslation(node);

            if (!translation) continue;

            const height = kind === "handle" ? parseFloat(node.getAttribute("height")) : 0;

            items.push({
                node: node,
                kind: kind,
                x: translation.x,
                y: translation.y,
                height: isNaN(height) ? 0 : height,
                transform: node.getAttribute("transform")
            });
        }
    };

    /**
     * Captures the geometry the drag rescales, returning the state for applyScale and restore, or
     * null when there is nothing to preview.  The dragged handle follows the cursor instead.
     */
    const capture = (props, yScale, draggedHandleNode) => {

        if (!props || !props.chartGroup || !yScale) return null;

        const axisNames = Ren.DateValueChart_YScales.getAxisNamesOnScale(props, yScale);
        const seriesNumbers = getBarSeriesNumbers(props, axisNames);
        const items = [];

        for (let i = 0; i < seriesNumbers.length; i++) {

            const inSeries = `g.ren-series-${seriesNumbers[i]} `;
            const group = props.chartGroup;

            captureSelection(items, group, inSeries + ".ren-bar.ren-vertical", "bar", null);
            captureSelection(items, group, inSeries + ".ren-text-wrapper", "move", null);
            captureSelection(items, group, inSeries + ".ren-bar-resize-handle", "handle", null);
            captureSelection(
                items,
                group,
                inSeries + ".ren-value-resize-handle",
                "handle",
                draggedHandleNode
            );
        }

        if (!items.length) return null;

        // The ticks move with the bars, so the scale being set can be read off during the drag.
        for (let i = 0; i < axisNames.length; i++) {

            const axisSelector = axisNames[i] === "rightAxis" ? ".ren-y-axis-2" : ".ren-y-axis:not(.ren-y-axis-2)";

            captureSelection(items, props.chartGroup, `${axisSelector} g.tick`, "tick", null);
        }

        return {
            items: items,
            baselineY: getBaselineY(props, yScale)
        };
    };

    /**
     * Rescales the captured elements about the baseline by the fraction the plotted heights now
     * are.
     */
    const applyScale = (state, scaleFactor) => {

        if (!state) return;

        const factor = Math.max(minimumScaleFactor, scaleFactor);
        const baselineY = state.baselineY;
        const items = state.items;

        for (let i = 0; i < items.length; i++) {

            const item = items[i];
            const y = baselineY - (baselineY - item.y) * factor;

            if (item.kind === "bar") {

                item.node.setAttribute("transform", `translate(${item.x},${y}) scale(1,${factor})`);
                continue;
            }

            item.node.setAttribute("transform", `translate(${item.x},${y})`);

            if (item.kind === "handle" && item.height) {

                item.node.setAttribute("height", item.height * factor);
            }
            else if (item.kind === "tick") {

                const isOffPlot = y < -0.5 || y > baselineY + 0.5;
                item.node.style.display = isOffPlot ? "none" : "";
            }
        }
    };

    /**
     * Puts the captured elements back, for a drag that ends without a redraw.
     */
    const restore = state => {

        if (!state) return;

        const items = state.items;

        for (let i = 0; i < items.length; i++) {

            const item = items[i];

            item.node.setAttribute("transform", item.transform);

            if (item.kind === "handle" && item.height) {
                item.node.setAttribute("height", item.height);
            }
            else if (item.kind === "tick") {

                item.node.style.display = "";
            }
        }
    };

    return {
        capture,
        applyScale,
        restore
    };
})();
