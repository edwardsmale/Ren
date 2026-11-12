/**
 * The date/value chart's own date range filter: a client-side reduction of the dates it draws, with
 * no second query.  The range is held on the chart's date grouping entry (see
 * Ren.DateValueChart_GroupingApplyer), so it is saved with the chart and applied as its data is
 * binned.
 *
 * A range is stored either as { from, to } - inclusive yyyy-MM-dd dates, or yyyy-MM-dd HH:mm:ss
 * times where the chart is binned finer than a day, either of which may be left out for an open
 * end - or as { lastPeriodCount, lastPeriodUnit }, counted back from the last date in the data
 * rather than from today, so a saved "last 12 months" still means the last twelve months of
 * whatever the next query returns - or as { preset }, one of the date selector's ranges counted
 * from today (see Ren.DateSelector_ContextMenu_Options), worked out again each day - or as
 * { acronym }, a date range acronym such as "L90D" or "YTD" (see Ren.DateAcronyms), also counted
 * from today, which is the easiest way to give a report's chart its initial range.
 *
 * A resolved range is { from, toExclusive }, snapped outwards to the chart's bin boundaries so that
 * no bar is ever drawn from part of a period.  A boundary at midnight is always the plain
 * yyyy-MM-dd, which sorts before every time on that day, so boundaries compare as strings with
 * dates and times alike.
 */
