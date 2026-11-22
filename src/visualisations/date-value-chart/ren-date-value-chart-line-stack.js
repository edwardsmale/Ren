/**
 * Stacks a date/value chart's line series where its line layout is stacked: each line stands on
 * the lines before it that share its axis, so the top line traces their total.
 */
Ren.DateValueChart_LineStack = (() => {

    /**
     * Gets a value indicating whether the chart's lines are stacked.
     */
    const isStacked = (props) =>
        Ren.DateValueChartCalculator.getLineLayout(props) === Ren.LineLayoutEnum.Stacked;

    /**
     * Gets the indexes of the series stacked as lines, in series order: the line series shown, or
     * none where the lines are overlayed.
     */
    const getStackedSeriesIndexes = (props) => {

        const seriesIndexes = [];

        if (!isStacked(props)) return seriesIndexes;

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (series.chartType !== Ren.SeriesChartTypeEnum.Line) continue;
            if (series.isEnabled === false) continue;

            seriesIndexes.push(i);
        }

        return seriesIndexes;
    };

    /**
     * Gets the value a series plots for a row, which is its estimate for an estimated last period
     * drawn in place.
     */
    const getPlottedValueFn = (props, seriesIndex) => {

        const heading = props.valueHeadings[seriesIndex];

        return Ren.DateValueChart_LastPeriodEstimate.applyEstimatedValue(
            props,
            seriesIndex,
            d => d[heading]
        );
    };

    /**
     * Stacks the chart's line series over the rows given.  A row a series has no value for adds
     * nothing to the stack, and leaves a gap in the series' own line.
     *
     * @returns {object} { seriesIndexes, getBase(seriesIndex, row), getTopFn(seriesIndex),
     *     getBaseFn(seriesIndex) }, the functions taking the rows given, or null where the lines
     *     are not stacked.
     */
    const getStacks = (props, data) => {

        const seriesIndexes = getStackedSeriesIndexes(props);

        if (seriesIndexes.length === 0) return null;

        const rowIndexes = new Map();

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            rowIndexes.set(data[rowIndex], rowIndex);
        }

        const bases = {};
        const tops = {};
        const totalsByAxis = {};

        for (let i = 0; i < seriesIndexes.length; i++) {

            const seriesIndex = seriesIndexes[i];
            const axis = props.series[seriesIndex].valueAxis || "leftAxis";
            const valueFn = getPlottedValueFn(props, seriesIndex);

            if (!totalsByAxis[axis]) totalsByAxis[axis] = new Array(data.length).fill(0);

            const totals = totalsByAxis[axis];
            const seriesBases = new Array(data.length);
            const seriesTops = new Array(data.length);

            for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {

                const value = valueFn(data[rowIndex]);

                seriesBases[rowIndex] = totals[rowIndex];

                if (typeof value === "number" && isFinite(value)) {

                    totals[rowIndex] += value;
                    seriesTops[rowIndex] = totals[rowIndex];
                }
                else {

                    seriesTops[rowIndex] = null;
                }
            }

            bases[seriesIndex] = seriesBases;
            tops[seriesIndex] = seriesTops;
        }

        const getBase = (seriesIndex, row) => {

            const rowIndex = rowIndexes.get(row);

            return rowIndex === undefined ? 0 : bases[seriesIndex][rowIndex];
        };

        const getTopFn = seriesIndex => d => {

            const rowIndex = rowIndexes.get(d);

            return rowIndex === undefined ? null : tops[seriesIndex][rowIndex];
        };

        const getBaseFn = seriesIndex => d => getBase(seriesIndex, d);

        return {
            seriesIndexes,
            getBase,
            getTopFn,
            getBaseFn
        };
    };

    /**
     * Gets the height the tallest line stack reaches on each axis, as { leftAxis, rightAxis,
     * hiddenAxis }, or zeroes where the lines are not stacked.  An overlayed estimate's dot stands
     * on the lines below its series, so is counted at that height.
     */
    const getAxisMaxes = (props, data) => {

        const maxes = { leftAxis: 0, rightAxis: 0, hiddenAxis: 0 };
        const stacks = getStacks(props, data);

        if (!stacks) return maxes;

        for (let i = 0; i < stacks.seriesIndexes.length; i++) {

            const seriesIndex = stacks.seriesIndexes[i];
            const axis = props.series[seriesIndex].valueAxis || "leftAxis";
            const topFn = stacks.getTopFn(seriesIndex);

            for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {

                const top = topFn(data[rowIndex]);

                if (top !== null) maxes[axis] = Math.max(maxes[axis], top);
            }

            const estimate = Ren.DateValueChart_LastPeriodEstimate
                .getRefreshedEstimate(props, seriesIndex);

            if (estimate && typeof estimate.estimatedValue === "number") {

                maxes[axis] = Math.max(
                    maxes[axis],
                    stacks.getBase(seriesIndex, estimate.row) + estimate.estimatedValue
                );
            }
        }

        return maxes;
    };

    return {
        isStacked,
        getStacks,
        getAxisMaxes
    };
})();
