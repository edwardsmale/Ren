/**
 * Turns the values a date/value chart has prepared into the ones it plots, where a series is set
 * to show a running total or a total for the year to date, or the chart to show each series per
 * day, as a share of each period's total, as an index of its first value or as its change on the
 * period before.
 *
 * The transforms are applied afresh on every redraw, to rows of their own, so the prepared data
 * are left as they were for the next redraw, which may have a series hidden or the transform off.
 * Values per day are taken first, so that a month of 28 days and one of 31 compare fairly whatever
 * else is shown of them.  A running total is next, so that shown as shares, the series share the
 * totals to date.  A total for the year to date is a running total that starts again each year,
 * and a rolling year's total is that of the year up to each period's end.
 * Shares, an index and changes are alternatives: where more than one is set, shares win, then an
 * index.
 */
Ren.DateValueChart_ValueTransforms = (() => {

    /**
     * Gets a value indicating whether a series is set to show its running total.
     */
    const isRunningTotal = (props, seriesIndex) =>
        props.series?.[seriesIndex]?.runningTotal === true;

    /**
     * Gets a value indicating whether the chart could show totals for the year to date: it bins
     * its dates into periods shorter than a year, over a range of dates rather than all time.
     */
    const canShowYearToDate = (props) => props.datePeriod < Ren.DatePeriodEnum.Year
        && !props.isAllTime
        && !props.showAsPies;

    /**
     * Gets a value indicating whether a series is set to show its total for the year to date.
     */
    const isYearToDate = (props, seriesIndex) =>
        props.series?.[seriesIndex]?.yearToDate === true && canShowYearToDate(props);

    /**
     * Gets a value indicating whether the chart could show totals over rolling years: it could
     * show totals for the year to date, binning its dates into days or longer.
     */
    const canShowRollingYearTotal = (props) => canShowYearToDate(props)
        && props.datePeriod >= Ren.DatePeriodEnum.Day;

    /**
     * Gets a value indicating whether a series is set to show its total for the rolling year to
     * each period's end.  A total for the year to date wins over it.
     */
    const isRollingYearTotal = (props, seriesIndex) =>
        props.series?.[seriesIndex]?.rollingYearTotal === true
        && !isYearToDate(props, seriesIndex)
        && canShowRollingYearTotal(props);

    /**
     * Gets a value indicating whether the chart shows its series as shares of each period's total.
     */
    const isShareOfTotal = (props) => props.showAsShareOfTotal === true;

    /**
     * Gets a value indicating whether the chart shows each series as an index of its first value.
     */
    const isIndexed = (props) => props.showAsIndex === true && !isShareOfTotal(props);

    /**
     * Gets a value indicating whether the chart shows each series as its change on the period
     * before.
     */
    const isChange = (props) => props.showAsChange === true
        && !isShareOfTotal(props)
        && !isIndexed(props);

    /**
     * Gets a value indicating whether the chart could show its values as their change on the year
     * before: it can draw the year before, binning its dates into days or longer over a range.
     */
    const canShowYearOnYearChange = (props) => Ren.DateValueChart_PreviousYear.isAvailable(props);

    /**
     * Gets a value indicating whether the chart shows each series as its change on the same period
     * a year before.  Shares, an index and changes on the period before win over it.
     */
    const isYearOnYearChange = (props) => props.showAsYearOnYearChange === true
        && !isShareOfTotal(props)
        && !isIndexed(props)
        && !isChange(props)
        && canShowYearOnYearChange(props);

    /**
     * Gets a value indicating whether the chart shows its values as changes of either kind.
     */
    const isAnyChange = (props) => isChange(props) || isYearOnYearChange(props);

    /**
     * Gets a value indicating whether the chart could show its values per day: it bins its dates
     * into weeks or longer, over a range of dates rather than all time.
     */
    const canShowPerDay = (props) => props.datePeriod >= Ren.DatePeriodEnum.Week
        && !props.isAllTime
        && !props.showAsPies;

    /**
     * Gets a value indicating whether a series is shown per day: the chart is set to show its
     * values so, and the series' are totals, which divide into days, rather than averages or
     * extremes, which are already as they would be for a day.
     */
    const isPerDay = (props, seriesIndex) => {

        if (props.showPerDay !== true || !canShowPerDay(props)) return false;

        const columnKey = props.seriesSourceHeadings?.[seriesIndex]
            ?? props.valueHeadings[seriesIndex];

        return Ren.DateValueChart_LastPeriodEstimate.isScalableAggregation(
            props.visualisation,
            columnKey
        );
    };

    /**
     * Gets a value indicating whether the chart plots anything other than its prepared values.
     */
    const hasTransforms = (props) => {

        if (isShareOfTotal(props) || isIndexed(props) || isAnyChange(props)) return true;

        if (props.showPerDay === true && canShowPerDay(props)) return true;

        for (let i = 0; i < props.seriesCount; i++) {

            if (isRunningTotal(props, i) || isYearToDate(props, i)) return true;

            if (isRollingYearTotal(props, i)) return true;
        }

        return false;
    };

    /**
     * Replaces a column's values with their average per day over each row's period.  A period
     * still running at the time given is averaged over the days it has had so far, today included,
     * so that it is not read as a fall; with no time given every period counts as over.
     */
    const applyPerDay = (rows, heading, dateHeading, datePeriod, now) => {

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][heading];
            const date = rows[i][dateHeading];

            if (typeof value !== "number" || !isFinite(value)) continue;

            if (!(date instanceof Date) || isNaN(date.getTime())) {

                rows[i][heading] = null;
                continue;
            }

            let days = Math.round(Ren.DateUtils.daysInPeriod(date, datePeriod));

            if (now && now.getTime() >= date.getTime()) {

                const daysSoFar = Math.floor(Ren.DateUtils.daysBetween(date, now)) + 1;

                days = Math.min(days, daysSoFar);
            }

            rows[i][heading] = days > 0 ? value / days : null;
        }
    };

    /**
     * Replaces a column's values with its running totals, in the rows' order.  A period without a
     * value carries the total so far, except before the first value, where there is no total yet.
     */
    const applyRunningTotal = (rows, heading) => {

        let total = null;

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][heading];

            if (typeof value === "number" && isFinite(value)) {
                total = (total ?? 0) + value;
            }

            rows[i][heading] = total;
        }
    };

    const isDate = value => value instanceof Date && !isNaN(value.getTime());

    // Periods are a day or longer, so a year's start is matched to within half a day, which a
    // change of the clocks, an hour, falls well inside.
    const HALF_DAY = 12 * 60 * 60 * 1000;

    /**
     * Replaces a column's values with their totals over the year to each period's end: a year of
     * monthly periods ending with December sums January to December.  A period less than a year
     * after the first row, whose year reaches back before the rows, has no total.  The periods
     * are a day or longer.
     */
    const applyRollingYearTotal = (rows, heading, dateHeading, datePeriod) => {

        const values = new Array(rows.length);

        for (let i = 0; i < rows.length; i++) {
            values[i] = rows[i][heading];
        }

        const firstDate = rows.length > 0 ? rows[0][dateHeading] : null;
        let start = 0;
        let total = 0;

        for (let i = 0; i < rows.length; i++) {

            if (typeof values[i] === "number" && isFinite(values[i])) total += values[i];

            const date = rows[i][dateHeading];

            if (!isDate(date) || !isDate(firstDate)) {

                rows[i][heading] = null;
                continue;
            }

            const periodEnd = new Date(Ren.DateUtils.addPeriod(date, datePeriod).getTime());

            periodEnd.setFullYear(periodEnd.getFullYear() - 1);

            const yearStart = periodEnd.getTime();

            while (start < i && isDate(rows[start][dateHeading])
                && rows[start][dateHeading].getTime() < yearStart - HALF_DAY) {

                if (typeof values[start] === "number" && isFinite(values[start])) {
                    total -= values[start];
                }

                start++;
            }

            rows[i][heading] = firstDate.getTime() <= yearStart + HALF_DAY ? total : null;
        }
    };

    /**
     * Replaces a column's values with its totals for the year to date, in the rows' order, which
     * start again with each year's first row.  As with a running total, a period without a value
     * carries the total so far, except before the year's first value.
     */
    const applyYearToDate = (rows, heading, dateHeading) => {

        let total = null;
        let year = null;

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][heading];
            const date = rows[i][dateHeading];
            const rowYear = date instanceof Date && !isNaN(date.getTime())
                ? date.getFullYear()
                : year;

            if (rowYear !== year) {

                total = null;
                year = rowYear;
            }

            if (typeof value === "number" && isFinite(value)) {
                total = (total ?? 0) + value;
            }

            rows[i][heading] = total;
        }
    };

    /**
     * Replaces each of the given columns' values with its share of the row's total over them.  A
     * row totalling nothing has no shares, as a share of nothing is not a number.
     */
    const applyShareOfTotal = (rows, headings) => {

        for (let i = 0; i < rows.length; i++) {

            const row = rows[i];
            let total = 0;

            for (let j = 0; j < headings.length; j++) {

                const value = row[headings[j]];

                if (typeof value === "number" && isFinite(value)) total += value;
            }

            for (let j = 0; j < headings.length; j++) {

                const value = row[headings[j]];

                row[headings[j]] = total !== 0 && typeof value === "number" && isFinite(value)
                    ? value / total
                    : null;
            }
        }
    };

    /**
     * Replaces a column's values with an index of them, its first value other than nothing being
     * 100.  A column with no such value has no index.
     */
    const applyIndex = (rows, heading) => {

        let base = null;

        for (let i = 0; i < rows.length && base === null; i++) {

            const value = rows[i][heading];

            if (typeof value === "number" && isFinite(value) && value !== 0) base = value;
        }

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][heading];

            rows[i][heading] = base !== null && typeof value === "number" && isFinite(value)
                ? value / base * 100
                : null;
        }
    };

    /**
     * Replaces a column's values with their change on the row before, as a fraction of it.  The
     * first row has nothing to change from, nor has a row following one without a value or with
     * nothing, as a change on nothing is not a number.  A change from below nothing is taken on
     * its size, so that a rise reads as one whatever the sign.
     */
    const applyChange = (rows, heading) => {

        let previous = null;

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][heading];
            const isValue = typeof value === "number" && isFinite(value);

            rows[i][heading] = isValue && previous !== null && previous !== 0
                ? (value - previous) / Math.abs(previous)
                : null;

            previous = isValue ? value : null;
        }
    };

    const getDateKey = value => value instanceof Date ? value.getTime() : String(value);

    /**
     * Replaces a column's values with their change on the same period a year before, as a fraction
     * of it, from the year before's rows, each dated at the period it is compared with.  A period
     * with no value, or none or nothing a year before, has no change.
     */
    const applyYearOnYearChange = (rows, heading, dateHeading, earlierRows) => {

        const earlierValues = new Map();

        for (let i = 0; i < earlierRows.length; i++) {
            earlierValues.set(getDateKey(earlierRows[i][dateHeading]), earlierRows[i][heading]);
        }

        for (let i = 0; i < rows.length; i++) {

            const value = rows[i][heading];
            const earlier = earlierValues.get(getDateKey(rows[i][dateHeading]));
            const isValue = typeof value === "number" && isFinite(value);
            const isEarlier = typeof earlier === "number" && isFinite(earlier) && earlier !== 0;

            rows[i][heading] = isValue && isEarlier ? (value - earlier) / Math.abs(earlier) : null;
        }
    };

    /**
     * Gets the year before's rows, prepared and transformed as the chart's own are, so that a
     * running total is compared with the running total a year before.
     */
    const getYearBeforeRows = (props) => {

        const rows = Ren.DateValueChart_GroupingApplyer.getPreviousYearRows(
            props.previousYearInputData,
            props.previousYearGroupingEntry
        );

        if (rows.length === 0) return [];

        const prepared = Ren.CreateDateValueChart_PrepareData.prepareData(
            props.previousYearInputData,
            Object.assign({}, props, { preGroupedData: rows })
        );

        return transform(props, prepared || [], true);
    };

    /**
     * Gets the rows a chart plots from the rows it has prepared: the same rows where nothing is
     * transformed, and otherwise copies of them holding the transformed values.  The shares are
     * of the series drawn, so hiding a series shares each period out among those left.
     *
     * @param {boolean} [isPreviousYear] - Whether the rows are the year before's, whose periods
     *     are all over, though drawn at this year's dates.
     */
    const transform = (props, data, isPreviousYear) => {

        if (!data || data.length === 0 || !hasTransforms(props)) return data;

        const earlierRows = !isPreviousYear && isYearOnYearChange(props)
            ? getYearBeforeRows(props)
            : null;

        const rows = new Array(data.length);

        for (let i = 0; i < data.length; i++) {
            rows[i] = Object.assign({}, data[i]);
        }

        const sharedHeadings = [];
        const now = isPreviousYear ? null : new Date();

        for (let i = 0; i < props.seriesCount; i++) {

            const heading = props.valueHeadings[i];

            if (isPerDay(props, i)) {
                applyPerDay(rows, heading, props.dateHeading, props.datePeriod, now);
            }

            if (isYearToDate(props, i)) {
                applyYearToDate(rows, heading, props.dateHeading);
            }
            else if (isRollingYearTotal(props, i)) {

                applyRollingYearTotal(rows, heading, props.dateHeading, props.datePeriod);
            }
            else if (isRunningTotal(props, i)) {

                applyRunningTotal(rows, heading);
            }

            if (isIndexed(props)) applyIndex(rows, heading);

            if (isChange(props)) applyChange(rows, heading);

            if (earlierRows) {
                applyYearOnYearChange(rows, heading, props.dateHeading, earlierRows);
            }

            if (props.series[i]?.isEnabled !== false) sharedHeadings.push(heading);
        }

        if (isShareOfTotal(props)) applyShareOfTotal(rows, sharedHeadings);

        return rows;
    };

    /**
     * Gives a series of whole numbers shown per day a plain number format, as its averages have
     * fractions.
     */
    const applyPerDayFormats = (props) => {

        for (let i = 0; i < props.seriesCount; i++) {

            if (isPerDay(props, i)
                && props.valueColumnFormats[i] === Ren.SpreadsheetColumnFormatEnum.Integer) {

                props.valueColumnFormats[i] = Ren.SpreadsheetColumnFormatEnum.Number;
            }
        }
    };

    /**
     * Gives the series and the axes a percentage format, where the chart shows shares or changes,
     * and a plain number format, where it shows an index, as none is in the columns' own units.
     * The formats are put back by the chart being built again, as turning any off does.
     */
    const applyTransformFormats = (props) => {

        let format;

        if (isShareOfTotal(props) || isAnyChange(props)) {
            format = Ren.SpreadsheetColumnFormatEnum.Percentage;
        }
        else if (isIndexed(props)) {

            format = Ren.SpreadsheetColumnFormatEnum.Number;
        }
        else {

            applyPerDayFormats(props);
            return;
        }

        for (let i = 0; i < props.seriesCount; i++) {

            props.valueColumnFormats[i] = format;
            props.valueColumnFormatFunctions[i] = null;
        }

        const axisNames = Object.keys(props.axes);

        for (let i = 0; i < axisNames.length; i++) {
            props.axes[axisNames[i]].tickFormats = { format, formatFunction: null };
        }
    };

    /**
     * Gets a value indicating whether a series' plotted values are its own, rather than totals to
     * date or for the year to date, shares, changes or averages per day, which an estimate of the
     * last period would scale up as if they were.
     */
    const isPlottedAsPrepared = (props, seriesIndex) => !isShareOfTotal(props)
        && !isAnyChange(props)
        && !isRunningTotal(props, seriesIndex)
        && !isYearToDate(props, seriesIndex)
        && !isRollingYearTotal(props, seriesIndex)
        && !isPerDay(props, seriesIndex);

    return {
        isRunningTotal,
        canShowYearToDate,
        isYearToDate,
        canShowRollingYearTotal,
        isRollingYearTotal,
        isShareOfTotal,
        isIndexed,
        isChange,
        canShowYearOnYearChange,
        isYearOnYearChange,
        isAnyChange,
        canShowPerDay,
        isPerDay,
        hasTransforms,
        applyPerDay,
        applyRunningTotal,
        applyYearToDate,
        applyRollingYearTotal,
        applyShareOfTotal,
        applyIndex,
        applyChange,
        applyYearOnYearChange,
        transform,
        applyTransformFormats,
        isPlottedAsPrepared
    };
})();
