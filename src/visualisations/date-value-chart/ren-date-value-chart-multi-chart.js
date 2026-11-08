/**
 * Draws a date/value chart as several charts side by side, wrapping onto further rows, each over
 * one of the latest periods (months, quarters or years) its data holds, oldest first.  The charts
 * share the chart's settings and grouping; only the date range each is drawn over differs.
 *
 * The charts read as one: each runs across the whole of its period, so a period is as wide on
 * one chart as on the next, and their value axes reach as high as the tallest of them.  Each is
 * drawn from props of its own (see createChartProps), so none starts from what the chart, or
 * another chart, last drew.  One legend beneath them all, for every series the chart holds, shows
 * and hides series on all of them, and what is selected or hovered in it is marked on each.
 */
Ren.DateValueChart_MultiChart = (() => {

    const GRID_CLASS_NAME = "ren-date-value-chart-multi-chart-grid";
    const PIES_GRID_CLASS_NAME = GRID_CLASS_NAME + "--pies";
    const ITEM_CLASS_NAME = "ren-date-value-chart-multi-chart-item";
    const LEGEND_CLASS_NAME = "ren-date-value-chart-multi-chart-legend";
    const DATE_RANGE_CLASS_NAME = "ren-date-value-chart-multi-chart-date-range";

    const DEFAULT_MAX_CHART_COUNT = 4;

    // Pies are as tall as they are wide, so sit in a row, wrapping onto evenly filled rows only
    // beyond this many.
    const MAX_PIES_PER_ROW = 4;

    const AXIS_NAMES = ["leftAxis", "rightAxis", "hiddenAxis"];

    /**
     * Gets a value indicating whether a chart is drawn as several charts, which is never so of
     * one of those charts itself.
     */
    const isMultiChart = (props) => !props.multiChartRange
        && !!Ren.DateValueChart_PeriodSlider.getPeriod(props.multiChartPeriod);

    /**
     * Gets the most charts a chart is drawn as.
     */
    const getMaxChartCount = (props) => props.multiChartMaxCount > 0
        ? Math.floor(props.multiChartMaxCount)
        : DEFAULT_MAX_CHART_COUNT;

    /**
     * Stores the most charts a chart is drawn as, on its props and its settings, where the default
     * is left unstated.  The props are optional, for a chart not yet drawn.
     */
    const setMaxChartCount = (visualisation, props, count) => {

        if (props) props.multiChartMaxCount = count;

        visualisation.multiChartMaxCount = count === DEFAULT_MAX_CHART_COUNT ? undefined : count;
    };

    /**
     * Gets the ranges the charts are drawn over: the latest periods the rows hold dates in, up to
     * the most charts, oldest first.  Where the chart has a date range of its own, the periods are
     * those starting within it.
     */
    const getRanges = (rows, dateHeading, datePeriod, maxChartCount, chartDateRange) => {

        const stops = Ren.DateValueChart_PeriodSlider.getStops(rows, dateHeading, datePeriod);
        const ranges = [];

        // The first stop is the slider's "All", which is no period.
        for (let index = 1; index < stops.length; index++) {

            const range = stops[index].range;

            if (chartDateRange
                && (range.from < chartDateRange.from
                    || range.from >= chartDateRange.toExclusive)) continue;

            ranges.push(range);
        }

        return ranges.slice(Math.max(ranges.length - maxChartCount, 0));
    };

    /**
     * Puts a chart's own range on the grouping entry made for it, in place of the date range
     * stored in the settings the charts share.
     */
    const applyChartRange = (props, groupingEntry) => {

        if (groupingEntry && props.multiChartRange) {

            groupingEntry.dateRange = props.multiChartRange;
        }
    };

    /**
     * Gets the stylesheet for the chart at an index, kept on the chart's props from one draw to
     * the next so that redrawing does not add a stylesheet each time.
     */
    const getStylesheet = (props, index) => {

        if (!props.multiChartStylesheets) props.multiChartStylesheets = [];

        if (!props.multiChartStylesheets[index]) {

            const cssClass = Ren.RandomUtils.generateRandomClassName("ren-date-value-chart");

            props.multiChartStylesheets[index] =
                Ren.DynamicStylesheets.setupDynamicStylesheet(cssClass, "").getStylesheet();
        }

        return props.multiChartStylesheets[index];
    };

    /**
     * Gets the props one chart is drawn from, with its own container, stylesheet and range, and
     * the value axis maximums it shares with the others (see shareAxisMaxes).  The chart's
     * settings are read from the visualisation, as the chart's own are.
     */
    const createChartProps = (props, index, range, sharedAxisMaxes, sharedCrosshairs) => ({
        guid: props.guid + "-multi-" + index,
        stylesheet: getStylesheet(props, index),
        visualisation: props.visualisation,
        redrawVisualisation: props.redrawVisualisation,
        multiChartDetection: props.multiChartDetection,
        multiChartRange: range,
        multiChartIndex: index,
        multiChartAxisMaxes: sharedAxisMaxes,
        sharedLegendProps: props.multiChartLegendProps,
        sharedCrosshairs,
        multiChartLimitedHeadings: props.limitedOutHeadings?.length ? props.valueHeadings : null,
        scaleMultiChartAxes: (axisNames, maxY) => scaleAxes(props, axisNames, maxY)
    });

    /**
     * Sets value axes on every one of a multi-chart's charts to a maximum one of them was dragged
     * to, as they share their value scales, and redraws each to it rather than drawing the
     * multi-chart again, which would work the maximums out afresh.
     */
    const scaleAxes = (props, axisNames, maxY) => {

        const chartPropsList = props.multiChartProps || [];

        for (let index = 0; index < chartPropsList.length; index++) {

            const chartProps = chartPropsList[index];

            for (let axisIndex = 0; axisIndex < axisNames.length; axisIndex++) {

                const axis = chartProps.axes?.[axisNames[axisIndex]];

                if (!axis) continue;

                axis.maxY = maxY;
                axis.yExtent = [0, maxY];
                axis.fromSettings = true;
                axis.yScale?.setDomain([0, maxY]);
            }

            chartProps.skipExtentRecalculation = true;
        }

        props.redrawChart?.();
    };

    /**
     * Gets the props the charts' shared legend is drawn from: the series the chart detected over
     * all its data, with a container and stylesheets of its own, so that what is styled for it
     * reaches none of the charts.  They are kept from one draw to the next, as is what is
     * selected in the legend.  Showing or hiding a series redraws every chart.
     */
    const getLegendProps = (props, data) => {

        if (!props.multiChartLegendProps) {

            const guid = props.guid + "-legend";

            props.multiChartLegendProps = {
                guid,
                stylesheet: Ren.DynamicStylesheets.setupDynamicStylesheet(guid, "").getStylesheet()
            };
        }

        const seriesCount = props.seriesCount || 0;
        const seriesTypeStrings = [];

        for (let index = 0; index < seriesCount; index++) {

            seriesTypeStrings.push(Ren.DateValueChart_Pies.isShown(props)
                ? "bar"
                : Ren.DateValueChart_LastPeriodEstimate.getSeriesTypeString(props, index));
        }

        return Object.assign(props.multiChartLegendProps, {
            visualisation: props.visualisation,
            redrawVisualisation: props.redrawVisualisation,
            redrawChart: () => requestRedraw(props),
            series: props.series || [],
            seriesCount,
            seriesTypeStrings,
            seriesSplit: props.seriesSplit,
            valueHeadings: props.valueHeadings || [],
            allValueHeadings: props.allValueHeadings,
            preGroupedData: props.preGroupedData,
            plottedData: data || [],
            showLegend: props.showLegend,
            sharedLegendCharts: []
        });
    };

    /**
     * Gets the number one chart gives a series that another numbers seriesNum, the two matched by
     * column, as each of a multi-chart's charts numbers only the series its own period holds.
     * Gets null where the other chart has no such series.
     */
    const getChartSeriesNum = (fromProps, toProps, seriesNum) => {

        const heading = seriesNum ? fromProps.valueHeadings?.[seriesNum - 1] : undefined;
        const index = heading === undefined ? -1 : (toProps.valueHeadings || []).indexOf(heading);

        return index === -1 ? null : index + 1;
    };

    /**
     * Gets the props of the legend shared by the multi-chart that the given props belong to, be
     * they one of its charts', the whole chart's or the legend's own, or null outside a
     * multi-chart.  The legend's list of charts is the one kept current, as each draw makes the
     * charts' props anew.
     */
    const getSharedLegendProps = (props) => props.sharedLegendProps
        || (props.multiChartProps ? props.multiChartLegendProps : null)
        || (props.sharedLegendCharts ? props : null);

    /**
     * Raises the value axis maximums one chart's data reaches to the highest any of the charts
     * reaches, recording its own for the others.  A chart drawn before a taller one is drawn
     * again once all are (see render).
     */
    const shareAxisMaxes = (props, axisMaxes) => {

        const sharedAxisMaxes = props.multiChartAxisMaxes;

        if (!sharedAxisMaxes) return;

        sharedAxisMaxes[props.multiChartIndex] = Object.assign({}, axisMaxes);

        for (let index = 0; index < sharedAxisMaxes.length; index++) {

            const chartAxisMaxes = sharedAxisMaxes[index];

            if (!chartAxisMaxes) continue;

            for (let axisIndex = 0; axisIndex < AXIS_NAMES.length; axisIndex++) {

                const axisName = AXIS_NAMES[axisIndex];

                axisMaxes[axisName] = Math.max(axisMaxes[axisName], chartAxisMaxes[axisName] || 0);
            }
        }
    };

    /**
     * Draws a chart again over the maximums every chart reaches.  Its axes go back to the
     * maximums they were first drawn with, as an axis that ratchets, or is fixed, keeps the one
     * it has while its own data stays the same.
     */
    const redrawOverSharedMaxes = (chartProps, redrawChart) => {

        for (let index = 0; index < AXIS_NAMES.length; index++) {

            const axisName = AXIS_NAMES[index];
            const axis = chartProps.axes?.[axisName];

            if (axis && !axis.fromSettings) {

                axis.maxY = chartProps.visualisation?.[axisName]?.maxY;
            }
        }

        redrawChart();
    };

    /**
     * Gets the dates a chart's x axis runs between: the whole of its period, whatever part of it
     * the data covers, as [start, end] Dates with an exclusive end.
     */
    const getXDomain = (props) => {

        const DateRange = Ren.DateValueChart_DateRange;
        const range = DateRange.resolveFromExtent(null, props.binPeriod, props.multiChartRange);

        return range ? [DateRange.toDate(range.from), DateRange.toDate(range.toExclusive)] : null;
    };

    /**
     * Redraws the multi-chart as a whole, once a frame however many of its charts ask.  What one
     * chart changes is a setting they all share, so each is drawn again from the settings.
     */
    const requestRedraw = (props) => {

        if (props.isMultiChartRedrawPending) return;

        props.isMultiChartRedrawPending = true;

        requestAnimationFrame(() => {

            props.isMultiChartRedrawPending = false;
            props.redrawVisualisation?.();
        });
    };

    /**
     * Gets how many columns the charts are laid out in: as near square as they go, so a pair sits
     * side by side and four make two rows of two.  Pies go up to MAX_PIES_PER_ROW to a row, and
     * beyond that are spread evenly over as few rows as hold them, so five make rows of three and
     * two.
     */
    const getColumnCount = (chartCount, isPies) => {

        if (!isPies) return Math.max(Math.ceil(Math.sqrt(chartCount)), 1);

        const rowCount = Math.max(Math.ceil(chartCount / MAX_PIES_PER_ROW), 1);

        return Math.max(Math.ceil(chartCount / rowCount), 1);
    };

    const appendDiv = (parent, className, styles) => {

        const div = document.createElement("div");

        div.className = className;
        Ren.Svg.setStyles(div, styles);

        return parent.appendChild(div);
    };

    const createItem = (chartProps, chartCount, isPies) => {

        const columnCount = getColumnCount(chartCount, isPies);
        const rowCount = Math.ceil(chartCount / columnCount);

        const item = document.createElement("div");

        item.className = ITEM_CLASS_NAME;

        // Not grown, so a short last row's charts are as wide as the rest.
        Ren.Svg.setStyles(item, {
            "flex": "0 0 calc(100% / " + columnCount + ")",
            "height": "calc(100% / " + rowCount + ")",
            "min-width": "0",
            "position": "relative",
            "box-sizing": "border-box"
        });

        const chartContainer = document.createElement("div");

        chartContainer.className = chartProps.guid;
        Ren.Svg.setStyles(chartContainer, { "height": "100%" });

        // Read by the pies grid's styles, which keep each pie's chart no taller than it is wide.
        if (isPies) item.style.setProperty("--ren-multi-chart-columns", String(columnCount));

        item.appendChild(chartContainer);

        return item;
    };

    /**
     * Names a chart's range at its top left, in the strip above the plot, or centred above a pie.
     */
    const addDateRangeLabel = (item, chartProps) => {

        const label = document.createElement("div");

        label.className = DATE_RANGE_CLASS_NAME;
        label.textContent = Ren.DateValueChart_DateRange.describe(chartProps.multiChartRange);

        Ren.Svg.setStyles(label, {
            "position": "absolute",
            "top": "2px",
            "left": (chartProps.margin ? chartProps.margin.left : 8) + "px",
            "font-size": "14px",
            "font-weight": "bold",
            "line-height": "16px",
            "white-space": "nowrap",
            "color": "black",
            "pointer-events": "none"
        });

        if (chartProps.showAsPies) {

            Ren.Svg.setStyles(label, { "left": "0", "right": "0", "text-align": "center" });
        }

        item.appendChild(label);
    };

    const showMessage = (item, message) => {

        const messageElement = document.createElement("div");

        messageElement.textContent = message;
        Ren.Svg.setStyles(messageElement, { "padding": "24px 8px 8px", "font-size": "12px" });

        item.firstChild.replaceChildren(messageElement);
    };

    /**
     * Removes the charts drawn last time, their legend and their layout, from a chart's container.
     */
    const clear = (props) => {

        props.multiChartProps = null;

        if (props.multiChartLegendProps) {

            props.multiChartLegendProps.sharedLegendCharts = [];
            props.multiChartLegendProps.stylesheet.textContent = "";
        }

        const container = document.querySelector("." + props.guid);

        if (!container) return;

        const previous = container.querySelectorAll(
            ":scope > ." + GRID_CLASS_NAME + ", :scope > ." + LEGEND_CLASS_NAME
        );

        for (let index = 0; index < previous.length; index++) {

            previous[index].remove();
        }

        Ren.Svg.setStyles(container, { "flex-direction": "column", "flex-wrap": "nowrap" });

        const stylesheets = props.multiChartStylesheets || [];

        for (let index = 0; index < stylesheets.length; index++) {

            stylesheets[index].textContent = "";
        }
    };

    /**
     * Draws the legend the charts share beneath them, before they are drawn, so that they are
     * fitted to the room it leaves.  Its entries run in the order data, the chart's own prepared
     * data, gives them.
     */
    const renderLegend = (props, container, data) => {

        const legendProps = getLegendProps(props, data);

        appendDiv(container, LEGEND_CLASS_NAME + " " + legendProps.guid, {
            "flex": "0 0 auto",
            "display": "flex",
            "flex-direction": "column",
            "min-width": "0"
        });

        Ren.DateValueChart_Legend.renderLegend(legendProps);
        Ren.DateValueChart_StyleUpdater.updateLegendStylesheet(legendProps);

        return legendProps;
    };

    /**
     * Draws the chart as several charts, each through drawChart, which detects, prepares and
     * draws one chart from its props and returns a message where it cannot be drawn, with one
     * legend for them all.  Returns a message where there is no period to draw at all.
     */
    const render = (props, drawChart, data) => {

        const container = document.querySelector("." + props.guid);

        if (!container) return null;

        props.svg?.remove();
        props.svg = null;

        clear(props);

        const ranges = getRanges(
            props.rawInputData,
            props.dateHeading,
            Ren.DateValueChart_PeriodSlider.getPeriod(props.multiChartPeriod),
            getMaxChartCount(props),
            props.chartDateRange
        );

        if (ranges.length === 0) {

            return `Date column '${props.dateHeading}' holds no dates to plot.`;
        }

        // A slider is left to Ren.DateValueChart_PeriodSlider.renderMultiChart, which keeps one
        // being dragged.
        const previous = container.querySelectorAll(
            ":scope > svg, :scope > .ren-date-value-chart-legend-html"
        );

        for (let index = 0; index < previous.length; index++) {

            previous[index].remove();
        }

        // What the chart styled when last drawn as one would reach its charts and their legend,
        // such as the crosshairs it hid.
        const chartStylesheets = [
            props.stylesheet,
            props.selectionStylesheet,
            props.hoverStylesheet,
            props.highlightLabelsStylesheet,
            props.chartHoverLegendStylesheet,
            props.legendItemsStylesheet,
            props.visibility?.stylesheet
        ];

        for (let index = 0; index < chartStylesheets.length; index++) {

            if (chartStylesheets[index]) chartStylesheets[index].textContent = "";
        }

        props.visibility = null;

        Ren.Svg.setStyles(container, {
            "display": "flex",
            "flex-direction": "column",
            "flex-wrap": "nowrap",
            "height": "100%",
            "box-sizing": "border-box"
        });

        // Before the charts are laid out, so that they are fitted to the room it leaves.
        Ren.DateValueChart_Title.render(props);

        const grid = appendDiv(container, GRID_CLASS_NAME, {
            "position": "relative",
            "flex": "1 1 0",
            "min-height": "0",
            "display": "flex",
            "flex-direction": "row",
            "flex-wrap": "wrap"
        });

        if (Ren.DateValueChart_Pies.isShown(props)) grid.classList.add(PIES_GRID_CLASS_NAME);

        const slider = container.querySelector(
            ":scope > ." + Ren.DateValueChart_PeriodSlider.CLASS_NAME
        );

        if (slider) container.insertBefore(grid, slider);

        Ren.DateValueChart_MultiChartWheel.attach(props, grid);
        Ren.DateValueChart_PeriodSlider.renderMultiChart(props, container, grid);

        const legendProps = renderLegend(props, container, data);

        const chartPropsList = [];
        const chartRedraws = [];
        const redrawnChartProps = [];
        const sharedAxisMaxes = [];
        const sharedCrosshairs = Ren.DateValueChart_Crosshairs.createShared();

        for (let index = 0; index < ranges.length; index++) {

            const chartProps = createChartProps(
                props,
                index,
                ranges[index],
                sharedAxisMaxes,
                sharedCrosshairs
            );

            const item = createItem(
                chartProps,
                ranges.length,
                Ren.DateValueChart_Pies.isShown(props)
            );

            grid.appendChild(item);

            const message = drawChart(chartProps);

            if (typeof message === "string") {

                showMessage(item, message);
                continue;
            }

            chartPropsList.push(chartProps);

            if (chartProps.redrawChart) {

                chartRedraws.push(chartProps.redrawChart);
                redrawnChartProps.push(chartProps);
                chartProps.redrawChart = () => requestRedraw(props);
            }

            if (props.multiChartShowDateRange !== false) addDateRangeLabel(item, chartProps);
        }

        props.multiChartProps = chartPropsList;

        // After the charts, so that the crosshairs are drawn over them.
        grid.appendChild(sharedCrosshairs.element);

        // What was selected in the legend before the charts were drawn again is marked on them.
        legendProps.sharedLegendCharts = chartPropsList;
        Ren.DateValueChart_StyleUpdater.updateSelectionStyles(legendProps);

        // For anything redrawing the chart as a whole, there being no one plot of its own.
        props.redrawChart = () => {

            for (let index = 0; index < chartRedraws.length; index++) {

                chartRedraws[index]();
            }
        };

        // The last chart drawn saw every chart's maximums, the others only those drawn before.
        for (let index = 0; index < chartRedraws.length - 1; index++) {

            redrawOverSharedMaxes(redrawnChartProps[index], chartRedraws[index]);
        }

        return null;
    };

    return {
        DEFAULT_MAX_CHART_COUNT,
        DATE_RANGE_CLASS_NAME,
        applyChartRange,
        clear,
        getChartSeriesNum,
        getColumnCount,
        getMaxChartCount,
        getRanges,
        getSharedLegendProps,
        getXDomain,
        isMultiChart,
        render,
        scaleAxes,
        setMaxChartCount,
        shareAxisMaxes
    };
})();
