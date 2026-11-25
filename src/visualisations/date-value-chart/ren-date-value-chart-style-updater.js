Ren.DateValueChart_StyleUpdater = (() => {

    const {
        seriesColourElements, getSeriesColour, pushSeriesColourProperty, buildLegendSeriesStyles,
        buildLegendLayoutStyles, buildLineStyles, buildPointStyles, IN_PLACE_PASTEL_STRENGTH,
        getEstimatePastelStrength, hasEstimate, buildEstimateStyles, buildInsideBarLabelStyle,
        buildBarSeriesNameStyle, buildEstimateInsideBarLabelStyle, estimateCaptionStyle,
        SERIES_NAMES_IN_BARS_FONT_SIZE_PX, LINE_NAMES_LAYER_CLASS, PIE_LABELS_LAYER_CLASS,
        SUBDIVISION_LABELS_LAYER_CLASS, valueLabelClasses, axisTickLabelClasses,
        defaultLabelFontSizes, valueLabelFontSize, axisLabelFontSize
    } = Ren.DateValueChart_StyleBuilders;

    const {
        setPreviewColours, setPreviewLines, setPreviewDots, clearPreview
    } = Ren.DateValueChart_StylePreviews;

    const {
        updateSelectionStyles, updateHighlightedValueLabels, updateHoverStyles
    } = Ren.DateValueChart_StyleSelection;

    let prevContainerWidth = 0;
    let prevContainerHeight = 0;

    // How opaque a shaded line's fill is, where the chart does not set its own.
    const DEFAULT_LINE_SHADING_OPACITY = 0.25;

    const SERIES_FADE_TRANSITION = "opacity 0.15s ease, filter 0.15s ease";

    // The axis group is scaled with the plot, so the ticks shrink with the chart; the extension is
    // in visual pixels so they stay legible on any size of chart.
    const DATE_AXIS_TICK_SIZE = 6;
    const DATE_AXIS_TICK_EXTENSION_PX = 2;

    /**
     * Sets the date axis' tick length, the visual-pixel extension divided by the axis group's
     * vertical scale.  The marks are drawn as paths, so the path is rewritten.
     */
    const setDateAxisTickLength = (props, scaleY) => {

        if (!props.chartGroup || !scaleY) return;

        const lengthPx = DATE_AXIS_TICK_SIZE + DATE_AXIS_TICK_EXTENSION_PX / scaleY;

        const tickPaths = props.chartGroup.querySelectorAll(".ren-x-axis g.tick path");

        for (let i = 0; i < tickPaths.length; i++) {

            tickPaths[i].setAttribute("d", `M0,0L0,${lengthPx}`);
        }
    };

    const updateScales = (props, containerWidth, containerHeight) => {

        // Margins are visual pixels (no viewBox), so the scaled content fills what remains.
        const scalableWidth = containerWidth - props.margin.left - props.margin.right;
        const scalableHeight = containerHeight - props.margin.top - props.margin.bottom;
        props.scaleX = scalableWidth / props.width;

        // The chart draws vertically across the plot area alone, not its margins as well.
        props.scaleY = scalableHeight / props.innerHeight;
    };

    /**
     * Gets the height the svg is laid out at, or else its container's, or 0 if it has neither.
     * clientHeight can be 0 on SVG elements, so the rendered rect is used.  Inside a zoomed popup
     * that is scaled, unlike clientWidth, so is scaled back to layout pixels.
     */
    const getLayoutHeight = (props, containerNode) => {

        const svgNode = props.svg || null;
        const svgBCR = svgNode ? svgNode.getBoundingClientRect() : null;
        const renderedWidth = containerNode ? containerNode.getBoundingClientRect().width : 0;
        const layoutScale = renderedWidth && containerNode.offsetWidth
            ? renderedWidth / containerNode.offsetWidth
            : 1;

        return svgBCR && svgBCR.height > 0
            ? svgBCR.height / layoutScale
            : (containerNode ? containerNode.clientHeight : 0);
    };

    /**
     * @param {boolean} [isLegendRealigned] - Whether this pass follows the legend's items being
     *     aligned, or the plot being resized by the pass before, which is not done again.
     */
    const updateStylesheet = (props, containerWidth, containerHeight, isLegendRealigned) => {

        // A chart drawn as several charts has no plot of its own, so its legend, which can change
        // the room they have, is restyled first and then each of them at its own size.
        if (props.multiChartProps) {

            if (props.multiChartLegendProps) updateLegendStylesheet(props.multiChartLegendProps);

            for (let index = 0; index < props.multiChartProps.length; index++) {

                updateStylesheet(props.multiChartProps[index]);
            }

            return;
        }

        if (!props.margin) return;

        const containerNode = document.querySelector("." + props.guid);
        const actualContainerWidth = containerNode ? containerNode.clientWidth : 0;
        const actualContainerHeight = getLayoutHeight(props, containerNode);

        containerWidth = actualContainerWidth || containerWidth || prevContainerWidth;
        containerHeight = actualContainerHeight || containerHeight || prevContainerHeight;

        prevContainerWidth = containerWidth;
        prevContainerHeight = containerHeight;

        if (containerWidth && containerHeight) {
            updateScales(props, containerWidth, containerHeight);
        }

        const scaleX = props.scaleX;
        const scaleY = props.scaleY;

        let textScaleX = 1 / scaleX;
        let textScaleY = 1 / scaleY;

        const styles = [];

        styles.push(`.ren-data-series { scale: ${scaleX} ${scaleY}; transform-origin: 0 0 }`);
        styles.push(`.ren-date-axis { scale: ${scaleX} ${scaleY}; transform-origin: 0 0 }`);
        styles.push(`.ren-value-axis { scale: ${scaleX} ${scaleY}; transform-origin: 0 0 }`);

        // Marker lines share the series' plot-area coordinates, so are scaled alongside them.
        styles.push(`.ren-marker-lines { scale: ${scaleX} ${scaleY}; transform-origin: 0 0 }`);

        // Value labels are drawn into a layer of their own, but in the series' plot coordinates.
        styles.push(`.ren-value-labels-layer { scale: ${scaleX} ${scaleY}; transform-origin: 0 0 }`);
        styles.push(
            ".ren-trend-lines, .ren-value-lines, .ren-gridlines, .ren-period-focus, .ren-extremes, "
            + ".ren-previous-year "
            + `{ scale: ${scaleX} ${scaleY}; transform-origin: 0 0 }`
        );

        styles.push(
            ".ren-text-wrapper text, .ren-text-wrapper .ren-extreme-marker "
            + `{ scale: ${textScaleX} ${textScaleY}; transform-origin: 0 0 }`
        );

        // A line's nodes, and a point series' dots and their rings, are rescaled about their own
        // centres to the greater of the series' scales, so they stay round.  A series' dot is the
        // circle in its point group, and an estimate's dot a circle of its own.
        const nodeScale = Math.max(scaleX, scaleY);
        styles.push(
            ".ren-data-series__line-node, .ren-data-series__point-dot, circle.ren-data-series__point, "
            + ".ren-data-series__point-ring "
            + `{ scale: ${nodeScale / scaleX} ${nodeScale / scaleY}; `
            + "transform-box: fill-box; transform-origin: center }"
        );

        const pieStyles = Ren.DateValueChart_Pies.buildStyles(props, scaleX, scaleY);

        for (let i = 0; i < pieStyles.length; i++) styles.push(pieStyles[i]);

        const grooveStyles =
            Ren.DateValueChart_SeriesSubdivisions.buildScaleStyles(scaleX, scaleY);

        for (let i = 0; i < grooveStyles.length; i++) styles.push(grooveStyles[i]);

        // A marker's flag is sized to its counter-scaled label, so is counter-scaled with it.
        styles.push(
            `.ren-marker-line-flag { scale: ${textScaleX} ${textScaleY}; transform-origin: 0 0 }`
        );

        // A heading stands outside its axis' tick labels, or just inside the chart's edge where the
        // axis is hidden and the margin is only as wide as the heading.
        const leftAxisLabelInsetPx = props.showLeftAxis === false ? 20 : 50;
        const rightAxisLabelInsetPx = 25;
        const leftAxisVisualX = props.margin.left;
        const rightAxisVisualX = (props.width - props.margin.right) / props.width * containerWidth;
        // Halfway down the plot area rather than the chart's own coordinates (see updateScales).
        const labelY = props.margin.top + (props.innerHeight / 2) * scaleY;
        styles.push(`.ren-value-axis-label { transform: translate(${leftAxisVisualX - leftAxisLabelInsetPx}px, ${labelY}px); }`);
        styles.push(`.ren-value-axis-label-2 { transform: translate(${rightAxisVisualX - rightAxisLabelInsetPx}px, ${labelY}px); }`);

        for (let i = 0; i < axisTickLabelClasses.length; i++) {

            const axisTickLabelClass = axisTickLabelClasses[i];
            styles.push(
                `${axisTickLabelClass.selector} `
                + `{ font-size: ${axisLabelFontSize(props, axisTickLabelClass)} }`
            );
        }

        styles.push(".ren-marker-line-label { font-size: 0.75rem; user-select: none }");

        // A marker clamped to an edge is not at its own date, so is drawn back a little.
        styles.push(".ren-marker-line--clamped { opacity: 0.75 }");

        // Prevent unwanted selection of axis labels when bars are double-clicked.
        styles.push(".ren-bar { user-select: none }");

        // The pointer would otherwise take the shape of whatever a label stands on, such as a bar's
        // col-resize, which reads as the label being draggable.
        for (let i = 0; i < valueLabelClasses.length; i++) {

            styles.push(`.${valueLabelClasses[i].className} { cursor: default }`);
        }

        // A line's <path> bounding box would otherwise block clicks on the bars beneath it.
        styles.push(
            ".ren-data-series__line-path { pointer-events: stroke; vector-effect: non-scaling-stroke }"
        );

        styles.push(
            ".ren-data-series__line-area "
            + `{ fill-opacity: ${props.lineShadingOpacity ?? DEFAULT_LINE_SHADING_OPACITY} }`
        );

        // --- Series colors (bars, lines, dots) ---
        for (let i = 0; i < props.seriesCount; i++) {

            const colour = getSeriesColour(props, i);
            const filter = props.series[i].colourFilter;
            const seriesNum = i + 1;
            const seriesClass = `.ren-series-${seriesNum}`;

            pushSeriesColourProperty(styles, "", props, seriesNum, colour);

            for (let j = 0; j < seriesColourElements.length; j++) {

                const isBar = seriesColourElements[j].selector === ".ren-data-series__bar";
                const fillValue = isBar
                    ? `url(#${Ren.DateValueChart_RenderChartSetup.barGradientId(props, seriesNum)})`
                    : colour;
                const markValue =
                    Ren.DateValueChart_SeriesColourFunction.getMarkColourValue(fillValue);

                let style = `${seriesClass} ${seriesColourElements[j].selector} { ${seriesColourElements[j].property}: ${markValue}`;
                if (filter) style += `; filter: ${filter}`;
                style += " }";
                styles.push(style);
            }

            const lineStyles = buildLineStyles(seriesClass, props, i, false);

            for (let j = 0; j < lineStyles.length; j++) styles.push(lineStyles[j]);

            const pointStyles = buildPointStyles(seriesClass, props, i);

            for (let j = 0; j < pointStyles.length; j++) styles.push(pointStyles[j]);

            // Always present, so a series fades in as smoothly as out (see updateSelectionStyles).
            styles.push(
                `.ren-chart-group > ${seriesClass} { transition: ${SERIES_FADE_TRANSITION} }`
            );

            styles.push(
                `.ren-value-labels-layer > ${seriesClass} { transition: ${SERIES_FADE_TRANSITION} }`
            );

            styles.push(
                `.${LINE_NAMES_LAYER_CLASS} > ${seriesClass}, `
                + `.${PIE_LABELS_LAYER_CLASS} > ${seriesClass}, `
                + `.${SUBDIVISION_LABELS_LAYER_CLASS} > ${seriesClass} `
                + `{ transition: ${SERIES_FADE_TRANSITION} }`
            );

            const legendStyles = buildLegendSeriesStyles(seriesClass, props, i, colour, filter);

            for (let j = 0; j < legendStyles.length; j++) styles.push(legendStyles[j]);

            if (hasEstimate(props, i)) {

                const estimateStyles = buildEstimateStyles(
                    seriesClass,
                    colour,
                    filter,
                    getEstimatePastelStrength(props, i)
                );

                for (let j = 0; j < estimateStyles.length; j++) styles.push(estimateStyles[j]);
            }
        }

        // Bars highlighted by Alt+clicking them.
        styles.push(".ren-bar-alt-selected.ren-vertical path { filter: none; fill: #ff7100 }");

        // --- Value labels (bars, lines, points) ---

        const lineValueLabelOffsetPx = -12;
        const lineValueLabelBelowOffsetPx = 8;

        // Hung by its top, so that it clears the point at any font size.
        styles.push(
            `.${Ren.DateValueChart_RenderValueLabels.LINE_LABEL_BELOW_WRAPPER_CLASS} text `
            + "{ dominant-baseline: hanging }"
        );

        // Turned or slanted after being counter-scaled, so that it is not sheared.
        styles.push(
            `.${Ren.DateValueChart_BarValueLabelLayout.VERTICAL_CLASS} `
            + "{ transform: rotate(-90deg); dominant-baseline: central }"
        );

        styles.push(
            `.${Ren.DateValueChart_BarValueLabelLayout.DIAGONAL_CLASS} `
            + "{ transform: rotate(-45deg); dominant-baseline: central }"
        );

        // Left to the bars beneath them to take the pointer.
        const barSeriesNameFontSizePx =
            props.seriesNamesInBarsFontSize ?? SERIES_NAMES_IN_BARS_FONT_SIZE_PX;

        styles.push(
            `.${Ren.DateValueChart_BarSeriesNames.LABEL_CLASS} `
            + "{ transform: rotate(-90deg); dominant-baseline: central; pointer-events: none; "
            + `font-size: ${barSeriesNameFontSizePx}px }`
        );

        const lineNameStyles = Ren.DateValueChart_LineNames.buildStyles(props);

        for (let i = 0; i < lineNameStyles.length; i++) styles.push(lineNameStyles[i]);

        const pieLabelStyles = Ren.DateValueChart_PieLabels.buildStyles(props);

        for (let i = 0; i < pieLabelStyles.length; i++) styles.push(pieLabelStyles[i]);

        const subdivisionStyles = Ren.DateValueChart_SeriesSubdivisions.buildStyles(props);

        for (let i = 0; i < subdivisionStyles.length; i++) styles.push(subdivisionStyles[i]);

        for (let i = 0; i < props.seriesCount; i++) {

            const show = props.series[i].showValueLabels ?? true;
            const display = show ? "block" : "none";
            const seriesNum = i + 1;
            const seriesClass = `.ren-series-${seriesNum}`;

            for (let j = 0; j < valueLabelClasses.length; j++) {

                const valueLabelClass = valueLabelClasses[j];
                styles.push(
                    `${seriesClass} .${valueLabelClass.className} `
                    + `{ display: ${display}; `
                    + `font-size: ${valueLabelFontSize(props, valueLabelClass)}; }`
                );
            }

            styles.push(estimateCaptionStyle(seriesClass));
            styles.push(Ren.DateValueChart_Extremes.buildValueStyle(seriesNum, show));
        }

        // A fallback, overridden per series below.
        styles.push(".ren-bar-value-label--inside { fill: white }");

        for (let i = 0; i < props.seriesCount; i++) {

            const colour = getSeriesColour(props, i);
            const filter = props.series[i].colourFilter;
            const seriesClass = `.ren-series-${i + 1}`;

            styles.push(buildInsideBarLabelStyle(seriesClass, colour, filter));
            styles.push(buildBarSeriesNameStyle(seriesClass, colour, filter));

            const lineNameStyles =
                Ren.DateValueChart_LineNames.buildColourStyles(seriesClass, colour);

            for (let j = 0; j < lineNameStyles.length; j++) styles.push(lineNameStyles[j]);

            const pieLabelStyles =
                Ren.DateValueChart_PieLabels.buildColourStyles(seriesClass, colour, filter);

            for (let j = 0; j < pieLabelStyles.length; j++) styles.push(pieLabelStyles[j]);

            const subdivisionColourStyles =
                Ren.DateValueChart_SeriesSubdivisions.buildColourStyles(
                    seriesClass,
                    colour,
                    filter
                );

            for (let j = 0; j < subdivisionColourStyles.length; j++) {
                styles.push(subdivisionColourStyles[j]);
            }

            if (hasEstimate(props, i)) {

                const strength = getEstimatePastelStrength(props, i);
                styles.push(
                    buildEstimateInsideBarLabelStyle(seriesClass, colour, filter, strength)
                );
            }
        }

        // A label clear of its mark can land on anything, so its colour is settled by the contrast
        // pass below once laid out; until then black suits the background it usually lands on.
        styles.push(".ren-bar-value-label--outside { fill: black }");
        styles.push(".ren-line-value-label { fill: black }");
        styles.push(".ren-point-value-label { fill: black }");

        const legendLayoutStyles = buildLegendLayoutStyles(containerWidth);

        for (let j = 0; j < legendLayoutStyles.length; j++) styles.push(legendLayoutStyles[j]);

        const css = styles
            .map(style => "." + props.guid + " " + style)
            .join("\n");

        // Writing to a stylesheet restyles the whole document, so a pass coming to the rules that
        // are already in force - which is every pass of a chart redrawn at the size it was, as it
        // is while being zoomed or panned - leaves it alone.
        const isCssChanged = props.stylesheet.textContent !== css;

        if (isCssChanged) {

            props.stylesheet.textContent = css;
        }

        // A selected line's width is in visual pixels too, so follows the scale just written.
        updateSelectionStyles(props);

        // Aligning the legend's items can take it onto another row, which shrinks the plot the
        // scales above were fitted to, so the pass is made again at the plot's new size.  So can
        // the legend's padding, which follows the chart's width, e.g. on leaving focus mode.
        const isPlotResized = () => isCssChanged &&
            actualContainerHeight > 0 &&
            Math.abs(getLayoutHeight(props, containerNode) - actualContainerHeight) > 0.5;

        if (!isLegendRealigned &&
            (Ren.DateValueChart_Legend.alignItems(props, isCssChanged) || isPlotResized())) {

            updateStylesheet(props, containerWidth, null, true);
            return;
        }

        // A chart that never drew has no svg, but is still resized with the module it sits in.  One
        // laid out before its plot has any height has nothing to place labels against yet.
        if (!props.svg || !(scaleY > 0)) return;

        // The tick length and the room for date axis labels both follow the scale just written, so
        // are settled here rather than at render.
        setDateAxisTickLength(props, scaleY);
        Ren.DateValueChart_Axes.updateValueAxisTicks(props);

        // The date axis labels are measured along with the value labels below, so that the two
        // cost one layout between them rather than one each.
        const dateAxisLabels = Ren.DateValueChart_DeclutterDateAxisLabels.prepare(props);

        // Set via the SVG attribute, as a CSS transform overrides rather than compounds with it,
        // and divided by scaleY so the offset stays constant in visual pixels.
        const updateLabelWrappers = (selector, offsetPx, dataAttribute) => {

            const offsetSVG = offsetPx / scaleY;

            const wrappers = props.svg.querySelectorAll(selector);

            for (let i = 0; i < wrappers.length; i++) {

                const x = parseFloat(wrappers[i].getAttribute("data-x"));
                const y = parseFloat(wrappers[i].getAttribute(dataAttribute));

                wrappers[i].setAttribute("transform", `translate(${x}, ${y + offsetSVG})`);
            }
        };

        const lineLabelBelowClass =
            Ren.DateValueChart_RenderValueLabels.LINE_LABEL_BELOW_WRAPPER_CLASS;

        const labelWrapperConfigs = [
            {
                selector: `.ren-line-value-label-wrapper:not(.${lineLabelBelowClass})`,
                offsetPx: lineValueLabelOffsetPx,
                dataAttr: "data-line-point-y"
            },
            {
                selector: `.${lineLabelBelowClass}`,
                offsetPx: lineValueLabelBelowOffsetPx,
                dataAttr: "data-line-point-y"
            },
            {
                selector: ".ren-point-value-label-wrapper",
                offsetPx: lineValueLabelOffsetPx,
                dataAttr: "data-point-y"
            }
        ];

        for (let i = 0; i < labelWrapperConfigs.length; i++) {

            const c = labelWrapperConfigs[i];
            updateLabelWrappers(c.selector, c.offsetPx, c.dataAttr);
        }

        // A label's on-screen size is known only now, and which are shown decides what each lands
        // on, and so its colour.
        Ren.DateValueChart_BarValueLabelLayout.layout(props);

        const valueLabels = Ren.DateValueChart_DeclutterValueLabels.prepare(props);

        Ren.DateValueChart_DeclutterDateAxisLabels.measure(dateAxisLabels);
        Ren.DateValueChart_DeclutterValueLabels.measure(valueLabels);
        Ren.DateValueChart_DeclutterDateAxisLabels.apply(dateAxisLabels);
        Ren.DateValueChart_DeclutterValueLabels.apply(valueLabels);

        Ren.DateValueChart_BarSeriesNames.layout(props);
        Ren.DateValueChart_LineNames.layout(props);
        Ren.DateValueChart_PieLabels.layout(props);
        Ren.DateValueChart_SeriesSubdivisions.layout(props);
        Ren.DateValueChart_LabelContrast.applyContrast(props);

        // Marker label lanes follow on-screen widths, likewise known only now.
        Ren.DateValueChart_MarkerLabels.layout(props);
    };

    const updateBarColour = (props, colour, seriesIndex, barIndex) => {

        if (barIndex !== undefined && barIndex !== null) {

            const selector = "." + props.guid + " .ren-bar[data-series='" + seriesIndex + "'][data-index='" + barIndex + "'] path";
            props.stylesheet.textContent += "\n" + selector + " { fill: " + colour + " }";
        }
        else {

            // seriesIndex is 1-based.
            const arrayIndex = seriesIndex - 1;

            if (props.series && props.series[arrayIndex]) {
                props.series[arrayIndex].colour = colour;
            }

            Ren.DateValueChart_RenderChartSetup.setBarGradientColour(props, seriesIndex, colour);

            const seriesClass = `.ren-series-${seriesIndex}`;

            // The rules are appended after the old ones, so a filter since removed is overridden.
            const filter = props.series[arrayIndex]?.colourFilter || "none";

            const propertyStyles = [];

            pushSeriesColourProperty(propertyStyles, `.${props.guid} `, props, seriesIndex, colour);
            props.stylesheet.textContent += "\n" + propertyStyles.join("\n");

            for (let i = 0; i < seriesColourElements.length; i++) {

                const isBar = seriesColourElements[i].selector === ".ren-data-series__bar";
                const fillValue = isBar
                    ? `url(#${Ren.DateValueChart_RenderChartSetup.barGradientId(props, seriesIndex)})`
                    : colour;
                const markValue =
                    Ren.DateValueChart_SeriesColourFunction.getMarkColourValue(fillValue);

                let rule = "\n." + props.guid + " " + seriesClass + " " + seriesColourElements[i].selector + " { " + seriesColourElements[i].property + ": " + markValue;
                rule += "; filter: " + filter;
                rule += " }";
                props.stylesheet.textContent += rule;
            }

            let legendRule = "\n." + props.guid + " " + seriesClass + " .ren-legend-colour-rect { background-color: " + colour;
            legendRule += "; filter: " + filter;
            legendRule += " }";
            props.stylesheet.textContent += legendRule;

            let legendLineRule = "\n." + props.guid + " " + seriesClass + " .ren-legend-colour-rect line { stroke: " + colour;
            legendLineRule += "; filter: " + filter;
            legendLineRule += " }";
            props.stylesheet.textContent += legendLineRule;

            let legendCircleRule = "\n." + props.guid + " " + seriesClass + " .ren-legend-colour-rect circle { fill: " + colour;
            legendCircleRule += "; filter: " + filter;
            legendCircleRule += " }";
            props.stylesheet.textContent += legendCircleRule;

            props.stylesheet.textContent +=
                "\n." + props.guid + " " + buildInsideBarLabelStyle(seriesClass, colour, filter);

            props.stylesheet.textContent +=
                "\n." + props.guid + " " + buildBarSeriesNameStyle(seriesClass, colour, filter);

            const lineNameRules =
                Ren.DateValueChart_LineNames.buildColourStyles(seriesClass, colour);

            for (let i = 0; i < lineNameRules.length; i++) {
                props.stylesheet.textContent += "\n." + props.guid + " " + lineNameRules[i];
            }

            const pieLabelRules =
                Ren.DateValueChart_PieLabels.buildColourStyles(seriesClass, colour, filter);

            for (let i = 0; i < pieLabelRules.length; i++) {
                props.stylesheet.textContent += "\n." + props.guid + " " + pieLabelRules[i];
            }

            const subdivisionRules =
                Ren.DateValueChart_SeriesSubdivisions.buildColourStyles(
                    seriesClass,
                    colour,
                    filter
                );

            for (let i = 0; i < subdivisionRules.length; i++) {
                props.stylesheet.textContent += "\n." + props.guid + " " + subdivisionRules[i];
            }

            if (hasEstimate(props, arrayIndex)) {

                const strength = getEstimatePastelStrength(props, arrayIndex);
                const estimateRules = buildEstimateStyles(seriesClass, colour, filter, strength);

                for (let i = 0; i < estimateRules.length; i++) {
                    props.stylesheet.textContent += "\n." + props.guid + " " + estimateRules[i];
                }

                props.stylesheet.textContent += "\n." + props.guid + " "
                    + buildEstimateInsideBarLabelStyle(seriesClass, colour, filter, strength);
            }

            // A selected series' bar edges are a shade of its colour.
            updateSelectionStyles(props);
        }

        // Labels over the mark were coloured to read over its old colour.
        Ren.DateValueChart_LabelContrast.applyContrast(props);
    };

    /**
     * Recolours a series wherever it is drawn: on the chart or, in a multi-chart, on each of the
     * charts holding it and in their legend.
     *
     * @param {object} props - The props numbering the series seriesIndex.
     * @param {string} colour - The new colour.
     * @param {number} seriesIndex - The series' 1-based number.
     */
    const updateSeriesColour = (props, colour, seriesIndex) => {

        const MultiChart = Ren.DateValueChart_MultiChart;
        const legendProps = MultiChart.getSharedLegendProps(props);

        if (!legendProps) {

            updateBarColour(props, colour, seriesIndex);
            return;
        }

        const charts = legendProps.sharedLegendCharts;

        for (let index = 0; index < charts.length; index++) {

            const seriesNum = MultiChart.getChartSeriesNum(props, charts[index], seriesIndex);

            if (seriesNum) updateBarColour(charts[index], colour, seriesNum);
        }

        const legendSeriesNum = MultiChart.getChartSeriesNum(props, legendProps, seriesIndex);

        if (legendSeriesNum) legendProps.series[legendSeriesNum - 1].colour = colour;

        updateLegendStylesheet(legendProps);
    };

    const updateShowValueLabels = (props, show, seriesIndex) => {

        // seriesIndex is 1-based.
        const arrayIndex = seriesIndex - 1;
        const display = show ? "block" : "none";

        if (props.series && props.series[arrayIndex]) {
            props.series[arrayIndex].showValueLabels = show;
        }

        const seriesClass = `.ren-series-${seriesIndex}`;

        for (let i = 0; i < valueLabelClasses.length; i++) {

            const valueLabelClass = valueLabelClasses[i];
            props.stylesheet.textContent +=
                "\n." + props.guid + " " + seriesClass + " ." + valueLabelClass.className
                + " { display: " + display
                + "; font-size: " + valueLabelFontSize(props, valueLabelClass) + "; }";
        }

        props.stylesheet.textContent += "\n." + props.guid + " " + estimateCaptionStyle(seriesClass);
        props.stylesheet.textContent += "\n." + props.guid + " "
            + Ren.DateValueChart_Extremes.buildValueStyle(seriesIndex, show);

        // Showing or hiding a series' values changes which labels collide, and a label shown only
        // now could not be measured to be placed before.
        Ren.DateValueChart_BarValueLabelLayout.layout(props);
        Ren.DateValueChart_DeclutterValueLabels.declutter(props);
        Ren.DateValueChart_BarSeriesNames.layout(props);
        Ren.DateValueChart_LineNames.layout(props);
        Ren.DateValueChart_PieLabels.layout(props);
        Ren.DateValueChart_SeriesSubdivisions.layout(props);
        Ren.DateValueChart_LabelContrast.applyContrast(props);
    };

    /**
     * Styles a legend drawn apart from any plot, as a multi-chart's is, and lines up its items.
     */
    const updateLegendStylesheet = (props) => {

        const containerNode = document.querySelector("." + props.guid);
        const containerWidth = containerNode ? containerNode.clientWidth : 0;
        const styles = buildLegendLayoutStyles(containerWidth);

        for (let i = 0; i < props.seriesCount; i++) {

            const legendStyles = buildLegendSeriesStyles(
                `.ren-series-${i + 1}`,
                props,
                i,
                getSeriesColour(props, i),
                props.series[i].colourFilter
            );

            for (let j = 0; j < legendStyles.length; j++) styles.push(legendStyles[j]);
        }

        const css = styles
            .map(style => "." + props.guid + " " + style)
            .join("\n");

        const isCssChanged = props.stylesheet.textContent !== css;

        if (isCssChanged) {

            props.stylesheet.textContent = css;
        }

        Ren.DateValueChart_Legend.alignItems(props, isCssChanged);
    };

    /**
     * Whether a chart's render has already styled it at its size, so needs no pass after.  A
     * chart drawn as several charts styles each of them as it draws it, but not their legend.
     *
     * @param {object} props - The chart's props.
     * @returns {boolean}
     */
    const isStyledByRender = (props) => !props.multiChartProps;

    return {
        DATE_AXIS_TICK_SIZE,
        IN_PLACE_PASTEL_STRENGTH,
        DEFAULT_LINE_SHADING_OPACITY,
        defaultLabelFontSizes,
        getSeriesColour,
        updateStylesheet,
        isStyledByRender,
        updateLegendStylesheet,
        updateScales,
        updateBarColour,
        updateSeriesColour,
        updateShowValueLabels,
        setPreviewColours,
        setPreviewLines,
        setPreviewDots,
        clearPreview,
        updateSelectionStyles,
        updateHoverStyles,
        updateHighlightedValueLabels
    };
})();
