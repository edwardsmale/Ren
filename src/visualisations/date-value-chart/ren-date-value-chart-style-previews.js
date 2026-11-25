/**
 * Previews a colour, line or dot size on a date/value chart's series, as the menu offering it is
 * hovered, in a stylesheet of its own that is cleared to restore them.
 */
Ren.DateValueChart_StylePreviews = (() => {

    const {
        seriesColourElements,
        pushSeriesColourProperty,
        buildLegendLineStyle,
        buildLegendSeriesStyles,
        buildLineStyles,
        buildPointStyles,
        getSelectedSeriesNums,
        getEstimatePastelStrength,
        hasEstimate,
        buildEstimateStyles
    } = Ren.DateValueChart_StyleBuilders;

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

    return {
        setPreviewColours,
        setPreviewLines,
        setPreviewDots,
        clearPreview
    };
})();
