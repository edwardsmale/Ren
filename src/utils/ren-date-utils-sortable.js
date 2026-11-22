/**
 * Date helpers working on yyyy-MM-dd (and yyyy-MM-dd HH:mm:ss) sortable date strings, including the
 * fast paths that read them straight from their character codes.
 */
Ren.DateUtils_Sortable = (() => {

    const {
        formatSortableYmd,
        getMaxDay,
        MILLISECONDS_PER_DAY,
        pad2,
        parseYYYYMMDD,
        today,
        toSortableDate
    } = Ren.DateUtils_Core;

    const {
        addDays,
        daysBetween,
        startOfCurrentMonth,
        startOfCurrentQuarter,
        startOfCurrentWeek,
        startOfCurrentYear,
        startOfDay,
        startOfMonth,
        startOfQuarter,
        startOfWeek,
        startOfYear
    } = Ren.DateUtils_Periods;

    /**
     * First month of the quarter each month (1-12) falls in, as it appears in a sortable date.
     */
    const quarterStartMonthDigits = [
        "", "01", "01", "01", "04", "04", "04", "07", "07", "07", "10", "10", "10"
    ];

    /**
     * Gets today's date as a yyyy-MM-dd string.
     * @returns {string}
     */
    const todayAsSortableDate = () => toSortableDate(today());

    /**
     * Removes the time component from a yyyy-MM-dd HH:mm:ss string, returning just the yyyy-MM-dd
     * part.
     * @param {string} sortableDate
     * @returns {string}
     */
    const removeTimeComponent = (sortableDate) => {

        if (!sortableDate || sortableDate.length < 10) return sortableDate;

        return sortableDate.substring(0, 10);
    };

    /**
     * Gets the start of the current week as yyyy-MM-dd string.
     * @returns {string}
     */
    const startOfCurrentWeekAsSortableDate = () => toSortableDate(startOfCurrentWeek());

    /**
     * Gets the start of the current month as yyyy-MM-dd string.
     * @returns {string}
     */
    const startOfCurrentMonthAsSortableDate = () => toSortableDate(startOfCurrentMonth());

    /**
     * Gets the start of the current quarter as yyyy-MM-dd string.
     * @returns {string}
     */
    const startOfCurrentQuarterAsSortableDate = () => toSortableDate(startOfCurrentQuarter());

    /**
     * Gets the start of the current year as yyyy-MM-dd string.
     * @returns {string}
     */
    const startOfCurrentYearAsSortableDate = () => toSortableDate(startOfCurrentYear());

    /**
     * Adds a number of days to a sortable date string.
     * @param {string} sortableDate
     * @param {number} days
     * @returns {string}
     */
    const addDaysToSortableDate = (sortableDate, days) => toSortableDate(
        addDays(parseYYYYMMDD(sortableDate), days)
    );

    /**
     * Adds a number of weeks to a sortable date string.
     * @param {string} sortableDate
     * @param {number} weeks
     * @returns {string}
     */
    const addWeeksToSortableDate = (sortableDate, weeks) => addDaysToSortableDate(
        sortableDate,
        weeks * 7
    );

    /**
     * Gets the number of days between two sortable date strings.
     * @param {string} s1
     * @param {string} s2
     * @returns {number}
     */
    const daysBetweenSortableDates = (s1, s2) => daysBetween(parseYYYYMMDD(s1), parseYYYYMMDD(s2));

    /**
     * Reads the date of a yyyy-MM-dd or yyyy-MM-dd HH:mm:ss string straight from its character
     * codes, packed as the number yyyyMMdd so that reading it allocates nothing, or returns -1 for
     * anything else, including an out-of-range date.
     * @param {*} value
     * @returns {number}
     */
    const readSortableYmd = (value) => {

        if (typeof value !== "string") return -1;

        const length = value.length;

        if ((length !== 10 && length !== 19)
            || value.charCodeAt(4) !== 45 || value.charCodeAt(7) !== 45) {

            return -1;
        }

        const y0 = value.charCodeAt(0) - 48, y1 = value.charCodeAt(1) - 48;
        const y2 = value.charCodeAt(2) - 48, y3 = value.charCodeAt(3) - 48;
        const m0 = value.charCodeAt(5) - 48, m1 = value.charCodeAt(6) - 48;
        const d0 = value.charCodeAt(8) - 48, d1 = value.charCodeAt(9) - 48;

        // The unsigned shift turns a character below "0" into a huge number, so each check is one
        // comparison.
        if (y0 < 1 || y0 > 9 || y1 >>> 0 > 9 || y2 >>> 0 > 9 || y3 >>> 0 > 9
            || m0 >>> 0 > 1 || m1 >>> 0 > 9 || d0 >>> 0 > 3 || d1 >>> 0 > 9) {

            return -1;
        }

        const y = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
        const m = m0 * 10 + m1;
        const d = d0 * 10 + d1;

        if (m < 1 || m > 12 || d < 1 || d > getMaxDay(y, m)) return -1;

        return y * 10000 + m * 100 + d;
    };

    /**
     * Gets the start of the day a Date or sortable date string falls in, as yyyy-MM-dd.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfDay = (date) => {

        if (readSortableYmd(date) === -1) return toSortableDate(startOfDay(date));

        return date.substring(0, 10);
    };

    /**
     * Gets the start of the week (Monday) a Date or sortable date string falls in, as yyyy-MM-dd.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfWeek = (date) => {

        const ymd = readSortableYmd(date);

        if (ymd === -1) return toSortableDate(startOfWeek(date));

        let y = Math.floor(ymd / 10000), m = Math.floor(ymd / 100) % 100, d = ymd % 100;

        // 1 January 1970 was a Thursday, three days after a Monday.
        const daysSinceEpoch = Math.floor(Date.UTC(y, m - 1, d) / MILLISECONDS_PER_DAY);

        d -= ((daysSinceEpoch + 3) % 7 + 7) % 7;

        if (d < 1) {

            m--;

            if (m < 1) {

                y--;
                m = 12;
            }

            d += getMaxDay(y, m);
        }

        return formatSortableYmd(y, m, d);
    };

    /**
     * Gets the start of the month a Date or sortable date string falls in, as yyyy-MM-dd.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfMonth = (date) => {

        if (readSortableYmd(date) === -1) return toSortableDate(startOfMonth(date));

        return date.substring(0, 8) + "01";
    };

    /**
     * Gets the start of the quarter a Date or sortable date string falls in, as yyyy-MM-dd.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfQuarter = (date) => {

        const ymd = readSortableYmd(date);

        if (ymd === -1) return toSortableDate(startOfQuarter(date));

        return date.substring(0, 5) + quarterStartMonthDigits[Math.floor(ymd / 100) % 100] + "-01";
    };

    /**
     * Gets the start of the year a Date or sortable date string falls in, as yyyy-MM-dd.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfYear = (date) => {

        if (readSortableYmd(date) === -1) return toSortableDate(startOfYear(date));

        return date.substring(0, 5) + "01-01";
    };

    /**
     * Gets the start of the period shorter than a day that a Date or date/time string falls in, as
     * yyyy-MM-dd HH:mm:ss.  The period is given as the number of the string's leading characters
     * it keeps: 13 for an hour, 16 for a minute and 19 for a second.
     * @param {Date|string} date
     * @param {number} keptLength
     * @returns {string|null}
     */
    const toSortableStartOfSubDayPeriod = (date, keptLength) => {

        if (!date || date === Ren.NullSentinel) return null;

        const truncate = (sortable) =>
            sortable.substring(0, 10) + " " + sortable.substring(11, keptLength)
            + ":00:00".substring(0, 19 - keptLength);

        if (readSortableYmd(date) !== -1) {
            return truncate(date.length === 10 ? date + " 00:00:00" : date);
        }

        // A Date's local parts are its wall-clock time, as dates are parsed with BST removed.
        const parsed = typeof date === "string"
            ? Ren.DateUtils_Parsing.parseDateTimeUniversal(date, true)
            : date;

        if (!parsed || !parsed.getFullYear || isNaN(parsed.getTime())) return null;

        return truncate(
            formatSortableYmd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
            + " " + pad2(parsed.getHours())
            + ":" + pad2(parsed.getMinutes())
            + ":" + pad2(parsed.getSeconds())
        );
    };

    /**
     * Gets the start of the hour a Date or date/time string falls in, as yyyy-MM-dd HH:mm:ss.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfHour = (date) => toSortableStartOfSubDayPeriod(date, 13);

    /**
     * Gets the start of the minute a Date or date/time string falls in, as yyyy-MM-dd HH:mm:ss.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfMinute = (date) => toSortableStartOfSubDayPeriod(date, 16);

    /**
     * Gets the start of the quarter hour (:00, :15, :30 or :45) a Date or date/time string falls
     * in, as yyyy-MM-dd HH:mm:ss.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfQuarterHour = (date) => {

        const startOfMinute = toSortableStartOfMinute(date);

        if (!startOfMinute) return null;

        const minutes = Number(startOfMinute.substring(14, 16));

        return startOfMinute.substring(0, 14) + pad2(minutes - minutes % 15) + ":00";
    };

    /**
     * Gets the start of the second a Date or date/time string falls in, as yyyy-MM-dd HH:mm:ss.
     * @param {Date|string} date
     * @returns {string|null}
     */
    const toSortableStartOfSecond = (date) => toSortableStartOfSubDayPeriod(date, 19);

    /**
     * Gets the start of a period a Date or sortable date string falls in, as yyyy-MM-dd, or as
     * yyyy-MM-dd HH:mm:ss for a period shorter than a day.
     * @param {Date|string} date
     * @param {Ren.DatePeriodEnum} datePeriod
     * @returns {string|null}
     */
    const toSortableStartOfPeriod = (date, datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second: return toSortableStartOfSecond(date);
            case Ren.DatePeriodEnum.Minute: return toSortableStartOfMinute(date);
            case Ren.DatePeriodEnum.QuarterHour: return toSortableStartOfQuarterHour(date);
            case Ren.DatePeriodEnum.Hour: return toSortableStartOfHour(date);
            case Ren.DatePeriodEnum.Day: return toSortableStartOfDay(date);
            case Ren.DatePeriodEnum.Week: return toSortableStartOfWeek(date);
            case Ren.DatePeriodEnum.Month: return toSortableStartOfMonth(date);
            case Ren.DatePeriodEnum.Quarter: return toSortableStartOfQuarter(date);
            case Ren.DatePeriodEnum.Year: return toSortableStartOfYear(date);
        }
    };

    return {
        addDaysToSortableDate,
        addWeeksToSortableDate,
        daysBetweenSortableDates,
        readSortableYmd,
        removeTimeComponent,
        startOfCurrentMonthAsSortableDate,
        startOfCurrentQuarterAsSortableDate,
        startOfCurrentWeekAsSortableDate,
        startOfCurrentYearAsSortableDate,
        todayAsSortableDate,
        toSortableStartOfDay,
        toSortableStartOfHour,
        toSortableStartOfMinute,
        toSortableStartOfMonth,
        toSortableStartOfPeriod,
        toSortableStartOfQuarter,
        toSortableStartOfQuarterHour,
        toSortableStartOfSecond,
        toSortableStartOfWeek,
        toSortableStartOfYear
    };
})();
