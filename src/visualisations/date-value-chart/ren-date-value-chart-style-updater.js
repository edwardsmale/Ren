Ren.DateValueChart_StyleUpdater = (() => {

    let prevContainerWidth = 0;
    let prevContainerHeight = 0;

    const seriesColourElements = [
        { selector: ".ren-data-series__bar", property: "fill" },
        { selector: ".ren-data-series__line-path", property: "stroke" },
        { selector: ".ren-data-series__line-area", property: "fill" },
        { selector: ".ren-data-series__line-node", property: "fill" },
        { selector: ".ren-data-series__line-node", property: "stroke" },
        { selector: ".ren-data-series__point", property: "fill" },
        { selector: ".ren-data-series__point-ring", property: "stroke" },
        { selector: ".ren-data-series__pie-slice", property: "fill" }
    ];

    // How much of its colour a selected series' bar edges keep.
    const SELECTED_BAR_EDGE_SHADE = 0.6;
    const SELECTED_BAR_EDGE_WIDTH_PX = 2;

    // A line's nodes' radius as a share of its width, and how much thicker a selected series' line
    // is drawn, with its nodes' radius as a share of that.
    const LINE_NODE_RADIUS_FACTOR = 0.25;
    const SELECTED_LINE_WIDTH_FACTOR = 1.75;
    const SELECTED_LINE_NODE_RADIUS_FACTOR = 0.375;

    // How opaque a shaded line's fill is, where the chart does not set its own.
    const DEFAULT_LINE_SHADING_OPACITY = 0.25;

    const SELECTED_LEGEND_ENTRY_OUTLINE = "1px solid #777777";

    // While any series is selected, the rest are faded and brightened back so the selection stands
    // out.
    const UNSELECTED_SERIES_OPACITY = 0.3;
    const UNSELECTED_SERIES_BRIGHTNESS = 0.5;

    // A pie's labels are faded less, so the rest of the slices' labels can still be read.
    const UNSELECTED_PIE_LABEL_OPACITY = 0.7;
    const SERIES_FADE_TRANSITION = "opacity 0.15s ease, filter 0.15s ease";

    // A switched-off series keeps its legend entry so it can be switched back on; the entry is
    // faded to distinguish it from the series actually being plotted.
    const DISABLED_LEGEND_ITEM_OPACITY = 0.3;

    // While series are highlighted from the legend, the other shown series' entries are faded, if
    // less than a switched-off series' entry is, so the two can still be told apart.
    const UNHIGHLIGHTED_LEGEND_ITEM_OPACITY = 0.5;

    const getSeriesColour = (props, seriesIndex) =>
        props.series[seriesIndex].colour
            || Ren.DateValueChart_SeriesColours.getDefaultColour(
                seriesIndex,
                props.visualisation?.colourScheme
            );

    // Appends the rules setting the colour a colour function's marks mix their series' colour from,
    // on the series and on its line's gradient, which sits in the chart's defs outside the series.
    const pushSeriesColourProperty = (styles, prefix, props, seriesNum, colour) => {

        const property = Ren.DateValueChart_SeriesColourFunction.SERIES_COLOUR_PROPERTY;
        const gradientId =
            Ren.DateValueChart_SeriesColourFunction.getLineGradientId(props, seriesNum - 1);

        styles.push(`${prefix}.ren-series-${seriesNum} { ${property}: ${colour} }`);
        styles.push(`${prefix}#${gradientId} { ${property}: ${colour} }`);
    };

    // A legend's line is drawn at this share of its series' width, which keeps an ordinary line
    // at the legend's 2px.
    const LEGEND_LINE_WIDTH_FACTOR = 0.5;

    /**
     * Gets a series' line style, or the one previewed on it.
     */
    const getLineStyle = (props, seriesIndex, linePreview) => linePreview
        ? linePreview.lineStyle
        : Ren.DateValueChart_Render.getLineStyle(props, seriesIndex);

    /**
     * Gets the width a series' line is drawn at in the chart's unscaled units, or the width of the
     * one previewed on it.
     */
    const getLineStrokeWidth = (props, seriesIndex, linePreview) => linePreview
        ? Ren.DateValueChart_Render.getStyledLineStrokeWidth(
            linePreview.lineStyle,
            linePreview.lineWidth
        )
        : Ren.DateValueChart_Render.getLineStrokeWidth(props, seriesIndex);

    /**
     * Builds the rule drawing a series' legend line in its line's style, led by legendItemSelector.
     */
    const buildLegendLineStyle = (legendItemSelector, props, seriesIndex, linePreview) => {

        const widthPx = getLineStrokeWidth(props, seriesIndex, linePreview)
            * LEGEND_LINE_WIDTH_FACTOR;
        const dasharray = Ren.ChartLineSeries.getStrokeDasharray(
            getLineStyle(props, seriesIndex, linePreview),
            widthPx
        );

        return `${legendItemSelector} .ren-legend-colour-rect line `
            + `{ stroke-width: ${widthPx}px; stroke-dasharray: ${dasharray} }`;
    };

    /**
     * Builds the rules colouring a series' legend marker, each led by seriesClass.
     */
    const buildLegendSeriesStyles = (seriesClass, props, seriesIndex, colour, filter) => {

        const filterRule = filter ? `; filter: ${filter}` : "";

        return [
            `${seriesClass} .ren-legend-colour-rect { background-color: ${colour}${filterRule} }`,
            `${seriesClass} .ren-legend-colour-rect line { stroke: ${colour}${filterRule} }`,
            buildLegendLineStyle(seriesClass, props, seriesIndex),
            `${seriesClass} .ren-legend-colour-rect circle { fill: ${colour}${filterRule} }`
        ];
    };

    /**
     * Builds the rules sizing a legend to the width of the chart it sits in.
     */
    const buildLegendLayoutStyles = (containerWidth) => {

        // 600px is the container width at which the base values below give the default sizes.
        const legendRefWidth = 600;
        const legendScale = Math.min(1.7, containerWidth > 0 ? containerWidth / legendRefWidth : 1);
        const legendPadH = Math.round(9 * legendScale);
        const legendPadTop = Math.round(8 * legendScale);
        const legendPadBottom = Math.round(8 * legendScale);
        const legendRectSize = Math.round(9.8 * legendScale);
        const legendRectMargin = Math.round(3.5 * legendScale);
        const legendItemGap = Math.round(10 * legendScale);
        const legendFontSize = Math.max(13, Math.round(8.4 * legendScale * 10) / 10);
        const legendRightPadding = "0.5rem";
        const legendRowGap = "0.5rem";

        return [
            ".ren-date-value-chart-legend-html { padding: "
                + `${legendPadTop}px ${legendPadH}px ${legendPadBottom}px ${legendPadH}px }`,
            `.ren-legend-items { gap: ${legendRowGap} }`,
            `.ren-legend-item { margin-right: ${legendItemGap}px; `
                + `padding-right: ${legendRightPadding} }`,
            ".ren-legend-item:last-child { margin-right: 0 }",
            `.ren-legend-colour-rect { width: ${legendRectSize}px; height: ${legendRectSize}px; `
                + `margin-right: ${legendRectMargin}px }`,
            `.ren-legend-text { font-size: ${legendFontSize}px }`,
            ".ren-legend-item[data-series-enabled='false'] "
                + `{ opacity: ${DISABLED_LEGEND_ITEM_OPACITY} }`
        ];
    };

    /**
     * Builds the rules sizing a series' line and its nodes, each led by seriesSelector.  The line's
     * stroke doesn't scale with the plot, which would stretch dashes along the date axis and squash
     * dots into ellipses, so its width is converted to the visual pixels a flat stretch of the
     * scaled line would be drawn at.
     *
     * @param {number} seriesIndex - The 0-based index of the series.
     * @param {object} [linePreview] - The { lineStyle, lineWidth } to draw it with instead of its
     *     own.
     */
    const buildLineStyles = (seriesSelector, props, seriesIndex, isSelected, linePreview) => {

        const lineStyle = getLineStyle(props, seriesIndex, linePreview);
        const strokeWidth = getLineStrokeWidth(props, seriesIndex, linePreview);

        const lineWidth = strokeWidth * (isSelected ? SELECTED_LINE_WIDTH_FACTOR : 1);
        const nodeRadius = lineWidth
            * (isSelected ? SELECTED_LINE_NODE_RADIUS_FACTOR : LINE_NODE_RADIUS_FACTOR);
        const widthPx = lineWidth * (props.scaleY ?? 1);
        const dasharray = Ren.ChartLineSeries.getStrokeDasharray(lineStyle, widthPx);

        return [
            `${seriesSelector} .ren-data-series__line-path `
                + `{ stroke-width: ${widthPx}px; stroke-dasharray: ${dasharray} }`,
            `${seriesSelector} .ren-data-series__line-node { r: ${nodeRadius}px }`
        ];
    };

    /**
     * Builds the rules sizing a series' dots and their selection rings, each led by seriesSelector.
     * An overlayed estimate's dot is sized with them, a line series' included.
     *
     * @param {number} seriesIndex - The 0-based index of the series.
     * @param {string} [dotSize] - The size to draw them at instead of the series' own.
     */
    const buildPointStyles = (seriesSelector, props, seriesIndex, dotSize) => {

        const radius = dotSize
            ? Ren.DateValueChart_Render.getStyledPointRadius(dotSize)
            : Ren.DateValueChart_Render.getPointRadius(props, seriesIndex);
        const ringRadius = radius + Ren.DateValueChart_Render.SELECTED_POINT_RING_GAP;

        return [
            `${seriesSelector} .ren-data-series__point-dot, `
                + `${seriesSelector} circle.ren-data-series__point { r: ${radius}px }`,
            `${seriesSelector} .ren-data-series__point-ring { r: ${ringRadius}px }`
        ];
    };

    /**
     * Gets the 1-based indexes of the series selected in the legend.  A hidden legend can't show or
     * clear a selection, so none is shown.  One of a multi-chart's charts takes the selection in
     * the legend they share, so that a chart drawn again is marked from the start, rather than
     * only once every chart is drawn, which would fade its other series back in and out again.
     */
    const getSelectedSeriesNums = (props) => {

        if (props.showLegend === false) return [];

        const legendProps = props.sharedLegendProps;

        if (!legendProps) return Ren.DateValueChart_Legend.getSelectedSeriesIndexes(props);

        const legendSeriesNums = getSelectedSeriesNums(legendProps);
        const seriesNums = [];

        for (let index = 0; index < legendSeriesNums.length; index++) {

            const seriesNum = Ren.DateValueChart_MultiChart.getChartSeriesNum(
                legendProps,
                props,
                legendSeriesNums[index]
            );

            if (seriesNum) seriesNums.push(seriesNum);
        }

        return seriesNums;
    };

    // An in-place estimate marks the series' own bar or dot with the same class.  Each selector
    // carries one more class than the series rule, so wins on specificity whatever the sheet order.
    const estimateColourElements = [
        { selector: ".ren-estimate-mark .ren-data-series__bar", property: "fill" },
        { selector: ".ren-data-series__point.ren-estimate-mark", property: "fill" }
    ];

    // An in-place estimate replaces the actual value outright, so is barely faded, unlike an
    // Overlayed one, which is drawn alongside it and needs a plainly paler shade.
    const IN_PLACE_PASTEL_STRENGTH = 0.9;

    /**
     * Gets how much of a series' own colour its last-period estimate keeps, by its mode.
     */
    const getEstimatePastelStrength = (props, seriesIndex) =>
        Ren.DateValueChart_LastPeriodEstimate.getMode(props, seriesIndex)
            === Ren.EstimateLastPeriodEnum.InPlace
            ? IN_PLACE_PASTEL_STRENGTH
            : undefined;

    /**
     * Gets a value indicating whether a series has an active last-period estimate.
     */
    const hasEstimate = (props, seriesIndex) =>
        Ren.DateValueChart_LastPeriodEstimate.getMode(props, seriesIndex)
            !== Ren.EstimateLastPeriodEnum.None;

    /**
     * Builds the rules drawing a series' last-period estimate in a pastel shade of its colour. They
     * are unscoped, so callers add the chart's own guid.
     */
    const buildEstimateStyles = (seriesClass, colour, filter, strength) => {

        const pastelColour = Ren.Colours.toPastel(colour, strength);
        const styles = [];

        for (let i = 0; i < estimateColourElements.length; i++) {

            const element = estimateColourElements[i];
            let style = `${seriesClass} ${element.selector} { ${element.property}: ${pastelColour}`;

            if (filter) style += `; filter: ${filter}`;
            style += " }";
            styles.push(style);
        }

        return styles;
    };

    /**
     * Gets the text colour that reads over a bar drawn in a colour with the series' colour filter
     * (a variant such as "Dark") over it.
     */
    const textColourOver = (colour, filter) =>
        Ren.Colours.contrastingTextColour(Ren.Colours.applyFilter(colour, filter));

    /**
     * Builds the unscoped rule colouring a series' inside-bar value labels to read over the bar.
     */
    const buildInsideBarLabelStyle = (seriesClass, colour, filter) =>
        `${seriesClass} .ren-bar-value-label--inside { fill: ${textColourOver(colour, filter)} }`;

    /**
     * Builds the unscoped rule colouring a series' names in its bars to read over them, until the
     * contrast pass colours each for the bar it is on.
     */
    const buildBarSeriesNameStyle = (seriesClass, colour, filter) =>
        `${seriesClass} .${Ren.DateValueChart_BarSeriesNames.LABEL_CLASS} `
        + `{ fill: ${textColourOver(colour, filter)} }`;

    /**
     * Builds the rule colouring an estimate's inside-bar value label to read over its pastel shade.
     * Value labels are drawn into the chart's label layer, so the estimate's is told apart by
     * class.
     */
    const buildEstimateInsideBarLabelStyle = (seriesClass, colour, filter, strength) => {

        const estimateColour = Ren.Colours.toPastel(colour, strength);
        return `${seriesClass} .ren-estimate-value-label .ren-bar-value-label--inside `
            + `{ fill: ${textColourOver(estimateColour, filter)} }`;
    };

    /**
     * Gets the rule keeping a series' "EST" captions shown whether or not it shows its values.  A
     * caption carries its label's classes, so this must follow the rule hiding those.
     */
    const estimateCaptionStyle = (seriesClass) =>
        `${seriesClass} .ren-estimate-period-label { display: block }`;

    // Line labels sit clear of the plot, so can be a little larger than bar labels, which have to
    // fit within a bar's width.
    const BAR_VALUE_LABEL_FONT_SIZE_PX = 10.4;
    const LINE_VALUE_LABEL_FONT_SIZE_PX = 13;
    const X_AXIS_LABEL_FONT_SIZE_PX = 9.8;
    const Y_AXIS_LABEL_FONT_SIZE_PX = 10;
    const SERIES_NAMES_IN_BARS_FONT_SIZE_PX = 12;

    const LINE_NAMES_LAYER_CLASS = Ren.DateValueChart_LineNames.LAYER_CLASS;
    const PIE_LABELS_LAYER_CLASS = Ren.DateValueChart_PieLabels.LAYER_CLASS;
    const SUBDIVISION_LABELS_LAYER_CLASS = Ren.DateValueChart_SeriesSubdivisions.LAYER_CLASS;

    const valueLabelClasses = [
        { className: "ren-bar-value-label", defaultFontSizePx: BAR_VALUE_LABEL_FONT_SIZE_PX },
        { className: "ren-line-value-label", defaultFontSizePx: LINE_VALUE_LABEL_FONT_SIZE_PX },
        { className: "ren-point-value-label", defaultFontSizePx: BAR_VALUE_LABEL_FONT_SIZE_PX }
    ];

    // The axis group is scaled with the plot, so the ticks shrink with the chart; the extension is
    // in visual pixels so they stay legible on any size of chart.
    const DATE_AXIS_TICK_SIZE = 6;
    const DATE_AXIS_TICK_EXTENSION_PX = 2;

    // The labels are counter-scaled by the .text-wrapper rule, so these are the sizes they are seen
    // at.
    const axisTickLabelClasses = [
        { selector: ".ren-x-axis text", defaultFontSizePx: X_AXIS_LABEL_FONT_SIZE_PX },
        { selector: ".ren-y-axis text", defaultFontSizePx: Y_AXIS_LABEL_FONT_SIZE_PX }
    ];

    // The default sizes a font size setting starts from, so it starts at the size on the chart.
    const defaultLabelFontSizes = {
        valueLabel: BAR_VALUE_LABEL_FONT_SIZE_PX,
        axisLabel: X_AXIS_LABEL_FONT_SIZE_PX,
        seriesNamesInBars: SERIES_NAMES_IN_BARS_FONT_SIZE_PX,
        lineNames: Ren.DateValueChart_LineNames.DEFAULT_FONT_SIZE_PX,
        pieLabels: Ren.DateValueChart_PieLabels.DEFAULT_FONT_SIZE_PX
    };

    /** Gets the CSS font size a series' value labels of one kind are drawn at. */
    const valueLabelFontSize = (props, valueLabelClass) =>
        (props.valueLabelFontSize ?? valueLabelClass.defaultFontSizePx) + "px";

    /** Gets the CSS font size one axis' tick labels are drawn at. */
    const axisLabelFontSize = (props, axisTickLabelClass) =>
        (props.axisLabelFontSize ?? axisTickLabelClass.defaultFontSizePx) + "px";

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

        Ren.DateValueChart_DeclutterDateAxisLabels.declutter(props);

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
        Ren.DateValueChart_DeclutterValueLabels.declutter(props);
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

    const setupTemporaryStylesheet = (props) => {

        if (!props.temporaryStylesheet) {
            props.temporaryStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(props.guid, "temporary").getStylesheet();
        }
        return props.temporaryStylesheet;
    };

    // Appends the styles previewing a colour and filter on one series.
    const pushPreviewStyles = (styles, props, colour, seriesIndex, filter) => {

        const seriesClass = `.ren-series-${seriesIndex}`;

        Ren.DateValueChart_RenderChartSetup.setBarGradientColour(props, seriesIndex, colour);

        pushSeriesColourProperty(styles, `.${props.guid} `, props, seriesIndex, colour);

        for (let i = 0; i < seriesColourElements.length; i++) {

            const isBar = seriesColourElements[i].selector === ".ren-data-series__bar";
            const fillValue = isBar
                ? `url(#${Ren.DateValueChart_RenderChartSetup.barGradientId(props, seriesIndex)})`
                : colour;
            const markValue =
                Ren.DateValueChart_SeriesColourFunction.getMarkColourValue(fillValue);

            let style = `.${props.guid} ${seriesClass} ${seriesColourElements[i].selector} { ${seriesColourElements[i].property}: ${markValue}`;
            style += `; filter: ${filter || "none"}`;
            style += " }";
            styles.push(style);
        }
        let legendStyle = `.${props.guid} ${seriesClass} .ren-legend-colour-rect { background-color: ${colour}`;
        if (filter) legendStyle += `; filter: ${filter}`;
        legendStyle += " }";
        styles.push(legendStyle);

        let legendLineStyle = `.${props.guid} ${seriesClass} .ren-legend-colour-rect line { stroke: ${colour}`;
        if (filter) legendLineStyle += `; filter: ${filter}`;
        legendLineStyle += " }";
        styles.push(legendLineStyle);

        let legendCircleStyle = `.${props.guid} ${seriesClass} .ren-legend-colour-rect circle { fill: ${colour}`;
        if (filter) legendCircleStyle += `; filter: ${filter}`;
        legendCircleStyle += " }";
        styles.push(legendCircleStyle);

        if (hasEstimate(props, seriesIndex - 1)) {

            const strength = getEstimatePastelStrength(props, seriesIndex - 1);
            const estimateStyles = buildEstimateStyles(seriesClass, colour, filter, strength);

            for (let i = 0; i < estimateStyles.length; i++) {
                styles.push(`.${props.guid} ${estimateStyles[i]}`);
            }
        }
    };

    // Previews colours on one chart's series, the previews already numbered as it numbers them.
    const setChartPreviewColours = (props, previews) => {

        const tempStylesheet = setupTemporaryStylesheet(props);
        const styles = [];

        for (let i = 0; i < previews.length; i++) {

            const preview = previews[i];

            pushPreviewStyles(styles, props, preview.colour, preview.seriesIndex, preview.filter);
        }

        tempStylesheet.textContent = styles.join("\n");
    };

    /**
     * Gets colour previews numbered as another chart of a multi-chart numbers its series, leaving
     * out the series it does not hold.
     */
    const mapPreviewsToChart = (fromProps, toProps, previews) => {

        const chartPreviews = [];

        for (let i = 0; i < previews.length; i++) {

            const seriesIndex = Ren.DateValueChart_MultiChart.getChartSeriesNum(
                fromProps,
                toProps,
                previews[i].seriesIndex
            );

            if (seriesIndex) chartPreviews.push(Object.assign({}, previews[i], { seriesIndex }));
        }

        return chartPreviews;
    };

    // Previews colours in a multi-chart's legend, the previews numbered as the legend does.
    const setLegendPreviewColours = (legendProps, previews) => {

        const styles = [];

        for (let i = 0; i < previews.length; i++) {

            const preview = previews[i];

            const legendStyles = buildLegendSeriesStyles(
                `.${legendProps.guid} .ren-series-${preview.seriesIndex}`,
                legendProps,
                preview.seriesIndex - 1,
                preview.colour,
                preview.filter || "none"
            );

            for (let j = 0; j < legendStyles.length; j++) styles.push(legendStyles[j]);
        }

        setupTemporaryStylesheet(legendProps).textContent = styles.join("\n");
    };

    /**
     * Previews colours on series wherever they are drawn, replacing any preview already shown.
     *
     * @param {object} props - The props numbering the series previewed.
     * @param {object[]} previews - The series to preview, as { seriesIndex, colour, filter }.
     */
    const setPreviewColours = (props, previews) => {

        const legendProps = Ren.DateValueChart_MultiChart.getSharedLegendProps(props);

        if (!legendProps) {

            setChartPreviewColours(props, previews);
            return;
        }

        const charts = legendProps.sharedLegendCharts;

        for (let index = 0; index < charts.length; index++) {

            setChartPreviewColours(
                charts[index],
                mapPreviewsToChart(props, charts[index], previews)
            );
        }

        setLegendPreviewColours(legendProps, mapPreviewsToChart(props, legendProps, previews));
    };

    /**
     * Previews line styles and widths on series, replacing any preview already shown.
     *
     * @param {object} props - The chart's props.
     * @param {object[]} previews - The series to preview, as { seriesIndex, lineStyle, lineWidth }.
     */
    const setPreviewLines = (props, previews) => {

        const tempStylesheet = setupTemporaryStylesheet(props);
        const selectedSeriesNums = getSelectedSeriesNums(props);
        const styles = [];

        for (let i = 0; i < previews.length; i++) {

            const seriesIndex = previews[i].seriesIndex;

            // Qualified by the svg to outrank the selected line's rules too.
            const lineStyles = buildLineStyles(
                `.${props.guid} svg .ren-chart-group > .ren-series-${seriesIndex}`,
                props,
                seriesIndex - 1,
                selectedSeriesNums.indexOf(seriesIndex) !== -1,
                previews[i]
            );

            for (let j = 0; j < lineStyles.length; j++) styles.push(lineStyles[j]);

            // Qualified by the item's own class to outrank the legend line's rule.
            styles.push(buildLegendLineStyle(
                `.${props.guid} .ren-legend-item.ren-series-${seriesIndex}`,
                props,
                seriesIndex - 1,
                previews[i]
            ));
        }

        tempStylesheet.textContent = styles.join("\n");
    };

    /**
     * Previews dot sizes on series, replacing any preview already shown.
     *
     * @param {object} props - The chart's props.
     * @param {object[]} previews - The series to preview, as { seriesIndex, dotSize }.
     */
    const setPreviewDots = (props, previews) => {

        const tempStylesheet = setupTemporaryStylesheet(props);
        const styles = [];

        for (let i = 0; i < previews.length; i++) {

            const seriesIndex = previews[i].seriesIndex;

            // Qualified by the svg and the series' parent to outrank the dots' own rules.
            const pointStyles = buildPointStyles(
                `.${props.guid} svg .ren-chart-group > .ren-series-${seriesIndex}`,
                props,
                seriesIndex - 1,
                previews[i].dotSize
            );

            for (let j = 0; j < pointStyles.length; j++) styles.push(pointStyles[j]);
        }

        tempStylesheet.textContent = styles.join("\n");
    };

    // Got by its guid, as a multi-chart's redraw under the preview makes the chart's props anew.
    const clearChartPreview = (props) => {

        setupTemporaryStylesheet(props).textContent = "";

        // A colour preview recoloured the bars' gradients themselves, which no stylesheet undoes.
        Ren.DateValueChart_RenderChartSetup.createBarGradients(props);
    };

    /**
     * Restores the look of series previewed, wherever they are drawn.
     */
    const clearPreview = (props) => {

        const legendProps = Ren.DateValueChart_MultiChart.getSharedLegendProps(props);

        if (!legendProps) {

            clearChartPreview(props);
            return;
        }

        const charts = legendProps.sharedLegendCharts;

        for (let index = 0; index < charts.length; index++) {

            clearChartPreview(charts[index]);
        }

        setupTemporaryStylesheet(legendProps).textContent = "";
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
     * Marks the series selected or hovered in a multi-chart's legend on each of its charts, which
     * number their series by the columns their own periods hold.
     */
    const shareLegendHighlights = (props) => {

        const charts = props.sharedLegendCharts;

        if (!charts) return;

        const MultiChart = Ren.DateValueChart_MultiChart;
        const selectedSeriesNums = getSelectedSeriesNums(props);

        for (let index = 0; index < charts.length; index++) {

            const chart = charts[index];
            const chartSeriesNums = [];

            for (let i = 0; i < selectedSeriesNums.length; i++) {

                const seriesNum = MultiChart.getChartSeriesNum(props, chart, selectedSeriesNums[i]);

                if (seriesNum) chartSeriesNums.push(seriesNum);
            }

            Ren.DateValueChart_Legend.showSelection(chart, chartSeriesNums);
            updateHoverStyles(
                chart,
                MultiChart.getChartSeriesNum(props, chart, props.hoveredSeriesNum)
            );
        }
    };

    /**
     * Marks the series selected in the legend, boxing their entries, and on the chart: their bars'
     * edges are darkened, their lines and nodes thickened, their dots ringed, and the other series
     * faded back.  The rules are keyed by series, so hold through redraws, and are kept apart so as
     * not to be rewritten with every resize.
     */
    const updateSelectionStyles = (props) => {

        if (!props.selectionStylesheet) {

            props.selectionStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "selection")
                .getStylesheet();
        }

        const selectedSeriesNums = getSelectedSeriesNums(props);

        const styles = [];

        for (let i = 0; i < selectedSeriesNums.length; i++) {

            const seriesIndex = selectedSeriesNums[i] - 1;

            if (!props.series[seriesIndex]) continue;

            const seriesClass = `.${props.guid} .ren-series-${seriesIndex + 1}`;
            const edgeColour = Ren.Colours.scaleBrightness(
                getSeriesColour(props, seriesIndex),
                SELECTED_BAR_EDGE_SHADE
            ) || "black";

            styles.push(
                `${seriesClass} .ren-data-series__bar { stroke: ${edgeColour}; `
                + `stroke-width: ${SELECTED_BAR_EDGE_WIDTH_PX}px; `
                + "vector-effect: non-scaling-stroke }"
            );

            // Qualified by the series' parent to outrank the unselected line's rules in the main
            // stylesheet.
            const lineStyles = buildLineStyles(
                `.${props.guid} .ren-chart-group > .ren-series-${seriesIndex + 1}`,
                props,
                seriesIndex,
                true
            );

            for (let j = 0; j < lineStyles.length; j++) styles.push(lineStyles[j]);

            styles.push(`${seriesClass} .ren-data-series__point-ring { display: inline }`);
            styles.push(
                `${seriesClass} .ren-legend-entry { outline: ${SELECTED_LEGEND_ENTRY_OUTLINE} }`
            );
        }

        // A selection of only hidden series has nothing to stand out, so the rest are left
        // unfaded.  Hidden series' legend entries are already faded further.
        let isAnySelectedSeriesShown = false;

        for (let i = 0; i < selectedSeriesNums.length; i++) {

            const series = props.series[selectedSeriesNums[i] - 1];

            if (series && series.isEnabled !== false) {

                isAnySelectedSeriesShown = true;
                break;
            }
        }

        if (isAnySelectedSeriesShown) {

            for (let i = 0; i < props.seriesCount; i++) {

                if (selectedSeriesNums.indexOf(i + 1) !== -1) continue;

                const seriesClass = `.ren-series-${i + 1}`;

                styles.push(
                    `.${props.guid} .ren-chart-group > ${seriesClass}, `
                    + `.${props.guid} .ren-value-labels-layer > ${seriesClass}, `
                    + `.${props.guid} .${LINE_NAMES_LAYER_CLASS} > ${seriesClass}, `
                    + `.${props.guid} .${SUBDIVISION_LABELS_LAYER_CLASS} > ${seriesClass} `
                    + `{ opacity: ${UNSELECTED_SERIES_OPACITY}; `
                    + `filter: brightness(${UNSELECTED_SERIES_BRIGHTNESS}) }`
                );

                styles.push(
                    `.${props.guid} .${PIE_LABELS_LAYER_CLASS} > ${seriesClass} `
                    + `{ opacity: ${UNSELECTED_PIE_LABEL_OPACITY}; }`
                );

                styles.push(
                    `.${props.guid} .ren-legend-item${seriesClass}:not([data-series-enabled='false']) `
                    + `{ opacity: ${UNHIGHLIGHTED_LEGEND_ITEM_OPACITY} }`
                );
            }
        }

        const css = styles.join("\n");

        if (props.selectionStylesheet.textContent !== css) {
            props.selectionStylesheet.textContent = css;
        }

        updateHighlightedValueLabels(props);
        shareLegendHighlights(props);
    };

    /**
     * Gets the 1-based numbers of the series that are highlighted: the one whose legend entry is
     * hovered, those selected, and the one left shown alone, as a double-click on its legend entry
     * does.
     */
    const getHighlightedSeriesNums = (props) => {

        const seriesNums = getSelectedSeriesNums(props).slice();
        const shownSeriesNums = [];

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i] && props.series[i].isEnabled !== false) {
                shownSeriesNums.push(i + 1);
            }
        }

        if (props.seriesCount > 1 && shownSeriesNums.length === 1) {
            seriesNums.push(shownSeriesNums[0]);
        }

        if (props.hoveredSeriesNum) seriesNums.push(props.hoveredSeriesNum);

        return seriesNums;
    };

    /**
     * Hides the value labels of the series faded back while others are highlighted, and shows the
     * highlighted series' labels where the chart is set to, whether or not the series' own labels
     * are on, letting them go again once the series isn't highlighted.  The rules are kept in their
     * own stylesheet, and are doubled in specificity so as to win over the series' own.
     */
    const updateHighlightedValueLabels = (props) => {

        if (!props.highlightLabelsStylesheet) {

            props.highlightLabelsStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "highlighted-value-labels")
                .getStylesheet();
        }

        const styles = [];
        const seriesNums = getHighlightedSeriesNums(props);

        // As with the fading, a highlight of only hidden series leaves the rest alone.  Hidden
        // labels measure as empty, so the decluttering below no longer gives way to them.
        let isAnyHighlightedSeriesShown = false;

        for (let i = 0; i < seriesNums.length; i++) {

            const series = props.series[seriesNums[i] - 1];

            if (series && series.isEnabled !== false) {

                isAnyHighlightedSeriesShown = true;
                break;
            }
        }

        if (isAnyHighlightedSeriesShown) {

            for (let i = 0; i < props.seriesCount; i++) {

                if (seriesNums.indexOf(i + 1) !== -1) continue;

                styles.push(
                    `.${props.guid}.${props.guid} .ren-value-labels-layer > .ren-series-${i + 1} `
                    + "{ display: none }"
                );
            }
        }

        if (props.showValueLabelsWhenHighlighted === true) {

            for (let i = 0; i < seriesNums.length; i++) {

                const series = props.series[seriesNums[i] - 1];

                if (!series || series.isEnabled === false) continue;

                for (let j = 0; j < valueLabelClasses.length; j++) {

                    styles.push(
                        `.${props.guid}.${props.guid} .ren-series-${seriesNums[i]} `
                        + `.${valueLabelClasses[j].className} { display: block }`
                    );
                }
            }
        }

        const css = styles.join("\n");

        if (props.highlightLabelsStylesheet.textContent === css) return;

        props.highlightLabelsStylesheet.textContent = css;

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
     * Previews the series whose legend entry the pointer is over by emphasising it as a selected
     * series is and fading back the plotted series that are neither it nor selected, or removes
     * the preview where there is none.  The rules are kept in their own stylesheet, and are doubled
     * in specificity so as to win over the main stylesheet's and a selection's.
     *
     * @param {object} props - The chart's props.
     * @param {number} [seriesNum] - The 1-based number of the hovered series.
     */
    const updateHoverStyles = (props, seriesNum) => {

        if (!props.hoverStylesheet) {

            props.hoverStylesheet = Ren.DynamicStylesheets
                .setupDynamicStylesheet(props.guid, "hover")
                .getStylesheet();
        }

        const styles = [];
        const hoveredSeries = seriesNum ? props.series[seriesNum - 1] : null;

        // A hidden series isn't plotted, so has nothing to preview.
        props.hoveredSeriesNum = hoveredSeries && hoveredSeries.isEnabled !== false
            ? seriesNum
            : null;

        const hoveredNum = props.hoveredSeriesNum;

        if (hoveredNum) {

            const edgeColour = Ren.Colours.scaleBrightness(
                getSeriesColour(props, hoveredNum - 1),
                SELECTED_BAR_EDGE_SHADE
            ) || "black";

            // The series is emphasised as a selected one is.
            styles.push(
                `.${props.guid}.${props.guid} .ren-series-${hoveredNum} .ren-data-series__bar `
                + `{ stroke: ${edgeColour}; stroke-width: ${SELECTED_BAR_EDGE_WIDTH_PX}px; `
                + "vector-effect: non-scaling-stroke }"
            );

            const lineStyles = buildLineStyles(
                `.${props.guid}.${props.guid} .ren-chart-group > .ren-series-${hoveredNum}`,
                props,
                hoveredNum - 1,
                true
            );

            for (let j = 0; j < lineStyles.length; j++) styles.push(lineStyles[j]);

            styles.push(
                `.${props.guid}.${props.guid} .ren-series-${hoveredNum} `
                + ".ren-data-series__point-ring { display: inline }"
            );

            // The hovered series is added to any selection, so it is unfaded where the selection
            // has faded it, and the selected series stay unfaded beside it.  The legend's own
            // entries are left as they are, as fading them would flicker as the pointer crosses it.
            const selectedSeriesNums = getSelectedSeriesNums(props);

            for (let i = 0; i < props.seriesCount; i++) {

                const seriesClass = `.ren-series-${i + 1}`;
                const isShownFully =
                    i + 1 === hoveredNum || selectedSeriesNums.indexOf(i + 1) !== -1;

                styles.push(
                    `.${props.guid}.${props.guid} .ren-chart-group > ${seriesClass}, `
                    + `.${props.guid}.${props.guid} .ren-value-labels-layer > ${seriesClass}, `
                    + `.${props.guid}.${props.guid} .${LINE_NAMES_LAYER_CLASS} > ${seriesClass}, `
                    + `.${props.guid}.${props.guid} .${SUBDIVISION_LABELS_LAYER_CLASS} `
                    + `> ${seriesClass} `
                    + (isShownFully
                        ? "{ opacity: 1; filter: none }"
                        : `{ opacity: ${UNSELECTED_SERIES_OPACITY}; `
                            + `filter: brightness(${UNSELECTED_SERIES_BRIGHTNESS}) }`)
                );

                // Pie labels are only faded, as a selection fades them: darkening them would turn
                // their white halos grey.
                styles.push(
                    `.${props.guid}.${props.guid} .${PIE_LABELS_LAYER_CLASS} > ${seriesClass} `
                    + `{ opacity: ${isShownFully ? 1 : UNSELECTED_PIE_LABEL_OPACITY} }`
                );
            }
        }

        const css = styles.join("\n");

        if (props.hoverStylesheet.textContent !== css) {
            props.hoverStylesheet.textContent = css;
        }

        updateHighlightedValueLabels(props);
        shareLegendHighlights(props);
    };

    return {
        DATE_AXIS_TICK_SIZE,
        IN_PLACE_PASTEL_STRENGTH,
        DEFAULT_LINE_SHADING_OPACITY,
        defaultLabelFontSizes,
        getSeriesColour,
        updateStylesheet,
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
