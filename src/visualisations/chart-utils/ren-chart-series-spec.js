/**
 * Provides functionality to create series specifications for charts.
 */
Ren.ChartSeriesSpec = (() => {

    /**
     * Creates a series specification object for a chart.
     */
    const createSeriesSpec = (props, data, mainValueFn, crossValueFn) => {

        const seriesSpec = {
            props,
            data,
            mainValueFn,
            crossValueFn
        };

        return seriesSpec;
    };

    return {
        createSeriesSpec
    };
})();
