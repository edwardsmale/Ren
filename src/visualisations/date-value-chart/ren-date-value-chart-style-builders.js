/**
 * Builds the rules styling a date/value chart's series, their legend entries and their labels.
 */
Ren.DateValueChart_StyleBuilders = (() => {

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

    // A line's nodes' radius as a share of its width, and how much thicker a selected series' line
    // is drawn, with its nodes' radius as a share of that.
    const LINE_NODE_RADIUS_FACTOR = 0.25;
    const SELECTED_LINE_WIDTH_FACTOR = 1.75;
    const SELECTED_LINE_NODE_RADIUS_FACTOR = 0.375;

    // A switched-off series keeps its legend entry so it can be switched back on; the entry is
    // faded to distinguish it from the series actually being plotted.
    const DISABLED_LEGEND_ITEM_OPACITY = 0.3;

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

    return {
        seriesColourElements,
        getSeriesColour,
        pushSeriesColourProperty,
        buildLegendLineStyle,
        buildLegendSeriesStyles,
        buildLegendLayoutStyles,
        buildLineStyles,
        buildPointStyles,
        getSelectedSeriesNums,
        IN_PLACE_PASTEL_STRENGTH,
        getEstimatePastelStrength,
        hasEstimate,
        buildEstimateStyles,
        buildInsideBarLabelStyle,
        buildBarSeriesNameStyle,
        buildEstimateInsideBarLabelStyle,
        estimateCaptionStyle,
        SERIES_NAMES_IN_BARS_FONT_SIZE_PX,
        LINE_NAMES_LAYER_CLASS,
        PIE_LABELS_LAYER_CLASS,
        SUBDIVISION_LABELS_LAYER_CLASS,
        valueLabelClasses,
        axisTickLabelClasses,
        defaultLabelFontSizes,
        valueLabelFontSize,
        axisLabelFontSize
    };
})();
