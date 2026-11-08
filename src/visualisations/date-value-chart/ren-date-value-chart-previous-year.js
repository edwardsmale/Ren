/**
 * Draws a series' values for the year before over the series, where it is set to compare with the
 * previous year: a dotted line in the series' colour, each period's value drawn at the period it
 * is compared with.  The values are binned and aggregated from the same rows as the chart's own,
 * so a chart showing the last twelve months compares them with the twelve before, even though it
 * does not draw those.  The line takes no clicks, so the series beneath it still can.
 */
Ren.DateValueChart_PreviousYear = (() => {

    /**
     * Gets a value indicating whether a series is set to compare with the previous year.
     */
    const isComparing = (props, seriesIndex) =>
        props.series?.[seriesIndex]?.compareWithPreviousYear === true;

    /**
     * Gets a value indicating whether the chart can draw the previous year: it bins its own dates
     * into days or longer, over a range of dates rather than all time.
     */
    const isAvailable = (props) => !!props.previousYearGroupingEntry
        && !!props.previousYearInputData
        && !props.isAllTime
        && !props.showAsPies
        && props.previousYearGroupingEntry.binPeriod >= Ren.DatePeriodEnum.Day;

    const isWanted = (props) => {

        if (!isAvailable(props) || Ren.DateValueChart_ValueTransforms.isYearOnYearChange(props)) {
            return false;
        }

        for (let i = 0; i < props.seriesCount; i++) {

            if (isComparing(props, i) && props.series[i].isEnabled !== false) return true;
        }

        return false;
    };

    /**
     * Gets the rows the chart draws for the previous year, prepared as its own are and with the
     * same transforms taken, so a running total or an index is compared with its own kind.
     */
    const getPlottedData = (props) => {

        if (!isWanted(props)) return [];

        const rows = Ren.DateValueChart_GroupingApplyer.getPreviousYearRows(
            props.previousYearInputData,
            props.previousYearGroupingEntry
        );

        if (rows.length === 0) return [];

        const prepared = Ren.CreateDateValueChart_PrepareData.prepareData(
            props.previousYearInputData,
            Object.assign({}, props, { preGroupedData: rows })
        );

        return Ren.DateValueChart_ValueTransforms.transform(props, prepared || [], true);
    };

    /**
     * Raises each axis' max to the highest previous year's value drawn against it.
     */
    const extendAxisMaxes = (props, axisMaxes) => {

        const rows = getPlottedData(props);

        if (rows.length === 0) return;

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!isComparing(props, i) || series.isEnabled === false) continue;

            const max = Ren.ArrayUtils.max(rows, row => row[props.valueHeadings[i]]);
            const axisName = series.valueAxis || "leftAxis";

            if (typeof max === "number" && isFinite(max)) {
                axisMaxes[axisName] = Math.max(axisMaxes[axisName] || 0, max);
            }
        }
    };

    /**
     * Lowers each axis' min to the lowest previous year's value drawn against it.
     */
    const extendAxisMins = (props, axisMins) => {

        const rows = getPlottedData(props);

        for (let i = 0; i < props.seriesCount && rows.length > 0; i++) {

            const series = props.series[i];

            if (!isComparing(props, i) || series.isEnabled === false) continue;

            const min = Ren.ArrayUtils.extent(rows, row => row[props.valueHeadings[i]])[0];
            const axisName = series.valueAxis || "leftAxis";

            if (typeof min === "number" && isFinite(min)) {
                axisMins[axisName] = Math.min(axisMins[axisName] ?? Infinity, min);
            }
        }
    };

    const render = (props) => {

        if (!props.xScale) return;

        const rows = getPlottedData(props);

        if (rows.length === 0) return;

        let group = null;

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!isComparing(props, i) || series.isEnabled === false) continue;

            const axis = props.axes[series.valueAxis || "leftAxis"];

            if (!axis?.yScale) continue;

            const heading = props.valueHeadings[i];
            let path = "";

            for (let j = 0; j < rows.length; j++) {

                const value = rows[j][heading];

                if (typeof value !== "number" || !isFinite(value)) continue;

                const date = Ren.DateValueChartCalculator.periodCentre(
                    props,
                    rows[j][props.dateHeading]
                );

                path += (path ? "L" : "M") + props.xScale.getPixel(date) + ","
                    + axis.yScale.getPixel(value);
            }

            if (!path) continue;

            if (!group) {

                group = Ren.Svg.append(props.chartGroup, "g", {
                    "class": "ren-previous-year",
                    "pointer-events": "none"
                });
            }

            Ren.Svg.append(group, "path", {
                "class": "ren-previous-year-line",
                "data-previous-year-series": i + 1,
                "d": path,
                "fill": "none",
                "stroke": series.colour,
                "stroke-width": 2,
                "stroke-dasharray": "2,4",
                "stroke-linecap": "round",
                "opacity": 0.7,
                "vector-effect": "non-scaling-stroke"
            });
        }
    };

    return {
        isComparing,
        isAvailable,
        getPlottedData,
        extendAxisMaxes,
        extendAxisMins,
        render
    };
})();