Ren.DateValueChart_DateRange = (() => {

    // Built on first use because Ren.DatePeriodEnum is defined after this file is loaded.
    let periodsByUnit = null;

    const getPeriodsByUnit = () => {

        if (!periodsByUnit) {

            periodsByUnit = {
                day: Ren.DatePeriodEnum.Day,
                week: Ren.DatePeriodEnum.Week,
                month: Ren.DatePeriodEnum.Month,
                quarter: Ren.DatePeriodEnum.Quarter,
                year: Ren.DatePeriodEnum.Year
            };
        }

        return periodsByUnit;
    };

    /**
     * Gets the unit name a date period is stored under, defaulting to days for a period the chart
     * cannot name (which is every period finer than a day).
     */
    const getUnitForPeriod = (datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Week: return "week";
            case Ren.DatePeriodEnum.Month: return "month";
            case Ren.DatePeriodEnum.Quarter: return "quarter";
            case Ren.DatePeriodEnum.Year: return "year";
            default: return "day";
        }
    };

    const getPeriodForUnit = (unit) => getPeriodsByUnit()[unit] ?? null;

    /**
     * Gets the period a range is kept in whole of: the chart's bins, or days where it has none.
     */
    const getRangePeriod = (binPeriod) => binPeriod || Ren.DatePeriodEnum.Day;

    const formatSortableDateTime = Ren.ChartDateTime.createUtcFormat("yyyy-MM-dd HH:mm:ss");

    /**
     * Gets a yyyy-MM-dd HH:mm:ss boundary at midnight as its plain yyyy-MM-dd.
     */
    const trimMidnight = (sortableDate) =>
        sortableDate && sortableDate.length === 19 && sortableDate.endsWith(" 00:00:00")
            ? sortableDate.substring(0, 10)
            : sortableDate;

    /**
     * Gets a yyyy-MM-dd or yyyy-MM-dd HH:mm:ss date as a time, reading it as UTC wall-clock time
     * as the chart plots it.
     */
    const toTime = (sortableDate) =>
        Ren.DateUtils.parseDateTimeUniversalToTime(sortableDate, false);

    /**
     * Gets a time as a range boundary: yyyy-MM-dd HH:mm:ss, or yyyy-MM-dd at midnight.
     */
    const toSortableDateTime = (time) => trimMidnight(formatSortableDateTime(new Date(time)));

    /**
     * Gets the chart grouping's date entry, which is where the range is stored.
     */
    const getDateEntry = (chartDataGroupingSettings) =>
        Ren.DateValueChart_GroupingEntries.getDateEntry(chartDataGroupingSettings);

    /**
     * Gets a value indicating whether the chart's grouping has a date entry to store a range on,
     * which a chart without a date column has not.
     */
    const canHoldRange = (chartDataGroupingSettings) =>
        !!getDateEntry(chartDataGroupingSettings);

    /**
     * Gets the stored range, or null where the chart draws every date it is given.
     */
    const getRange = (chartDataGroupingSettings) =>
        getDateEntry(chartDataGroupingSettings)?.dateRange ?? null;

    /**
     * Gets the range a date selector option stands for: its key where it is counted from today,
     * or else its dates, left open at the end where it runs up to today so that today is drawn.
     */
    const fromDateSelectorOption = (startDate, endDateExclusive, presetKey) => {

        if (presetKey) return { preset: presetKey };

        const range = { from: startDate };

        if (endDateExclusive < Ren.DateUtils.todayAsSortableDate()) {
            range.to = getInclusiveTo(endDateExclusive);
        }

        return range;
    };

    /**
     * Gets a value indicating whether two stored ranges are the same.
     */
    const isSameRange = (range, otherRange) => {

        if (!range || !otherRange) return !range && !otherRange;

        return (range.preset ?? null) === (otherRange.preset ?? null)
            && (range.acronym ?? null) === (otherRange.acronym ?? null)
            && (range.lastPeriodCount ?? null) === (otherRange.lastPeriodCount ?? null)
            && (range.lastPeriodUnit ?? null) === (otherRange.lastPeriodUnit ?? null)
            && (range.from ?? null) === (otherRange.from ?? null)
            && (range.to ?? null) === (otherRange.to ?? null);
    };

    /**
     * Stores a range on the chart's date grouping entry, or removes the one it has where the range
     * is null.
     */
    const setRange = (chartDataGroupingSettings, range) => {

        const dateEntry = getDateEntry(chartDataGroupingSettings);

        if (!dateEntry) return;

        if (range) {

            dateEntry.dateRange = range;
        }
        else {

            delete dateEntry.dateRange;
        }
    };

    /**
     * Gets a value indicating whether the chart leaves out the first (leading) or last period of
     * its data where that period is only partly covered.
     */
    const getExcludePartialPeriod = (chartDataGroupingSettings, isLeading) => {

        const dateEntry = getDateEntry(chartDataGroupingSettings);

        return !!(isLeading
            ? dateEntry?.excludePartialLeadingPeriod
            : dateEntry?.excludePartialTrailingPeriod);
    };

    const setExcludePartialPeriod = (chartDataGroupingSettings, isLeading, isExcluded) => {

        const dateEntry = getDateEntry(chartDataGroupingSettings);

        if (!dateEntry) return;

        const name = isLeading ? "excludePartialLeadingPeriod" : "excludePartialTrailingPeriod";

        if (isExcluded) {

            dateEntry[name] = true;
        }
        else {

            delete dateEntry[name];
        }
    };

    // How many zooms back a chart can be taken, beyond which the oldest is dropped.
    const MAX_ZOOM_STACK_DEPTH = 50;

    // What each chart was showing before each of the zooms it has been narrowed by, newest last,
    // so that a double-click takes it back one zoom at a time.  Held here rather than on the chart,
    // whose handlers are attached afresh on every redraw, and weakly so that a chart that has gone
    // takes its stack with it.
    const zoomStacks = new WeakMap();

    const getZoomStack = (visualisation) => {

        if (!visualisation) return [];

        let stack = zoomStacks.get(visualisation);

        if (!stack) {

            stack = [];
            zoomStacks.set(visualisation, stack);
        }

        return stack;
    };

    const getZoomStackDepth = (visualisation) => getZoomStack(visualisation).length;

    /**
     * Remembers the range a chart is showing before a zoom narrows it.  The range is copied, so
     * that a later edit of the chart's own range does not reach back into the stack.
     */
    const pushZoom = (visualisation, range) => {

        const stack = getZoomStack(visualisation);

        stack.push(range ? Object.assign({}, range) : null);

        if (stack.length > MAX_ZOOM_STACK_DEPTH) {

            stack.shift();
        }
    };

    /**
     * Takes the range a chart was showing before its last zoom back off the stack, or returns
     * undefined where it has none left to go back to.
     */
    const popZoom = (visualisation) => {

        const stack = getZoomStack(visualisation);

        return stack.length ? stack.pop() : undefined;
    };

    const clearZoomStack = (visualisation) => {

        getZoomStack(visualisation).length = 0;
    };

    /**
     * Remembers the range a chart is first given as the one Reset returns it to, unless the chart
     * declares a defaultDateRange of its own.
     */
    const rememberDefaultRange = (visualisation) => {

        if (!visualisation || visualisation.defaultDateRange !== undefined) return;

        const range = getRange(visualisation.chartDataGroupingSettings);

        visualisation.defaultDateRange = range ? Object.assign({}, range) : null;
    };

    /**
     * Gets the range Reset returns a chart to, or null where that is every date.
     */
    const getDefaultRange = (visualisation) => visualisation?.defaultDateRange ?? null;

    /**
     * Gets a value indicating whether a chart is showing a range other than its default one.
     */
    const isAwayFromDefault = (visualisation) => !isSameRange(
        getRange(visualisation?.chartDataGroupingSettings),
        getDefaultRange(visualisation)
    );

    /**
     * Stores a range on a chart and rebuilds it from its input data, rather than redrawing it from
     * the data it has prepared, as the range is applied while the rows are binned.
     *
     * The range is copied, so that two charts never share the one range object and a later edit
     * of it.
     */
    const applyToChart = (visualisation, props, range) => {

        const settings = visualisation?.chartDataGroupingSettings;

        // A chart without a date column has no dates for a range to choose among.
        if (!settings || !canHoldRange(settings)) return;

        setRange(settings, range ? Object.assign({}, range) : null);

        props.skipExtentRecalculation = false;

        Ren.VisualisationSettingsSynchroniser.commitChange(
            visualisation,
            props.redrawVisualisation
        );
    };

    /**
     * Gets the group a chart's date range and hovered date are shared under, defaulting to the
     * filter group as it does in Ren.DataGroupingSettingsBinding.
     */
    const getDateRangeGroup = (visualisation) =>
        visualisation.dateRangeGroup
            ?? visualisation.filterGroup
            ?? visualisation.dataGroupingSettingsGroup;

    /**
     * Gets what a range stored on a chart is read against - the period it groups its dates by,
     * and, where it is drawn as several charts, their period and count - as a string that is the
     * same for two charts only where a range means the same on both.  A range is shared only
     * between those, as a slider stop on yearly pies says nothing to a chart grouped by month, or
     * to one showing the latest three years rather than the latest two (unless the two were the
     * same until one was zoomed, when the other is zoomed with it; see notifyRangeChanged).
     */
    const getRangeSignature = (visualisation) => {

        const binPeriod = Ren.DateValueChart_GroupingApplyer.getBinPeriod(
            visualisation?.chartDataGroupingSettings
        ) ?? "";

        const multiChartPeriod =
            Ren.DateValueChart_PeriodSlider.getPeriod(visualisation?.multiChartPeriod);

        if (!multiChartPeriod) return String(binPeriod);

        return binPeriod + "|" + multiChartPeriod
            + "|" + Ren.DateValueChart_MultiChart.getMaxChartCount(visualisation);
    };

    // The last range announced to each date range group, by group and report context GUID, as
    // { range, signature, chartCount, supersededSignatures }, the last being those of the counts
    // of charts the announcing chart has since been drawn as instead.
    const announcedRanges = new Map();

    // The charts that have been drawn, as a recreated one (by a reset, say) keeps its own range.
    const drawnVisualisations = new WeakSet();

    /**
     * Gives a chart the range last announced to its date range group, if one has been by a chart
     * with the same range signature, for a chart first drawn after the other charts moved, such
     * as one waiting on an unshown tab.  A multi-chart still drawn as the count of charts the
     * announcing chart was before being zoomed takes the new count too.
     */
    const catchUpWithDateRangeGroup = (visualisation, props) => {

        if (drawnVisualisations.has(visualisation)) return;

        drawnVisualisations.add(visualisation);

        const key = getDateRangeGroup(visualisation) + "|" + visualisation.containingReportGuid;
        const announced = announcedRanges.get(key);

        if (!announced) return;

        const signature = getRangeSignature(visualisation);

        if (announced.supersededSignatures.indexOf(signature) >= 0) {

            Ren.DateValueChart_MultiChart.setMaxChartCount(
                visualisation,
                props,
                announced.chartCount
            );
        }
        else if (announced.signature !== signature) {

            return;
        }

        const range = announced.range;

        setRange(visualisation.chartDataGroupingSettings, range ? Object.assign({}, range) : null);
    };

    /**
     * Announces a range so that the charts sharing this one's date range group narrow with it.
     * Scoped to the report context, as another instance of the same report is filtered
     * independently.
     *
     * The range is carried as it is stored, not as it was resolved, so "last 3 months" is counted
     * again against each chart's own dates and snapped to its own bins.
     *
     * Where a multi-chart has just been drawn as another count of charts, the signature it had
     * before is passed, and the charts that shared it take the new count along with the range.
     *
     * Notified immediately, so that while panning or zooming the other charts redraw in the same
     * frame as this one rather than trailing it.
     */
    const notifyRangeChanged = (visualisation, range, previousSignature) => {

        const signature = getRangeSignature(visualisation);
        const isCountChanged = !!previousSignature && previousSignature !== signature;
        const chartCount = isCountChanged
            ? Ren.DateValueChart_MultiChart.getMaxChartCount(visualisation)
            : null;

        const key = getDateRangeGroup(visualisation) + "|" + visualisation.containingReportGuid;
        const previous = announcedRanges.get(key);

        // Zoomed again, a chart drawn late at any of the counts zoomed through is caught up.
        const carriedSignatures = previous
            && (previous.signature === signature || previous.signature === previousSignature)
            ? previous.supersededSignatures
            : [];

        const supersededSignatures = (isCountChanged
            ? carriedSignatures.concat([previousSignature])
            : carriedSignatures
        ).filter(supersededSignature => supersededSignature !== signature);

        announcedRanges.set(key, {
            range: range ? Object.assign({}, range) : null,
            signature,
            chartCount: Ren.DateValueChart_MultiChart.getMaxChartCount(visualisation),
            supersededSignatures
        });

        Ren.Messages.Events.chartDateRangeChanged.notifyImmediately(
            getDateRangeGroup(visualisation),
            range,
            visualisation.containingReportGuid,
            visualisation.visualisationGuid,
            isCountChanged ? previousSignature : signature,
            chartCount
        );
    };

    // The dates last drawn by a chart in each date range group, by group and report context GUID,
    // as { from, toExclusive, dateHeading }, or null where that chart drew every date.
    const shownRanges = new Map();

    /**
     * Records the dates a chart has just been drawn over - { from, toExclusive } as resolved,
     * either end null where open, or null for every date - and announces them where they differ
     * from the last a chart in its date range group was drawn over.  Unlike notifyRangeChanged,
     * which carries a range as it is stored for other charts to take up, this is what was drawn,
     * so a multi-chart showing its latest periods by default announces those periods.
     *
     * The last chart drawn speaks for its group, which is right where the charts in it are kept
     * showing the same dates, as a date range group's are.
     */
    const announceShownRange = (visualisation, resolvedRange, dateHeading) => {

        if (!visualisation || !dateHeading) return;

        const group = getDateRangeGroup(visualisation);
        const key = group + "|" + visualisation.containingReportGuid;

        const shownRange = resolvedRange
            && (resolvedRange.from != null || resolvedRange.toExclusive != null)
            ? {
                from: resolvedRange.from ?? null,
                toExclusive: resolvedRange.toExclusive ?? null,
                dateHeading
            }
            : null;

        const previous = shownRanges.get(key);

        if (previous !== undefined && JSON.stringify(previous) === JSON.stringify(shownRange)) {
            return;
        }

        shownRanges.set(key, shownRange);

        Ren.Messages.Events.chartShownRangeChanged.notify(
            group,
            shownRange,
            visualisation.containingReportGuid,
            visualisation.visualisationGuid
        );
    };

    /**
     * Gets the dates a chart in a date range group was last drawn over, as announceShownRange
     * records them, or null where none has been drawn or the last drew every date.
     */
    const getShownRange = (dateRangeGroup, containingReportGuid) =>
        shownRanges.get(dateRangeGroup + "|" + containingReportGuid) ?? null;

    /**
     * Gets a cell's date as a yyyy-MM-dd string, or yyyy-MM-dd HH:mm:ss where it has a time, which
     * is the form every date here is compared in, or null where the value is not a date at all.
     */
    const toComparableDate = (value) => {

        if (value == null) return null;

        if (typeof value !== "string") {

            return value instanceof Date ? Ren.DateUtils.toSortableDate(value) : null;
        }

        if (Ren.DateUtils.readSortableYmd(value) !== -1) {

            // An ISO "T" would sort after the space every other time is written with.
            return value.length === 19 && value.charCodeAt(10) !== 32
                ? value.substring(0, 10) + " " + value.substring(11)
                : value;
        }

        const sortableDate = Ren.DateUtils.toSortableDateAuto(value);

        return Ren.DateUtils.readSortableYmd(sortableDate) !== -1
            ? sortableDate.substring(0, 10)
            : null;
    };

    /**
     * Adds a number of periods (negative to subtract) to a range boundary, as one.  A time of day
     * is kept through whole days and longer.
     */
    const addPeriods = (sortableDate, datePeriod, count) => {

        const periodMs = Ren.DateValueChartCalculator.getSubDayPeriodMilliseconds(datePeriod);

        if (periodMs !== null) return toSortableDateTime(toTime(sortableDate) + count * periodMs);

        const date = sortableDate.substring(0, 10);
        const timeOfDay = sortableDate.substring(10);

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Week:
                return Ren.DateUtils.addDaysToSortableDate(date, count * 7) + timeOfDay;
            case Ren.DatePeriodEnum.Month:
                return Ren.DateUtils.addMonths(date, count) + timeOfDay;
            case Ren.DatePeriodEnum.Quarter:
                return Ren.DateUtils.addQuarters(date, count) + timeOfDay;
            case Ren.DatePeriodEnum.Year:
                return Ren.DateUtils.addYears(date, count) + timeOfDay;
            default:
                return Ren.DateUtils.addDaysToSortableDate(date, count) + timeOfDay;
        }
    };

    /**
     * Gets the start of the period a date or time falls in, as a range boundary.
     */
    const floorToPeriod = (sortableDate, datePeriod) =>
        trimMidnight(Ren.DateUtils.toSortableStartOfPeriod(sortableDate, datePeriod));

    /**
     * Gets the first period boundary at or after a date or time, as a range boundary.
     */
    const ceilToPeriod = (sortableDate, datePeriod) => {

        const date = trimMidnight(sortableDate);
        const start = floorToPeriod(date, datePeriod);

        return start < date ? addPeriods(start, datePeriod, 1) : start;
    };

    /**
     * Gets the exclusive end of a stored inclusive "to": the day after a date, or the second after
     * a time.
     */
    const getToExclusive = (to) => to.length === 10
        ? Ren.DateUtils.addDaysToSortableDate(to, 1)
        : toSortableDateTime(toTime(to) + 1000);

    /**
     * Gets the inclusive "to" a range with an exclusive end is stored with: the day before a
     * midnight, or the second before any other time.
     */
    const getInclusiveTo = (toExclusive) => toExclusive.length === 10
        ? Ren.DateUtils.addDaysToSortableDate(toExclusive, -1)
        : formatSortableDateTime(new Date(toTime(toExclusive) - 1000));

    /**
     * Gets the first and last date the rows hold, as { min, max } comparable dates (see
     * toComparableDate), or null where none of them holds a date.
     */
    const getDataExtent = (rows, dateHeading) => {

        if (!rows || !dateHeading) return null;

        let min = null;
        let max = null;

        for (let i = 0; i < rows.length; i++) {

            const date = toComparableDate(rows[i][dateHeading]);

            if (date === null) continue;

            if (min === null || date < min) min = date;

            if (max === null || date > max) max = date;
        }

        return min === null ? null : { min, max };
    };

    /**
     * Resolves a stored range against the data it filters, as { from, toExclusive } range
     * boundaries snapped outwards to the bin boundaries, or null where nothing is to be filtered
     * out.
     *
     * A range that misses the data entirely - a saved absolute range against a later query, say -
     * resolves to null rather than to an empty chart, which would leave no chart to clear it from.
     */
    const resolve = (rows, dateHeading, binPeriod, range) =>
        resolveFromExtent(getDataExtent(rows, dateHeading), binPeriod, range);

    /**
     * Resolves a stored range as resolve does, against an extent already taken from the rows, for
     * a caller holding one (see Ren.DateValueChart_DataCache).
     */
    const resolveFromExtent = (extent, binPeriod, range) => {

        if (!range) return null;

        const period = getRangePeriod(binPeriod);

        let from = null;
        let toExclusive = null;

        if (range.lastPeriodCount > 0) {

            if (!extent) return null;

            const unit = getPeriodForUnit(range.lastPeriodUnit) ?? period;

            toExclusive = addPeriods(floorToPeriod(extent.max, period), period, 1);
            from = floorToPeriod(
                addPeriods(toExclusive, unit, -range.lastPeriodCount),
                period
            );
        }
        else if (range.preset) {

            const preset = Ren.DateSelector_ContextMenu_Options.getPreset(range.preset);

            if (!preset) return null;

            from = floorToPeriod(preset.startDate, period);

            // One running up to today is left open, so that today is drawn.
            if (preset.endDate < Ren.DateUtils.todayAsSortableDate()) {
                toExclusive = ceilToPeriod(preset.endDate, period);
            }
        }
        else if (range.acronym) {

            const acronymRange = Ren.DateAcronyms.getSortableDateRangeByAcronym(range.acronym);

            if (!acronymRange) return null;

            from = floorToPeriod(acronymRange.getStartDate(), period);

            const endDate = acronymRange.getEndDate();

            if (endDate < Ren.DateUtils.todayAsSortableDate()) {
                toExclusive = ceilToPeriod(endDate, period);
            }
        }
        else {

            const fromDate = toComparableDate(range.from);
            const toDate = toComparableDate(range.to);

            if (fromDate !== null) from = floorToPeriod(fromDate, period);

            if (toDate !== null) toExclusive = ceilToPeriod(getToExclusive(toDate), period);
        }

        if (from === null && toExclusive === null) return null;

        if (extent) {

            if (from !== null && from > extent.max) return null;

            if (toExclusive !== null && toExclusive <= extent.min) return null;
        }

        return { from, toExclusive };
    };

    /**
     * Gets the current wall-clock time as a range boundary, read as UTC as the chart plots it.
     */
    const getNow = () => {

        const now = new Date();

        return toSortableDateTime(now.getTime() - now.getTimezoneOffset() * 60000);
    };

    /**
     * Narrows a resolved range (null for every date) so that it leaves out the data's first bin
     * where the data starts part way through it, and its last where the data stops part way
     * through it or the period is still running.  Only a bin the range would otherwise draw is
     * left out, and a range that would be left with nothing is kept as it was.
     *
     * The data's own period (sourcePeriod) says where its last date's coverage ends, as a month
     * of monthly data dated the 1st covers the whole month.
     */
    const excludePartialPeriods = (resolvedRange, extent, sourcePeriod, binPeriod, options) => {

        if (!extent || (!options.leading && !options.trailing)) return resolvedRange;

        const period = getRangePeriod(binPeriod);

        let from = resolvedRange?.from ?? null;
        let toExclusive = resolvedRange?.toExclusive ?? null;

        const min = trimMidnight(extent.min);
        const max = trimMidnight(extent.max);

        if (options.leading && (from === null || from <= min)) {

            const firstBinStart = floorToPeriod(min, period);

            if (min > firstBinStart) from = addPeriods(firstBinStart, period, 1);
        }

        if (options.trailing && (toExclusive === null || toExclusive > max)) {

            const lastBinStart = floorToPeriod(max, period);
            const lastBinEnd = addPeriods(lastBinStart, period, 1);

            const dataPeriod = sourcePeriod || Ren.DatePeriodEnum.Day;
            const coverageEnd = addPeriods(floorToPeriod(max, dataPeriod), dataPeriod, 1);

            const now = getNow();
            const isRunning = now >= lastBinStart && now < lastBinEnd;

            if (coverageEnd < lastBinEnd || isRunning) toExclusive = lastBinStart;
        }

        if (from !== null && toExclusive !== null && from >= toExclusive) return resolvedRange;

        if (from === null && toExclusive === null) return null;

        return { from, toExclusive };
    };

    /**
     * Gets a value indicating whether a date falls in a resolved range.  A date that cannot be read
     * is kept, as is every date where there is no range.
     */
    const includes = (resolvedRange, sortableDate) => {

        if (!resolvedRange) return true;

        const date = toComparableDate(sortableDate);

        if (date === null) return true;

        if (resolvedRange.from !== null && date < resolvedRange.from) return false;

        if (resolvedRange.toExclusive !== null && date >= resolvedRange.toExclusive) return false;

        return true;
    };

    /**
     * Gets a range boundary as the Date the chart plots it at, or null where there is none.
     */
    const toDate = (boundary) => boundary ? new Date(toTime(boundary)) : null;

    /**
     * Narrows the time the data covers to the resolved range, so the date axis ends where the
     * filtered chart ends rather than where the unfiltered data did.  Coverage is { start, end }
     * Dates with an exclusive end (see getDataDateCoverage).
     */
    const clampCoverage = (coverage, resolvedRange) => {

        if (!coverage || !resolvedRange) return coverage;

        let start = coverage.start;
        let end = coverage.end;

        const from = toDate(resolvedRange.from);
        const toExclusive = toDate(resolvedRange.toExclusive);

        if (from && start && from > start) start = from;

        if (toExclusive && end && toExclusive < end) end = toExclusive;

        return { start, end };
    };

    /**
     * Gets the ranges offered as one-click alternatives for a chart binned by the given period,
     * each as { text, count, unit }.
     */
    const getPresets = (binPeriod) => {

        const unit = getUnitForPeriod(binPeriod ?? Ren.DatePeriodEnum.Day);

        const counts = {
            day: [7, 14, 30, 90, 365],
            week: [4, 13, 26, 52],
            month: [3, 6, 12, 24],
            quarter: [4, 8, 12],
            year: [2, 3, 5]
        }[unit];

        const presets = [];

        for (let i = 0; i < counts.length; i++) {

            presets.push({
                text: "Last " + counts[i] + " " + unit + "s",
                count: counts[i],
                unit
            });
        }

        return presets;
    };

    /**
     * Formats a range boundary as dd/MM/yyyy, followed by HH:mm, or HH:mm:ss where it has seconds.
     */
    const formatBoundary = (sortableDate) => {

        const date = Ren.DateUtils.sortableDateToddMMyyyy(sortableDate.substring(0, 10));

        if (sortableDate.length === 10) return date;

        return date + " " + sortableDate.substring(11, sortableDate.endsWith(":00") ? 16 : 19);
    };

    /**
     * Describes a range as the menu shows it, e.g. "Last 12 months", "Q2 2026" or
     * "01/04/2026 to 30/06/2026".  Returns null where no range is set.
     */
    const describe = (range, resolvedRange) => {

        if (!range) return null;

        if (range.lastPeriodCount > 0) {

            const unit = range.lastPeriodUnit || "day";

            return "Last " + range.lastPeriodCount + " " + unit
                + (range.lastPeriodCount === 1 ? "" : "s");
        }

        if (range.preset) {

            const preset = Ren.DateSelector_ContextMenu_Options.getPreset(range.preset);

            if (!preset) return null;

            // The "Since" options are named by their year alone, which reads as that year.
            return range.preset.startsWith("since-") ? "Since " + preset.text : preset.text;
        }

        const to = toComparableDate(range.to);

        const from = resolvedRange?.from ?? toComparableDate(range.from);
        const toExclusive = resolvedRange?.toExclusive ?? (to ? getToExclusive(to) : null);

        if (from && !toExclusive) return "From " + formatBoundary(from);

        if (!from && !toExclusive) return null;

        // A time ends where the next begins, so reads better as the end it runs up to.
        if ((from && from.length > 10) || toExclusive.length > 10) {

            return (from ? formatBoundary(from) + " to " : "Up to ") + formatBoundary(toExclusive);
        }

        if (!from) return "Up to " + formatBoundary(getInclusiveTo(toExclusive));

        const summary = Ren.DateRangeSummariser.getDateRangeSummary(from, toExclusive);

        if (summary) return summary;

        return formatBoundary(from) + " to " + formatBoundary(getInclusiveTo(toExclusive));
    };

    return {
        addPeriods,
        announceShownRange,
        applyToChart,
        canHoldRange,
        catchUpWithDateRangeGroup,
        ceilToPeriod,
        clampCoverage,
        clearZoomStack,
        describe,
        excludePartialPeriods,
        floorToPeriod,
        fromDateSelectorOption,
        getDataExtent,
        getDateRangeGroup,
        getDefaultRange,
        getExcludePartialPeriod,
        getInclusiveTo,
        getPresets,
        getRange,
        getRangePeriod,
        getRangeSignature,
        getShownRange,
        getUnitForPeriod,
        getZoomStackDepth,
        includes,
        isAwayFromDefault,
        isSameRange,
        notifyRangeChanged,
        popZoom,
        pushZoom,
        rememberDefaultRange,
        resolve,
        resolveFromExtent,
        setExcludePartialPeriod,
        setRange,
        toComparableDate,
        toDate,
        toSortableDateTime,
        toTime
    };
})();
