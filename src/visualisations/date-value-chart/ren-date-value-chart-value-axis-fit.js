/**
 * Lets a value axis start at its lowest value rather than at zero, where its "Start at zero" is
 * turned off, so that lines far from zero show how they move.  Only an axis drawing nothing but
 * lines and dots can start above zero: a bar, a stack or shading is measured from zero, so would
 * mislead.
 * A linear trend line can run below the values it is fitted to, so an axis with one starts at zero.
 * Without a right axis the left axis' setting goes for both, as they share one scale.
 * An axis that could start above zero can be drawn to a logarithmic scale instead, where all it
 * draws is above zero, so that a series that grows by a steady rate draws as a straight line.
 */
Ren.DateValueChart_ValueAxisFit = (() => {

    const isNumber = value => typeof value === "number" && isFinite(value);

    /**
     * Gets the names of the axes whose series are drawn to an axis' scale.
     */
    const getAxisNamesOnScale = (props, axisName) =>
        Ren.DateValueChart_YScales.hasRightAxis(props) ? [axisName] : ["leftAxis", "rightAxis"];

    /**
     * Gets the indexes of the series shown that are drawn against the axes named.
     */
    const getSeriesIndexes = (props, axisNames) => {

        const seriesIndexes = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!series || series.isEnabled === false) continue;

            if (axisNames.indexOf(series.valueAxis || "leftAxis") !== -1) seriesIndexes.push(i);
        }

        return seriesIndexes;
    };

    /**
     * Gets a value indicating whether an axis could start above zero, drawing only lines and dots.
     */
    const canFit = (props, axisName) => {

        if (props.shadeLines === true
            || Ren.DateValueChart_LineStack.isStacked(props)
            || Ren.DateValueChart_Pies.isShown(props)) {

            return false;
        }

        const seriesIndexes = getSeriesIndexes(props, getAxisNamesOnScale(props, axisName));

        for (let i = 0; i < seriesIndexes.length; i++) {

            const series = props.series[seriesIndexes[i]];

            if (series.chartType === Ren.SeriesChartTypeEnum.Bar
                || series.trendLine === Ren.DateValueChart_TrendLines.LINEAR) {

                return false;
            }
        }

        return seriesIndexes.length > 0;
    };

    /**
     * Gets a value indicating whether an axis is set to start at zero, as it does by default.
     */
    const isStartAtZero = (props, axisName) => props.axes?.[axisName]?.startAtZero !== false;

    /**
     * Gets a value indicating whether an axis is set to a logarithmic scale.
     */
    const isLogScale = (props, axisName) => props.axes?.[axisName]?.logScale === true;

    /**
     * Gets the lowest value drawn against the axes named: the series' own, the previous year's
     * and any value line.
     */
    const getLowestValue = (props, data, axisNames) => {

        const seriesIndexes = getSeriesIndexes(props, axisNames);
        const axisMins = { leftAxis: Infinity, rightAxis: Infinity, hiddenAxis: Infinity };
        let lowest = Infinity;

        for (let i = 0; i < seriesIndexes.length; i++) {

            const heading = props.valueHeadings[seriesIndexes[i]];
            const min = Ren.ArrayUtils.extent(data || [], row => row[heading])[0];

            if (isNumber(min)) lowest = Math.min(lowest, min);
        }

        Ren.DateValueChart_ValueLines.extendAxisMins(props, axisMins);
        Ren.DateValueChart_PreviousYear.extendAxisMins(props, axisMins);

        for (let i = 0; i < axisNames.length; i++) {
            lowest = Math.min(lowest, axisMins[axisNames[i]]);
        }

        return lowest;
    };

    /**
     * Gets a value indicating whether an axis could be drawn to a logarithmic scale: it could
     * start above zero, and everything drawn against it is above zero.
     */
    const canUseLogScale = (props, axisName, data) => {

        if (!canFit(props, axisName)) return false;

        const lowest = getLowestValue(props, data, getAxisNamesOnScale(props, axisName));

        return lowest > 0 && lowest !== Infinity;
    };

    /**
     * Sets the value the left and right axes start at: their lowest value where they can and are
     * set to start above zero, or to a logarithmic scale, and otherwise zero.  An axis whose
     * lowest value is zero or below starts at zero, as the chart draws no negative values, and so
     * is drawn to a linear scale, whatever it is set to.
     */
    const setAxisMins = (props, data) => {

        const axisNames = ["leftAxis", "rightAxis"];

        for (let i = 0; i < axisNames.length; i++) {

            const axis = props.axes[axisNames[i]];
            const isShared = !Ren.DateValueChart_YScales.hasRightAxis(props);
            const settingAxisName = isShared ? "leftAxis" : axisNames[i];

            axis.minY = 0;
            axis.isLogScaleDrawn = false;

            const isLog = isLogScale(props, settingAxisName);

            if (!isLog && isStartAtZero(props, settingAxisName)) continue;

            if (!canFit(props, axisNames[i])) continue;

            const lowest = getLowestValue(props, data, getAxisNamesOnScale(props, axisNames[i]));

            if (lowest > 0 && lowest !== Infinity) {

                axis.minY = lowest;
                axis.isLogScaleDrawn = isLog;
            }
        }
    };

    /**
     * Gets the value an axis' scale starts at, which is zero unless below the top of its extent.
     */
    const getDomainMin = (axis) => {

        const min = axis.minY || 0;

        return min < axis.yExtent[1] ? min : 0;
    };

    return {
        canFit,
        isLogScale,
        canUseLogScale,
        isStartAtZero,
        getLowestValue,
        setAxisMins,
        getDomainMin
    };
})();
