/**
 * Date helpers for date arithmetic and for the periods, from seconds to years, dates fall in.
 */
Ren.DateUtils_Periods = (() => {

    const {
        createDate,
        currentMonth,
        currentYear,
        formatSortableYmd,
        getMaxDay,
        isLeapYear,
        MILLISECONDS_PER_DAY,
        parseSortableDate,
        parseYYYYMMDD,
        today,
        toYmd
    } = Ren.DateUtils_Core;

    const MILLISECONDS_PER_SECOND = 1000;
    const MILLISECONDS_PER_MINUTE = 60000;
    const MILLISECONDS_PER_QUARTER_HOUR = 900000;
    const MILLISECONDS_PER_HOUR = 3600000;

    // --- Arithmetic helpers ---

    /**
     * Adds months, quarters, or years to a date or sortable date string.
     * @param {Date|string} date
     * @param {number} n
     * @param {string} unit ("months", "quarters", or "years")
     * @returns {Date|string|null}
     */
    const addToDate = (date, n, unit) => {

        if (!date || date === Ren.NullSentinel) return null;

        const ymd = toYmd(date);

        if (ymd === null) return null;

        let { y, m, d } = ymd;

        switch (unit) {

            case "months": m += n; break;
            case "quarters": m += n * 3; break;
            case "years": y += n; break;
        }

        while (m > 12) { y++; m -= 12; }

        while (m < 1) { y--; m += 12; }

        d = Math.min(d, getMaxDay(y, m));

        return typeof date === "string" ? formatSortableYmd(y, m, d) : createDate(y, m, d);
    };

    /**
     * Adds a number of days to a Date.
     * @param {Date} date
     * @param {number} days
     * @returns {Date}
     */
    const addDays = (date, days) => {

        const d = new Date(date.valueOf());
        d.setDate(d.getDate() + Math.floor(days));

        if (days % 1 !== 0) {

            const fraction = days % 1;
            d.setHours(d.getHours() + Math.floor(fraction * 24));
            d.setMinutes(
                d.getMinutes() + Math.floor((fraction * 24 - Math.floor(fraction * 24)) * 60)
            );
        }

        return d;
    };

    /**
     * Adds a number of months to a date or sortable date string.
     * @param {Date|string} date
     * @param {number} months
     * @returns {Date|string}
     */
    const addMonths = (date, months) => addToDate(date, months, "months");

    /**
     * Adds a number of quarters to a date or sortable date string.
     * @param {Date|string} date
     * @param {number} quarters
     * @returns {Date|string}
     */
    const addQuarters = (date, quarters) => addToDate(date, quarters, "quarters");

    /**
     * Adds a number of years to a Date or sortable date string.
     * @param {Date|string} date
     * @param {number} years
     * @returns {Date|string}
     */
    const addYears = (date, years) => addToDate(date, years, "years");

    /**
     * Adds a number of milliseconds to a Date.
     * @param {Date} date
     * @param {number} milliseconds
     * @returns {Date}
     */
    const addMilliseconds = (date, milliseconds) => new Date(date.getTime() + milliseconds);

    /**
     * Adds a period (second up to year) to a Date, or a period from a day up to a sortable date
     * string.
     * @param {Date|string} date
     * @param {Ren.DatePeriodEnum} datePeriod
     * @returns {Date|string}
     */
    const addPeriod = (date, datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second: return addMilliseconds(date, MILLISECONDS_PER_SECOND);
            case Ren.DatePeriodEnum.Minute: return addMilliseconds(date, MILLISECONDS_PER_MINUTE);
            case Ren.DatePeriodEnum.QuarterHour:
                return addMilliseconds(date, MILLISECONDS_PER_QUARTER_HOUR);
            case Ren.DatePeriodEnum.Hour: return addMilliseconds(date, MILLISECONDS_PER_HOUR);
            case Ren.DatePeriodEnum.Day: return addDays(date, 1);
            case Ren.DatePeriodEnum.Week: return addDays(date, 7);
            case Ren.DatePeriodEnum.Month: return addMonths(date, 1);
            case Ren.DatePeriodEnum.Quarter: return addQuarters(date, 1);
            case Ren.DatePeriodEnum.Year: return addYears(date, 1);
        }
    };

    /**
     * Gets the number of days between two dates.
     * @param {Date} date1
     * @param {Date} date2
     * @returns {number}
     */
    const daysBetween = (date1, date2) =>
        (date2.getTime() - date1.getTime()) / MILLISECONDS_PER_DAY;

    // --- Period helpers ---

    /**
     * Gets the number of days in the month of a Date.
     * @param {Date} date
     * @returns {number}
     */
    const daysInMonth = (date) => getMaxDay(date.getFullYear(), date.getMonth() + 1);

    /**
     * Gets the quarter number (1-4) for a Date.
     * @param {Date} date
     * @returns {number}
     */
    const quarterNumber = (date) => Math.floor(date.getMonth() / 3) + 1;

    /**
     * Gets the number of days in the quarter of a Date.
     * @param {Date} date
     * @returns {number}
     */
    const daysInQuarter = (date) => {

        const y = date.getFullYear(), firstMonth = (quarterNumber(date) - 1) * 3 + 1;
        let days = 0;

        for (let i = 0; i < 3; i++) {

            days += getMaxDay(y, firstMonth + i);
        }

        return days;
    };

    /**
     * Gets the number of days in the year of a Date.
     * @param {Date} date
     * @returns {number}
     */
    const daysInYear = (date) => isLeapYear(date.getFullYear()) ? 366 : 365;

    /**
     * Gets Easter Sunday of a year in the Gregorian calendar, as UTC midnight.  Worked out by the
     * Anonymous Gregorian (Meeus/Jones/Butcher) algorithm, whose letters the variables keep.
     * @param {number} year
     * @returns {Date}
     */
    const easterSunday = (year) => {

        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const monthAndDay = h + l - 7 * m + 114;

        return new Date(Date.UTC(year, Math.floor(monthAndDay / 31) - 1, monthAndDay % 31 + 1));
    };

    /**
     * Gets the number of days in a period (second up to year), a fraction of one for a period
     * shorter than a day.
     * @param {Date} date
     * @param {Ren.DatePeriodEnum} datePeriod
     * @returns {number}
     */
    const daysInPeriod = (date, datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second: return MILLISECONDS_PER_SECOND / MILLISECONDS_PER_DAY;
            case Ren.DatePeriodEnum.Minute: return MILLISECONDS_PER_MINUTE / MILLISECONDS_PER_DAY;
            case Ren.DatePeriodEnum.QuarterHour:
                return MILLISECONDS_PER_QUARTER_HOUR / MILLISECONDS_PER_DAY;
            case Ren.DatePeriodEnum.Hour: return MILLISECONDS_PER_HOUR / MILLISECONDS_PER_DAY;
            case Ren.DatePeriodEnum.Day: return 1;
            case Ren.DatePeriodEnum.Week: return 7;
            case Ren.DatePeriodEnum.Month: return daysInMonth(date);
            case Ren.DatePeriodEnum.Quarter: return daysInQuarter(date);
            case Ren.DatePeriodEnum.Year: return daysInYear(date);
        }
    };

    // --- Start of period helpers ---

    /**
     * Gets the start of the period of the given length, in milliseconds, that a Date or date/time
     * string falls in.  Like the other start of period helpers, a Date is read by its local parts
     * and the start is returned as a UTC date.
     * @param {Date|string} date
     * @param {number} periodMilliseconds
     * @returns {Date|string|null}
     */
    const startOfSubDayPeriod = (date, periodMilliseconds) => {

        if (!date || date === Ren.NullSentinel) return null;

        let time;

        if (typeof date === "string") {

            // Read without removing any BST offset, so the time is UTC with the string's own parts.
            time = Ren.DateUtils_Parsing.parseDateTimeUniversalToTime(date, false);

            if (time === null || isNaN(time)) return date;
        }
        else if (date.getFullYear) {

            time = Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                date.getHours(),
                date.getMinutes(),
                date.getSeconds()
            );
        }
        else {

            return date;
        }

        return new Date(Math.floor(time / periodMilliseconds) * periodMilliseconds);
    };

    /**
     * Gets the start of the hour for a Date or date/time string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfHour = (date) => startOfSubDayPeriod(date, MILLISECONDS_PER_HOUR);

    /**
     * Gets the start of the quarter hour (:00, :15, :30 or :45) for a Date or date/time string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfQuarterHour = (date) => startOfSubDayPeriod(date, MILLISECONDS_PER_QUARTER_HOUR);

    /**
     * Gets the start of the minute for a Date or date/time string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfMinute = (date) => startOfSubDayPeriod(date, MILLISECONDS_PER_MINUTE);

    /**
     * Gets the start of the second for a Date or date/time string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfSecond = (date) => startOfSubDayPeriod(date, MILLISECONDS_PER_SECOND);

    /**
     * Gets the start of the day for a Date or sortable date string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfDay = (date) => {

        if (!date || date === Ren.NullSentinel) return null;

        if (typeof date === "string") {

            const ymd = parseSortableDate(date);

            return ymd === null ? date : createDate(ymd.y, ymd.m, ymd.d);
        }

        return date.getFullYear ?
            createDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) :
            date;
    };

    /**
     * Gets the start of the week (Monday) for a Date or sortable date string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfWeek = (date) => {

        if (!date || date === Ren.NullSentinel) return null;

        const parsed = typeof date === "string" ? parseYYYYMMDD(date) : date;

        if (!parsed || !parsed.getFullYear) return date;

        const d = new Date(parsed.valueOf());
        const day = d.getDay();
        d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));

        return createDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    };

    /**
     * Gets the start of the month for a Date or sortable date string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfMonth = (date) => {

        if (!date || date === Ren.NullSentinel) return null;

        if (typeof date === "string") {

            const ymd = parseSortableDate(date);

            return ymd === null ? date : createDate(ymd.y, ymd.m, 1);
        }

        return date.getFullYear ? createDate(date.getFullYear(), date.getMonth() + 1, 1) : date;
    };

    /**
     * Gets the start of the quarter for a Date or sortable date string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfQuarter = (date) => {

        if (!date || date === Ren.NullSentinel) return null;

        if (typeof date === "string") {

            const ymd = parseSortableDate(date);

            return ymd === null ? date : createDate(ymd.y, Math.floor((ymd.m - 1) / 3) * 3 + 1, 1);
        }

        return date.getFullYear ?
            createDate(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3 + 1, 1) :
            date;
    };

    /**
     * Gets the start of the year for a Date or sortable date string.
     * @param {Date|string} date
     * @returns {Date|string|null}
     */
    const startOfYear = (date) => {

        if (!date || date === Ren.NullSentinel) return null;

        if (typeof date === "string") {

            const ymd = parseSortableDate(date);

            return ymd === null ? date : createDate(ymd.y, 1, 1);
        }

        return date.getFullYear ? createDate(date.getFullYear(), 1, 1) : date;
    };

    /**
     * Gets the start of a period (second up to year) for a Date or sortable date string.
     * @param {Date|string} date
     * @param {Ren.DatePeriodEnum} datePeriod
     * @returns {Date|string|null}
     */
    const startOfPeriod = (date, datePeriod) => {

        switch (datePeriod) {

            case Ren.DatePeriodEnum.Second: return startOfSecond(date);
            case Ren.DatePeriodEnum.Minute: return startOfMinute(date);
            case Ren.DatePeriodEnum.QuarterHour: return startOfQuarterHour(date);
            case Ren.DatePeriodEnum.Hour: return startOfHour(date);
            case Ren.DatePeriodEnum.Day: return startOfDay(date);
            case Ren.DatePeriodEnum.Week: return startOfWeek(date);
            case Ren.DatePeriodEnum.Month: return startOfMonth(date);
            case Ren.DatePeriodEnum.Quarter: return startOfQuarter(date);
            case Ren.DatePeriodEnum.Year: return startOfYear(date);
        }
    };

    // --- Current period helpers ---

    /**
     * Gets the start of the current week (Monday, UTC).
     * @returns {Date}
     */
    const startOfCurrentWeek = () => startOfWeek(today());

    /**
     * Gets the start of the current month (UTC).
     * @returns {Date}
     */
    const startOfCurrentMonth = () => createDate(currentYear, currentMonth, 1);

    /**
     * Gets the start of the current quarter (UTC).
     * @returns {Date}
     */
    const startOfCurrentQuarter = () =>
        createDate(currentYear, Math.floor((currentMonth - 1) / 3) * 3 + 1, 1);

    /**
     * Gets the start of the current year (UTC).
     * @returns {Date}
     */
    const startOfCurrentYear = () => createDate(currentYear, 1, 1);

    // --- Range helpers ---

    /**
     * Gets the minimum and maximum dates from an array of Date objects.
     * @param {Date[]} dates
     * @returns {{min: Date, max: Date}|null}
     */
    const getDateRange = (dates) => {

        if (!Array.isArray(dates) || dates.length === 0) return null;

        let min = dates[0], max = dates[0];

        for (let i = 1; i < dates.length; i++) {

            if (dates[i] < min) min = dates[i];
            if (dates[i] > max) max = dates[i];
        }

        return { min, max };
    };

    /**
     * Gets the earlier of two dates.
     * @param {Date} date1
     * @param {Date} date2
     * @returns {Date}
     */
    const minDate = (date1, date2) => new Date(Math.min(date1, date2));

    /**
     * Gets the later of two dates.
     * @param {Date} date1
     * @param {Date} date2
     * @returns {Date}
     */
    const maxDate = (date1, date2) => new Date(Math.max(date1, date2));

    return {
        addDays,
        addMonths,
        addPeriod,
        addQuarters,
        addYears,
        daysBetween,
        daysInMonth,
        daysInPeriod,
        daysInQuarter,
        daysInYear,
        easterSunday,
        getDateRange,
        maxDate,
        minDate,
        quarterNumber,
        startOfCurrentMonth,
        startOfCurrentQuarter,
        startOfCurrentWeek,
        startOfCurrentYear,
        startOfDay,
        startOfHour,
        startOfMinute,
        startOfMonth,
        startOfPeriod,
        startOfQuarter,
        startOfQuarterHour,
        startOfSecond,
        startOfWeek,
        startOfYear
    };
})();
