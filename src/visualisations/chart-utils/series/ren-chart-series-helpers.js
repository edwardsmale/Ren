/**
 * Common utilities for data series rendering across bar, line, and point visualizations.
 */
Ren.ChartSeriesHelpers = (() => {

    /**
     * Gets the appropriate Y-scale for a data series, using either the specific series scale
     * or the global chart scale depending on series type and data.
     */
    const getYScale = (props, data, mainValueFn) => {

        if (typeof props.getYScaleForChartSeries === "function") {
            return props.getYScaleForChartSeries(data, mainValueFn);
        }
        return props.yScale;
    };

    /**
     * Sets up a series group container with proper SVG structure and class names.
     */
    const createSeriesGroup = (props, seriesClassName) =>
        Ren.Svg.append(props.chartGroup, "g", { "class": seriesClassName });

    /**
     * Applies default options from a defaults object to an options object,
     * filling in any missing keys.  (Convenience wrapper for clarity.)
     */
    const applyDefaults = (options, defaults) => {

        Ren.ObjectUtils.applyDefaultOptions(options, defaults);
    };

    return {
        getYScale,
        createSeriesGroup,
        applyDefaults
    };
})();
