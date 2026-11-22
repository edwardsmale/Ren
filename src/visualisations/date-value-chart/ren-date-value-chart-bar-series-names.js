/**
 * Writes a bar series' name up each of its bars, from the bottom left, for a series set to show it.
 * The names are drawn with the chart and placed once the style updater has scaled it, as only then
 * are the bars' and names' on-screen sizes known.  A name too long for its bar is shortened with an
 * ellipsis, and one its bar is too narrow or short for, or that would run into a value label, is
 * hidden.  Runs after the value labels are placed and decluttered, and
 * before the contrast pass, which colours the names for the bars they are on.
 */
Ren.DateValueChart_BarSeriesNames = (() => {

    const GROUP_CLASS = "ren-bar-series-names";
    const WRAPPER_CLASS = "ren-bar-series-name-wrapper";
    const LABEL_CLASS = "ren-bar-series-name-label";

    const LABEL_PADDING_PX = 3;

    // Glyphs are a little thinner than the line box getBBox reports.
    const GLYPH_HEIGHT_FRACTION = 0.85;

    // Marks a name on a bar for a negative value, which hangs down from the baseline.
    const BAR_DOWN_ATTRIBUTE = "data-bar-down";

    // Keeps the name whole, as the shown text may have been shortened by the last pass.
    const FULL_NAME_ATTRIBUTE = "data-full-name";

    const ELLIPSIS = "…";

    let lastResult = { placed: 0, hidden: 0 };

    const getDiagnostics = () => lastResult;

    /**
     * Draws a series' name, unplaced, for each of its bars.  The names go into the series' group
     * in the value label layer, so they fade and hide with its value labels.
     *
     * @param {Element} seriesGroup - The group the series' bars are drawn in.
     * @param {number} seriesIndex - The series' 0-based index.
     * @param {function} valueFn - Gets a bar's value from its row.
     */
    const render = (props, seriesGroup, seriesIndex, valueFn) => {

        const series = props.series && props.series[seriesIndex];

        if (!series || series.showNameInBars !== true) return;

        const name = series.label || props.valueHeadings[seriesIndex];

        if (!name) return;

        // An overlayed estimate's extra part is left out, as the bar it tops carries the name.
        const barNodes = seriesGroup.querySelectorAll(
            ".ren-data-series--bar .ren-bar.ren-vertical"
        );

        if (!barNodes.length) return;

        const namesGroup = Ren.Svg.append(
            Ren.DateValueChart_RenderValueLabels
                .getSeriesLabelsGroup(props, `.ren-series-${seriesIndex + 1}`),
            "g",
            { "class": GROUP_CLASS }
        );

        for (let i = 0; i < barNodes.length; i++) {

            const row = Ren.Svg.getDatum(barNodes[i]);
            const value = row ? valueFn(row) : null;

            // The wrapper's datum is the bar it names.
            const wrapper = Ren.Svg.append(namesGroup, "g", {
                "class": "ren-text-wrapper " + WRAPPER_CLASS,
                [BAR_DOWN_ATTRIBUTE]: value < 0 ? "true" : null
            });

            Ren.Svg.setDatum(wrapper, barNodes[i]);

            const text = Ren.Svg.append(wrapper, "text", {
                "class": LABEL_CLASS,
                "x": 0,
                "y": 0,
                [FULL_NAME_ATTRIBUTE]: name
            });

            text.textContent = name;

            Ren.DateValueChart_OtherSeries.addTooltip(wrapper, props, seriesIndex);
        }
    };

    /**
     * Gets a bar's extent in plot coordinates: its path's box, moved by the translations between
     * it and the chart group.
     */
    const getBarExtent = (barNode, chartGroupNode) => {

        const pathNode = barNode.querySelector(".ren-data-series__bar");

        if (!pathNode) return null;

        let box;

        try {

            box = pathNode.getBBox();
        }
        catch (error) {

            return null;
        }

        let offsetX = 0;
        let offsetY = 0;
        let current = pathNode;

        while (current && current !== chartGroupNode) {

            const transforms = current.transform && current.transform.baseVal;

            if (transforms) {

                for (let i = 0; i < transforms.numberOfItems; i++) {

                    const matrix = transforms.getItem(i).matrix;
                    offsetX += matrix.e;
                    offsetY += matrix.f;
                }
            }

            current = current.parentNode;
        }

        return {
            left: box.x + offsetX,
            right: box.x + box.width + offsetX,
            top: box.y + offsetY,
            bottom: box.y + box.height + offsetY
        };
    };

    /**
     * Measures a name, drawn in full with an ellipsis after it, in its own (screen pixel) units:
     * its thickness, and the length of each leading run of its characters with the ellipsis.
     * prefixLengths[n] is the length of the first n characters and an ellipsis, and the last entry
     * is the whole name's length without one.  Gets null where the name is not shown.
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

            return { thickness: box.height, prefixLengths: prefixLengths };
        }
        catch (error) {

            return null;
        }
    };

    /**
     * Gets the text to show for a name in a length, shortened to end in an ellipsis where the
     * whole name is too long, or null where not even one character and an ellipsis fit.
     */
    const fitName = (fullName, prefixLengths, availableLengthPx) => {

        if (prefixLengths[fullName.length] <= availableLengthPx) return fullName;

        for (let count = fullName.length - 1; count >= 1; count--) {

            if (prefixLengths[count] <= availableLengthPx) {

                return fullName.substring(0, count).replace(/\s+$/, "") + ELLIPSIS;
            }
        }

        return null;
    };

    /** Gets a value indicating whether two screen rectangles overlap. */
    const rectsOverlap = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    /**
     * Hides each placed name that runs into a shown value label, as the value says more about its
     * bar than the name does.
     *
     * @returns {number} How many names were hidden.
     */
    const hideNamesUnderValueLabels = (layerNode, placedNodes) => {

        const valueLabelNodes = layerNode.querySelectorAll(
            ".ren-text-wrapper:not(." + WRAPPER_CLASS + ")"
        );

        const valueLabelRects = [];

        for (let i = 0; i < valueLabelNodes.length; i++) {

            const rect = valueLabelNodes[i].getBoundingClientRect();

            if (rect.width && rect.height) valueLabelRects.push(rect);
        }

        const nameRects = [];

        for (let i = 0; i < placedNodes.length; i++) {

            nameRects.push(placedNodes[i].getBoundingClientRect());
        }

        let hiddenCount = 0;

        for (let i = 0; i < placedNodes.length; i++) {

            for (let j = 0; j < valueLabelRects.length; j++) {

                if (!rectsOverlap(nameRects[i], valueLabelRects[j])) continue;

                placedNodes[i].style.display = "none";
                hiddenCount++;
                break;
            }
        }

        return hiddenCount;
    };

    /**
     * Places a chart's bar series names at the bottom left of their bars, reading up them.  All
     * measuring is done before any name is moved, and the names are then checked against the
     * value labels in a second layout.
     *
     * @returns {object} { placed, hidden }, for the QA hooks.
     */
    const layout = (props) => {

        const result = { placed: 0, hidden: 0 };
        lastResult = result;

        if (!props || !props.chartGroup || !props.scaleX || !props.scaleY) return result;

        const layerClass = Ren.DateValueChart_RenderValueLabels.LABELS_LAYER_CLASS;
        const layerNode = props.chartGroup.querySelector("." + layerClass);

        if (!layerNode) return result;

        const wrapperNodes = layerNode.querySelectorAll("." + WRAPPER_CLASS);

        if (!wrapperNodes.length) return result;

        const chartGroupNode = props.chartGroup;
        const names = [];

        for (let i = 0; i < wrapperNodes.length; i++) {

            // Undoes the last pass before measuring, so a bar grown to make room shows its name.
            wrapperNodes[i].style.display = "";

            const labelNode = wrapperNodes[i].querySelector("." + LABEL_CLASS);

            // The ellipsis is drawn after the full name so that one layout measures both.
            if (labelNode) {

                labelNode.textContent = labelNode.getAttribute(FULL_NAME_ATTRIBUTE) + ELLIPSIS;
            }
        }

        for (let i = 0; i < wrapperNodes.length; i++) {

            const wrapperNode = wrapperNodes[i];
            const labelNode = wrapperNode.querySelector("." + LABEL_CLASS);
            const barNode = Ren.Svg.getDatum(wrapperNode);
            const fullName = labelNode ? labelNode.getAttribute(FULL_NAME_ATTRIBUTE) : "";

            names.push({
                wrapperNode: wrapperNode,
                labelNode: labelNode,
                fullName: fullName,
                isDown: wrapperNode.getAttribute(BAR_DOWN_ATTRIBUTE) === "true",
                extent: labelNode && barNode ? getBarExtent(barNode, chartGroupNode) : null,
                measurement: labelNode ? measureName(labelNode, fullName) : null
            });
        }

        const placedNodes = [];

        for (let i = 0; i < names.length; i++) {

            const name = names[i];
            const extent = name.extent;
            const measurement = name.measurement;
            const thicknessPx = measurement ? measurement.thickness * GLYPH_HEIGHT_FRACTION : 0;
            const barWidthPx = extent ? (extent.right - extent.left) * props.scaleX : 0;
            const barLengthPx = extent ? (extent.bottom - extent.top) * props.scaleY : 0;

            const availableLengthPx = barLengthPx - LABEL_PADDING_PX * 2;
            const text = measurement && thicknessPx + LABEL_PADDING_PX * 2 <= barWidthPx
                ? fitName(name.fullName, measurement.prefixLengths, availableLengthPx)
                : null;

            if (name.labelNode) name.labelNode.textContent = text || name.fullName;

            if (text === null) {

                name.wrapperNode.style.display = "none";
                result.hidden++;
                continue;
            }

            // Turned to read up the bar, the text is centred across its line, and runs from its
            // start.  A bar hanging down has its foot at the top, so its name ends there.
            const x = extent.left + (LABEL_PADDING_PX + thicknessPx / 2) / props.scaleX;
            const y = name.isDown
                ? extent.top + LABEL_PADDING_PX / props.scaleY
                : extent.bottom - LABEL_PADDING_PX / props.scaleY;

            name.wrapperNode.setAttribute("transform", `translate(${x}, ${y})`);
            name.labelNode.setAttribute("text-anchor", name.isDown ? "end" : "start");

            placedNodes.push(name.wrapperNode);
        }

        const hiddenCount = hideNamesUnderValueLabels(layerNode, placedNodes);

        result.placed = placedNodes.length - hiddenCount;
        result.hidden += hiddenCount;

        return result;
    };

    return {
        WRAPPER_CLASS,
        LABEL_CLASS,
        getBarExtent,
        measureName,
        fitName,
        hideNamesUnderValueLabels,
        render,
        layout,
        getDiagnostics
    };
})();
