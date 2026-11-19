/**
 * The date/value chart's estimate of what the last period will total once it is over.
 *
 * A last period that is still running draws lower than the ones before it, which reads as a fall.
 * Where a series asks for it, the value it has so far is scaled up by the proportion of the
 * period's working days that have gone.  Unless the chart turns it off, each day is instead
 * weighted by the share of trade it usually brings (Ren.WorkingDayWeights), so that a period with
 * the Christmas slump or a school holiday still to come is not overestimated, and the weekends'
 * orders count for what they usually bring rather than for nothing.
 *
 * Only a series whose values accumulate over the period can
 * be scaled that way - an average or a maximum of a part period is already the figure it will be -
 * so the estimate is offered only where the aggregation is Sum, Count or CountDistinct.
 *
 * The estimate is drawn in a pastel shade of the series' own colour, either in place of the actual
 * value or alongside it, per the series' Ren.EstimateLastPeriodEnum setting.
 */
Ren.DateValueChart_LastPeriodEstimate = (() => {

    /**
     * Gets the estimate mode a series is set to, which is None where it has not chosen one, where
     * the chart totals all time and so has no last period, or where it plots totals to date or
     * shares, which scaled up would be nonsense.
     */
    const getMode = (props, seriesIndex) =>
        props.isAllTime
            || !Ren.DateValueChart_ValueTransforms.isPlottedAsPrepared(props, seriesIndex)
            ? Ren.EstimateLastPeriodEnum.None
            : props.series?.[seriesIndex]?.estimateLastPeriod ?? Ren.EstimateLastPeriodEnum.None;

    /**
     * Gets the mode a series added to a chart takes up, which is the one most of the series already
     * there are set to: a series added to a chart that estimates its last period would otherwise
     * read as a fall against the ones beside it.  A tie goes to the mode of the first series.
     *
     * @param {object[]} series - The series already on the chart, as either props or the settings
     *     hold them.
     */
    const getInheritedMode = (series) => {

        if (!series || series.length === 0) return Ren.EstimateLastPeriodEnum.None;

        const countsByMode = new Map();
        let inheritedMode = Ren.EstimateLastPeriodEnum.None;
        let highestCount = 0;

        for (let i = 0; i < series.length; i++) {

            const mode = series[i]?.estimateLastPeriod ?? Ren.EstimateLastPeriodEnum.None;
            const count = (countsByMode.get(mode) ?? 0) + 1;

            countsByMode.set(mode, count);

            if (count > highestCount) {

                highestCount = count;
                inheritedMode = mode;
            }
        }

        return inheritedMode;
    };

    /**
     * Gets the format function the series' data settings name for its values, or null where they
     * name none.
     */
    const getFormatFunction = (props, seriesIndex) => {

        const formatFunction = props.valueColumnFormatFunctions?.[seriesIndex];

        return formatFunction?.length ? formatFunction : null;
    };

    /**
     * Gets the format an estimate is stated in, which is the series' own where a format function
     * goes with it.  Otherwise it is a plain number with no decimal places: a projection's decimals
     * would claim a precision it does not have.
     */
    const getEstimateFormat = (props, seriesIndex) =>
        getFormatFunction(props, seriesIndex) !== null
            ? props.valueColumnFormats?.[seriesIndex]
            : Ren.SpreadsheetColumnFormatEnum.Integer;

    /** An estimate as it is shown, in the format function its series' data settings name. */
    const formatEstimateValue = (props, seriesIndex, value) =>
        Ren.ValueFormatter.formatValue(
            value,
            null,
            getEstimateFormat(props, seriesIndex),
            getFormatFunction(props, seriesIndex),
            null,
            null,
            null,
            null
        );

    /**
     * Gets a value indicating whether a chart column's values accumulate as the period runs, which
     * is what makes scaling a part period up to a whole one meaningful.  A column with no
     * aggregation of its own is summed by default, so an unset aggregation counts here too.
     *
     * @param {object} visualisation - The chart's settings, holding chartDataGroupingSettings.
     * @param {string} columnKey - The heading of the column behind the series.
     */
    const isScalableAggregation = (visualisation, columnKey) => {

        const entry = visualisation?.chartDataGroupingSettings?.groupings?.entries?.[0];
        const aggregationType = entry?.columns?.[columnKey]?.aggregationType;

        // The aggregations that accumulate over a period, so scaling a part one up says something.
        return aggregationType == null
            || aggregationType === Ren.AggregationTypeEnum.Sum
            || aggregationType === Ren.AggregationTypeEnum.Count
            || aggregationType === Ren.AggregationTypeEnum.CountDistinct;
    };

    /**
     * Gets how far through a period today is, in working days, or null where the period is not one
     * that is still running.  Bank holidays are left out of the counts along with the weekends,
     * though seasonally adjusted, their weights still count.
     *
     * Today itself is not counted as elapsed: a day that is still going has only part of its data
     * in, so counting it in full would scale the value up by too little.
     *
     * @param {Date} periodStart - The first day of the period.
     * @param {Ren.DatePeriodEnum} datePeriod - The period's length.
     * @param {boolean} isSeasonallyAdjusted - Whether the days are weighted by the share of trade
     *     they usually bring, rather than each counting as one.
     * @returns {object|null} { elapsed, total } working days, with { elapsedWeight, totalWeight }
     *     and the ruleNames of the rules that weighted the period's days, or null.
     */
    const getPeriodProgress = (periodStart, datePeriod, isSeasonallyAdjusted) => {

        const periodEnd = Ren.DateUtils.addPeriod(periodStart, datePeriod);
        if (!periodEnd) return null;

        const today = Ren.DateUtils.today();

        // The period is over (or has yet to begin), so it holds every value it is ever going to.
        if (today >= periodEnd || today <= periodStart) return null;

        const total = Ren.WorkingDayUtils.countWorkingDays(periodStart, periodEnd);
        const elapsed = Ren.WorkingDayUtils.countWorkingDays(periodStart, today);

        // Nothing to scale by (a period of holidays), or nothing to scale up (every working day is
        // already done, the period just has non-working days left to run).
        if (elapsed <= 0 || total <= 0 || elapsed >= total) return null;

        if (!isSeasonallyAdjusted) {

            return { elapsed, total, elapsedWeight: elapsed, totalWeight: total, ruleNames: [] };
        }

        const totalWeights = Ren.WorkingDayWeights.sumWeights(periodStart, periodEnd);

        return {
            elapsed,
            total,
            elapsedWeight: Ren.WorkingDayWeights.sumWeights(periodStart, today).weight,
            totalWeight: totalWeights.weight,
            ruleNames: totalWeights.ruleNames
        };
    };

    /**
     * Gets the index of the row holding the latest date, which is the period the estimate is made
     * for, or -1 where no row carries a date. A series' bars and dots are drawn in the order of the
     * rows behind them, so the index identifies the mark to restyle.
     */
    const getLastPeriodRowIndex = (props, data) => {

        let lastIndex = -1;

        for (let i = 0; i < data.length; i++) {

            const date = data[i][props.dateHeading];
            if (!date) continue;

            if (lastIndex === -1 || date > data[lastIndex][props.dateHeading]) lastIndex = i;
        }

        return lastIndex;
    };

    /**
     * Gets the share of a running last period's working days that must have gone before the chart
     * shows it, per its Ren.ShowIncompleteLastPeriodEnum setting.
     */
    const getShowFromFraction = (props) => {

        switch (props.showIncompleteLastPeriod) {

            case Ren.ShowIncompleteLastPeriodEnum.FromHalfway: return 1 / 2;
            case Ren.ShowIncompleteLastPeriodEnum.FromOneThird: return 1 / 3;
            case Ren.ShowIncompleteLastPeriodEnum.FromTwoThirds: return 2 / 3;
            case Ren.ShowIncompleteLastPeriodEnum.Never: return Infinity;
            default: return 0;
        }
    };

    /**
     * Gets a value indicating whether any series overlays an estimate on its last period, which
     * shows that period's actual value whatever the estimate makes of it.
     */
    const hasOverlayedEstimate = (props) => {

        for (let i = 0; i < props.seriesCount; i++) {

            if (getMode(props, i) !== Ren.EstimateLastPeriodEnum.Overlayed) continue;

            const columnKey = props.seriesSourceHeadings?.[i] ?? props.valueHeadings[i];

            if (isScalableAggregation(props.visualisation, columnKey)) return true;
        }

        return false;
    };

    /**
     * Gets the rows the chart plots: its data, less the last period where that period is still
     * running and has not got as far through as the chart is set to show it from.  The data are
     * returned as they are where nothing is left out.
     *
     * Where a series overlays an estimate, such a period is kept instead and its estimates are
     * withheld, so that the actual value shows without a projection from too little of the period.
     *
     * Unlike an estimate, a period on its first working day counts as running, as it has data in
     * that is not a day's worth.
     */
    const getPlottedData = (props, data) => {

        props.isLastPeriodEstimateWithheld = false;

        const showFromFraction = getShowFromFraction(props);

        if (showFromFraction === 0 || !data || data.length === 0 || !props.dateHeading) return data;
        if (!(props.datePeriod >= Ren.DatePeriodEnum.Day)) return data;

        const rowIndex = getLastPeriodRowIndex(props, data);
        if (rowIndex === -1) return data;

        const periodStart = Ren.DateUtils.startOfPeriod(
            data[rowIndex][props.dateHeading],
            props.datePeriod
        ) || data[rowIndex][props.dateHeading];

        const periodEnd = Ren.DateUtils.addPeriod(periodStart, props.datePeriod);
        if (!periodEnd) return data;

        const today = Ren.DateUtils.today();
        if (today >= periodEnd || today < periodStart) return data;

        const total = Ren.WorkingDayUtils.countWorkingDays(periodStart, periodEnd);
        const elapsed = Ren.WorkingDayUtils.countWorkingDays(periodStart, today);

        // Only non-working days are left to run, so the period holds all it is going to.
        if (total <= 0 || elapsed >= total) return data;

        if (elapsed / total >= showFromFraction) return data;

        if (showFromFraction !== Infinity && hasOverlayedEstimate(props)) {

            props.isLastPeriodEstimateWithheld = true;

            return data;
        }

        // Compared by the periods the rows fall in, as over British Summer Time a row's date is an
        // hour short of the UTC midnight the period starts at.
        return data.filter(row => {

            const date = row[props.dateHeading];

            return !((Ren.DateUtils.startOfPeriod(date, props.datePeriod) || date) >= periodStart);
        });
    };

    /**
     * Gets one series' estimate for the last period on the chart, or null where there is not one to
     * make - the series is not asking for an estimate, its values are not summed, or the last
     * period is already complete.
     *
     * @returns {object|null} { row, rowIndex, actualValue, estimatedValue, workingDaysElapsed,
     *     workingDaysInPeriod, elapsedWeight, totalWeight, ruleNames }.
     */
    const getEstimate = (props, data, seriesIndex) => {

        if (getMode(props, seriesIndex) === Ren.EstimateLastPeriodEnum.None) return null;
        if (!data || data.length === 0 || !props.dateHeading) return null;

        const columnKey = props.seriesSourceHeadings?.[seriesIndex] ?? props.valueHeadings[seriesIndex];
        if (!isScalableAggregation(props.visualisation, columnKey)) return null;

        const rowIndex = getLastPeriodRowIndex(props, data);
        if (rowIndex === -1) return null;

        const row = data[rowIndex];

        const actualValue = row[props.valueHeadings[seriesIndex]];
        if (typeof actualValue !== "number" || !isFinite(actualValue)) return null;

        const progress = getPeriodProgress(
            row[props.dateHeading],
            props.datePeriod,
            props.seasonallyAdjustEstimate !== false
        );

        if (!progress) return null;

        return {
            row,
            rowIndex,
            actualValue,
            estimatedValue: actualValue * progress.totalWeight / progress.elapsedWeight,
            workingDaysElapsed: progress.elapsed,
            workingDaysInPeriod: progress.total,
            elapsedWeight: progress.elapsedWeight,
            totalWeight: progress.totalWeight,
            ruleNames: progress.ruleNames
        };
    };

    /**
     * Gets what an estimate's tooltip reads after the series' name: the estimate, the value it was
     * scaled up from, and the seasonal rules that weighted it, if any did.
     */
    const getEstimateTooltipValue = (props, seriesIndex, estimate) => {

        const workingDays = estimate.workingDaysInPeriod === 1 ? "working day" : "working days";

        let text = `${formatEstimateValue(props, seriesIndex, estimate.estimatedValue)} (estimated)`
            + `\n${formatEstimateValue(props, seriesIndex, estimate.actualValue)} so far, `
            + `${estimate.workingDaysElapsed} of ${estimate.workingDaysInPeriod} ${workingDays}`;

        if (estimate.ruleNames.length > 0) {

            const share = Math.round(100 * estimate.elapsedWeight / estimate.totalWeight);

            text += `\nSeasonally adjusted for ${estimate.ruleNames.join(", ")}: `
                + `the days so far usually bring ${share}% of the period`;
        }

        return text;
    };

    /**
     * Works out every series' estimate and holds them on props, so that the extents and the drawing
     * see the same figures.  None is made where the last period is shown before the chart is set
     * to show it from.
     */
    const refreshEstimates = (props, data) => {

        props.lastPeriodEstimates = [];

        for (let i = 0; i < props.seriesCount; i++) {

            props.lastPeriodEstimates[i] = props.isLastPeriodEstimateWithheld
                ? null
                : getEstimate(props, data, i);
        }
    };

    /** Gets a series' estimate from the last refresh, or null where it has none. */
    const getRefreshedEstimate = (props, seriesIndex) =>
        props.lastPeriodEstimates ? props.lastPeriodEstimates[seriesIndex] : null;

    /**
     * Gets a value indicating whether a series is drawn as bars stacked on the series below it,
     * which makes its estimate part of the stack rather than something laid over it: the segments
     * above a stacked segment stand on its top.
     */
    const isStackedBarSeries = (props, seriesIndex) =>
        getSeriesTypeString(props, seriesIndex) === "bar"
            && Ren.DateValueChartCalculator.isStackedBarLayout(
                Ren.DateValueChartCalculator.getBarLayout(props)
            );

    /**
     * Gets a value indicating whether the estimate is what a series plots for the last period,
     * rather than a figure drawn beside the value the data holds.  In place, it always is; stacked,
     * it is whichever mode the series is set to, since the segment carries what is stacked on it.
     */
    const isEstimatePlotted = (props, seriesIndex) => {

        const mode = getMode(props, seriesIndex);

        if (mode === Ren.EstimateLastPeriodEnum.None) return false;
        if (mode === Ren.EstimateLastPeriodEnum.InPlace) return true;

        return isStackedBarSeries(props, seriesIndex);
    };

    /**
     * Wraps a series' value function so that the estimate is what is plotted for the last period
     * where the series plots it.
     */
    const applyEstimatedValue = (props, seriesIndex, valueFn) => {

        const estimate = getRefreshedEstimate(props, seriesIndex);
        if (!estimate) return valueFn;
        if (!isEstimatePlotted(props, seriesIndex)) return valueFn;

        return d => d === estimate.row ? estimate.estimatedValue : valueFn(d);
    };

    /**
     * Gets the value a series reaches once its estimate is taken into account.  An overlayed
     * estimate is drawn beside the actual value, so the taller of the two counts; an in-place one
     * replaces it.
     */
    const getExtentValue = (props, seriesIndex, dataMax) => {

        const estimate = getRefreshedEstimate(props, seriesIndex);
        if (!estimate) return dataMax;

        return Math.max(dataMax || 0, estimate.estimatedValue);
    };

    /** Gets the kind of mark a series is drawn with, as the render and label modules name it. */
    const getSeriesTypeString = (props, seriesIndex) => {

        switch (props.series[seriesIndex].chartType) {

            case Ren.SeriesChartTypeEnum.Line: return "line";
            case Ren.SeriesChartTypeEnum.Dot: return "point";
            case Ren.SeriesChartTypeEnum.Pie: return "pie";
            default: return "bar";
        }
    };

    /**
     * Gets the wrapper of the value label a series drew for one of its rows, or null where the
     * series has none there.  The labels are appended in row order, in a group of their own per
     * series, so the row's index finds the label belonging to it.
     */
    const getValueLabelWrapper = (props, seriesIndex, typeString, rowIndex) =>
        Ren.DateValueChart_RenderValueLabels
            .getSeriesLabelsGroup(props, `.ren-series-${seriesIndex + 1}`)
            .querySelectorAll(`.ren-${typeString}-value-labels > .ren-text-wrapper`)[rowIndex]
            || null;

    /**
     * Marks a mark already drawn as being the estimate, so that the style updater's pastel rules
     * apply to it.  The label the series drew for the row is marked in the same way, and captioned
     * as the estimate it now reads.
     */
    const markInPlaceEstimate = (props, seriesGroup, seriesIndex, estimate) => {

        const typeString = getSeriesTypeString(props, seriesIndex);

        // The tooltips are built from the plotted value alone, which does not say it is estimated.
        const tooltipValue = getEstimateTooltipValue(props, seriesIndex, estimate);

        const replaceTooltipValue = (title) => {

            if (title) {

                title.textContent = title.textContent.replace(/:.*$/, () => `: ${tooltipValue}`);
            }
        };

        if (typeString === "bar") {

            const bar = seriesGroup.querySelectorAll(".ren-bar.ren-vertical")[estimate.rowIndex];

            if (bar) {

                bar.classList.add("ren-estimate-mark");
                replaceTooltipValue(bar.querySelector("title"));
            }
        }
        else if (typeString === "point") {

            seriesGroup.querySelectorAll(".ren-data-series__point")[estimate.rowIndex]
                ?.classList.add("ren-estimate-mark");
        }

        const labelWrapper = getValueLabelWrapper(props, seriesIndex, typeString, estimate.rowIndex);

        if (!labelWrapper) return;

        labelWrapper.classList.add("ren-estimate-value-label");

        // The series drew the label in its own format as it plotted the estimated value; an
        // estimate is stated in the estimate's format instead.
        const labelText = labelWrapper.querySelector("text");

        if (labelText) {

            labelText.textContent =
                formatEstimateValue(props, seriesIndex, estimate.estimatedValue) ?? "";
        }

        replaceTooltipValue(labelWrapper.querySelector("title"));

        Ren.DateValueChart_RenderValueLabels.appendEstimateCaption(labelWrapper);
    };

    /**
     * Draws an overlayed estimate as a mark of its own: a second bar, or a dot for a point or line
     * series.
     */
    const renderEstimateMark = (context) => {

        const { props, seriesGroup, seriesIndex, estimate, crossValueFn, yScale, mode } = context;

        // In place, a bar or a dot is the series' own mark restyled, and a line is drawn through
        // the estimate, whose node marks it, so there is nothing to add.
        if (mode !== Ren.EstimateLastPeriodEnum.Overlayed) return;

        const typeString = getSeriesTypeString(props, seriesIndex);

        const group = Ren.Svg.append(seriesGroup, "g", {
            "class": "ren-data-series ren-data-series--estimate"
        });
        const x = props.xScale.getPixel(crossValueFn(estimate.row));
        const y = yScale.getPixel(estimate.estimatedValue);

        if (typeString === "bar") {

            const width = context.bandwidthFn(estimate.row);
            const height = yScale.getPixel(0) - y;

            const bar = Ren.Svg.append(group, "g", {
                "class": "ren-bar-estimate ren-estimate-mark",
                "transform": `translate(${x - width / 2}, ${y})`
            });

            Ren.Svg.append(bar, "path", {
                "class": "ren-data-series__bar",
                "d": `M 0,0 h ${width} v ${height} h -${width} Z`
            });
        }
        else {

            // The dot's and ring's radii are the chart's stylesheet's to set, as the series' own.
            Ren.Svg.append(group, "circle", {
                "class": "ren-data-series__point ren-estimate-mark",
                "cx": x,
                "cy": y,
                "stroke": "#fff",
                "stroke-width": 1.5
            });

            // Shown, like the series' own dots' rings, while the series is selected.
            Ren.Svg.append(group, "circle", {
                "class": "ren-data-series__point-ring",
                "cx": x,
                "cy": y,
                "fill": "none",
                "stroke-width": 2,
                "vector-effect": "non-scaling-stroke",
                "pointer-events": "none",
                "display": "none"
            });
        }

        // The estimate has a label of its own - the actual value keeps the one the series drew for
        // it.
        const labelsGroup = Ren.DateValueChart_RenderValueLabels.renderValueLabelsIntoGroup(
            typeString,
            props,
            `.ren-series-${seriesIndex + 1}`,
            [{
                x,
                y,
                value: estimate.estimatedValue,
                date: estimate.row[props.dateHeading],
                isEstimate: true
            }],
            getEstimateFormat(props, seriesIndex),
            getFormatFunction(props, seriesIndex),
            yScale.getPixel(0)
        );

        // Marked as the estimate's own in the same way an in-place label is, since that class is
        // what the style updater's pastel-bar label colour hangs off.
        const labelWrapper = labelsGroup.querySelector(".ren-text-wrapper");
        labelWrapper?.classList.add("ren-estimate-value-label");

        Ren.DateValueChart_RenderValueLabels.appendEstimateCaption(labelWrapper);

        // The lower of the two values is drawn on top, so that both stay visible where they
        // overlap.
        if (estimate.estimatedValue > estimate.actualValue) {

            seriesGroup.insertBefore(group, seriesGroup.firstChild);
        }
    };

    /**
     * Draws a series' last-period estimate, after the series itself has been rendered.  Does
     * nothing where the series has no estimate to show.
     *
     * @param {object} context - { props, seriesGroup, seriesIndex, crossValueFn, yScale,
     *     bandwidthFn }, the series' own rendering values.
     */
    const renderForSeries = (context) => {

        const { props, seriesIndex } = context;

        const estimate = getRefreshedEstimate(props, seriesIndex);
        if (!estimate) return;

        // A stacked series draws its estimate as part of its stack, as it draws its segments,
        // so there is nothing to add over it here.
        if (isStackedBarSeries(props, seriesIndex)) return;

        const mode = getMode(props, seriesIndex);

        if (mode === Ren.EstimateLastPeriodEnum.InPlace) {

            markInPlaceEstimate(props, context.seriesGroup, seriesIndex, estimate);
        }

        renderEstimateMark(Object.assign({ mode, estimate }, context));
    };

    return {
        getMode,
        getInheritedMode,
        formatEstimateValue,
        getEstimateTooltipValue,
        getEstimateFormat,
        getEstimateFormatFunction: getFormatFunction,
        isScalableAggregation,
        getPeriodProgress,
        getPlottedData,
        getEstimate,
        refreshEstimates,
        getRefreshedEstimate,
        applyEstimatedValue,
        isEstimatePlotted,
        getExtentValue,
        getSeriesTypeString,
        renderForSeries
    };
})();
