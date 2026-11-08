// The values run finest to coarsest, so periods compare by value.  Settings persist the name, as
// the values have been renumbered before.
Ren.DatePeriodEnum = (() => {

    const members = {
        Auto: 0,
        Second: 1,
        Minute: 2,
        QuarterHour: 3,
        Hour: 4,
        Day: 5,
        Week: 6,
        Month: 7,
        Quarter: 8,
        Year: 9
    };

    // What settings saved as a number meant, before sub-day periods were added.
    const LEGACY_VALUE_NAMES = ["Auto", "Day", "Week", "Month", "Quarter", "Year"];

    /**
     * Gets the period a persisted value names: a name, or a legacy number (possibly as a string,
     * from an element attribute).  Anything unrecognised is Auto.
     */
    const Parse = (value) => {

        if (value === null || value === undefined || value === "") return members.Auto;

        if (typeof value === "string" && Object.prototype.hasOwnProperty.call(members, value)) {
            return members[value];
        }

        const legacyName = LEGACY_VALUE_NAMES[Number(value)];

        return legacyName ? members[legacyName] : members.Auto;
    };

    return Ren.DefineEnum(members, { Parse });
})();

/**
 * The date helpers the other Ren.DateUtils_Xxx modules build on: constants, today, and conversion
 * between dates, their parts and their commonest string forms.
 */
