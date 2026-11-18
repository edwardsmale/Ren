Ren.DateValueChart_Render = (() => {

    /**
     * Calculates the x position for a data point, centred within its date period - or within the
     * part of that period the axis shows, where the data only partly fills it.
     */
    const getDateValueChartCrossValueFn = props => d =>
        Ren.DateValueChartCalculator.periodCentre(props, d[props.dateHeading]);

    /**
     * Gets the function that returns the y value for a given series index.
     */
    const getMainValueFn = (props, seriesIndex) => {

        const index = seriesIndex !== undefined ? seriesIndex : 0;
        const heading = props.valueHeadings[index];
        const valueFn = d => d[heading];

        // An estimated last period is plotted, and so labelled, in place of its value.
        return Ren.DateValueChart_LastPeriodEstimate.applyEstimatedValue(props, index, valueFn);
    };

    // No width is passed, as the bar series works its bars' width out for itself.
    const getBarRenderOptions = (props, seriesIndex, axisName) => ({
        yScale: props.axes[axisName].yScale
    });

    // A dot's area by size, in the chart's unscaled square units.
    const pointSizeMap = { small: 500 / 36, medium: 500 / 16, large: 500 / 9 };

    // How far a selected series' dots are ringed clear of their edge.
    const SELECTED_POINT_RING_GAP = 5;

    const lineWidthMap = { thin: 2, normal: 4, thick: 6 };

    const getLineStyle = (props, seriesIndex) => props.series[seriesIndex]?.lineStyle ?? "solid";

    const getLineWidth = (props, seriesIndex) => props.series[seriesIndex]?.lineWidth ?? "normal";

    /**
     * Gets the x positions a row's period starts and ends at.
     */
    const getPeriodEdges = (props, d) => {

        const span = Ren.DateValueChartCalculator.periodSpan(props, d[props.dateHeading]);

        return [props.xScale.getPixel(span.start), props.xScale.getPixel(span.end)];
    };

    // Shaded, a stacked line is filled down to the line below it, and an overlayed one to zero,
    // and both carry on, fading, to the outer edges of their first and last periods.  A stepped
    // line is flat across each period, so reaches those edges as it is.
    const getLineRenderOptions = (props, seriesIndex, axisName, lineStacks) => {

        const lineShape = Ren.DateValueChartCalculator.getLineShape(props.series[seriesIndex]);
        const periodEdgesFn = d => getPeriodEdges(props, d);

        return {
            curved: lineShape === "curved",
            stepEdgesFn: lineShape === "stepped" ? periodEdgesFn : null,
            nodeOverhang: 1,
            yScale: props.axes[axisName].yScale,
            areaBaseValueFn: props.shadeLines === true
                ? (lineStacks ? lineStacks.getBaseFn(seriesIndex) : () => 0)
                : null,
            periodEdgesFn: props.shadeLines === true ? periodEdgesFn : null,
            edgeMaskId: `line-ends-${props.guid}-series-${seriesIndex + 1}`
        };
    };

    /**
     * Labels each point of a stacked line with the series' own value, at the height the line is
     * drawn at.  Every row is labelled, as the unstacked labels are, so that a label's index is
     * still its row's.
     */
    const renderStackedLineValueLabels = (
        props,
        data,
        valueFn,
        topFn,
        crossValueFn,
        yScale,
        seriesIndex
    ) => {

        const points = [];

        for (let index = 0; index < data.length; index++) {

            const d = data[index];
            const top = topFn(d);

            points.push({
                x: props.xScale.getPixel(crossValueFn(d)),
                y: yScale.getPixel(top ?? 0),
                value: valueFn(d),
                date: d[props.dateHeading]
            });
        }

        Ren.DateValueChart_RenderValueLabels.renderValueLabelsIntoGroup(
            "line",
            props,
            `.ren-series-${seriesIndex + 1}`,
            points,
            props.valueColumnFormats[seriesIndex],
            props.valueColumnFormatFunctions[seriesIndex],
            yScale.getPixel(0)
        );
    };

    /**
     * Gets the width a line of the given style and width ("thin", "normal" or "thick") is drawn at,
     * in the chart's unscaled units.
     */
    const getStyledLineStrokeWidth = (lineStyle, lineWidth) =>
        Ren.ChartLineSeries.getStrokeWidth(lineStyle, lineWidthMap[lineWidth]);

    /**
     * Gets the width a line series is drawn at, in the chart's unscaled units.
     */
    const getLineStrokeWidth = (props, seriesIndex) => getStyledLineStrokeWidth(
        getLineStyle(props, seriesIndex),
        getLineWidth(props, seriesIndex)
    );

    /**
     * Gets the radius of a dot of the given size ("small", "medium" or "large"), in the chart's
     * unscaled units.
     */
    const getStyledPointRadius = (dotSize) =>
        Math.sqrt((pointSizeMap[dotSize] ?? pointSizeMap.medium) / Math.PI);

    /**
     * Gets the radius of a series' dots, in the chart's unscaled units.
     */
    const getPointRadius = (props, seriesIndex) =>
        getStyledPointRadius(props.series[seriesIndex]?.dotSize);

    const getPointRenderOptions = (props, seriesIndex, axisName) => ({
        hasSelectionRings: true,
        yScale: props.axes[axisName].yScale
    });

    /**
     * Gets the rows the chart plots from those it has prepared: less any last period it is not
     * showing yet, with any running totals or shares taken.
     */
    const getPlottedData = (props, data) => Ren.DateValueChart_ValueTransforms.transform(
        props,
        Ren.DateValueChart_LastPeriodEstimate.getPlottedData(props, data)
    );

    // The hidden axis is never drawn, but plots the series assigned to it on a scale of their own.
    /**
     * Renders a date-value chart with bars, line, and/or points.  Supports both single-column and
     * multi-column (dual-series) modes.
     */
    const renderDateValueChart = (props, data) => {

        props.currentData = data;

        // A last period the chart is not showing yet is left out of everything drawn.
        data = getPlottedData(props, data);
        props.plottedData = data;

        props.isMultiColumn = props.seriesCount >= 2;

        Ren.DateValueChart_RenderChartSetup.setChartDimensions(props);

        // Before the extents, which must leave room for an estimate above any value in the data.
        Ren.DateValueChart_LastPeriodEstimate.refreshEstimates(props, data);

        Ren.DateValueChart_RenderChartSetup.setChartExtents(props, data);

        // Carrying on would leave the chart half set up (no svg), breaking anything that resizes
        // it.
        if (!props.xExtentPlusPeriod) {

            return `Date column '${props.dateHeading}' holds no dates to plot.`;
        }

        // The extents were just calculated, so the initial redrawChart need not recalculate them.
        props.skipExtentRecalculation = true;

        Ren.DateValueChart_YScales.createYScales(props);

        Ren.DateValueChart_RenderChartSetup.setupSvgAndGroups(props);
        Ren.DateValueChart_PeriodSlider.render(props);

        const containerNode = document.querySelector("." + props.guid);

        Ren.DateValueChart_StyleUpdater.updateScales(
            props,
            containerNode ? containerNode.clientWidth : 0,
            containerNode ? containerNode.clientHeight : 0
        );

        props.xScale = Ren.ChartScales.createTimeScale(
            props.xExtentPlusPeriod,
            [0, props.innerWidth]
        );

        props.resetScale = () => {

            props.axes.leftAxis.fromSettings = false;
            props.axes.rightAxis.fromSettings = false;
            props.axes.hiddenAxis.fromSettings = false;

            const currentData = getPlottedData(props, props.currentData || data);

            Ren.DateValueChart_LastPeriodEstimate.refreshEstimates(props, currentData);
            Ren.DateValueChart_RenderChartSetup.setChartExtents(props, currentData);

            Ren.DateValueChart_YScales.createYScales(props);

            props.redrawChart();
        };

        props.scaleToValue = (maxValue, axisName) => {

            if (maxValue === undefined || maxValue === null || maxValue <= 0) return;

            const axis = props.axes[axisName];
            if (!axis) return;

            axis.maxY = maxValue;
            axis.yExtent = [0, maxValue];
            axis.fromSettings = true;

            if (props.visualisation) {

                if (!props.visualisation[axisName]) {
                    props.visualisation[axisName] = {};
                }
                props.visualisation[axisName].maxY = maxValue;
                props.visualisation[axisName].fromSettings = true;
            }

            // Not niced, so that the exact value is respected.
            if (axis.yScale) {
                axis.yScale.setDomain([0, maxValue]);
            }

            // The user set this value explicitly, so the extent ratchet must not override it.
            props.skipExtentRecalculation = true;
            props.redrawChart();
        };

        props.redrawChart = () => {

            // The data may have changed since the initial render, e.g. through filtering.
            const currentData = getPlottedData(props, props.currentData || data);

            props.plottedData = currentData;
            Ren.QA.DateValueChart.setPlottedData(props, currentData);
            Ren.DateValueChart_Accessibility.labelChart(props);

            // Refreshed here, as the extents are not always recalculated but the draw needs these.
            Ren.DateValueChart_LastPeriodEstimate.refreshEstimates(props, currentData);

            const userSetScale = props.axes.leftAxis.fromSettings || props.axes.rightAxis.fromSettings;

            if (!props.skipExtentRecalculation && !userSetScale) {

                Ren.DateValueChart_RenderChartSetup.setChartExtents(props, currentData);
            }
            else {

                // The value scale is being left as it is, but the dates the data covers still have
                // to be taken again, or a chart narrowed to a date range would keep the axis it had
                // and simply draw nothing before the range.
                Ren.DateValueChart_RenderChartSetup.setXExtent(props, currentData);
            }

            props.skipExtentRecalculation = false;

            // Set on every redraw, as a series estimating the last period is drawn across all of
            // it, so the domain follows the estimates too.
            Ren.DateValueChart_RenderChartSetup.setXDomain(props);

            // The x scale is created once, so without this a grouping change would re-tick the axis
            // over the previous grouping's date range.
            if (props.xScale) props.xScale.setDomain(props.xExtentPlusPeriod);

            // Before the scales below, which are ranged over the plot area the margins leave.
            Ren.DateValueChart_RenderChartSetup.updateAxisMargins(props);
            Ren.DateValueChart_PeriodSlider.align(props);

            // Marker lines and their labels stand above the plot, so their room comes out of the
            // top margin, again before the scales below are ranged over what is left.
            Ren.DateValueChart_MarkerLabels.reserveBand(props);

            Ren.DateValueChart_YScales.createYScales(props);

            // A default format depends on how high its axis reaches.
            Ren.DateValueChart_ValueFormats.resolveFormats(props);
            Ren.DateValueChart_ValueTransforms.applyTransformFormats(props);

            props.chartGroup.replaceChildren();

            // props.defs persists across redraws, so gradients are recreated for added or removed
            // series.
            Ren.DateValueChart_RenderChartSetup.createBarGradients(props);

            const seriesChartTypeToSeriesMap = {

                [Ren.SeriesChartTypeEnum.Bar]: "bar",
                [Ren.SeriesChartTypeEnum.Line]: "line",
                [Ren.SeriesChartTypeEnum.Dot]: "point",
                [Ren.SeriesChartTypeEnum.Pie]: "pie"
            };

            // Series switched off in the legend keep their type string, as the legend still draws
            // their marker, but are left out of the types to render.  A series drawn as a pie is a
            // slice of the pies, drawn together by DateValueChart_Pies, and is marked as a bar is.
            const seriesTypeStrings = [];
            const typesNeeded = new Set();
            const isPies = Ren.DateValueChart_Pies.isShown(props);

            for (let i = 0; i < props.seriesCount; i++) {

                const chartType = props.series[i].chartType ?? Ren.SeriesChartTypeEnum.Bar;
                const typeString = seriesChartTypeToSeriesMap[chartType] ?? "bar";
                seriesTypeStrings[i] = typeString;

                if (props.series[i].isEnabled !== false) typesNeeded.add(typeString);
            }

            props.seriesTypeStrings = seriesTypeStrings;
            props.seriesTypes = Array.from(typesNeeded);

            const renderSeriesOfType = (typeString, config) => {

                const getValueFn = series => getMainValueFn(props, series);
                const crossValueFn = getDateValueChartCrossValueFn(props);

                // Stacked, a line is drawn at the height its top stands at in the stack, as are
                // its labels and drag handles, but its labels read its own values.
                const lineStacks = typeString === "line"
                    ? Ren.DateValueChart_LineStack.getStacks(props, currentData)
                    : null;

                for (let i = 0; i < props.seriesCount; i++) {

                    if (props.series[i].isEnabled === false) continue;

                    if (seriesTypeStrings[i] === typeString) {

                        const mainValueFn = getValueFn(i);
                        const plottedValueFn = lineStacks ? lineStacks.getTopFn(i) : mainValueFn;
                        const seriesNum = i + 1;
                        const axisName = props.series[i].valueAxis || "leftAxis";
                        const yScale = props.axes[axisName].yScale;
                        const seriesGroup = Ren.Svg.append(props.chartGroup, "g", {
                            "class": `ren-series-${seriesNum}`,
                            "data-series": seriesNum
                        });

                        const seriesSpec = Ren.ChartSeriesSpec.createSeriesSpec(props, currentData, plottedValueFn, crossValueFn);
                        const seriesSpecModified = Object.assign({}, seriesSpec, {
                            props: Object.assign({}, seriesSpec.props, { chartGroup: seriesGroup })
                        });

                        const options = config.getOptions(props, i, axisName, lineStacks);

                        config.renderFn(seriesSpecModified, options);

                        Ren.DateValueChart_OtherSeries.addTooltip(
                            seriesGroup.querySelector(config.dataSeriesSelector),
                            props,
                            i
                        );

                        if (typeString === "line") {

                            Ren.DateValueChart_LineNames.recordLine(
                                props,
                                i,
                                currentData,
                                plottedValueFn,
                                crossValueFn,
                                yScale,
                                options.stepEdgesFn
                            );
                        }

                        if (lineStacks) {

                            renderStackedLineValueLabels(
                                props,
                                currentData,
                                mainValueFn,
                                plottedValueFn,
                                crossValueFn,
                                yScale,
                                i
                            );
                        }
                        else {

                            config.labelRenderFn(props, currentData, mainValueFn, crossValueFn, yScale, `.ren-series-${seriesNum}`, null, props.valueColumnFormats[i], props.valueColumnFormatFunctions[i]);
                        }

                        // An overlayed estimate's dot stands on the lines below, as the line does.
                        const estimate = lineStacks
                            ? Ren.DateValueChart_LastPeriodEstimate.getRefreshedEstimate(props, i)
                            : null;
                        const estimateBase = estimate ? lineStacks.getBase(i, estimate.row) : 0;

                        Ren.DateValueChart_LastPeriodEstimate.renderForSeries({
                            props,
                            seriesGroup,
                            seriesIndex: i,
                            crossValueFn,
                            yScale: estimateBase
                                ? { getPixel: value => yScale.getPixel(value + estimateBase) }
                                : yScale
                        });

                        Ren.DateValueChart_SeriesColourFunction.applyToSeries(
                            props,
                            i,
                            seriesGroup,
                            crossValueFn
                        );

                        const dataGroup = seriesGroup.querySelector(config.dataSeriesSelector);

                        if (dataGroup) {
                            config.resizeHandlerFn(dataGroup, currentData, plottedValueFn, crossValueFn, props.xScale, yScale, axisName, props, props.visualisation);
                        }
                    }
                }
            };

            const seriesConfigs = {
                line: {
                    dataSeriesSelector: ".ren-data-series--line",
                    renderFn: Ren.ChartLineSeries.renderLineSeries,
                    labelRenderFn: Ren.DateValueChart_RenderValueLabels.renderLineValueLabels,
                    resizeHandlerFn: Ren.DateValueChart_ValueResize.addHandlesToLineNodes,
                    getOptions: (props, i, axisName, lineStacks) =>
                        getLineRenderOptions(props, i, axisName, lineStacks)
                },
                point: {
                    dataSeriesSelector: ".ren-data-series--point",
                    renderFn: Ren.ChartPointSeries.renderPointSeries,
                    labelRenderFn: Ren.DateValueChart_RenderValueLabels.renderPointValueLabels,
                    resizeHandlerFn: Ren.DateValueChart_ValueResize.addHandlesToDots,
                    getOptions: (props, i, axisName) => getPointRenderOptions(props, i, axisName)
                }
            };

            // Where each bar series' bars are drawn, by series index, for the marks laid on them.
            props.barPlacements = {};

            if (props.seriesTypes.includes("bar")) {

                const getValueFn = series => getMainValueFn(props, series);
                const crossValueFn = getDateValueChartCrossValueFn(props);

                const barSeriesIndices = [];

                for (let i = 0; i < props.seriesCount; i++) {

                    if (seriesTypeStrings[i] === "bar" && props.series[i].isEnabled !== false) {
                        barSeriesIndices.push(i);
                    }
                }

                const barLayout = Ren.DateValueChartCalculator.getBarLayout(props);
                const isStacked = Ren.DateValueChartCalculator.isStackedBarLayout(barLayout);

                // The series sharing a slot are overlayed or stacked, and the slots are drawn
                // side-by-side.
                const barSlots = Ren.DateValueChartCalculator.getBarSlots(
                    props,
                    barSeriesIndices,
                    barLayout
                );

                const slotCount = barSlots.slotCount;

                // The heights each stacked bar stands on and reaches, by series then data index.
                let stackBases = null;
                let stackTops = null;

                // Gets the value function for the height a bar's top stands at in the stack.
                let getStackTopFn = null;

                // Each stack's furthest reach each way, and the series whose bar reaches it, by
                // slot then data index, as { high, low, highSeriesIndex, lowSeriesIndex }.
                let stackEnds = null;

                if (isStacked) {

                    stackBases = {};
                    stackTops = {};
                    stackEnds = [];
                    const dataIndexes = new Map();

                    for (let slot = 0; slot < slotCount; slot++) stackEnds.push([]);

                    for (let i = 0; i < barSeriesIndices.length; i++) {

                        stackBases[barSeriesIndices[i]] = [];
                        stackTops[barSeriesIndices[i]] = [];
                    }

                    currentData.forEach((d, dataIndex) => {

                        // Each slot's stack starts from 0.
                        const slotTotals = new Array(slotCount).fill(0);

                        for (let slot = 0; slot < slotCount; slot++) {

                            stackEnds[slot][dataIndex] = {
                                high: 0,
                                low: 0,
                                highSeriesIndex: null,
                                lowSeriesIndex: null
                            };
                        }

                        for (let i = 0; i < barSeriesIndices.length; i++) {

                            const seriesIndex = barSeriesIndices[i];
                            const slot = barSlots.slotBySeriesIndex[seriesIndex];
                            const value = getValueFn(seriesIndex)(d) || 0;
                            const ends = stackEnds[slot][dataIndex];

                            stackBases[seriesIndex][dataIndex] = slotTotals[slot];
                            slotTotals[slot] += value;
                            stackTops[seriesIndex][dataIndex] = slotTotals[slot];

                            if (value > 0 && slotTotals[slot] >= ends.high) {

                                ends.high = slotTotals[slot];
                                ends.highSeriesIndex = seriesIndex;
                            }

                            if (value < 0 && slotTotals[slot] <= ends.low) {

                                ends.low = slotTotals[slot];
                                ends.lowSeriesIndex = seriesIndex;
                            }
                        }

                        dataIndexes.set(d, dataIndex);
                    });

                    getStackTopFn = seriesIndex => d => {

                        const dataIndex = dataIndexes.get(d);

                        if (dataIndex === undefined) return 0;

                        return stackTops[seriesIndex][dataIndex];
                    };
                }

                const originalNarrowingRatio = props.barNarrowingRatio || 1;

                props.barNarrowingRatio = slotCount > 1
                    ? originalNarrowingRatio / slotCount
                    : originalNarrowingRatio;

                // Taken from the bar series itself, so everything lined up with the bars shares
                // their width.  A slot's share of the period is already in the narrowing ratio.
                const bandwidthFn = d => Ren.ChartBarSeries.getBarWidth(props, d[props.dateHeading]);

                // Overlayed series are drawn highest average first, so the lower ones stay visible.
                let renderOrder = barSeriesIndices.slice();

                if (Ren.DateValueChartCalculator.isOverlayedBarLayout(barLayout)
                    && currentData.length > 0) {

                    renderOrder.sort((indexA, indexB) => {

                        const fnA = getValueFn(indexA);
                        const fnB = getValueFn(indexB);
                        const avgA = currentData.reduce((sum, d) => sum + (fnA(d) || 0), 0) / currentData.length;
                        const avgB = currentData.reduce((sum, d) => sum + (fnB(d) || 0), 0) / currentData.length;
                        return avgB - avgA; // Descending order: highest values first, lowest last.
                    });
                }

                for (let renderIndex = 0; renderIndex < renderOrder.length; renderIndex++) {

                    const seriesIndex = renderOrder[renderIndex];
                    const slot = barSlots.slotBySeriesIndex[seriesIndex];
                    const seriesNum = seriesIndex + 1;
                    const axisName = props.series[seriesIndex].valueAxis || "leftAxis";
                    const yScale = props.axes[axisName].yScale;

                    const seriesGroup = Ren.Svg.append(props.chartGroup, "g", {
                        "class": `ren-series-${seriesNum}`,
                        "data-series": seriesNum
                    });

                    const createCrossValueFn = () => {

                        if (slotCount > 1) {

                            return d => {

                                const centerDate = crossValueFn(d);
                                const periodWidth = Ren.DateValueChartCalculator.periodWidth(props, d[props.dateHeading]);
                                const availableWidth = periodWidth * (1 - 0.04);
                                const barPixelWidth = availableWidth / slotCount;
                                const barPixelOffset = (slot - (slotCount - 1) / 2) * barPixelWidth;
                                const centerPixel = props.xScale.getPixel(centerDate);
                                const barPixel = centerPixel + barPixelOffset;
                                return props.xScale.getValue(barPixel);
                            };
                        }
                        else {

                            return crossValueFn;
                        }
                    };
                    const seriesCrossValueFn = createCrossValueFn();

                    const createMainValueFn = () => {

                        if (isStacked) {

                            return getValueFn(seriesIndex);
                        }
                        else {

                            return getValueFn(seriesIndex);
                        }
                    };
                    const seriesMainValueFn = createMainValueFn();

                    // A stacked bar's marks go beyond the whole stack, clear of the bars above.
                    props.barPlacements[seriesIndex] = {
                        crossValueFn: seriesCrossValueFn,
                        getEnd: isStacked
                            ? (d, dataIndex, isUp) => {

                                const ends = stackEnds[slot][dataIndex];

                                return isUp
                                    ? { value: ends.high, seriesIndex: ends.highSeriesIndex }
                                    : { value: ends.low, seriesIndex: ends.lowSeriesIndex };
                            }
                            : d => ({ value: seriesMainValueFn(d), seriesIndex })
                    };

                    const seriesSpec = Ren.ChartSeriesSpec.createSeriesSpec(props, currentData, seriesMainValueFn, seriesCrossValueFn);
                    const seriesSpecModified = Object.assign({}, seriesSpec, {
                        props: Object.assign({}, seriesSpec.props, {
                            chartGroup: seriesGroup,
                            valueHeading: props.valueHeadings[seriesIndex],
                            seriesLabel: props.series[seriesIndex].label || props.valueHeadings[seriesIndex],
                            valueColumnFormat: props.valueColumnFormats[seriesIndex],
                            seriesTooltipNote:
                                Ren.DateValueChart_OtherSeries.getTooltip(props, seriesIndex)
                        })
                    });

                    // A stacked series draws its last-period estimate as part of its stack rather
                    // than as a mark laid over it afterwards.
                    const seriesEstimate =
                        Ren.DateValueChart_LastPeriodEstimate.getRefreshedEstimate(props, seriesIndex);
                    const estimateMode =
                        Ren.DateValueChart_LastPeriodEstimate.getMode(props, seriesIndex);
                    const estimatedRowIndex = seriesEstimate ? seriesEstimate.rowIndex : -1;

                    if (isStacked) {

                        const bandwidthFnValue = bandwidthFn;
                        const dataSeriesGroup = Ren.Svg.append(seriesGroup, "g", {
                            "class": "ren-data-series ren-data-series--bar"
                        });
                        const gradientId = Ren.DateValueChart_RenderChartSetup.barGradientId(props, seriesNum);
                        const dateTickFormat =
                            Ren.DateValueChart_DateTickFormat.getChartTickFormat(props);
                        const seriesLabel = props.series[seriesIndex].label
                            || props.valueHeadings[seriesIndex];

                        const formatSegmentValue = value => Ren.ValueFormatter.formatValueSimple(
                            value,
                            props.valueColumnFormats[seriesIndex]
                        );

                        const formatEstimate = estimate =>
                            Ren.DateValueChart_LastPeriodEstimate.getEstimateTooltipValue(
                                props,
                                seriesIndex,
                                estimate
                            );

                        /**
                         * Draws one part of a stacked segment: the value the data holds, or what
                         * the estimate adds above it.
                         *
                         * @param {object} part - { fromValue, toValue, className, isEstimate,
                         *     valueLabel }, valueLabel being what its tooltip reads.
                         */
                        const appendSegmentPart = (d, dataIndex, part) => {

                            const x = props.xScale.getPixel(seriesCrossValueFn(d));
                            const width = bandwidthFnValue(d);
                            const top = yScale.getPixel(part.toValue);
                            const height = yScale.getPixel(part.fromValue) - top;

                            const partGroup = Ren.Svg.append(dataSeriesGroup, "g", {
                                "class": part.className,
                                "data-index": dataIndex,
                                "data-series": seriesNum,
                                "transform": `translate(${x - width / 2}, ${top})`
                            });

                            Ren.Svg.setDatum(partGroup, d);

                            // The path is coloured by its own datum, so it is given the part's.
                            const path = Ren.Svg.setDatum(Ren.Svg.append(partGroup, "path", {
                                "class": "ren-data-series__bar",
                                "d": `M 0,0 h ${width} v ${height} h -${width} Z`
                            }), d);

                            // An estimate keeps the style updater's pastel shade, which an inline
                            // fill would beat.
                            if (!part.isEstimate) {

                                path.style.fill =
                                    Ren.DateValueChart_SeriesColourFunction.getMarkColourValue(
                                        `url(#${gradientId})`
                                    );
                            }

                            const dateLabel = dateTickFormat(d[props.dateHeading]).replace(/\n/g, " ");
                            Ren.Svg.append(partGroup, "title").textContent =
                                `${dateLabel}\n${seriesLabel}: ${part.valueLabel}`;

                            Ren.DateValueChart_OtherSeries
                                .addTooltip(partGroup, props, seriesIndex);
                        };

                        currentData.forEach((d, dataIndex) => {

                            const value = getValueFn(seriesIndex)(d) || 0;
                            const stackBase = stackBases[seriesIndex][dataIndex];
                            const stackTop = stackTops[seriesIndex][dataIndex];

                            // Drawn to the estimated total, since everything above stands on its
                            // top.  Overlayed, the estimate adds a pastel part above the actual
                            // value; either way the row is one bar, which later passes count on.
                            const estimate = dataIndex === estimatedRowIndex ? seriesEstimate : null;
                            const isOverlayedEstimate = estimate
                                && estimateMode === Ren.EstimateLastPeriodEnum.Overlayed;

                            const segmentTop = isOverlayedEstimate
                                ? stackBase + estimate.actualValue
                                : stackTop;

                            appendSegmentPart(d, dataIndex, {
                                fromValue: stackBase,
                                toValue: segmentTop,
                                className: estimate && !isOverlayedEstimate
                                    ? "ren-bar ren-vertical ren-estimate-mark"
                                    : "ren-bar ren-vertical",
                                isEstimate: !!estimate && !isOverlayedEstimate,
                                valueLabel: estimate
                                    ? (isOverlayedEstimate
                                        ? formatSegmentValue(estimate.actualValue)
                                        : formatEstimate(estimate))
                                    : formatSegmentValue(value)
                            });

                            if (isOverlayedEstimate) {

                                appendSegmentPart(d, dataIndex, {
                                    fromValue: segmentTop,
                                    toValue: stackTop,
                                    className: "ren-bar-estimate ren-estimate-mark",
                                    isEstimate: true,
                                    valueLabel: formatEstimate(estimate)
                                });
                            }
                        });
                    }
                    else {

                        const barOptions = getBarRenderOptions(props, seriesIndex, axisName);
                        Ren.ChartBarSeries.renderBarSeries(seriesSpecModified, barOptions);
                    }

                    const seriesBars = seriesGroup.querySelectorAll(".ren-bar.ren-vertical");

                    for (let barIndex = 0; barIndex < seriesBars.length; barIndex++) {

                        seriesBars[barIndex].setAttribute("data-index", barIndex);
                        seriesBars[barIndex].setAttribute("data-series", seriesNum);
                    }

                    Ren.DateValueChart_SeriesSubdivisions.renderBarMarks(
                        props,
                        seriesGroup,
                        seriesIndex
                    );

                    // Before the value labels, so that they are painted over the names.
                    Ren.DateValueChart_BarSeriesNames.render(
                        props,
                        seriesGroup,
                        seriesIndex,
                        getValueFn(seriesIndex)
                    );

                    if (!isStacked) {

                        Ren.DateValueChart_RenderValueLabels.renderBarValueLabels(
                            props,
                            currentData,
                            seriesMainValueFn,
                            seriesCrossValueFn,
                            yScale,
                            `.ren-series-${seriesNum}`,
                            null,
                            props.valueColumnFormats[seriesIndex],
                            props.valueColumnFormatFunctions[seriesIndex]
                        );
                    }
                    else {

                        // Drawn even where the series hides its labels, as the style updater hides
                        // them, which leaves the estimate a label to caption.
                        if (seriesGroup.querySelector(".ren-data-series--bar")) {

                            const labelPoints = [];

                            // The estimate is in its own format, so is labelled apart from the
                            // rest.
                            let estimateLabelPoint = null;

                            // Whether a label fits inside the bar depends on its own part's height.
                            const labelPointFor = (d, fromValue, toValue, value) => ({
                                x: props.xScale.getPixel(seriesCrossValueFn(d)),
                                y: yScale.getPixel((fromValue + toValue) / 2),
                                value: value,
                                barHeight: yScale.getPixel(fromValue) - yScale.getPixel(toValue),
                                date: d[props.dateHeading]
                            });

                            currentData.forEach((d, dataIndex) => {

                                const value = getValueFn(seriesIndex)(d);
                                if (value === undefined || value === null) return;

                                const stackBase = stackBases[seriesIndex][dataIndex];
                                const stackTop = stackTops[seriesIndex][dataIndex];

                                const estimate = dataIndex === estimatedRowIndex ? seriesEstimate : null;
                                const isOverlayedEstimate = estimate
                                    && estimateMode === Ren.EstimateLastPeriodEnum.Overlayed;

                                const segmentTop = isOverlayedEstimate
                                    ? stackBase + estimate.actualValue
                                    : stackTop;

                                if (estimate) {

                                    estimateLabelPoint = labelPointFor(
                                        d,
                                        isOverlayedEstimate ? segmentTop : stackBase,
                                        stackTop,
                                        estimate.estimatedValue
                                    );

                                    estimateLabelPoint.isEstimate = true;
                                }

                                // In place, the estimate is the whole segment, so has the only
                                // label.
                                if (!estimate || isOverlayedEstimate) {

                                    labelPoints.push(labelPointFor(
                                        d,
                                        stackBase,
                                        segmentTop,
                                        isOverlayedEstimate ? estimate.actualValue : value
                                    ));
                                }
                            });

                            Ren.DateValueChart_RenderValueLabels.renderValueLabelsIntoGroup(
                                "bar",
                                props,
                                `.ren-series-${seriesNum}`,
                                labelPoints,
                                props.valueColumnFormats[seriesIndex],
                                props.valueColumnFormatFunctions[seriesIndex],
                                yScale.getPixel(0)
                            );

                            if (estimateLabelPoint) {

                                const estimateLabels = Ren.DateValueChart_RenderValueLabels
                                    .renderValueLabelsIntoGroup(
                                        "bar",
                                        props,
                                        `.ren-series-${seriesNum}`,
                                        [estimateLabelPoint],
                                        Ren.DateValueChart_LastPeriodEstimate
                                            .getEstimateFormat(props, seriesIndex),
                                        Ren.DateValueChart_LastPeriodEstimate
                                            .getEstimateFormatFunction(props, seriesIndex),
                                        yScale.getPixel(0)
                                    );

                                // The style updater's pastel-bar label colour hangs off this class.
                                const labelWrapper =
                                    estimateLabels.querySelector(".ren-text-wrapper");

                                if (labelWrapper) {
                                    labelWrapper.classList.add("ren-estimate-value-label");
                                }

                                Ren.DateValueChart_RenderValueLabels
                                    .appendEstimateCaption(labelWrapper);
                            }
                        }
                    }

                    const barGroup = seriesGroup.querySelector(".ren-data-series--bar");

                    // A stacked bar is dragged by the height its top stands at rather than by its
                    // value, as that is where the axis maximum is read off.
                    if (barGroup) {

                        Ren.DateValueChart_ValueResize.addHandlesToBars(
                            barGroup,
                            currentData,
                            isStacked
                                ? getStackTopFn(seriesIndex)
                                : getValueFn(seriesIndex),
                            seriesCrossValueFn,
                            props.xScale,
                            yScale,
                            axisName,
                            props,
                            props.visualisation,
                            bandwidthFn
                        );
                    }

                    // Width is dragged from the bars' sides, which stacked bars do not have free.
                    if (barGroup && !isStacked) {

                        const handleSize = 8;

                        // Dropping a handle sets the narrowing every bar is drawn with, from how
                        // far it moved the edge of its own bar.
                        const appendWidthHandle = (
                            handlesGroup,
                            side,
                            barIndex,
                            barWidth,
                            edgeX,
                            barTop,
                            barHeight) => {

                            const leftPx = edgeX - handleSize / 2;
                            let movedPx = 0;

                            const handle = Ren.Svg.append(handlesGroup, "rect", {
                                "class": `ren-bar-resize-handle ren-bar-resize-handle--${side}`
                                    + ` ren-series-${seriesNum}`,
                                "width": handleSize,
                                "height": barHeight,
                                "fill": "transparent",
                                "cursor": "col-resize",
                                "data-key": `series-${seriesNum}-${barIndex}`,
                                "transform": `translate(${leftPx},${barTop})`
                            });

                            Ren.Svg.drag(handle, {
                                start: () => {

                                    handle.classList.add("ren-bar-resize-handle--active");
                                    Ren.StylesUtils.holdDragCursor("col-resize");
                                },
                                move: (event, delta) => {

                                    movedPx += delta.dx;

                                    const transform = `translate(${leftPx + movedPx},${barTop})`;

                                    handle.setAttribute("transform", transform);
                                },
                                end: () => {

                                    handle.classList.remove("ren-bar-resize-handle--active");
                                    Ren.StylesUtils.releaseDragCursor();

                                    const newWidth = side === "left"
                                        ? barWidth - movedPx
                                        : barWidth + movedPx;

                                    const originalWidth = barWidth / (props.barNarrowingRatio || 1);

                                    // Rounded to 4dp, as the ratio is saved with the report
                                    // settings.
                                    const newRatio = Ren.NumberUtils.round(
                                        Ren.NumberUtils.clamp(newWidth / originalWidth, 0.1, 1.0),
                                        4
                                    );

                                    props.barNarrowingRatio = newRatio;

                                    if (props.visualisation) {

                                        props.visualisation.barNarrowingRatio = newRatio;
                                        props.visualisation.barLayout = props.barLayout;
                                        Ren.VisualisationSettingsSynchroniser
                                            .commitChange(props.visualisation);
                                    }

                                    props.redrawChart();
                                }
                            });
                        };

                        // Placed now, but only made once the pointer is over the chart (see
                        // DateValueChart_DeferredHandles).
                        const widthHandles = [];

                        for (let barIndex = 0; barIndex < seriesBars.length; barIndex++) {

                            const bar = seriesBars[barIndex];
                            const barTransform = bar.getAttribute("transform");
                            const barMatch = barTransform.match(/translate\(([-\d.]+)/);
                            const barCenterX = barMatch ? parseFloat(barMatch[1]) : 0;

                            const pathD = bar.querySelector("path").getAttribute("d");
                            const widthMatch = pathD.match(/h([-\d.]+)/);
                            const barWidth = widthMatch ? parseFloat(widthMatch[1]) : 0;

                            const barDatum = Ren.Svg.getDatum(bar);
                            const barTop = yScale.getPixel(seriesMainValueFn(barDatum));
                            const barHeight = yScale.getPixel(0) - barTop;

                            widthHandles.push(
                                ["left", barIndex, barWidth, barCenterX - barWidth / 2, barTop, barHeight],
                                ["right", barIndex, barWidth, barCenterX + barWidth / 2, barTop, barHeight]
                            );
                        }

                        Ren.DateValueChart_DeferredHandles.add(props, barGroup, (handlesGroup) => {

                            for (let i = 0; i < widthHandles.length; i++) {
                                appendWidthHandle(handlesGroup, ...widthHandles[i]);
                            }
                        });
                    }

                    Ren.DateValueChart_LastPeriodEstimate.renderForSeries({
                        props,
                        seriesGroup,
                        seriesIndex,
                        crossValueFn: seriesCrossValueFn,
                        yScale,
                        bandwidthFn
                    });

                    Ren.DateValueChart_SeriesColourFunction.applyToSeries(
                        props,
                        seriesIndex,
                        seriesGroup,
                        seriesCrossValueFn
                    );
                }

                props.barNarrowingRatio = originalNarrowingRatio;
            }

            // Each line drawn records its course, for its name to be placed by.
            props.lineNamePaths = [];

            if (props.seriesTypes.includes("line")) {
                renderSeriesOfType("line", seriesConfigs.line);
            }

            if (props.seriesTypes.includes("point")) {
                renderSeriesOfType("point", seriesConfigs.point);
            }

            if (!isPies) {

                Ren.DateValueChart_PreviousYear.render(props);
                Ren.DateValueChart_TrendLines.render(props, currentData);
                Ren.DateValueChart_Extremes.render(props, currentData);
                Ren.DateValueChart_ValueLines.render(props);
                Ren.DateValueChart_NonWorkingDays.render(props);
            }

            // Over the series they share the plot with.
            if (props.seriesTypes.includes("pie")) {
                Ren.DateValueChart_Pies.render(props, currentData);
            }

            Ren.DateValueChart_SeriesSubdivisions.renderLabels(props);
            Ren.DateValueChart_LineNames.render(props);

            // Effects reach the plotted bars, lines and dots and the legend's markers for them, not
            // the axes or labels.  They are applied once the legend is drawn, as the marks are
            // drawn afresh on every redraw.
            const dataSeriesGroups = props.chartGroup.querySelectorAll(".ren-data-series");
            const effectsClassName = Ren.VisualisationEffects.EFFECTS_APPLY_CLASS_NAME;

            for (let i = 0; i < dataSeriesGroups.length; i++) {
                dataSeriesGroups[i].classList.add(effectsClassName);
            }

            Ren.DateValueChart_Axes.renderAxes(props);
            Ren.DateValueChart_Gridlines.render(props);
            Ren.DateValueChart_PeriodFocus.attach(props);

            // Drawn last so the lines sit above the bars, and so that one landing on the plot's
            // left or right edge is not hidden underneath the axis spine.
            Ren.DateValueChart_MarkerLines.renderMarkerLines(props);

            // Before the labels layer is raised, so the hover line passes behind the values.
            if (props.showHoverDateLine
                || props.hoverDateLineFullHeight
                || props.showHoverValues) {

                Ren.DateValueChart_HoverDateLine.attach(props);
            }

            // After the hover line, so the dragged band is drawn over it rather than under it.
            Ren.DateValueChart_DateRangeSelection.attach(props);
            Ren.DateValueChart_DateRangeWheel.attach(props);
            Ren.DateValueChart_Legend.attachChartClicks(props);
            Ren.DateValueChart_Legend.attachChartHover(props);
            Ren.DateValueChart_DataPointGrid.attach(props);
            Ren.DateValueChart_CrossFiltering.attach(props);

            Ren.DateValueChart_Crosshairs.attach(props);

            // Raised so that nothing plotted after a series covers an earlier series' labels.
            Ren.DateValueChart_RenderValueLabels.raiseLabelsLayer(props);
            Ren.DateValueChart_LineNames.raiseLayer(props);

            Ren.DateValueChart_Legend.renderLegend(props);

            if (props.visualisation) Ren.VisualisationEffects.applyEffects(props.visualisation);

            if (props.visualisation) {

                const xAxisContextMenu = Ren.DateValueChart_ContextMenu_XAxis(
                    props,
                    props.visualisation
                );

                xAxisContextMenu.setupXAxisContextMenu();
            }

            if (props.visualisation) {

                const yAxisContextMenu = Ren.DateValueChart_ContextMenu_YAxis(
                    props,
                    props.visualisation
                );

                yAxisContextMenu.setupYAxisContextMenu();
            }

            // Set by the chart's menu, which is built after the first draw.
            if (props.addSeriesMenuItems) props.addSeriesMenuItems();

            const setupAxisLabelInteractions = (cssClass, axisName) => {

                const containerNode = document.querySelector("." + props.guid);
                if (!containerNode) return;

                const axisLabelElement = containerNode.querySelector("." + cssClass);
                if (!axisLabelElement) return;

                const openEditor = () => {

                    const axisLabel = axisLabelElement.querySelector(".ren-axis-label");
                    const currentLabel = axisLabel ? axisLabel.textContent : "";

                    Ren.DateValueChart_AxisLabelEditor.showAxisLabelEditor(axisName, currentLabel, (name, newLabel) => {

                        if (props.axes && props.axes[axisName]) {
                            props.axes[axisName].label = newLabel;
                        }

                        if (props.visualisation) {

                            props.visualisation[axisName] = props.visualisation[axisName] || {};
                            props.visualisation[axisName].label = newLabel;
                            Ren.VisualisationSettingsSynchroniser.commitChange(props.visualisation);
                        }

                        props.redrawChart();
                    });
                };

                // Like the axis it heads, the label takes nothing from the chart's menu apart from
                // axis visibility, which the chart sets up after it is first drawn.
                Ren.IsolateContextMenu(axisLabelElement);

                Ren.AddContextMenuItems(axisLabelElement, () => {

                    const menuItems = [
                        {
                            section: "Axis Label",
                            text: "Edit axis label...",
                            action: openEditor
                        }
                    ];

                    if (props.axisVisibilityMenuItem) {

                        menuItems.push(
                            { section: "Axis Label", text: "-" },
                            Object.assign(
                                {},
                                props.axisVisibilityMenuItem,
                                { section: "Axis Label" }
                            )
                        );
                    }

                    return menuItems;
                });
            };

            setupAxisLabelInteractions("ren-value-axis-label", "leftAxis");
            setupAxisLabelInteractions("ren-value-axis-label-2", "rightAxis");

            const updateStylesheetWithScales = () => {

                const containerNode = document.querySelector("." + props.guid);
                const containerWidth = containerNode ? containerNode.clientWidth : 0;
                const containerHeight = containerNode ? containerNode.clientHeight : 0;

                Ren.DateValueChart_StyleUpdater.updateStylesheet(
                    props,
                    containerWidth,
                    containerHeight
                );
            };

            updateStylesheetWithScales();
        };

        props.redrawChart(); // Initial render
    };

    return {
        SELECTED_POINT_RING_GAP,
        getStyledLineStrokeWidth,
        getLineStrokeWidth,
        getLineStyle,
        getStyledPointRadius,
        getPointRadius,
        renderDateValueChart
    };
})();
