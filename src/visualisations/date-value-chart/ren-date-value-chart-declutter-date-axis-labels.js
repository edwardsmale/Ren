/**
 * Keeps a date/value chart's date axis legible where it ticks at more periods than there is room
 * to label.
 *
 * This pass runs once the style updater has written the sheet, since only then is the labels' real
 * size on screen known.  An axis with no room for a label a period steps back to coarser ones - a
 * time of day steps through round intervals (every 15 minutes, every 6 hours) to a label a day -
 * then every 2 or 3 days, a week, a month, a quarter and a year, and only thins by distance once
 * even a label a year is more than fits.  The last line of a label (its year, or its date under a
 * time of day) is printed only where it changes, and the labels are measured as they will be
 * printed.
 */
Ren.DateValueChart_DeclutterDateAxisLabels = (() => {

    // The gap (in visual pixels) two labels have to leave each other to count as clear.  Labels
    // touching at the edges read as one, so a few pixels are asked for.
    const LABEL_GAP_PX = 6;

    // The narrowest a date label is ever printed, which with the gap gives the most labels an axis
    // of a given width could ever show (see getLabellableDates).  Deliberately under any real
    // label's width: it decides only which labels are not worth drawing to measure.
    const MIN_LABEL_WIDTH_PX = 12;

    // Labelled however narrow the axis is, so that a chart drawn in a sliver still says where it
    // starts and roughly where it ends.
    const MIN_LABELS_LABELLED = 2;

    // Where a tick's whole label is kept, so that a later pass has the year line back to print
    // whether or not the pass before it suppressed it, and measures the label at its full width.
    const FULL_LABEL_ATTRIBUTE = "data-full-label";

    // Milliseconds in a minute, an hour, a day and a week, and the offset from the epoch (a
    // Thursday) to the first Monday after it, which is what buckets the dates into weeks starting
    // on a Monday.
    const MS_PER_MINUTE = 60 * 1000;
    const MS_PER_HOUR = 60 * MS_PER_MINUTE;
    const MS_PER_DAY = 24 * MS_PER_HOUR;
    const MS_PER_WEEK = 7 * MS_PER_DAY;
    const EPOCH_TO_FIRST_MONDAY_MS = 4 * MS_PER_DAY;

    // What the last pass settled on.  A label that is not on the axis was either never drawn or
    // dropped here, and the two look the same from the outside, so the counts are exposed through
    // Ren.QA.DateValueChart.getDateAxisLabelPlacements() to tell them apart.
    let lastResult = { shown: 0, hidden: 0, yearsSuppressed: 0, level: "all" };

    const getDiagnostics = () => lastResult;

    /**
     * Prints a tick's label, a line of it per element of the array given.  The lines are drawn as
     * tspans rather than as one string with newlines in it, SVG text having no line breaks of its
     * own.
     */
    const setTickLabelLines = (textNode, lines) => {

        textNode.textContent = "";

        for (let i = 0; i < lines.length; i++) {

            Ren.Svg.append(textNode, "tspan", { "x": 0, "dy": i === 0 ? 0 : "1.2em" })
                .textContent = lines[i];
        }
    };

    /**
     * Gets the whole of a tick's label, as its lines.  Read off the tick the first time and kept on
     * it after that, so that a suppressed year can be put back.
     */
    const getLabelLines = (tickNode, textNode) => {

        const stored = tickNode.getAttribute(FULL_LABEL_ATTRIBUTE);

        if (stored !== null) return stored.split("\n");

        const tspans = textNode.querySelectorAll("tspan");
        const lines = [];

        for (let i = 0; i < tspans.length; i++) {

            lines.push(tspans[i].textContent);
        }

        if (lines.length === 0) lines.push(textNode.textContent);

        tickNode.setAttribute(FULL_LABEL_ATTRIBUTE, lines.join("\n"));

        return lines;
    };

    // The dates are UTC midnights (see Ren.DateUtils.createDate), so they are bucketed by their
    // UTC parts: a local reading would put a date either side of midnight into the wrong bucket
    // wherever the two calendars disagree.
    const everyMilliseconds = milliseconds => date => Math.floor(date.getTime() / milliseconds);

    const weekBucket = date =>
        Math.floor((date.getTime() - EPOCH_TO_FIRST_MONDAY_MS) / MS_PER_WEEK);

    const monthBucket = date => date.getUTCFullYear() * 12 + date.getUTCMonth();

    const quarterBucket = date =>
        date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);

    const yearBucket = date => date.getUTCFullYear();

    /**
     * Adds a level per count of a unit, labelling every so many of it counted from the epoch.  The
     * counts under a day divide the unit above them, so those labels fall on round times.
     */
    const addEveryLevels = (levels, applies, unitName, unitMilliseconds, counts) => {

        if (!applies) return;

        for (let i = 0; i < counts.length; i++) {

            const count = counts[i];

            levels.push({
                name: count === 1 ? unitName : `${count}-${unitName}s`,
                bucket: everyMilliseconds(count * unitMilliseconds),
                isDateOnly: unitMilliseconds >= MS_PER_DAY
            });
        }
    };

    /**
     * Gets the steps an axis of the given period can be thinned to, coarsening as they go.  A level
     * keeps the first tick falling in each of its buckets, since no week begins a month, say.  Each
     * period offers only the levels coarser than itself.
     */
    const getLevels = (datePeriod) => {

        const levels = [];
        const isSecond = datePeriod <= Ren.DatePeriodEnum.Second;
        const isMinuteOrFiner = datePeriod <= Ren.DatePeriodEnum.Minute;
        const isQuarterHourOrFiner = datePeriod <= Ren.DatePeriodEnum.QuarterHour;
        const isHourOrFiner = datePeriod <= Ren.DatePeriodEnum.Hour;

        addEveryLevels(levels, isSecond, "second", 1000, [2, 5, 10, 15, 30]);
        addEveryLevels(levels, isSecond, "minute", MS_PER_MINUTE, [1]);
        addEveryLevels(levels, isMinuteOrFiner, "minute", MS_PER_MINUTE, [2, 5, 10, 15]);
        addEveryLevels(levels, isQuarterHourOrFiner, "minute", MS_PER_MINUTE, [30]);
        addEveryLevels(levels, isQuarterHourOrFiner, "hour", MS_PER_HOUR, [1]);
        addEveryLevels(levels, isHourOrFiner, "hour", MS_PER_HOUR, [2, 3, 6, 12]);

        addEveryLevels(levels, isHourOrFiner, "day", MS_PER_DAY, [1]);
        addEveryLevels(levels, datePeriod <= Ren.DatePeriodEnum.Day, "day", MS_PER_DAY, [2, 3]);

        if (datePeriod <= Ren.DatePeriodEnum.Day) {

            levels.push({ name: "week", bucket: weekBucket, isDateOnly: true });
        }

        if (datePeriod <= Ren.DatePeriodEnum.Week) {

            levels.push({ name: "month", bucket: monthBucket, isDateOnly: true });
        }

        if (datePeriod <= Ren.DatePeriodEnum.Month) {

            levels.push({ name: "quarter", bucket: quarterBucket, isDateOnly: true });
        }

        if (datePeriod <= Ren.DatePeriodEnum.Quarter) {

            levels.push({ name: "year", bucket: yearBucket, isDateOnly: true });
        }

        return levels;
    };

    /** The first tick falling in each of the buckets the ticks are spread across. */
    const firstOfEachBucket = (ticks, bucket) => {

        const kept = [];
        let previousKey = null;

        for (let i = 0; i < ticks.length; i++) {

            const key = bucket(ticks[i].date);

            if (i === 0 || key !== previousKey) kept.push(ticks[i]);

            previousKey = key;
        }

        return kept;
    };

    const getLastLine = (tick) => tick.lines.length < 2 ? null : tick.lines[tick.lines.length - 1];

    /**
     * Gets the space a tick's label takes as printed after a label ending in the given line: a
     * repeat of that line is dropped (see declutter), which is what lets a time of day be labelled
     * without the width of its date.
     */
    const getPrintedRect = (tick, previousLastLine) => {

        const lastLine = getLastLine(tick);

        return lastLine !== null && lastLine === previousLastLine ? tick.shortRect : tick.rect;
    };

    /** Gets a value indicating whether every label in a set clears the one before it. */
    const areAllClear = (ticks) => {

        let previousRight = null;
        let previousLastLine = null;

        for (let i = 0; i < ticks.length; i++) {

            const rect = getPrintedRect(ticks[i], previousLastLine);

            if (previousRight !== null && rect.left - LABEL_GAP_PX < previousRight) return false;

            previousRight = rect.right;
            previousLastLine = getLastLine(ticks[i]) ?? previousLastLine;
        }

        return true;
    };

    /**
     * The ticks of a set that can be labelled without printing over one another, taken from the
     * left: the first is always kept, so the date the axis starts at is labelled whatever else has
     * to go.
     */
    const thinToWhatFits = (ticks) => {

        const kept = [];
        let lastKeptRight = null;
        let lastKeptLastLine = null;

        for (let i = 0; i < ticks.length; i++) {

            const rect = getPrintedRect(ticks[i], lastKeptLastLine);

            if (lastKeptRight !== null && rect.left - LABEL_GAP_PX < lastKeptRight) continue;

            kept.push(ticks[i]);
            lastKeptRight = rect.right;
            lastKeptLastLine = getLastLine(ticks[i]) ?? lastKeptLastLine;
        }

        return kept;
    };

    /**
     * Gets which of a set's labels come first or print a last line the label before them does not,
     * and so are printed at their full width.
     */
    const getWideTickFlags = (ticks) => {

        const flags = [];
        let previousLastLine = null;

        for (let i = 0; i < ticks.length; i++) {

            const lastLine = getLastLine(ticks[i]);

            flags.push(i === 0 || (lastLine !== null && lastLine !== previousLastLine));
            previousLastLine = lastLine ?? previousLastLine;
        }

        return flags;
    };

    /**
     * Gets a set of labels with those crowding a wide label beside them dropped, or null where that
     * does not leave the rest clear.  The first label of the axis and each new date or year are
     * wider than the labels between them, and would otherwise take the whole axis to a coarser
     * step for the sake of the few labels next to them.
     */
    const fitAroundWideTicks = (ticks) => {

        const isWide = getWideTickFlags(ticks);
        const kept = [];

        for (let i = 0; i < ticks.length; i++) {

            if (!isWide[i] && crowdsWideNeighbour(ticks, isWide, i)) continue;

            kept.push(ticks[i]);
        }

        return areAllClear(kept) ? kept : null;
    };

    const crowdsWideNeighbour = (ticks, isWide, index) => {

        const rect = ticks[index].shortRect;

        if (index > 0 && isWide[index - 1]) {

            if (rect.left - LABEL_GAP_PX < ticks[index - 1].rect.right) return true;
        }

        if (index < ticks.length - 1 && isWide[index + 1]) {

            if (rect.right + LABEL_GAP_PX > ticks[index + 1].rect.left) return true;
        }

        return false;
    };

    /**
     * Gets a step's ticks without those crowding its first.  An axis rarely starts where a bucket
     * does - the first of August is no Monday - so its first label stands for a part-filled bucket
     * and can sit a day from the next, which would otherwise fail every step but the one the axis
     * happens to start on.
     */
    const dropCrowdingFirst = (ticks) => {

        if (ticks.length < 2) return ticks;

        const first = ticks[0];
        let index = 1;

        while (index < ticks.length) {

            const rect = getPrintedRect(ticks[index], getLastLine(first));

            if (rect.left - LABEL_GAP_PX >= first.rect.right) break;

            index++;
        }

        return index === 1 ? ticks : [first].concat(ticks.slice(index));
    };

    /**
     * The set of labels to show: every one of them where they all fit, and otherwise the finest
     * step they do fit at, thinned by distance if even the coarsest step is too crowded.
     */
    const chooseTicksToLabel = (ticks, props, result) => {

        // Labels pre-thinned to a step (see getLabellableDates) are that step's plus the coarser
        // steps' firsts, which together make no step at all, so are stepped from that one on.
        const firstLevelIndex = props.dateAxisLabelLevelIndex ?? -1;

        if (firstLevelIndex < 0) {

            const allFitting = fitAroundWideTicks(ticks);

            if (allFitting !== null) return allFitting;
        }

        const levels = getLevels(props.datePeriod);
        const isTimeOfDay = props.datePeriod <= Ren.DatePeriodEnum.Hour;
        let isDateOnlyLabelled = false;
        let coarsest = ticks;

        for (let i = Math.max(firstLevelIndex, 0); i < levels.length; i++) {

            if (isTimeOfDay && levels[i].isDateOnly && !isDateOnlyLabelled) {

                labelByDateOnly(ticks);
                isDateOnlyLabelled = true;
            }

            coarsest = dropCrowdingFirst(firstOfEachBucket(ticks, levels[i].bucket));
            result.level = levels[i].name;

            const fitting = fitAroundWideTicks(coarsest);

            if (fitting !== null) return fitting;
        }

        result.level += "-thinned";

        return thinToWhatFits(coarsest);
    };

    /**
     * The dates of an axis that are worth labelling at all: the finest of the steps above leaving
     * no more labels than the axis could print at its very narrowest, or null where every tick can
     * be labelled.
     *
     * This runs before the labels are drawn, since a chart binned by the quarter hour and showing
     * a month ticks nearly three thousand times, and every label drawn is a label this pass then
     * measures.  It only rules out labels that could never be printed however the axis is stepped;
     * which of the rest are actually shown is settled by measuring them, as ever.
     *
     * @returns {object} { times, levelIndex }: the times (as milliseconds) to label and the step
     *     they were thinned to (-1 for none), or null to label every tick.
     */
    const getLabellableDates = (dates, datePeriod, availableWidthPx) => {

        const maxLabels = Math.max(
            MIN_LABELS_LABELLED,
            Math.floor(availableWidthPx / (MIN_LABEL_WIDTH_PX + LABEL_GAP_PX))
        );

        if (dates.length <= maxLabels) return null;

        const ticks = [];

        for (let i = 0; i < dates.length; i++) ticks.push({ date: dates[i] });

        const levels = getLevels(datePeriod);
        let levelIndex = -1;
        let coarsest = ticks;

        for (let i = 0; i < levels.length; i++) {

            coarsest = firstOfEachBucket(ticks, levels[i].bucket);
            levelIndex = i;

            if (coarsest.length <= maxLabels) break;
        }

        // An axis with more years than it has room for - which no step can thin further - keeps
        // one label in every so many, evenly.
        const stride = Math.ceil(coarsest.length / maxLabels);
        const times = new Set();

        for (let i = 0; i < coarsest.length; i += stride) {

            times.add(coarsest[i].date.getTime());
        }

        // A coarser step's buckets need not start where this one's do - the first of a month is
        // rarely the first of a 3-day bucket - so their firsts are kept too, or a month would be
        // labelled at whichever day of it this step happened to keep.
        for (let i = levelIndex + 1; i < levels.length; i++) {

            const firsts = firstOfEachBucket(ticks, levels[i].bucket);

            for (let j = 0; j < firsts.length; j++) times.add(firsts[j].date.getTime());
        }

        return { times, levelIndex };
    };

    /**
     * Relabels time-of-day ticks by their date alone, as the day and the year on lines of their
     * own, and measures them again as printed: a step of a day or more labels days, not midnights.
     */
    const labelByDateOnly = (ticks) => {

        for (let i = 0; i < ticks.length; i++) {

            const dateLine = ticks[i].lines[ticks[i].lines.length - 1];
            const yearStart = dateLine.lastIndexOf(" ");
            const lines = yearStart < 0
                ? [dateLine]
                : [dateLine.substring(0, yearStart), dateLine.substring(yearStart + 1)];

            ticks[i].lines = lines;
            setTickLabelLines(ticks[i].textNode, lines);
        }

        measureTicks(ticks);
    };

    /**
     * Gets the space a label takes without its last line, as the span of its other lines' tspans.
     */
    const measureAllButLastLine = (textNode, rect) => {

        const tspans = textNode.querySelectorAll("tspan");

        if (tspans.length < 2) return rect;

        let left = Infinity;
        let right = -Infinity;

        for (let i = 0; i < tspans.length - 1; i++) {

            const tspanRect = tspans[i].getBoundingClientRect();

            if (tspanRect.left < left) left = tspanRect.left;
            if (tspanRect.right > right) right = tspanRect.right;
        }

        return { left, right };
    };

    /**
     * Reads a chart's date axis ticks, with each one's date, label and the space its label takes
     * on screen.  Every tick is shown with the whole of its label before any of them is measured.
     */
    const collectTicks = (props) => {

        const chartGroupNode = props.chartGroup;

        if (!chartGroupNode) return null;

        const tickNodes = chartGroupNode.querySelectorAll(".ren-x-axis g.tick");
        const ticks = [];

        for (let i = 0; i < tickNodes.length; i++) {

            const tickNode = tickNodes[i];
            const textNode = tickNode.querySelector("text");

            if (!textNode) continue;

            const date = Ren.Svg.getDatum(tickNode);

            if (!date || !date.getTime) continue;

            const lines = getLabelLines(tickNode, textNode);

            tickNode.style.display = "";
            textNode.style.display = "";
            setTickLabelLines(textNode, lines);

            ticks.push({ tickNode, textNode, date, lines, rect: null, shortRect: null });
        }

        return ticks;
    };

    /**
     * Measures every label after all of them have been printed, so that it costs one layout rather
     * than one per label.  Returns false where the labels measure as nothing.
     */
    const measureTicks = (ticks) => {

        for (let i = 0; i < ticks.length; i++) {

            const rect = ticks[i].textNode.getBoundingClientRect();

            if (rect.width === 0) return false;

            ticks[i].rect = rect;
            ticks[i].shortRect = measureAllButLastLine(ticks[i].textNode, rect);
        }

        return true;
    };

    /**
     * Settles which of a chart's date axis labels are shown, and prints each one's year only where
     * it differs from the year of the label before it.  Does nothing for a chart with no axis
     * drawn, or one whose labels cannot be measured.
     *
     * @param {object} props - The chart's props, holding the chart group the axis was drawn into
     *     and the period its dates are grouped by.
     * @returns {object} What the pass did, as { shown, hidden, yearsSuppressed, level }.
     */
    const declutter = (props) => {

        const state = prepare(props);

        measureLabels(state);
        apply(state);

        return lastResult;
    };

    /**
     * Shows every tick with the whole of its label, ready for measuring: the first of the three
     * steps declutter takes.  The steps are offered apart so that a caller with labels of its own
     * to measure can have them all measured in one layout, writing nothing in between.
     * @returns {object} What measure and apply take, or null for a chart with no axis drawn.
     */
    const prepare = (props) => {

        const result = { shown: 0, hidden: 0, yearsSuppressed: 0, level: "all" };
        lastResult = result;

        const ticks = collectTicks(props ?? {});

        if (ticks === null || ticks.length === 0) return null;

        return { props, result, ticks, isMeasured: false };
    };

    /** Measures the labels prepare showed, which costs one layout. */
    const measureLabels = (state) => {

        // A chart that is not on screen - one in a tab that is not showing, say - measures as
        // nothing, and there is no telling from that what would fit, so its labels are left alone
        // until it is laid out somewhere they can be measured.
        if (state) state.isMeasured = measureTicks(state.ticks);
    };

    /** Shows or hides each label as measured. */
    const apply = (state) => {

        if (!state || !state.isMeasured) return;

        const { props, result, ticks } = state;
        const ticksToLabel = chooseTicksToLabel(ticks, props, result);
        const shownTicks = new Set(ticksToLabel);

        for (let i = 0; i < ticks.length; i++) {

            if (shownTicks.has(ticks[i])) continue;

            // Only the label goes: the tick itself still marks where a period starts.
            ticks[i].textNode.style.display = "none";
            result.hidden++;
        }

        // The year (or, under a time of day, the date) sits on a line of its own, so it is dropped
        // from a label whose last line already stands under the label to its left.  A label of one
        // line is the year itself (a chart grouped by year), which is the whole of what that label
        // says and so is kept.
        let previousYearLine = null;

        for (let i = 0; i < ticksToLabel.length; i++) {

            const tick = ticksToLabel[i];
            const lines = tick.lines;

            result.shown++;

            if (lines.length < 2) continue;

            const yearLine = lines[lines.length - 1];

            if (yearLine === previousYearLine) {

                setTickLabelLines(tick.textNode, lines.slice(0, lines.length - 1));
                result.yearsSuppressed++;
            }

            previousYearLine = yearLine;
        }
    };

    return {
        declutter,
        prepare,
        measure: measureLabels,
        apply,
        getLabellableDates,
        setTickLabelLines,
        getDiagnostics
    };
})();
