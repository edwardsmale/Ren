Ren.DateRangeSummariser = (() => {

    const ymdEqual = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;

    const isYearStart = (ymd) => ymd.m === 1 && ymd.d === 1;

    const isQuarterStart = (ymd) => ymd.d === 1 && (ymd.m === 1 || ymd.m === 4 || ymd.m === 7 || ymd.m === 10);

    const isMonthStart = (ymd) => ymd.d === 1;

    const nextYearStart = (ymd) => ({ y: ymd.y + 1, m: 1, d: 1 });

    const nextQuarterStart = (ymd) => {

        let m = ymd.m + 3, y = ymd.y;

        if (m > 12) { m -= 12; y++; }
        return { y, m, d: 1 };
    };

    const nextMonthStart = (ymd) => {

        let m = ymd.m + 1, y = ymd.y;

        if (m > 12) { m = 1; y++; }
        return { y, m, d: 1 };
    };

    const nextDay = (ymd) => Ren.DateUtils.toYmd(new Date(ymd.y, ymd.m - 1, ymd.d + 1));

    const quarterNumber =(ymd) => Math.floor((ymd.m - 1) / 3) + 1;

    const isTD = (summary) => summary.endsWith(" to date");

    // True if the compare range mirrors the primary's position (same period-type start and same
    // relative end day) but in an earlier year — i.e. "the same period in [year]".
    const isSamePeriodPriorYear = (start, end, cStart, cEnd) => {

        if (cStart.y >= start.y) return false;
        if (end.m !== cEnd.m || end.d !== cEnd.d) return false;
        if (isYearStart(start) && isYearStart(cStart)) return true;
        if (isQuarterStart(start) && isQuarterStart(cStart) && quarterNumber(start) === quarterNumber(cStart)) return true;
        if (isMonthStart(start) && isMonthStart(cStart) && start.m === cStart.m) return true;
        return false;
    };

    const monthYearLabel = (ymd, useFullMonthNames) => {

        const names = useFullMonthNames ? Ren.DateUtils.monthNames : Ren.DateUtils.monthNamesAbbrv;
        return names[ymd.m - 1] + " " + ymd.y;
    };

    // Returns a period label for the compare start that matches the granularity of the primary *TD.
    const periodLabelForTD = (tdSummary, cStart, useFullMonthNames) => {

        if (/^\d/.test(tdSummary) && isYearStart(cStart)) return String(cStart.y);
        if (tdSummary.startsWith("Q") && isQuarterStart(cStart)) return "Q" + quarterNumber(cStart) + " " + cStart.y;
        if (isMonthStart(cStart)) return monthYearLabel(cStart, useFullMonthNames);
        return null;
    };

    /**
     * Returns a human-readable summary of a date range, such as "Today", "Q2 2026", "Q2 2026 to date",
     * "2025", "2026 to date", "Oct 2026", or "Jun 2026 to date".  Returns null if the range does
     * not align to a recognised period.
     * @param {Date|string} startDate - Start of the range (inclusive).  Date, yyyy-MM-dd, or
     *   yyyy-MM-dd HH:mm:ss.
     * @param {Date|string} endDate - End of the range (exclusive).  Date, yyyy-MM-dd, or
     *   yyyy-MM-dd HH:mm:ss.
     * @param {Date|string} [currentDate] - Date to treat as today.  Defaults to the actual current
     *   date.
     * @param {boolean} [useFullMonthNames] - True to write months in full ("October 2026") rather
     *   than abbreviated ("Oct 2026").
     * @returns {string|null}
     */
    const getDateRangeSummary = (startDate, endDate, currentDate, useFullMonthNames) => {

        const start = Ren.DateUtils.toYmd(startDate);
        const end = Ren.DateUtils.toYmd(endDate);

        if (!start || !end) return null;

        const today = currentDate ? Ren.DateUtils.toYmd(currentDate) : Ren.DateUtils.toYmd(Ren.DateUtils.todayAsSortableDate());
        const endIsToday = ymdEqual(end, today);

        if (ymdEqual(start, today) && ymdEqual(end, nextDay(today))) return "Today";

        if (isYearStart(start)) {

            if (endIsToday && start.y === today.y) return String(start.y) + " to date";
            if (ymdEqual(end, nextYearStart(start))) return String(start.y);
        }

        if (isQuarterStart(start)) {

            const curQStart = { y: today.y, m: Math.floor((today.m - 1) / 3) * 3 + 1, d: 1 };
            if (endIsToday && ymdEqual(start, curQStart)) return "Q" + quarterNumber(start) + " " + start.y + " to date";
            if (ymdEqual(end, nextQuarterStart(start))) return "Q" + quarterNumber(start) + " " + start.y;
        }

        if (isMonthStart(start)) {

            const curMonthStart = { y: today.y, m: today.m, d: 1 };
            if (endIsToday && ymdEqual(start, curMonthStart)) return monthYearLabel(start, useFullMonthNames) + " to date";
            if (ymdEqual(end, nextMonthStart(start))) return monthYearLabel(start, useFullMonthNames);
        }

        return null;
    };

    /**
     * Returns human-readable summaries for a primary and comparison date range as an object with
     * two properties: { dateRangeSummary, compareDateRangeSummary }.  For example:
     *   { dateRangeSummary: "Q2 2026", compareDateRangeSummary: "Q2 2025" } { dateRangeSummary: "Q2
     *   2026 to date", compareDateRangeSummary: "the same period in 2025" } { dateRangeSummary: "Q2
     *   2026 to date", compareDateRangeSummary: "the same date range in Q1 2026" }
     * Returns null if the primary range does not align to a recognised period.
     * @param {Date|string} startDate - Start of the primary range (inclusive).
     * @param {Date|string} endDate - End of the primary range (exclusive).
     * @param {Date|string} compareStartDate - Start of the comparison range (inclusive).
     * @param {Date|string} compareEndDate - End of the comparison range (exclusive).
     * @param {Date|string} [currentDate] - Date to treat as today.  Defaults to the actual current
     *   date.
     * @param {boolean} [useFullMonthNames] - True to write months in full rather than abbreviated.
     * @returns {{ dateRangeSummary: string, compareDateRangeSummary: string }|null}
     */
    const getDateRangeComparisonSummary = (
        startDate, endDate, compareStartDate, compareEndDate, currentDate, useFullMonthNames
    ) => {

        const start = Ren.DateUtils.toYmd(startDate);
        const end = Ren.DateUtils.toYmd(endDate);
        const cStart = Ren.DateUtils.toYmd(compareStartDate);
        const cEnd = Ren.DateUtils.toYmd(compareEndDate);

        if (!start || !end || !cStart || !cEnd) return null;

        const primarySummary = getDateRangeSummary(startDate, endDate, currentDate, useFullMonthNames);
        if (!primarySummary) return null;

        if (isTD(primarySummary)) {

            if (isSamePeriodPriorYear(start, end, cStart, cEnd)) {

                return {
                    dateRangeSummary: primarySummary,
                    compareDateRangeSummary: "the same period in " + cStart.y
                };
            }

            const compareLabel = periodLabelForTD(primarySummary, cStart, useFullMonthNames);

            if (compareLabel) {

                return {
                    dateRangeSummary: primarySummary,
                    compareDateRangeSummary: "the same date range in " + compareLabel
                };
            }

        }
        else {

            const compareSummary = getDateRangeSummary(
                compareStartDate,
                compareEndDate,
                currentDate,
                useFullMonthNames
            );

            if (compareSummary) {

                return {
                    dateRangeSummary: primarySummary,
                    compareDateRangeSummary: compareSummary
                };
            }
        }

        return null;
    };

    return { getDateRangeSummary, getDateRangeComparisonSummary };
})();
