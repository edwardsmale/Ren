/**
 * The date/value chart context menu's "Date slider" and "Multi-chart": a slider beneath the
 * chart stepping its date range through the months, quarters or years its data holds (see
 * Ren.DateValueChart_PeriodSlider), or the chart drawn as several, one for each of the latest of
 * those periods (see Ren.DateValueChart_MultiChart).
 */
Ren.ContextMenuItems_DateValueChart_PeriodSlider = (chart) => {

    const { visualisation, props } = chart;

    const PERIOD_OPTIONS = [
        { text: "None", unit: null },
        { text: "By month", unit: "month" },
        { text: "By quarter", unit: "quarter" },
        { text: "By year", unit: "year" }
    ];

    const MAX_CHART_COUNTS = [2, 3, 4, 6, 8, 12];

    // Redrawn in full, as both are drawn with the plot and change the room it has.
    const setChartSetting = (propertyName, value, savedValue) => {

        props[propertyName] = value;
        visualisation[propertyName] = savedValue;

        Ren.VisualisationSettingsSynchroniser.commitChange(
            visualisation,
            props.redrawVisualisation
        );
    };

    const canHoldRange = () => Ren.DateValueChart_DateRange.canHoldRange(
        visualisation.chartDataGroupingSettings
    );

    // One of a multi-chart's charts reads the multi-chart's settings, so is asked about them.
    const isMultiChart = () => !!props.multiChartRange
        || Ren.DateValueChart_MultiChart.isMultiChart(props);

    const buildPeriodOptions = (propertyName, idPrefix) => PERIOD_OPTIONS.map(option => ({
        text: option.text,
        id: idPrefix + (option.unit ?? "none"),
        action: () => setChartSetting(propertyName, option.unit, option.unit ?? undefined),
        ticked: () => (props[propertyName] ?? null) === option.unit
    }));

    const Slider = Ren.DateValueChart_PeriodSlider;

    // A slider steps by periods coarser than the chart's bars, so only those are offered, and one
    // left finer by a change to the bars counts as none.
    const sliderOptions = buildPeriodOptions("periodSlider", "chart-period-slider-");

    for (let index = 0; index < sliderOptions.length; index++) {

        const unit = PERIOD_OPTIONS[index].unit;

        if (unit === null) {

            sliderOptions[index].ticked = () => !Slider.canStepBy(props, props.periodSlider);
        }
        else {

            sliderOptions[index].visible = () => Slider.canStepBy(props, unit);
        }
    }

    // Kept on charts whose bars are already yearly, saying why it has nothing to offer them.
    const periodSliderMenuItem = {
        section: "Dates",
        text: "Date slider",
        id: "chart-period-slider",
        title: () => Slider.canStepBy(props, "year")
            ? ""
            : "The slider steps by periods longer than the chart's bars, so needs them grouped"
                + " by quarter or finer (\"Group by\").",
        visible: () => canHoldRange() && !isMultiChart(),
        submenu: sliderOptions
    };

    const maxChartCountMenuItems = MAX_CHART_COUNTS.map(count => ({
        text: "At most " + count + " charts",
        id: "chart-multi-chart-max-" + count,
        visible: () => isMultiChart(),
        action: () => setChartSetting(
            "multiChartMaxCount",
            count,
            count === Ren.DateValueChart_MultiChart.DEFAULT_MAX_CHART_COUNT ? undefined : count
        ),
        ticked: () => Ren.DateValueChart_MultiChart.getMaxChartCount(props) === count
    }));

    const showDateRangesMenuItem = {
        text: "Show each chart's dates",
        id: "chart-multi-chart-show-date-range",
        visible: () => isMultiChart(),
        action: () => setChartSetting(
            "multiChartShowDateRange",
            props.multiChartShowDateRange === false,
            props.multiChartShowDateRange === false ? undefined : false
        ),
        ticked: () => props.multiChartShowDateRange !== false
    };

    const multiChartSliderMenuItem = {
        text: "Date slider",
        id: "chart-multi-chart-slider",
        title: "Steps the charts back through earlier periods, where the data holds more"
            + " periods than charts.",
        visible: () => isMultiChart(),
        action: () => setChartSetting(
            "multiChartSlider",
            !props.multiChartSlider,
            props.multiChartSlider ? undefined : true
        ),
        ticked: () => !!props.multiChartSlider
    };

    const keepEmptyPeriodsMenuItem = {
        text: "Keep empty periods",
        id: "chart-multi-chart-keep-empty-periods",
        title: "Keeps a chart for every period the data holds, whatever is filtered out, showing"
            + " \"No data\" in those left empty.",
        visible: () => isMultiChart(),
        action: () => setChartSetting(
            "multiChartKeepEmptyPeriods",
            !props.multiChartKeepEmptyPeriods,
            props.multiChartKeepEmptyPeriods ? false : undefined
        ),
        ticked: () => !!props.multiChartKeepEmptyPeriods
    };

    const multiChartMenuItem = {
        section: "Dates",
        text: "Multi-chart",
        id: "chart-multi-chart",
        visible: () => canHoldRange(),
        submenu: buildPeriodOptions("multiChartPeriod", "chart-multi-chart-")
            .concat([Ren.MENU_SEPARATOR])
            .concat(maxChartCountMenuItems)
            .concat([
                Ren.MENU_SEPARATOR,
                showDateRangesMenuItem,
                multiChartSliderMenuItem,
                keepEmptyPeriodsMenuItem
            ])
    };

    return {
        multiChartMenuItem,
        periodSliderMenuItem
    };
};
