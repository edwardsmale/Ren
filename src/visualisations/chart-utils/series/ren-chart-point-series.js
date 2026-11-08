Ren.ChartPointSeries = (() => {

    /**
     * Rings each point with a hollow circle, which is hidden until a style shows it to mark the
     * series as selected.  Its radius is the chart's stylesheet's to set.
     */
    const renderSelectionRings = points => {

        for (let i = 0; i < points.length; i++) {

            Ren.Svg.append(points[i], "circle", {
                "class": "ren-data-series__point-ring",
                "fill": "none",
                "stroke-width": 2,
                "vector-effect": "non-scaling-stroke",
                "pointer-events": "none",
                "display": "none"
            });
        }
    };

    /**
     * Renders a point series in the SVG props.chartGroup.  Its dots' colour and radius are the
     * chart's stylesheet's to set, so they can be restyled without a redraw.
     */
    const renderPointSeries = ({ props, data, mainValueFn, crossValueFn }, options = {}) => {

        const yScale = options.yScale || Ren.ChartSeriesHelpers.getYScale(props, data, mainValueFn);

        const seriesGroup = Ren.ChartSeriesHelpers.createSeriesGroup(props, "ren-data-series ren-data-series--point");

        const points = Ren.ChartSvgSeries.renderPoints(seriesGroup, data, {
            crossValue: crossValueFn,
            mainValue: mainValueFn,
            xScale: props.xScale,
            yScale
        });

        for (let i = 0; i < points.length; i++) {

            Ren.Svg.setAttrs(points[i], {
                "class": "ren-data-series__point",
                "stroke": "#fff",
                "stroke-width": 1.5
            });

            Ren.Svg.setAttrs(points[i].querySelector("circle"), {
                "class": "ren-data-series__point-dot",
                "r": null
            });
        }

        if (options.hasSelectionRings) {
            renderSelectionRings(points);
        }
    };

    return {
        renderPointSeries
    };
})();
