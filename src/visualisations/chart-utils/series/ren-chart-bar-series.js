Ren.ChartBarSeries = (() => {

    const defaultOptions = {
        barPadding: 0.1
    };

    /**
     * The width a bar standing for a period is drawn at: the width of the period itself, less the
     * padding that keeps one period's bars clear of the next's, narrowed by the ratio the chart
     * holds.  That ratio carries both the share of the period a side-by-side series' bars take and
     * any width the bars have been dragged to, so neither is applied again here.
     *
     * Anything drawn to line up with the bars - an estimate of the last period, the handles the
     * bars are resized by - takes its width from here, so that it is the width the bars are drawn
     * at rather than a second calculation of it.
     *
     * @param {object} props - The chart's rendering values, holding its x scale and date period.
     * @param {Date} date - A date in the period the bar stands for.
     * @param {number} [barPadding] - The padding to leave, where it is not the default.
     */
    const getBarWidth = (props, date, barPadding) => {

        const periodWidth = Ren.DateValueChartCalculator.periodWidth(props, date);
        const width = periodWidth * (1 - (barPadding ?? defaultOptions.barPadding));

        return props.barNarrowingRatio ? width * props.barNarrowingRatio : width;
    };

    const barWidthFn = (props, options, d) =>
        getBarWidth(props, d[props.dateHeading], options.barPadding);

    const getBarTooltipText = (props, d) => {

        const dateTickFormat = Ren.DateValueChart_DateTickFormat.getChartTickFormat(props);
        const dateLabel = dateTickFormat(d[props.dateHeading]).replace(/\n/g, " ");
        const valueLabel = Ren.ValueFormatter.formatValueSimple(
            d[props.valueHeading],
            props.valueColumnFormat
        );

        const text = `${dateLabel}\n${props.seriesLabel || props.valueHeading}: ${valueLabel}`;

        return props.seriesTooltipNote ? text + "\n\n" + props.seriesTooltipNote : text;
    };

    /**
     * Renders a bar series in the SVG props.chartGroup.
     */
    const renderBarSeries = ({ props, data, mainValueFn, crossValueFn }, options = {}) => {

        Ren.ChartSeriesHelpers.applyDefaults(options, defaultOptions);

        const xScale = props.xScale;
        const yScale = options.yScale || Ren.ChartSeriesHelpers.getYScale(props, data, mainValueFn);
        const bandwidthFn = d => barWidthFn(props, options, d);

        const seriesGroup = Ren.ChartSeriesHelpers.createSeriesGroup(
            props,
            "ren-data-series ren-data-series--bar"
        );

        const bars = Ren.ChartSvgSeries.renderBars(seriesGroup, data, {
            crossValue: crossValueFn,
            mainValue: mainValueFn,
            xScale,
            yScale,
            bandwidth: bandwidthFn
        });

        for (let i = 0; i < bars.length; i++) {

            const title = Ren.Svg.append(bars[i], "title");

            title.textContent = getBarTooltipText(props, Ren.Svg.getDatum(bars[i]));
            bars[i].querySelector("path").setAttribute("class", "ren-data-series__bar");
        }

        Ren.ChartElementSelection.setupSelectionHandlers(
            props.chartGroup,
            ".ren-bar.ren-vertical",
            "ren-bar-alt-selected"
        );
    };

    return {
        getBarWidth,
        renderBarSeries
    };
})();
