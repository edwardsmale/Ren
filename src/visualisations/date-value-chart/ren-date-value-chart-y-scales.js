/**
 * The value axes' scales.  The right axis has a scale of its own only where the chart draws a
 * right axis; otherwise its series are plotted on the left axis' scale.
 */
Ren.DateValueChart_YScales = (() => {

    /**
     * Gets a value indicating whether the chart draws a right-hand value axis.
     */
    const hasRightAxis = props => props.useDualAxes === true && props.seriesCount >= 2;

    const createScale = (props, axis) => {

        const domain = [Ren.DateValueChart_ValueAxisFit.getDomainMin(axis), axis.yExtent[1]];
        const range = [props.innerHeight, 0];

        return axis.isLogScaleDrawn === true
            ? Ren.ChartScales.createLogScale([axis.minY, axis.yExtent[1]], range, { nice: true })
            : Ren.ChartScales.createLinearScale(domain, range, { nice: true });
    };

    /**
     * Creates each value axis' scale from its extent.
     */
    const createYScales = props => {

        const axes = props.axes;

        axes.leftAxis.yScale = createScale(props, axes.leftAxis);

        axes.rightAxis.yScale = hasRightAxis(props)
            ? createScale(props, axes.rightAxis)
            : axes.leftAxis.yScale;

        axes.hiddenAxis.yScale = createScale(props, axes.hiddenAxis);
    };

    /**
     * Gets the names of the left and right axes drawn with a scale, which is both of them on a
     * chart without a right axis.
     */
    const getAxisNamesOnScale = (props, yScale) => {

        const names = [];
        const axisNames = ["leftAxis", "rightAxis"];

        for (let i = 0; i < axisNames.length; i++) {

            const axis = props.axes ? props.axes[axisNames[i]] : null;

            if (axis && axis.yScale === yScale) names.push(axisNames[i]);
        }

        return names;
    };

    return {
        hasRightAxis,
        createYScales,
        getAxisNamesOnScale
    };
})();
