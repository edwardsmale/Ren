/**
 * Gathers the series a date/value chart leaves out, whether removed or beyond the legend's limit,
 * into an "Other" series drawn after the rest, of what their rows aggregate to together under the
 * chart's own aggregation.  It is shown until it is hidden or removed itself.  Hidden series are
 * not gathered, as they keep their legend entries.  A chart split from several value columns
 * gathers each column's series into an "Other" series of its own.
 */
Ren.DateValueChart_OtherSeries = (() => {

    // Starts with a character no column heading or split value label does, so that a split value
    // that is itself "Other" is never mistaken for it.
    const HEADING = "\u0001other-series";
    const SOURCE_SEPARATOR = "\u0001";
    const LABEL = "Other";
    const COLOUR = "#9E9E9E";

    // The settings an "Other" series takes from the first series it gathers until it has its own,
    // so that it is drawn as they are.
    const TEMPLATE_PROPERTIES = [
        "valueAxis",
        "chartType",
        "showValueLabels",
        "curved",
        "lineShape",
        "lineStyle",
        "lineWidth",
        "dotSize",
        "estimateLastPeriod",
        "runningTotal",
        "yearToDate",
        "rollingYearTotal"
    ];

    /**
     * Gets a value indicating whether a series heading is that of an "Other" series.
     */
    const isOtherHeading = (heading) =>
        typeof heading === "string" && heading.indexOf(HEADING) === 0;

    /**
     * Gets a value indicating whether the series of the given number is an "Other" series.
     */
    const isOtherSeries = (props, seriesIndex) =>
        isOtherHeading(props.valueHeadings?.[seriesIndex - 1]);

    /**
     * Takes the "Other" series' settings out of the chart's series settings, so that the series
     * the data holds are matched to theirs as though there were none.  Gets them by column.
     */
    const extractSettings = (visualisation) => {

        const settingsByHeading = {};
        const seriesSettings = visualisation.series;

        if (!Array.isArray(seriesSettings)) return settingsByHeading;

        let keptCount = 0;

        for (let i = 0; i < seriesSettings.length; i++) {

            const settings = seriesSettings[i];

            if (settings && isOtherHeading(settings.column)) {

                settingsByHeading[settings.column] = settings;
                continue;
            }

            seriesSettings[keptCount] = settings;
            keptCount++;
        }

        seriesSettings.length = keptCount;

        return settingsByHeading;
    };

    /**
     * Gets the headings of the series an "Other" series would gather: those the data holds that
     * the chart does not draw, whether removed or beyond the legend's limit, in the data's order.
     */
    const getGatheredHeadings = (props) => {

        const headings = props.valueHeadings || [];

        return (props.allValueHeadings || []).filter(
            heading => !isOtherHeading(heading) && headings.indexOf(heading) === -1
        );
    };

    // Gets the value column a series aggregates, whether drawn or not.
    const getSourceHeading = (props, heading) => {

        const index = (props.allValueHeadings || []).indexOf(heading);

        return index === -1 ? heading : props.allSeriesSourceHeadings?.[index] ?? heading;
    };

    /**
     * Gets the chart's "Other" series, as { heading, sourceHeading, label, gatheredHeadings }: one
     * for each value column with series left out where the data is split, and one in all where
     * not.
     */
    const getOtherSeries = (props) => {

        const gatheredHeadings = getGatheredHeadings(props);

        if (gatheredHeadings.length === 0) return [];

        if (!props.seriesSplit) {

            return [{
                heading: HEADING,
                sourceHeading: null,
                label: LABEL,
                gatheredHeadings
            }];
        }

        const sourceHeadings = [];
        const allSourceHeadings = props.allSeriesSourceHeadings || [];

        for (let i = 0; i < allSourceHeadings.length; i++) {

            if (sourceHeadings.indexOf(allSourceHeadings[i]) === -1) {
                sourceHeadings.push(allSourceHeadings[i]);
            }
        }

        const isSplitFromSeveralColumns = sourceHeadings.length > 1;
        const otherSeries = [];

        for (let s = 0; s < sourceHeadings.length; s++) {

            const sourceHeading = sourceHeadings[s];
            const sourceGatheredHeadings = gatheredHeadings.filter(
                heading => getSourceHeading(props, heading) === sourceHeading
            );

            if (sourceGatheredHeadings.length === 0) continue;

            otherSeries.push({
                heading: isSplitFromSeveralColumns
                    ? HEADING + SOURCE_SEPARATOR + sourceHeading
                    : HEADING,
                sourceHeading,
                label: isSplitFromSeveralColumns ? sourceHeading + " (" + LABEL + ")" : LABEL,
                gatheredHeadings: sourceGatheredHeadings
            });
        }

        return otherSeries;
    };

    // Inserts a value into an array at an index, which the array may not reach yet.
    const insertAt = (array, index, value) => {

        if (!array) return;

        if (array.length < index) {

            array[index] = value;
            return;
        }

        array.splice(index, 0, value);
    };

    /**
     * Puts the settings of "Other" series not drawn back after the chart's other series settings.
     */
    const keepSettings = (visualisation, settingsByHeading) => {

        for (const heading in settingsByHeading) {

            if (!Object.prototype.hasOwnProperty.call(settingsByHeading, heading)) continue;

            visualisation.series ??= [];
            visualisation.series.push(settingsByHeading[heading]);
        }
    };

    /**
     * Gets an "Other" series' settings as drawn, being its own over those of the first series it
     * gathers, but for its colour and label, which are never taken from another series.
     */
    const buildSeries = (otherSeries, settings, templateSettings, templateSeries) => {

        const effectiveSettings = {};

        for (let i = 0; templateSettings && i < TEMPLATE_PROPERTIES.length; i++) {

            const value = templateSettings[TEMPLATE_PROPERTIES[i]];

            if (value !== undefined) effectiveSettings[TEMPLATE_PROPERTIES[i]] = value;
        }

        Object.assign(effectiveSettings, settings);

        return {
            valueAxis: effectiveSettings.valueAxis || templateSeries?.valueAxis || "leftAxis",
            colour: Ren.StandardColoursConfig.getColour(settings.standardColour)
                || settings.colour
                || COLOUR,
            standardColour: settings.standardColour || null,
            chartType: effectiveSettings.chartType
                ?? templateSeries?.chartType
                ?? Ren.SeriesChartTypeEnum.Bar,
            showValueLabels: effectiveSettings.showValueLabels !== false,
            showNameInBars: settings.showNameInBars === true,
            label: settings.label || otherSeries.label,
            colourFilter: settings.colourFilter || null,
            colourFunction: settings.colourFunction || null,
            lineShape: Ren.DateValueChartCalculator.getLineShape(effectiveSettings),
            lineStyle: effectiveSettings.lineStyle || "solid",
            lineWidth: effectiveSettings.lineWidth || "normal",
            dotSize: effectiveSettings.dotSize || "medium",
            isEnabled: settings.isEnabled !== false,
            estimateLastPeriod:
                effectiveSettings.estimateLastPeriod ?? Ren.EstimateLastPeriodEnum.None,
            runningTotal: effectiveSettings.runningTotal === true,
            yearToDate: effectiveSettings.yearToDate === true,
            rollingYearTotal: effectiveSettings.rollingYearTotal === true,
            trendLine: settings.trendLine || null,
            trendLinePeriods: settings.trendLinePeriods || null,
            markExtremes: settings.markExtremes === true,
            compareWithPreviousYear: settings.compareWithPreviousYear === true
        };
    };

    /**
     * Adds the chart's "Other" series after the series it draws, with the column of values each
     * aggregates, once the drawn series' settings are in place.  Settings of "Other" series it
     * does not draw, removed or with nothing to gather, are kept after the rest, so that each
     * comes back as it was.
     *
     * @param {Object} settingsByHeading - The "Other" series' settings, from extractSettings.
     * @param {Object} groupingEntry - The chart's compiled grouping, or null where it has none.
     */
    const addSeries = (props, visualisation, settingsByHeading, groupingEntry) => {

        const otherSeries = [];
        const removedOtherSeries = [];
        const seriesSettings = visualisation.series ??= [];
        const realSeriesCount = props.seriesCount;
        const possibleOtherSeries = getOtherSeries(props);

        for (let i = 0; i < possibleOtherSeries.length; i++) {

            const other = possibleOtherSeries[i];

            if (settingsByHeading[other.heading]?.isRemoved === true) {
                removedOtherSeries.push(other);
            }
            else {

                otherSeries.push(other);
            }
        }

        props.otherSeries = otherSeries;
        props.removedOtherSeries = removedOtherSeries;

        if (otherSeries.length > 0) {

            // Whichever arrays the drawn headings share are left as they are.
            props.valueHeadings = props.valueHeadings.slice();
            props.seriesSourceHeadings = props.seriesSourceHeadings.slice();
        }

        for (let k = 0; k < otherSeries.length; k++) {

            const other = otherSeries[k];
            const index = realSeriesCount + k;
            const firstGatheredHeading = other.gatheredHeadings[0];

            // A removed series keeps its settings, found by column, the first drawn standing in
            // for one beyond the legend's limit.
            const templateSettings = seriesSettings.find(
                seriesSetting => seriesSetting && seriesSetting.column === firstGatheredHeading
            ) ?? seriesSettings[0];

            const settings = settingsByHeading[other.heading] || { column: other.heading };

            delete settingsByHeading[other.heading];

            const series = buildSeries(other, settings, templateSettings, props.series[0]);

            // Formatted as the first drawn series of the same column.
            const formatIndex = other.sourceHeading == null
                ? 0
                : Math.max(0, props.seriesSourceHeadings.indexOf(other.sourceHeading));

            insertAt(seriesSettings, index, settings);
            insertAt(props.series, index, series);
            insertAt(props.valueHeadings, index, other.heading);
            insertAt(
                props.seriesSourceHeadings,
                index,
                other.sourceHeading ?? props.seriesSourceHeadings[0]
            );

            insertAt(props.valueColumnFormats, index, props.valueColumnFormats?.[formatIndex]);
            insertAt(
                props.valueColumnFormatFunctions,
                index,
                props.valueColumnFormatFunctions?.[formatIndex]
            );

            insertAt(
                props.valueColumnHasOwnFormat,
                index,
                props.valueColumnHasOwnFormat?.[formatIndex]
            );

            insertAt(
                props.valueColumnDefaultFormats,
                index,
                props.valueColumnDefaultFormats?.[formatIndex]
            );
        }

        keepSettings(visualisation, settingsByHeading);

        props.seriesCount = realSeriesCount + otherSeries.length;

        if (otherSeries.length > 0) {

            props.preGroupedData = Ren.DateValueChart_GroupingApplyer.addOtherSeriesColumns(
                props.preGroupedData,
                groupingEntry,
                otherSeries
            );
        }
    };

    /**
     * Gets the split values an "Other" series of a split chart gathers, which may include the
     * split's own "(other)" value, or null where the series is not an "Other" series of one.
     */
    const getSplitValues = (props, seriesIndex) => {

        const heading = props.valueHeadings?.[seriesIndex];
        const other = (props.otherSeries || []).find(series => series.heading === heading);
        const splitValueBySeriesHeading = props.seriesSplit?.splitValueBySeriesHeading;

        if (!other || !splitValueBySeriesHeading) return null;

        const splitValues = [];

        for (let i = 0; i < other.gatheredHeadings.length; i++) {

            const splitValue = splitValueBySeriesHeading[other.gatheredHeadings[i]];

            if (splitValue !== undefined) splitValues.push(splitValue);
        }

        return splitValues;
    };

    // The most series a tooltip names, beyond which it says how many more there are.
    const MAX_TOOLTIP_SERIES = 40;

    /**
     * Gets the tooltip listing the series an "Other" series gathers, each by its label where it
     * has one, or null where the series of the given index is not an "Other" series.
     */
    const getTooltip = (props, seriesIndex) => {

        const heading = props.valueHeadings?.[seriesIndex];
        const other = (props.otherSeries || []).find(series => series.heading === heading);

        if (!other) return null;

        const labelByHeading = {};
        const seriesSettings = props.visualisation?.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            const settings = seriesSettings[i];

            if (settings?.label && settings.column !== undefined) {
                labelByHeading[settings.column] = settings.label;
            }
        }

        const gatheredHeadings = other.gatheredHeadings;
        const count = gatheredHeadings.length;
        const lines = [
            "\"" + (props.series?.[seriesIndex]?.label || other.label) + "\" represents " +
                count + " series:"
        ];
        const listedCount = Math.min(count, MAX_TOOLTIP_SERIES);

        for (let i = 0; i < listedCount; i++) {
            lines.push(labelByHeading[gatheredHeadings[i]] || gatheredHeadings[i]);
        }

        if (count > listedCount) lines.push("\u2026and " + (count - listedCount) + " more");

        return lines.join("\n");
    };

    /**
     * Gives an element the tooltip listing the series an "Other" series gathers, where the series
     * of the given index is one: a title attribute on an HTML element, and a title element in an
     * SVG one, or added to the end of the title it has.
     */
    const addTooltip = (element, props, seriesIndex) => {

        const tooltip = element ? getTooltip(props, seriesIndex) : null;

        if (!tooltip) return;

        if (element.namespaceURI !== "http://www.w3.org/2000/svg") {

            element.title = element.title ? element.title + "\n\n" + tooltip : tooltip;
            return;
        }

        let title = null;

        for (let i = 0; i < element.children.length; i++) {

            if (element.children[i].tagName === "title") {

                title = element.children[i];
                break;
            }
        }

        if (title) {
            title.textContent += "\n\n" + tooltip;
        }
        else {

            Ren.Svg.append(element, "title").textContent = tooltip;
        }
    };

    /**
     * Removes the "Other" series of the given headings, or reinstates them, or every removed one
     * where no headings are given.  The change is left to the caller to commit.
     */
    const setRemoved = (visualisation, headings, isRemoved) => {

        const seriesSettings = visualisation?.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            const settings = seriesSettings[i];

            if (!settings || !isOtherHeading(settings.column)) continue;

            if (headings && headings.indexOf(settings.column) === -1) continue;

            if (isRemoved) {
                settings.isRemoved = true;
            }
            else {

                delete settings.isRemoved;
            }
        }
    };

    /**
     * Gets a value indicating whether any of the chart's "Other" series is shown.
     */
    const isShown = (props) => {

        for (let i = 0; i < (props.valueHeadings || []).length; i++) {

            if (isOtherHeading(props.valueHeadings[i]) && props.series?.[i]?.isEnabled !== false) {
                return true;
            }
        }

        return false;
    };

    /**
     * Shows or hides every one of the chart's "Other" series.  The change is left to the caller
     * to commit.
     */
    const setShown = (props, isEnabled) => {

        const seriesSettings = props.visualisation?.series || [];

        for (let i = 0; i < seriesSettings.length; i++) {

            if (seriesSettings[i] && isOtherHeading(seriesSettings[i].column)) {
                seriesSettings[i].isEnabled = isEnabled;
            }
        }

        for (let i = 0; i < (props.valueHeadings || []).length; i++) {

            if (isOtherHeading(props.valueHeadings[i]) && props.series?.[i]) {
                props.series[i].isEnabled = isEnabled;
            }
        }
    };

    return {
        HEADING,
        LABEL,
        COLOUR,
        isOtherHeading,
        isOtherSeries,
        extractSettings,
        keepSettings,
        getGatheredHeadings,
        getOtherSeries,
        addSeries,
        getSplitValues,
        getTooltip,
        addTooltip,
        setRemoved,
        isShown,
        setShown
    };
})();
