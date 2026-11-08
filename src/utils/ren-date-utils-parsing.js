/**
 * Date helpers for parsing date/time strings in any of the forms the reports' data arrives in.
 */
Ren.DateUtils_Parsing = (() => {

    const {
        createDate,
        formatSortableYmd,
        parseDateOrDateTime,
        parseMonthNameOrAbbrv
    } = Ren.DateUtils_Core;

    /**
     * Parses the yyyy-MM-dd and dd/MM/yyyy forms, with or without a HH:mm:ss time, straight from
     * their character codes to a time in milliseconds.  Returns NaN for anything else, including
     * those forms with any character out of place, leaving it to the general parser.
     * @param {string} str
     * @returns {number}
     */
    const parseCommonDateTimeToTime = (str) => {

        const length = str.length;

        if (length !== 10 && length !== 19) return NaN;

        let y0, y1, y2, y3, m0, m1, d0, d1;

        if (str.charCodeAt(4) === 45 && str.charCodeAt(7) === 45) {

            y0 = str.charCodeAt(0) - 48; y1 = str.charCodeAt(1) - 48;
            y2 = str.charCodeAt(2) - 48; y3 = str.charCodeAt(3) - 48;
            m0 = str.charCodeAt(5) - 48; m1 = str.charCodeAt(6) - 48;
            d0 = str.charCodeAt(8) - 48; d1 = str.charCodeAt(9) - 48;
        }
        else if (str.charCodeAt(2) === 47 && str.charCodeAt(5) === 47) {

            d0 = str.charCodeAt(0) - 48; d1 = str.charCodeAt(1) - 48;
            m0 = str.charCodeAt(3) - 48; m1 = str.charCodeAt(4) - 48;
            y0 = str.charCodeAt(6) - 48; y1 = str.charCodeAt(7) - 48;
            y2 = str.charCodeAt(8) - 48; y3 = str.charCodeAt(9) - 48;
        }
        else {

            return NaN;
        }

        // The unsigned shift turns a character below "0" into a huge number, so each check is one
        // comparison.
        if (y0 >>> 0 > 9 || y1 >>> 0 > 9 || y2 >>> 0 > 9 || y3 >>> 0 > 9
            || m0 >>> 0 > 9 || m1 >>> 0 > 9 || d0 >>> 0 > 9 || d1 >>> 0 > 9) {

            return NaN;
        }

        const y = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
        const m = m0 * 10 + m1;
        const d = d0 * 10 + d1;

        if (length === 10) return Date.UTC(y, m - 1, d);

        if (str.charCodeAt(10) !== 32 || str.charCodeAt(13) !== 58 || str.charCodeAt(16) !== 58) {
            return NaN;
        }

        const h0 = str.charCodeAt(11) - 48, h1 = str.charCodeAt(12) - 48;
        const min0 = str.charCodeAt(14) - 48, min1 = str.charCodeAt(15) - 48;
        const s0 = str.charCodeAt(17) - 48, s1 = str.charCodeAt(18) - 48;

        if (h0 >>> 0 > 9 || h1 >>> 0 > 9 || min0 >>> 0 > 9 || min1 >>> 0 > 9
            || s0 >>> 0 > 9 || s1 >>> 0 > 9) {

            return NaN;
        }

        return Date.UTC(y, m - 1, d, h0 * 10 + h1, min0 * 10 + min1, s0 * 10 + s1);
    };

    /**
     * Gets a value indicating whether a space-separated part names a quarter, e.g. "Q1".
     * @param {string} part
     * @returns {boolean}
     */
    const isQuarterPart = (part) => part[0] === "Q" && part[1] >= "1" && part[1] <= "4";

    /**
     * Parses the "Q1 2026" and "2026 Q1" forms, given the two space-separated parts, to the first
     * day of the quarter.
     * @param {string[]} parts
     * @returns {Date|null}
     */
    const parseQuarterName = (parts) => {

        let quarterPart, yearPart;

        if (isQuarterPart(parts[0])) {

            quarterPart = parts[0];
            yearPart = parts[1];
        }
        else if (isQuarterPart(parts[1])) {

            quarterPart = parts[1];
            yearPart = parts[0];
        }
        else {

            return null;
        }

        const quarter = parseInt(quarterPart.substring(1), 10);
        const year = parseInt(yearPart, 10);

        if (isNaN(quarter) || quarter < 1 || quarter > 4 || isNaN(year) || year < 1000) return null;

        return createDate(year, (quarter - 1) * 3 + 1, 1);
    };

    /**
     * Parses a date string, which may be in various formats, to a Date.
     * @param {string} dateString
     * @returns {Date|null}
     */
    const doParseDateTimeUniversal = (dateString) => {

        if (!dateString) return null;

        if (dateString.startsWith("/Date(")) {

            return Ren.JsonUtils.parseJsonDate(dateString);
        }

        const firstCode = dateString.charCodeAt(0);

        if (firstCode >= 48 && firstCode <= 57 && !dateString.includes("Q")) {

            return parseDateOrDateTime(dateString);
        }

        const parts = dateString.split(" ");

        if (parts.length !== 2) return null;

        const quarterDate = parseQuarterName(parts);

        if (quarterDate !== null) return quarterDate;

        const month = parseMonthNameOrAbbrv(parts[0]);

        if (month !== null) return createDate(parseInt(parts[1], 10), month, 1);

        return null;
    };

    // Reused to look up time zone offsets, so that doing so allocates nothing.
    const offsetDate = new Date(0);

    /**
     * Parses a date/time string as parseDateTimeUniversal does, but to a time in milliseconds, so
     * that the common forms allocate nothing.
     * @param {string} dateString
     * @param {boolean} removeBST
     * @returns {number|null} Null where the string doesn't parse, or NaN for an invalid date.
     */
    const parseDateTimeUniversalToTime = (dateString, removeBST) => {

        if (typeof dateString !== "string" || !dateString) return null;

        let time = parseCommonDateTimeToTime(dateString);

        if (isNaN(time)) {

            const date = doParseDateTimeUniversal(dateString);

            if (!date) return null;

            time = date.getTime();
        }

        if (!removeBST) return time;

        offsetDate.setTime(time);

        return time + offsetDate.getTimezoneOffset() * 60000;
    };

    /**
     * Parses a date/time string, which may be in various universal formats, to a Date, optionally
     * removing any BST offset.  A value that is already a Date is returned as it is.
     * @param {string|Date} dateString
     * @param {boolean} removeBST
     * @returns {Date|null}
     */
    const parseDateTimeUniversal = (dateString, removeBST) => {

        if (dateString instanceof Date) return dateString;

        const time = parseDateTimeUniversalToTime(dateString, removeBST);

        return time === null ? null : new Date(time);
    };

    /**
     * Formats a Date parsed by this module, which holds its date at UTC, as yyyy-MM-dd.
     * @param {Date} date
     * @returns {string}
     */
    const toSortableUtcDate = (date) =>
        formatSortableYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

    /**
     * Gets the range of days from the first of a month, running for the given number of months.
     * @returns {{start: string, end: string}}
     */
    const getMonthsRange = (y, m, monthCount) => ({
        start: toSortableUtcDate(createDate(y, m, 1)),
        end: toSortableUtcDate(createDate(y, m + monthCount, 1))
    });

    /**
     * Parses a value naming a day ("2026-05-04", "04/05/2026"), a month ("May 2026", "2026-05")
     * or a quarter ("Q2 2026") to the days it covers, as yyyy-MM-dd start and exclusive end dates.
     * @param {*} value
     * @returns {{start: string, end: string}|null} Null where the value names none of them.
     */
    const parseDateRange = (value) => {

        if (value == null) return null;

        const text = String(value).trim();

        if (!text) return null;

        const parts = text.split(" ");

        if (parts.length === 2) {

            const quarterStart = parseQuarterName(parts);

            if (quarterStart !== null) {

                return getMonthsRange(
                    quarterStart.getUTCFullYear(),
                    quarterStart.getUTCMonth() + 1,
                    3
                );
            }

            const month = parseMonthNameOrAbbrv(parts[0]);

            if (month !== null) {

                return /^\d{4}$/.test(parts[1])
                    ? getMonthsRange(parseInt(parts[1], 10), month, 1)
                    : null;
            }
        }

        if (/^\d{4}-\d{2}$/.test(text)) {

            return getMonthsRange(
                parseInt(text.substring(0, 4), 10),
                parseInt(text.substring(5), 10),
                1
            );
        }

        const date = parseDateTimeUniversal(text);

        // The general parser reads anything the right length with a dash in it, such as a negative
        // number, as a date of sorts.
        if (!date || isNaN(date.getTime())) return null;

        const y = date.getUTCFullYear();

        if (y < 1000 || y > 9999) return null;

        return {
            start: toSortableUtcDate(date),
            end: toSortableUtcDate(createDate(y, date.getUTCMonth() + 1, date.getUTCDate() + 1))
        };
    };

    return {
        parseDateRange,
        parseDateTimeUniversal,
        parseDateTimeUniversalToTime
    };
})();
