/**
 * The date/value chart's context menu items for how its data are reduced to the points it draws:
 * the aggregation applied to a series' column, the column that is aggregated with respect to, the
 * format its values are shown in, and the date granularity the chart is grouped by.
 *
 * These are settings of the column behind a series rather than of the series itself, so where the
 * data are split - many series from the one column - they apply to all of the series made from it.
 */
Ren.ContextMenuItems_DateValueChart_DataSettings = (chart) => {

    const { tabularData, visualisation, props } = chart;

    const { getTargetSeriesIndexes, getTargetSeriesIndex, getSeriesSourceHeading } = chart;

    const { regroupData, commitRedraw, rebuildVisualisation } = chart;

    const { getSeriesProperty, toggleSeriesProperty, setSeriesProperties } = chart;

    const { getCommonSeriesProperty, setSeriesPropertyOn } = chart;

    // Returns column info for the series at the given index, or null where it has no column.
    const getSeriesColumnInfo = (seriesIndex) => {

        const arrayIndex = seriesIndex - 1;

        // The column behind the series, which for a split series is the value column it
        // aggregates rather than its own heading (which names a value of the split column).
        const heading = getSeriesSourceHeading(arrayIndex);

        if (!heading) return null;

        const colResolver = tabularData?.columnResolver;

        if (!colResolver) return null;

        const columnIndex = colResolver.getColumnIndex(heading);

        // Use heading as the key so initGroupingEntry (which iterates valueHeadings) can find it.
        return {
            arrayIndex,
            columnIndex,
            columnKey: heading
        };
    };

    // Returns column info for each of the columns behind the series the data settings items apply
    // to, once per column however many of the series are made from it.
    const getTargetSeriesColumnInfos = () => {

        const seriesIndexes = getTargetSeriesIndexes();
        const infos = [];

        for (let i = 0; i < seriesIndexes.length; i++) {

            const info = getSeriesColumnInfo(seriesIndexes[i]);

            if (info && !infos.some(existing => existing.columnKey === info.columnKey)) {
                infos.push(info);
            }
        }

        return infos;
    };

    // Returns column info for the first of the series the data settings items apply to.
    const getTargetSeriesColumnInfo = () => getTargetSeriesColumnInfos()[0] ?? null;

    // Gets a value indicating whether a column contains numeric values.
    const isColumnNumeric = (heading) => {

        if (!heading || !props.rawInputData || props.rawInputData.length === 0) return true;

        for (let i = 0; i < props.rawInputData.length; i++) {

            const value = props.rawInputData[i][heading];

            return Ren.TextUtils.isNumeric(value);
        }

        return true;
    };

    // Gets a value indicating whether every target series' column contains numeric values.
    const isTargetSeriesNumeric = () => {

        const infos = getTargetSeriesColumnInfos();

        for (let i = 0; i < infos.length; i++) {

            if (!isColumnNumeric(infos[i].columnKey)) return false;
        }

        return true;
    };

    // Gets a value indicating whether any target series' column holds NULL or empty values.
    const targetSeriesHasNulls = () => {

        if (!props.rawInputData) return false;

        const infos = getTargetSeriesColumnInfos();

        for (let i = 0; i < infos.length; i++) {

            const heading = infos[i].columnKey;

            for (let j = 0; j < props.rawInputData.length; j++) {

                if (Ren.IsNullOrEmpty(props.rawInputData[j][heading])) return true;
            }
        }

        return false;
    };

    // Writes a property to the chart's column settings, leaving the caller to regroup and redraw.
    const writeChartColumnSetting = (columnKey, settingKey, value) => {

        if (!visualisation.chartDataGroupingSettings) return;
        const entry = visualisation.chartDataGroupingSettings.groupings.entries[0];
        entry.columns ??= {};
        entry.columns[columnKey] ??= {};
        entry.columns[columnKey][settingKey] = value;
    };

    // Re-aggregate so a change like the aggregation type takes effect immediately rather than
    // only on reload.
    const regroupAndRedraw = () => {

        regroupData();
        commitRedraw();
    };

    const getChartGroupingEntry = () =>
        visualisation.chartDataGroupingSettings?.groupings?.entries?.[0];

    /**
     * Gets a column setting the target series' columns share, null where it is unset, or
     * undefined where there is no target series or their columns differ.
     */
    const getTargetColumnSetting = (settingKey) => {

        const infos = getTargetSeriesColumnInfos();

        if (infos.length === 0) return undefined;

        const columns = getChartGroupingEntry()?.columns;
        const value = columns?.[infos[0].columnKey]?.[settingKey] ?? null;

        for (let i = 1; i < infos.length; i++) {

            if ((columns?.[infos[i].columnKey]?.[settingKey] ?? null) !== value) return undefined;
        }

        return value;
    };

    const setTargetColumnSetting = (settingKey, value) => {

        const infos = getTargetSeriesColumnInfos();

        if (infos.length === 0 || !visualisation.chartDataGroupingSettings) return;

        for (let i = 0; i < infos.length; i++) {
            writeChartColumnSetting(infos[i].columnKey, settingKey, value);
        }

        regroupAndRedraw();
    };

    // Min and Max fall back to an alphabetical comparison, so still read sensibly over text.
    // First, Last and Median take a single row's value, ordered by the "with respect to" column
    // where one is set.
    const TEXT_AGGREGATION_TYPES = [
        Ren.AggregationTypeEnum.Sum,
        Ren.AggregationTypeEnum.Average,
        Ren.AggregationTypeEnum.Count,
        Ren.AggregationTypeEnum.CountDistinct,
        Ren.AggregationTypeEnum.Min,
        Ren.AggregationTypeEnum.Max,
        Ren.AggregationTypeEnum.First,
        Ren.AggregationTypeEnum.Last,
        Ren.AggregationTypeEnum.Median
    ];

    const NUMERIC_AGGREGATION_TYPES =
        TEXT_AGGREGATION_TYPES.concat([Ren.AggregationTypeEnum.MostCommon]);

    const buildAggregationMenuItems = () => {

        const allowed = isTargetSeriesNumeric()
            ? NUMERIC_AGGREGATION_TYPES
            : TEXT_AGGREGATION_TYPES;

        const items = [];

        const aggregationTypes = Ren.AggregationTypeEnum;

        for (let i = 0; i < aggregationTypes.Values.length; i++) {

            const value = aggregationTypes.Values[i];
            if (!allowed.includes(value)) continue;

            const aggregationTypeAsString = aggregationTypes.Names[i];
            const aggregationTypeKebabCase = Ren.TextUtils.convertToKebabCase(aggregationTypeAsString);

            items.push({
                text: aggregationTypeAsString,
                className: "qa-ren-chart-aggregation-menu-item-" + aggregationTypeKebabCase,
                action: () => setTargetColumnSetting("aggregationType", value),
                ticked: () => getTargetColumnSetting("aggregationType") === value
            });
        }

        items.sort((a, b) => a.text.localeCompare(b.text));
        return items;
    };

    /**
     * Gets a value indicating whether the target series' column is aggregated by First, Last or
     * Median, the aggregations that read the "with respect to" column as an ordering rather than
     * as a column to deduplicate rows by.
     */
    const usesWithRespectToAsOrdering = () => {

        const aggregationType = getTargetColumnSetting("aggregationType");

        return aggregationType === Ren.AggregationTypeEnum.First
            || aggregationType === Ren.AggregationTypeEnum.Last
            || aggregationType === Ren.AggregationTypeEnum.Median;
    };

    /**
     * Builds the "with respect to" submenu.
     */
    const buildWithRespectToMenuItems = () => {

        const items = [
            {
                text: () => usesWithRespectToAsOrdering() ? "None (row order)" : "None",
                action: () => setTargetColumnSetting("aggregateWithRespectToColumn", null),
                ticked: () => {

                    const column = getTargetColumnSetting("aggregateWithRespectToColumn");

                    return column !== undefined && !column;
                }
            },
            Ren.MENU_SEPARATOR
        ];

        for (let i = 0; i < tabularData.ColumnModels.length; i++) {

            const col = tabularData.ColumnModels[i];

            if (Ren.DateValueChart_InputColumns.isInternalColumn(col)) continue;

            const colValue = col.ColumnId || col.Heading;

            items.push({
                text: () => col.Heading,
                action: () => setTargetColumnSetting("aggregateWithRespectToColumn", colValue),
                ticked: () => getTargetColumnSetting("aggregateWithRespectToColumn") === colValue
            });
        }

        return items;
    };

    /**
     * Stores a format function in chartDataGroupingSettings for a column, leaving the caller to
     * regroup and redraw.
     */
    const writeChartFormatFunction = (columnIndex, valueFormatFunction) => {

        // Use heading as the key, consistent with how initGroupingEntry looks up columns.
        const key = tabularData?.columnResolver?.getColumnHeading(columnIndex);

        if (!key) return;

        const fnArray = Ren.ArrayUtils.ensureArray(valueFormatFunction);

        // Update props before redrawChart is triggered so the render sees the new format.
        const seriesHeadings = props.seriesSourceHeadings || props.valueHeadings || [];

        for (let arrayIndex = 0; arrayIndex < seriesHeadings.length; arrayIndex++) {

            const seriesColumnIndex =
                tabularData.columnResolver.getColumnIndex(seriesHeadings[arrayIndex]);

            if (seriesColumnIndex !== columnIndex) continue;

            props.valueColumnFormatFunctions[arrayIndex] = fnArray.map(
                f => Ren.FormatFunctions.createFunction(
                    f,
                    Ren.ReportInputParameters.getInputParameters(visualisation.containingReport)
                )
            );

            props.valueColumnFormats[arrayIndex] = Ren.DateValueChart_ValueFormats
                .getFormatForFunction(fnArray, props.valueColumnFormats[arrayIndex]);

            if (props.valueColumnHasOwnFormat) {
                props.valueColumnHasOwnFormat[arrayIndex] = fnArray.length > 0;
            }

            const axisName = props.series?.[arrayIndex]?.valueAxis || "leftAxis";

            if (props.axes?.[axisName]) {

                props.axes[axisName].formatFunction = props.valueColumnFormatFunctions[arrayIndex];
                props.axes[axisName].format = props.valueColumnFormats[arrayIndex];
            }
        }

        writeChartColumnSetting(key, "valueFormatFunction", fnArray);
    };

    // Stores a format function, whether chosen from the shared Format menu or written by hand,
    // for each of the target series' columns.
    const setTargetFormatFunction = (valueFormatFunction) => {

        const infos = getTargetSeriesColumnInfos();

        if (infos.length === 0 || !visualisation.chartDataGroupingSettings) return;

        for (let i = 0; i < infos.length; i++) {
            writeChartFormatFunction(infos[i].columnIndex, valueFormatFunction);
        }

        regroupAndRedraw();
    };

    // Gets the first target series' hand-written format function, or "" where it has none.
    const getCustomFormatCode = () => {

        const info = getTargetSeriesColumnInfo();

        if (!info) return "";

        return Ren.FormatFunctionUtils.getCustomCode(
            getChartGroupingEntry()?.columns?.[info.columnKey]?.valueFormatFunction
        );
    };

    // Opens the function editor for a hand-written custom format function.  The code shown is the
    // first target series' own.
    const openCustomFormatEditor = () => {

        if (!getTargetSeriesColumnInfo()) return;

        Ren.Messages.Requests.functionEditorWindow.notify(
            getCustomFormatCode,
            (customCode) => setTargetFormatFunction(customCode),
            null,
            null,
            { centred: true }
        );
    };

    const customFormatMenuItem = {
        text: "Custom...",
        id: "chart-format-custom",
        ticked: () => !!getCustomFormatCode(),
        action: () => openCustomFormatEditor()
    };

    const aggregationMenuItem = {
        section: "Series",
        text: "Aggregation",
        id: "chart-aggregation",
        visible: () => !!getTargetSeriesIndex(),
        get submenu() {

            return buildAggregationMenuItems();
        }
    };

    const withRespectToMenuItem = {
        section: "Series",
        text: () => usesWithRespectToAsOrdering()
            ? "with respect to (ordered by)"
            : "with respect to",
        id: "chart-with-respect-to",
        visible: () => !!getTargetSeriesIndex(),
        submenu: buildWithRespectToMenuItems()
    };

    // Getter so submenu is built fresh with the correct valueFormat each time the menu opens.
    const formatMenuItem = {
        section: "Series",
        text: "Format",
        id: "chart-format",
        visible: () => !!getTargetSeriesIndex(),
        get submenu() {

            const info = getTargetSeriesColumnInfo();

            if (!info) return [];

            const valueFormat = props.valueColumnFormats[info.arrayIndex];

            // The chart formats its series' own values (axis ticks and value labels), which sit
            // outside any group or summarised report, so the stats-relative "Show as" formats
            // are not offered here.  Nor are the formats that only a grid cell can carry.
            // The formats offered are those of the first target series' column.
            const items = Ren.ContextMenuItems_Formatting(
                (_columnIndex, _rowIndex, valueFormatFunction) =>
                    setTargetFormatFunction(valueFormatFunction),
                {
                    summaryStatsAvailable: false,
                    gridContext: false,
                    columnHasNulls: () => targetSeriesHasNulls(),
                    getFormatFunction: () =>
                        getChartGroupingEntry()?.columns?.[info.columnKey]?.valueFormatFunction
                }
            ).getMenuItems(info.columnIndex, null, null, valueFormat);

            const submenu = items[0]?.submenu || [];

            return submenu.concat([
                Ren.MENU_SEPARATOR,
                customFormatMenuItem
            ]);
        }
    };

    const dateGroupingOptions = [
        { text: "Group by second", calcFunction: "date-second-start" },
        { text: "Group by minute", calcFunction: "date-minute-start" },
        { text: "Group by 15 minutes", calcFunction: "date-quarter-hour-start" },
        { text: "Group by hour", calcFunction: "date-hour-start" },
        { text: "Group by day", calcFunction: "date-day-start" },
        { text: "Group by week", calcFunction: "date-week-start" },
        { text: "Group by month", calcFunction: "date-month-start" },
        { text: "Group by quarter", calcFunction: "date-quarter-start" },
        { text: "Group by year", calcFunction: "date-year-start" },
        {
            text: "Group by all time",
            calcFunction: Ren.DateValueChart_GroupingApplyer.ALL_TIME_CALC_FUNCTION
        }
    ];

    const getDateEntry = () =>
        Ren.DateValueChart_GroupingEntries.getDateEntry(visualisation.chartDataGroupingSettings);

    const getCurrentDateGroupCalcFunction = () => {

        const spec = getDateEntry()?.groupByCalcFunctions?.[0];

        return typeof spec === "string" ? spec : spec?.name ?? null;
    };

    // The granularity the chart's own data is at, held against the data it was read from.
    let detectedDatePeriod = null;

    const getDetectedDatePeriod = () => {

        if (detectedDatePeriod
            && detectedDatePeriod.inputData === props.rawInputData
            && detectedDatePeriod.dateHeading === props.dateHeading) {

            return detectedDatePeriod.period;
        }

        detectedDatePeriod = {
            inputData: props.rawInputData,
            dateHeading: props.dateHeading,
            period: Ren.DatePeriodDetector.detectDatePeriodForRows(
                props.rawInputData,
                props.dateHeading
            )
        };

        return detectedDatePeriod.period;
    };

    // A grouping option only makes sense if it is at, or coarser than, the chart's own data
    // granularity - e.g. daily data can be grouped by day/week/month/etc but monthly data can't be
    // grouped by day.
    const isDateGroupOptionApplicable = (calcFunctionName) => {

        if (!props.rawInputData || !props.dateHeading) return true;

        // Any data can be totalled over all time.
        if (Ren.DateValueChart_GroupingApplyer.isAllTimeCalcFunction(calcFunctionName)) {
            return true;
        }

        const datePeriod = getDetectedDatePeriod();

        if (datePeriod == null) return true; // Period couldn't be detected; show all options.

        const optionPeriod = Ren.DatePeriodDetector.getPeriodForCalcFunction(calcFunctionName);

        return optionPeriod >= datePeriod;
    };

    const setDateGrouping = (calcFunctionName) => {

        const entry = getDateEntry();

        if (!entry) return;

        entry.groupByCalcFunctions = [{ name: calcFunctionName }];

        regroupData();

        // Keep the axis period in step with the new bin function.  A specified date period is
        // honoured only where it is coarser than the bins - a finer one would tick dates with no
        // data point (e.g.every day under monthly bars), overlapping into illegibility.  The bins
        // may have been coarsened to keep the chart within its point limit, so theirs is the
        // period followed rather than the one asked for.
        // All time's one point is drawn a year wide, as detectColumns draws it.
        const period = props.isAllTime
            ? Ren.DatePeriodEnum.Year
            : props.binPeriod ?? Ren.DatePeriodDetector.getPeriodForCalcFunction(calcFunctionName);

        if (period !== undefined) {

            const specifiedPeriod = Ren.DatePeriodEnum.Parse(visualisation.datePeriod);

            props.datePeriod = Math.max(specifiedPeriod, period);

            props.axisPeriod = props.datePeriod;
        }

        commitRedraw();
    };

    const changeDateGroupingMenuItem = {
        section: "Dates",
        text: "Group by",
        id: "chart-date-grouping",
        visible: () => !!getTargetSeriesIndex() && !!getDateEntry(),
        submenu: dateGroupingOptions.map(option => ({
            text: Ren.TextUtils.makeFirstCharUpperCase(option.text.replace("Group by ", "")),
            id: `chart-date-grouping-${option.calcFunction}`,
            visible: () => isDateGroupOptionApplicable(option.calcFunction),
            action: () => setDateGrouping(option.calcFunction),
            ticked: () => getCurrentDateGroupCalcFunction() === option.calcFunction
        }))
    };

    const estimateLastPeriodOptions = [
        { text: "No estimate", value: Ren.EstimateLastPeriodEnum.None },
        { text: "Overlayed estimate", value: Ren.EstimateLastPeriodEnum.Overlayed },
        { text: "In-place estimate", value: Ren.EstimateLastPeriodEnum.InPlace }
    ];

    // Scaling a part period up to a whole one only says anything about a running total, so the
    // estimate is offered for the target series whose values are summed or counted and not those
    // whose values are averaged or reduced to a single one.
    const getScalableTargetSeriesIndexes = () => {

        return getTargetSeriesIndexes().filter(seriesIndex => {

            const info = getSeriesColumnInfo(seriesIndex);

            return !!info && Ren.DateValueChart_LastPeriodEstimate.isScalableAggregation(
                visualisation,
                info.columnKey
            );
        });
    };

    // Whether a running last period is shown at all is the chart's, not a series', to say.
    const showIncompleteLastPeriodOptions = [
        {
            text: "Show incomplete last period",
            id: "always",
            value: Ren.ShowIncompleteLastPeriodEnum.Always
        },
        {
            text: "Show from halfway through",
            id: "from-halfway",
            value: Ren.ShowIncompleteLastPeriodEnum.FromHalfway
        },
        {
            text: "Show from 1/3 through",
            id: "from-one-third",
            value: Ren.ShowIncompleteLastPeriodEnum.FromOneThird
        },
        {
            text: "Show from 2/3 through",
            id: "from-two-thirds",
            value: Ren.ShowIncompleteLastPeriodEnum.FromTwoThirds
        },
        {
            text: "Do not show",
            id: "never",
            value: Ren.ShowIncompleteLastPeriodEnum.Never
        }
    ];

    const setShowIncompleteLastPeriod = (value) => {

        props.showIncompleteLastPeriod = value;
        visualisation.showIncompleteLastPeriod = value;

        commitRedraw();
    };

    const getShowIncompleteLastPeriod = () =>
        props.showIncompleteLastPeriod ?? Ren.ShowIncompleteLastPeriodEnum.Always;

    const estimateLastPeriodSubmenu = estimateLastPeriodOptions.map(option => ({
        text: option.text,
        id: `chart-estimate-last-period-${Ren.TextUtils.convertToKebabCase(option.text)}`,
        action: () => setSeriesPropertyOn(
            getScalableTargetSeriesIndexes(),
            "estimateLastPeriod",
            option.value
        ),
        ticked: () => getCommonSeriesProperty(
            getScalableTargetSeriesIndexes(),
            "estimateLastPeriod",
            Ren.EstimateLastPeriodEnum.None
        ) === option.value
    }));

    const toggleSeasonallyAdjustEstimate = () => {

        props.seasonallyAdjustEstimate = props.seasonallyAdjustEstimate === false;
        visualisation.seasonallyAdjustEstimate = props.seasonallyAdjustEstimate;

        commitRedraw();
    };

    estimateLastPeriodSubmenu.push(Ren.MENU_SEPARATOR);

    // Weights the days by the trade they usually bring, so a slump still to come is allowed for.
    estimateLastPeriodSubmenu.push({
        text: "Seasonally adjusted",
        id: "chart-estimate-last-period-seasonally-adjusted",
        visible: () => getCommonSeriesProperty(
            getScalableTargetSeriesIndexes(),
            "estimateLastPeriod",
            Ren.EstimateLastPeriodEnum.None
        ) !== Ren.EstimateLastPeriodEnum.None,
        action: toggleSeasonallyAdjustEstimate,
        ticked: () => props.seasonallyAdjustEstimate !== false
    });

    estimateLastPeriodSubmenu.push(Ren.MENU_SEPARATOR);

    for (let i = 0; i < showIncompleteLastPeriodOptions.length; i++) {

        const option = showIncompleteLastPeriodOptions[i];

        estimateLastPeriodSubmenu.push({
            text: option.text,
            id: `chart-show-incomplete-last-period-${option.id}`,
            action: () => setShowIncompleteLastPeriod(option.value),
            ticked: () => getShowIncompleteLastPeriod() === option.value
        });
    }

    const estimateLastPeriodMenuItem = {
        section: "Dates",
        text: "Estimate last period",
        id: "chart-estimate-last-period",
        // No estimate is made for a period shorter than a day, nor over all time.
        visible: () => props.datePeriod >= Ren.DatePeriodEnum.Day
            && !props.isAllTime
            && getScalableTargetSeriesIndexes().length > 0,
        submenu: estimateLastPeriodSubmenu
    };

    const isYearToDateTicked = () => getSeriesProperty("yearToDate", false) === true
        && Ren.DateValueChart_ValueTransforms.canShowYearToDate(props);

    const isRollingYearTotalTicked = () => getSeriesProperty("rollingYearTotal", false) === true
        && !isYearToDateTicked()
        && Ren.DateValueChart_ValueTransforms.canShowRollingYearTotal(props);

    const runningTotalMenuItem = {
        section: "Chart data",
        text: "Running total",
        id: "chart-running-total",
        // Running total, year to date and rolling year total each switch the others off.
        exclusiveGroup: "chart-totals",
        title: "Plots each period's total to date rather than the period's own value",
        action: () => {

            props.skipExtentRecalculation = false;
            setSeriesProperties({
                runningTotal: getSeriesProperty("runningTotal", false) !== true,
                yearToDate: false,
                rollingYearTotal: false
            });
        },
        ticked: () => getSeriesProperty("runningTotal", false) === true
            && !isYearToDateTicked()
            && !isRollingYearTotalTicked()
    };

    // An alternative to a running total, so setting either takes the other off.
    const yearToDateMenuItem = {
        section: "Chart data",
        text: "Year to date",
        id: "chart-year-to-date",
        exclusiveGroup: "chart-totals",
        title: "Plots each period's total for the year to date, starting again each year",
        visible: () => Ren.DateValueChart_ValueTransforms.canShowYearToDate(props),
        action: () => {

            props.skipExtentRecalculation = false;
            setSeriesProperties({
                yearToDate: !isYearToDateTicked(),
                runningTotal: false,
                rollingYearTotal: false
            });
        },
        ticked: isYearToDateTicked
    };

    // Another alternative to a running total, offered by the day or longer.
    const rollingYearTotalMenuItem = {
        section: "Chart data",
        text: "Rolling year total",
        id: "chart-rolling-year-total",
        exclusiveGroup: "chart-totals",
        title: "Plots each period's total over the year to its end, such as a moving annual total",
        visible: () => Ren.DateValueChart_ValueTransforms.canShowRollingYearTotal(props),
        action: () => {

            props.skipExtentRecalculation = false;
            setSeriesProperties({
                rollingYearTotal: !isRollingYearTotalTicked(),
                runningTotal: false,
                yearToDate: false
            });
        },
        ticked: isRollingYearTotalTicked
    };

    const ALTERNATIVE_VALUE_PROPERTIES = [
        "showAsShareOfTotal",
        "showAsIndex",
        "showAsChange",
        "showAsYearOnYearChange"
    ];

    // Formats are taken afresh from the columns once shares, an index or changes are off, so the
    // chart is rebuilt.  They are alternatives, so setting one takes the others off.
    const toggleAlternativeValues = (property) => {

        const isOn = props[property] !== true;

        for (let i = 0; i < ALTERNATIVE_VALUE_PROPERTIES.length; i++) {

            const name = ALTERNATIVE_VALUE_PROPERTIES[i];

            visualisation[name] = name === property ? isOn : false;
            props[name] = visualisation[name];
        }

        rebuildVisualisation();
    };

    const toggleShareOfTotal = () => toggleAlternativeValues("showAsShareOfTotal");

    const toggleIndex = () => toggleAlternativeValues("showAsIndex");

    const indexMenuItem = {
        section: "Chart data",
        text: "Index to first period",
        id: "chart-index",
        exclusiveGroup: "chart-alternative-values",
        title: "Plots each series as an index of its first value, which is 100",
        visible: () => !props.showAsPies,
        action: toggleIndex,
        ticked: () => props.showAsIndex === true
    };

    const changeMenuItem = {
        section: "Chart data",
        text: "Change on period before",
        id: "chart-change",
        exclusiveGroup: "chart-alternative-values",
        title: "Plots each period's value as its change on the period before, as a percentage",
        visible: () => !props.showAsPies,
        action: () => toggleAlternativeValues("showAsChange"),
        ticked: () => props.showAsChange === true
    };

    const yearOnYearChangeMenuItem = {
        section: "Chart data",
        text: "Change on year before",
        id: "chart-change-year-before",
        exclusiveGroup: "chart-alternative-values",
        title: "Plots each period's value as its change on the same period a year before, as a "
            + "percentage",
        visible: () => Ren.DateValueChart_ValueTransforms.canShowYearOnYearChange(props),
        action: () => toggleAlternativeValues("showAsYearOnYearChange"),
        ticked: () => props.showAsYearOnYearChange === true
    };

    // Per day only changes the series of totals, so it is offered where there is one.
    const perDayMenuItem = {
        section: "Chart data",
        text: "Per day",
        id: "chart-per-day",
        title: "Plots each period's total as its average per day, so that periods of different "
            + "lengths compare fairly",
        visible: () => Ren.DateValueChart_ValueTransforms.canShowPerDay(props)
            && getScalableTargetSeriesIndexes().length > 0,
        action: () => {

            visualisation.showPerDay = props.showPerDay !== true;
            props.showPerDay = visualisation.showPerDay;

            rebuildVisualisation();
        },
        ticked: () => props.showPerDay === true
    };

    const shareOfTotalMenuItem = {
        section: "Chart data",
        text: "Share of total",
        id: "chart-share-of-total",
        exclusiveGroup: "chart-alternative-values",
        title: "Plots each series as its share of the period's total over the series shown",
        visible: () => props.seriesCount >= 2,
        action: toggleShareOfTotal,
        ticked: () => props.showAsShareOfTotal === true
    };

    const movingAverageOption = (periods) => ({
        text: `${periods}-period moving average`,
        id: `moving-average-${periods}`,
        trendLine: Ren.DateValueChart_TrendLines.MOVING_AVERAGE,
        periods
    });

    const trendLineOptions = [
        { text: "None", id: "none", trendLine: null, periods: null },
        {
            text: "Linear",
            id: "linear",
            trendLine: Ren.DateValueChart_TrendLines.LINEAR,
            periods: null
        },
        {
            text: "Average",
            id: "average",
            trendLine: Ren.DateValueChart_TrendLines.AVERAGE,
            periods: null
        },
        movingAverageOption(3),
        movingAverageOption(6),
        movingAverageOption(12)
    ];

    const isTrendLineOptionTicked = (option) => {

        const trendLine = getSeriesProperty("trendLine", null);

        if (trendLine !== option.trendLine) return false;

        return trendLine !== Ren.DateValueChart_TrendLines.MOVING_AVERAGE
            || (getSeriesProperty("trendLinePeriods", null)
                || Ren.DateValueChart_TrendLines.DEFAULT_PERIODS) === option.periods;
    };

    // Pies have no line to follow.
    const trendLineMenuItem = {
        section: "Chart data",
        text: "Trend line",
        id: "chart-trend-line",
        visible: () => !props.showAsPies,
        submenu: trendLineOptions.map(option => ({
            text: option.text,
            id: `chart-trend-line-${option.id}`,
            action: () => setSeriesProperties({
                trendLine: option.trendLine,
                trendLinePeriods: option.periods
            }),
            ticked: () => isTrendLineOptionTicked(option)
        }))
    };

    // Pies have no points to mark.
    const markExtremesMenuItem = {
        section: "Chart data",
        text: "Mark highest and lowest",
        id: "chart-mark-extremes",
        title: "Rings and labels each series' highest and lowest values",
        visible: () => !props.showAsPies,
        action: () => toggleSeriesProperty("markExtremes", false),
        ticked: () => getSeriesProperty("markExtremes", false) === true
    };

    const previousYearMenuItem = {
        section: "Chart data",
        text: "Compare with previous year",
        id: "chart-previous-year",
        title: "Draws each series' values for the year before over it, as a dotted line",
        visible: () => Ren.DateValueChart_PreviousYear.isAvailable(props),
        action: () => {

            props.skipExtentRecalculation = false;
            toggleSeriesProperty("compareWithPreviousYear", false);
        },
        ticked: () => getSeriesProperty("compareWithPreviousYear", false) === true
    };

    return {
        trendLineMenuItem,
        markExtremesMenuItem,
        previousYearMenuItem,
        runningTotalMenuItem,
        yearToDateMenuItem,
        rollingYearTotalMenuItem,
        perDayMenuItem,
        shareOfTotalMenuItem,
        indexMenuItem,
        changeMenuItem,
        yearOnYearChangeMenuItem,
        aggregationMenuItem,
        withRespectToMenuItem,
        formatMenuItem,
        changeDateGroupingMenuItem,
        estimateLastPeriodMenuItem
    };
};
