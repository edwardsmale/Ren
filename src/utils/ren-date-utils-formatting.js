/**
 * Date helpers for formatting dates as text, and for recognising and converting the text forms.
 */
Ren.DateUtils_Formatting = (() => {

    const {
        formatSortableYmd,
        getMaxDay,
        monthNamesAbbrv,
        pad2,
        parseSortableDate,
        quarterName,
        toSortableDate
    } = Ren.DateUtils_Core;

    // --- Formatting helpers ---

    /**
     * Converts a yyyy-MM-dd string to a dd/MM/yyyy string.
     * @param {string} sortableDate
     * @returns {string|null}
     */
    const sortableDateToddMMyyyy = (sortableDate) => {

        if (!sortableDate || sortableDate === Ren.NullSentinel) return null;

        const ymd = parseSortableDate(sortableDate);

        if (ymd === null) return null;

        const { y, m, d } = ymd;

        return `${pad2(d)}/${pad2(m)}/${y}`;
    };

    /**
     * Converts a yyyy-MM-dd string to an MMM yyyy string.
     * @param {string} sortableDate
     * @returns {string|null}
     */
    const sortableDateToMMMyyyy = (sortableDate) => {

        if (!sortableDate || sortableDate === Ren.NullSentinel) return null;

        const ymd = parseSortableDate(sortableDate);

        if (ymd === null) return null;

        const { y, m } = ymd;

        return `${monthNamesAbbrv[m - 1]} ${y}`;
    };

    /**
     * Converts a yyyy-MM-dd string to its year alone, e.g. "2026".
     * @param {string} sortableDate
     * @returns {string|null}
     */
    const sortableDateToYear = (sortableDate) => {

        if (!sortableDate || sortableDate === Ren.NullSentinel) return null;

        const ymd = parseSortableDate(sortableDate);

        if (ymd === null) return null;

        return `${ymd.y}`;
    };

    /**
     * Gets the quarter name from a sortable date string.
     * @param {string} sortableDate
     * @returns {string|null}
     */
    const getQuarterNameFromSortableDate = (sortableDate) => {

        if (!sortableDate || sortableDate === Ren.NullSentinel) return null;

        const ymd = parseSortableDate(sortableDate);

        if (ymd === null) return null;

        const { y, m } = ymd;

        return quarterName(y, Math.floor((m - 1) / 3) + 1);
    };

    /**
     * Formats a Date as dd/MM/yyyy.
     * @param {Date} date
     * @returns {string|null}
     */
    const formatddMMyyyy = (date) => date ?
        `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}` :
        null;

    /**
     * Formats a Date as dd/MM/yyyy HH:mm:ss.
     * @param {Date} date
     * @returns {string|null}
     */
    const formatddMMyyyy_HHmmss = (date) => date ?
        `${formatddMMyyyy(date)} ` +
        `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` :
        null;

    /**
     * Formats a Date as dd/MM/yyyy HH:mm:ss.fff.
     * @param {Date} date
     * @returns {string|null}
     */
    const formatddMMyyyy_HHmmssfff = (date) => date ?
        `${formatddMMyyyy_HHmmss(date)}.${String(date.getMilliseconds()).padStart(3, "0")}` :
        null;

    /**
     * Formats a Date as yyyy-MM-dd.
     * @param {Date} date
     * @returns {string|null}
     */
    const formatAsSortableDate = (date) => date ? toSortableDate(date) : null;

    /**
     * Formats a Date as yyyy-MM-dd HH:mm:ss.
     * @param {Date} date
     * @returns {string|null}
     */
    const formatAsSortableDateTime = (date) => {

        if (!date) return null;

        return formatSortableYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()) + " " +
            pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + pad2(date.getSeconds());
    };

    /**
     * Formats a Date holding its date and time at UTC, as parseDateTimeUniversal gives, as
     * yyyy-MM-dd HH:mm:ss.
     * @param {Date} date
     * @returns {string|null}
     */
    const formatAsSortableUtcDateTime = (date) => {

        if (!date) return null;

        return formatSortableYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) +
            " " + pad2(date.getUTCHours()) + ":" + pad2(date.getUTCMinutes()) + ":" +
            pad2(date.getUTCSeconds());
    };

    // --- Validation helpers ---

    /**
     * Gets a value indicating whether year, month and day numbers form a real date.
     * @param {number} y
     * @param {number} m
     * @param {number} d
     * @returns {boolean}
     */
    const isValidYmd = (y, m, d) => !isNaN(y) && !isNaN(m) && !isNaN(d)
        && m >= 1 && m <= 12 && d >= 1 && d <= getMaxDay(y, m);

    /**
     * Gets a value indicating whether the string is a valid yyyy-MM-dd date.
     * @param {string} str
     * @returns {boolean}
     */
    const isSortableDate = (str) => {

        if (!str || str.length !== 10) return false;

        const parts = str.split("-");

        if (parts.length !== 3) return false;

        const [y, m, d] = parts.map(Number);

        return isValidYmd(y, m, d);
    };

    /**
     * Gets a value indicating whether the string is a valid dd/MM/yyyy date.
     * @param {string} str
     * @returns {boolean}
     */
    const isddMMyyyy = (str) => {

        if (!str || str.length !== 10) return false;

        const parts = str.split("/");

        if (parts.length !== 3) return false;

        const [d, m, y] = parts.map(Number);

        return isValidYmd(y, m, d);
    };

    /**
     * Gets a value indicating whether a Date is date-only (i.e. has no time component).
     * @param {Date} date
     * @returns {boolean}
     */
    const isDateOnly = (date) =>
        date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;

    /**
     * Converts a dd/MM/yyyy string to a yyyy-MM-dd string.
     * @param {string} ddMMyyyy
     * @returns {string|null}
     */
    const ddMMyyyyToSortableDate = (ddMMyyyy) => {

        if (!ddMMyyyy) return null;

        const [d, m, y] = ddMMyyyy.split("/");

        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    };

    /**
     * Converts a date string to yyyy-MM-dd, returning it unchanged if it is in neither recognised
     * form.
     * @param {string} str
     * @returns {string|null}
     */
    const toSortableDateAuto = (str) => {

        if (!str) return null;

        const s = str.replace(/\s+\d{2}:\d{2}:\d{2}$/, "");

        if (isSortableDate(s)) return s;
        if (isddMMyyyy(s)) return ddMMyyyyToSortableDate(s);

        return str;
    };

    /**
     * Converts all date properties in an object to yyyy-MM-dd format.
     * @param {Object} obj
     */
    const convertAllDatesToSortable = (obj) => {

        if (!obj) return;

        const keys = Object.keys(obj);

        for (let i = 0; i < keys.length; i++) {

            const key = keys[i];

            if (key.endsWith("Date") || key.endsWith("date")) {

                obj[key] = toSortableDateAuto(obj[key]);
            }
        }
    };

    return {
        convertAllDatesToSortable,
        ddMMyyyyToSortableDate,
        formatAsSortableDate,
        formatAsSortableDateTime,
        formatAsSortableUtcDateTime,
        formatddMMyyyy,
        formatddMMyyyy_HHmmss,
        formatddMMyyyy_HHmmssfff,
        getQuarterNameFromSortableDate,
        isDateOnly,
        isddMMyyyy,
        isSortableDate,
        sortableDateToddMMyyyy,
        sortableDateToMMMyyyy,
        sortableDateToYear,
        toSortableDateAuto
    };
})();