Ren.DateUtils_Core = (() => {

    // --- Constants ---

    /**
     * Full month names (January, February, ...).
     */
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August",
        "September", "October", "November", "December"];

    /**
     * Abbreviated month names (Jan, Feb, ...).
     */
    const monthNamesAbbrv = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct",
        "Nov", "Dec"];

    /**
     * Number of days in each month (index 1-12).
     */
    const monthDayCounts = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const MILLISECONDS_PER_DAY = 86400000;

    // --- Today ---

    /**
     * Gets today's date in UTC (date only, no time).
     * @returns {Date}
     */
    const today = () => {

        const d = new Date();
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    // Read once, so the three parts below cannot straddle midnight.
    const todayAtLoad = today();

    /**
     * The current year (UTC).
     */
    const currentYear = todayAtLoad.getFullYear();

    /**
     * The current month (1-based, UTC).
     */
    const currentMonth = todayAtLoad.getMonth() + 1;

    /**
     * The current day of the month (UTC).
     */
    const currentDate = todayAtLoad.getDate();

    // --- Core helpers ---

    /**
     * Gets a value indicating whether the year is a leap year.
     * @param {number} year
     * @returns {boolean}
     */
    const isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

    /**
     * Gets the maximum day number for a given month and year numbers.
     * @param {number} y
     * @param {number} m
     * @returns {number}
     */
    const getMaxDay = (y, m) => (m === 2 && isLeapYear(y)) ? 29 : monthDayCounts[m];

    /**
     * Creates a UTC Date from year, month (1-based), and day numbers.
     * @param {number} y
     * @param {number} m
     * @param {number} d
     * @returns {Date}
     */
    const createDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

    /**
     * Pads a number below ten with a leading zero.
     * @param {number} n
     * @returns {string}
     */
    const pad2 = (n) => n >= 0 && n < 10 ? "0" + n : "" + n;

    /**
     * Formats year, month (1-based) and day numbers as yyyy-MM-dd.
     * @param {number} y
     * @param {number} m
     * @param {number} d
     * @returns {string}
     */
    const formatSortableYmd = (y, m, d) =>
        y + (m < 10 ? "-0" : "-") + m + (d < 10 ? "-0" : "-") + d;

    /**
     * Formats an object with form {y, m, d} as yyyy-MM-dd.
     * @param {{y: number, m: number, d: number}} ymd
     * @returns {string}
     */
    const formatSortableDate = (ymd) => formatSortableYmd(ymd.y, ymd.m, ymd.d);

    /**
     * Converts a Date to a yyyy-MM-dd string, returning anything that is not a Date unchanged.
     * @param {Date} date
     * @returns {string}
     */
    const toSortableDate = (date) => {

        if (!date || !date.getFullYear) return date;

        return formatSortableYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    };

    // --- Parsing helpers ---

    /**
     * Parses a yyyy-MM-dd string or a yyyy-MM-dd HH:mm:ss string to an object with form {y, m, d}.
     * @param {string} str
     * @returns {{y: number, m: number, d: number}|null}
     */
    const parseSortableDate = (str) => {

        if (!str) return null;

        if (str.length === 19) str = str.substring(0, 10); // Handle yyyy-MM-dd HH:mm:ss format.
        if (str.length !== 10) return null;

        const y = (str.charCodeAt(0) - 48) * 1000 + (str.charCodeAt(1) - 48) * 100
            + (str.charCodeAt(2) - 48) * 10 + (str.charCodeAt(3) - 48);
        const m = (str.charCodeAt(5) - 48) * 10 + (str.charCodeAt(6) - 48);
        const d = (str.charCodeAt(8) - 48) * 10 + (str.charCodeAt(9) - 48);

        return { y, m, d };
    };

    /**
     * Converts a Date object or sortable date string to an object with form {y, m, d}, or null if
     * the input is not a recognised type.
     * @param {Date|string} date
     * @returns {{y: number, m: number, d: number}|null}
     */
    const toYmd = (date) => {

        if (typeof date === "string") return parseSortableDate(date);

        if (date && date.getFullYear) {
            return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
        }
        return null;
    };

    /**
     * Parses a date string that has the given format.
     * @param {string} str
     * @param {string} format
     * @returns {Date|null}
     */
    const parseDateParts = (str, format) => {

        if (!str || typeof str !== "string" || (!str.includes("/") && !str.includes("-"))) {
            return null;
        }

        let y, m, d, h = 0, min = 0, s = 0;

        if (format === "dd/MM/yyyy" || format === "dd/MM/yyyy HH:mm:ss") {

            d = parseInt(str.substring(0, 2), 10);
            m = parseInt(str.substring(3, 5), 10);
            y = parseInt(str.substring(6, 10), 10);
        }
        else if (format === "yyyy-MM-dd" || format === "yyyy-MM-dd HH:mm:ss") {

            y = parseInt(str.substring(0, 4), 10);
            m = parseInt(str.substring(5, 7), 10);
            d = parseInt(str.substring(8, 10), 10);
        }
        else if (format === "yyyy-MM") {

            y = parseInt(str.substring(0, 4), 10);
            m = parseInt(str.substring(5, 7), 10);
            d = 1;
        }
        else {

            return null;
        }

        if (format === "dd/MM/yyyy HH:mm:ss" || format === "yyyy-MM-dd HH:mm:ss") {

            h = parseInt(str.substring(11, 13), 10);
            min = parseInt(str.substring(14, 16), 10);
            s = parseInt(str.substring(17, 19), 10);
        }

        return new Date(Date.UTC(y, m - 1, d, h, min, s));
    };

    /**
     * Parses a dd/MM/yyyy string to a Date.
     * @param {string} str
     * @returns {Date|null}
     */
    const parseDDMMYYYY = (str) => parseDateParts(str, "dd/MM/yyyy");

    /**
     * Parses a dd/MM/yyyy HH:mm:ss string to a Date.
     * @param {string} str
     * @returns {Date|null}
     */
    const parseDDMMYYYY_HHmmss = (str) => parseDateParts(str, "dd/MM/yyyy HH:mm:ss");

    /**
     * Parses a yyyy-MM-dd string to a Date.
     * @param {string} str
     * @returns {Date|null}
     */
    const parseYYYYMMDD = (str) => parseDateParts(str, "yyyy-MM-dd");

    /**
     * Parses a yyyy-MM-dd HH:mm:ss string to a Date.
     * @param {string} str
     * @returns {Date|null}
     */
    const parseYYYYMMDD_HHmmss = (str) => parseDateParts(str, "yyyy-MM-dd HH:mm:ss");

    /**
     * Parses a yyyy-MM string to a Date.
     * @param {string} str
     * @returns {Date|null}
     */
    const parseYYYYMM = (str) => parseDateParts(str, "yyyy-MM");

    /**
     * Parses a date or date/time string in various formats to a Date.
     * @param {string} str
     * @returns {Date|null}
     */
    const parseDateOrDateTime = (str) => {

        if (!str) return null;

        if (str.indexOf("-") === -1) {

            if (str.length === 10) return parseDDMMYYYY(str);
            if (str.length === 19) return parseDDMMYYYY_HHmmss(str);
            return null;
        }
        else {

            if (str.length === 7) return parseYYYYMM(str);
            if (str.length === 10) return parseYYYYMMDD(str);
            if (str.length === 19) return parseYYYYMMDD_HHmmss(str);
            return null;
        }
    };

    // --- Month and quarter names ---

    /**
     * Converts a month name or abbreviation to a month number (1-12).
     * @param {string} str
     * @returns {number|null}
     */
    const parseMonthNameOrAbbrv = (str) => {

        const abbrvIndex = monthNamesAbbrv.indexOf(str);

        if (abbrvIndex !== -1) return abbrvIndex + 1;

        const nameIndex = monthNames.indexOf(str);

        if (nameIndex !== -1) return nameIndex + 1;

        return null;
    };

    /**
     * Gets the abbreviated month name for a month number (1-12).
     * @param {number} m
     * @returns {string}
     */
    const getMonthNameAbbrv = (m) => monthNamesAbbrv[m - 1];

    /**
     * Gets the quarter name (e.g. Q1 2024).
     * @param {number} y
     * @param {number} q
     * @returns {string}
     */
    const quarterName = (y, q) => `Q${q} ${y}`;

    return {
        createDate,
        currentDate,
        currentMonth,
        currentYear,
        formatSortableDate,
        formatSortableYmd,
        getMaxDay,
        getMonthNameAbbrv,
        isLeapYear,
        MILLISECONDS_PER_DAY,
        monthDayCounts,
        monthNames,
        monthNamesAbbrv,
        pad2,
        parseDateOrDateTime,
        parseDDMMYYYY,
        parseDDMMYYYY_HHmmss,
        parseMonthNameOrAbbrv,
        parseSortableDate,
        parseYYYYMM,
        parseYYYYMMDD,
        parseYYYYMMDD_HHmmss,
        quarterName,
        today,
        toSortableDate,
        toYmd
    };
})();
