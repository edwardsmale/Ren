/**
 * The Excel-style comparison operators behind a "compare" row-filter predicate:
 *
 *     { type: "compare", column: <colIdOrHeading>, operator: <id>, value: <v>, value2: <v2> }
 *
 * A column may carry several, each in its own slot, ANDed together unless one names another slot of
 * the same column in orGroup, joining that slot's OR group.  Cells are compared in the same
 * normalised string form Ren.FilterPredicates reads, so hand-authored and UI-authored predicates
 * behave identically.
 */
Ren.FilterCompareOperators = (() => {

    // The operator groups, in the order the picker shows them.
    const GROUPS = ["Text", "Number", "Date", "Ranking", "Blank", "Custom"];

    // The value kinds a column can have, which decide the operators offered and what the value box
    // accepts.
    const COLUMN_KINDS = ["text", "number", "date"];

    // arity: how many value inputs the operator takes (0, 1 or 2).
    // inputType: "text", "number", "int", "date", "function" (a function's source, edited in an
    //     editor rather than a box), or null when arity is 0.
    // needsScan: the result depends on the whole column (top / bottom N).
    // needsRow: tested against the whole row, with a format function's signature (custom function).
    // appliesTo: the column kinds the operator is offered for.  The comparison operators also apply
    //     to text columns, comparing lexicographically where either side is non-numeric.
    // separatorBefore: draws a divider above the operator in the picker, or above its submenu.
    // submenu: { id, label } of the submenu the context-menu picker files the operator under, which
    //     the select shows as an option group of its own.
    // relativeDate: { kind, unit } for a date operator whose window is reckoned from today (see
    //     getRelativeDateWindow).  The "rolling" and "calendar" kinds take N as their value.
    const RELATIVE_DATE_SUBMENUS = {
        current: { id: "current", label: "Current period" },
        toDate: { id: "to-date", label: "Period to date" },
        previous: { id: "previous", label: "Previous period" },
        rolling: { id: "rolling", label: "Last N" },
        calendar: { id: "calendar", label: "Last N calendar" }
    };

    const relativeDateOperator = (id, label, kind, unit, separatorBefore) => ({
        id,
        label,
        group: "Date",
        arity: kind === "rolling" || kind === "calendar" ? 1 : 0,
        inputType: kind === "rolling" || kind === "calendar" ? "int" : null,
        appliesTo: ["date"],
        separatorBefore: !!separatorBefore,
        submenu: RELATIVE_DATE_SUBMENUS[kind],
        relativeDate: { kind, unit }
    });

    const OPERATORS = [
        {
            id: "contains",
            label: "contains",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "notContains",
            label: "does not contain",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "beginsWith",
            label: "starts with",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "notBeginsWith",
            label: "does not start with",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "endsWith",
            label: "ends with",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "notEndsWith",
            label: "does not end with",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "equals",
            label: "equals",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text", "number"]
        },
        {
            id: "notEquals",
            label: "does not equal",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text", "number"]
        },
        {
            id: "matches",
            label: "matches",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"],
            separatorBefore: true
        },
        {
            id: "matchesIgnoreCase",
            label: "matches (case-insensitive)",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "notMatches",
            label: "does not match",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "notMatchesIgnoreCase",
            label: "does not match (case-insensitive)",
            group: "Text",
            arity: 1,
            inputType: "text",
            appliesTo: ["text"]
        },
        {
            id: "greaterThan",
            label: "greater than",
            symbol: ">",
            group: "Number",
            arity: 1,
            inputType: "number",
            appliesTo: ["text", "number"]
        },
        {
            id: "greaterThanOrEqual",
            label: "greater than or equal to",
            symbol: "≥",
            group: "Number",
            arity: 1,
            inputType: "number",
            appliesTo: ["text", "number"]
        },
        {
            id: "lessThan",
            label: "less than",
            symbol: "<",
            group: "Number",
            arity: 1,
            inputType: "number",
            appliesTo: ["text", "number"]
        },
        {
            id: "lessThanOrEqual",
            label: "less than or equal to",
            symbol: "≤",
            group: "Number",
            arity: 1,
            inputType: "number",
            appliesTo: ["text", "number"]
        },
        {
            id: "between",
            label: "between",
            group: "Number",
            arity: 2,
            inputType: "number",
            appliesTo: ["text", "number"]
        },
        {
            id: "dateBefore",
            label: "is before",
            group: "Date",
            arity: 1,
            inputType: "date",
            appliesTo: ["date"]
        },
        {
            id: "dateAfter",
            label: "is on or after",
            group: "Date",
            arity: 1,
            inputType: "date",
            appliesTo: ["date"]
        },
        {
            id: "dateBetween",
            label: "is between",
            group: "Date",
            arity: 2,
            inputType: "date",
            appliesTo: ["date"]
        },
        relativeDateOperator("dateToday", "is today", "current", "day", true),
        relativeDateOperator("dateThisWeek", "is this week", "current", "week"),
        relativeDateOperator("dateThisMonth", "is this month", "current", "month"),
        relativeDateOperator("dateThisQuarter", "is this quarter", "current", "quarter"),
        relativeDateOperator("dateThisYear", "is this year", "current", "year"),
        relativeDateOperator("dateWeekToDate", "week to date", "toDate", "week"),
        relativeDateOperator("dateMonthToDate", "month to date", "toDate", "month"),
        relativeDateOperator("dateQuarterToDate", "quarter to date", "toDate", "quarter"),
        relativeDateOperator("dateYearToDate", "year to date", "toDate", "year"),
        relativeDateOperator("dateYesterday", "is yesterday", "previous", "day"),
        relativeDateOperator("datePreviousWeek", "is in the previous week", "previous", "week"),
        relativeDateOperator("datePreviousMonth", "is in the previous month", "previous", "month"),
        relativeDateOperator(
            "datePreviousQuarter",
            "is in the previous quarter",
            "previous",
            "quarter"
        ),
        relativeDateOperator("datePreviousYear", "is in the previous year", "previous", "year"),
        relativeDateOperator("dateLastNDays", "in the last N days", "rolling", "day"),
        relativeDateOperator(
            "dateLastNWorkingDays",
            "in the last N working days",
            "rolling",
            "workingDay"
        ),
        relativeDateOperator("dateLastNWeeks", "in the last N weeks", "rolling", "week"),
        relativeDateOperator("dateLastNMonths", "in the last N months", "rolling", "month"),
        relativeDateOperator("dateLastNQuarters", "in the last N quarters", "rolling", "quarter"),
        relativeDateOperator("dateLastNYears", "in the last N years", "rolling", "year"),
        relativeDateOperator(
            "dateLastNCalendarWeeks",
            "in the last N calendar weeks",
            "calendar",
            "week"
        ),
        relativeDateOperator(
            "dateLastNCalendarMonths",
            "in the last N calendar months",
            "calendar",
            "month"
        ),
        relativeDateOperator(
            "dateLastNCalendarQuarters",
            "in the last N calendar quarters",
            "calendar",
            "quarter"
        ),
        relativeDateOperator(
            "dateLastNCalendarYears",
            "in the last N calendar years",
            "calendar",
            "year"
        ),
        {
            id: "topN",
            label: "top N",
            group: "Ranking",
            arity: 1,
            inputType: "int",
            needsScan: true,
            appliesTo: ["number"]
        },
        {
            id: "bottomN",
            label: "bottom N",
            group: "Ranking",
            arity: 1,
            inputType: "int",
            needsScan: true,
            appliesTo: ["number"]
        },
        {
            id: "isBlank",
            label: "is blank",
            group: "Blank",
            arity: 0,
            inputType: null,
            appliesTo: ["text", "number", "date"]
        },
        {
            id: "isNotBlank",
            label: "is not blank",
            group: "Blank",
            arity: 0,
            inputType: null,
            appliesTo: ["text", "number", "date"]
        },
        {
            id: "customFunction",
            label: "custom",
            group: "Custom",
            arity: 1,
            inputType: "function",
            needsRow: true,
            appliesTo: ["text", "number", "date"]
        }
    ];

    const OPERATORS_BY_ID = {};

    for (let i = 0; i < OPERATORS.length; i++) OPERATORS_BY_ID[OPERATORS[i].id] = OPERATORS[i];

    const getOperator = (operatorId) => OPERATORS_BY_ID[operatorId] ?? null;

    // Gets the operators of a group, in OPERATORS order.
    const getOperatorsInGroup = (group) => {

        const result = [];

        for (let i = 0; i < OPERATORS.length; i++) {
            if (OPERATORS[i].group === group) result.push(OPERATORS[i]);
        }

        return result;
    };

    // Gets a value indicating whether an operator is offered for a column kind.  An unknown kind is
    // unrestricted.
    const operatorAppliesToColumnKind = (descriptor, columnKind) =>
        !columnKind || !descriptor.appliesTo || descriptor.appliesTo.indexOf(columnKind) !== -1;

    // Gets the operators of a group offered for a column kind, in OPERATORS order.
    const getOperatorsInGroupForColumnKind = (group, columnKind) => {

        const result = [];

        for (let i = 0; i < OPERATORS.length; i++) {

            if (OPERATORS[i].group === group && operatorAppliesToColumnKind(OPERATORS[i], columnKind)) {
                result.push(OPERATORS[i]);
            }
        }

        return result;
    };

    // Gets the groups that carry at least one operator for a column kind.
    const getGroupsForColumnKind = (columnKind) => {

        const result = [];

        for (let g = 0; g < GROUPS.length; g++) {
            if (getOperatorsInGroupForColumnKind(GROUPS[g], columnKind).length > 0) result.push(GROUPS[g]);
        }

        return result;
    };

    // A date column starts on "is on or after", everything from a date onwards being the commonest
    // date filter, rather than the "is before" heading the date group.
    const DEFAULT_OPERATOR_IDS_BY_COLUMN_KIND = {
        date: "dateAfter"
    };

    // Gets the operator a fresh control defaults to for a column kind.
    const getDefaultOperatorForColumnKind = (columnKind) => {

        const preferred = getOperator(DEFAULT_OPERATOR_IDS_BY_COLUMN_KIND[columnKind]);

        if (preferred && operatorAppliesToColumnKind(preferred, columnKind)) return preferred;

        for (let i = 0; i < OPERATORS.length; i++) {
            if (operatorAppliesToColumnKind(OPERATORS[i], columnKind)) return OPERATORS[i];
        }

        return OPERATORS[0];
    };

    // Gets the value kind a column's compare filter adapts to, from its spreadsheet format.  Enum
    // columns arrive downgraded to General, so are "text".
    const columnKindForFormat = (columnFormat) => {

        const Formats = Ren.SpreadsheetColumnFormatEnum;

        switch (columnFormat) {

            case Formats.Number:
            case Formats.Integer:
            case Formats.Currency:
            case Formats.Percentage:
                return "number";

            case Formats.Date:
            case Formats.DateTime:
                return "date";

            default:
                return "text";
        }
    };

    const normalise = (value) => (value === null || value === undefined) ? "" : String(value);

    // Returns NaN for blank input, which Number would otherwise read as 0.
    const toNumber = (value) => {

        const trimmed = normalise(value).trim();
        if (trimmed === "") return NaN;

        return Number(trimmed);
    };

    // Parsed dates hold their date and time at UTC, so are read back at UTC, lest a time late in a
    // BST evening fall on the next day.  Null where the value isn't a valid date.
    const toSortableDate = (value) => {

        const date = Ren.DateUtils.parseDateTimeUniversal(normalise(value), false);

        if (!date || isNaN(date.getTime())) return null;

        return Ren.DateUtils.formatSortableYmd(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate()
        );
    };

    // --- Per-operator cell tests (non-ranking) --------------------------------------------------

    // Returns null for a half-typed or malformed pattern rather than throwing on every row.
    const toRegExp = (pattern, ignoreCase) => {

        try {
            return new RegExp(normalise(pattern), ignoreCase ? "i" : "");
        }
        catch (error) {

            return null;
        }
    };

    // An uncompilable pattern matches nothing, in either direction, rather than letting every row
    // through.
    const buildRegexTest = (operatorId, value) => {

        const ignoreCase = operatorId === "matchesIgnoreCase" || operatorId === "notMatchesIgnoreCase";
        const negated = operatorId === "notMatches" || operatorId === "notMatchesIgnoreCase";

        const expression = toRegExp(value, ignoreCase);
        if (!expression) return () => false;

        if (negated) return (cell) => !expression.test(cell);

        return (cell) => expression.test(cell);
    };

    // Builds the text-comparison test for a cell (case-insensitive, as in Excel).
    const buildTextTest = (operatorId, value) => {

        const operand = normalise(value).toLowerCase();

        // Also matches a numerically-equal cell, so "equals 100" matches "100.0".
        const looseEquals = (cellLower, cellRaw) => {

            if (cellLower === operand) return true;

            const cellNumber = toNumber(cellRaw);
            const operandNumber = toNumber(value);

            return !isNaN(cellNumber) && !isNaN(operandNumber) && cellNumber === operandNumber;
        };

        switch (operatorId) {

            case "contains": return (cell) => cell.toLowerCase().indexOf(operand) !== -1;
            case "notContains": return (cell) => cell.toLowerCase().indexOf(operand) === -1;
            case "beginsWith": return (cell) => cell.toLowerCase().indexOf(operand) === 0;
            case "notBeginsWith": return (cell) => cell.toLowerCase().indexOf(operand) !== 0;
            case "endsWith": return (cell) => cell.toLowerCase().endsWith(operand);
            case "notEndsWith": return (cell) => !cell.toLowerCase().endsWith(operand);
            case "equals": return (cell) => looseEquals(cell.toLowerCase(), cell);
            case "notEquals": return (cell) => !looseEquals(cell.toLowerCase(), cell);

            case "matches":
            case "matchesIgnoreCase":
            case "notMatches":
            case "notMatchesIgnoreCase":
                return buildRegexTest(operatorId, value);
        }

        return null;
    };

    // Compares numerically when both sides parse as numbers, so "20" sorts below "100", and
    // case-insensitively lexicographically otherwise.
    const compareValues = (cell, operand) => {

        const cellNumber = toNumber(cell);
        const operandNumber = toNumber(operand);

        if (!isNaN(cellNumber) && !isNaN(operandNumber)) {
            return cellNumber < operandNumber ? -1 : cellNumber > operandNumber ? 1 : 0;
        }

        return Ren.ArrayUtils.compareOrdinal(
            normalise(cell).toLowerCase(),
            normalise(operand).toLowerCase()
        );
    };

    // Builds the comparison test for a cell (< ≤ > ≥, between).
    const buildComparisonTest = (operatorId, value, value2) => {

        if (operatorId === "between") {

            let low = value;
            let high = value2;

            // So a range typed either way round is the same.
            if (compareValues(low, high) > 0) { const swap = low; low = high; high = swap; }

            return (cell) => compareValues(cell, low) >= 0 && compareValues(cell, high) <= 0;
        }

        switch (operatorId) {

            case "greaterThan": return (cell) => compareValues(cell, value) > 0;
            case "greaterThanOrEqual": return (cell) => compareValues(cell, value) >= 0;
            case "lessThan": return (cell) => compareValues(cell, value) < 0;
            case "lessThanOrEqual": return (cell) => compareValues(cell, value) <= 0;
        }

        return null;
    };

    // Builds the blank / not-blank test for a cell (whitespace-only counts as blank).
    const buildBlankTest = (operatorId) => {

        if (operatorId === "isBlank") return (cell) => cell.trim() === "";
        if (operatorId === "isNotBlank") return (cell) => cell.trim() !== "";

        return null;
    };

    // --- Relative date windows -------------------------------------------------------------------

    const MILLISECONDS_PER_DAY = 86400000;

    const MONTHS_PER_UNIT = { month: 1, quarter: 3, year: 12 };

    // Dates here are all UTC midnights, as DateUtils.today gives, so are read and moved in UTC.
    const addUtcDays = (date, days) => new Date(date.getTime() + days * MILLISECONDS_PER_DAY);

    const toSortableUtc = (date) => Ren.DateUtils.formatSortableYmd(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    );

    // Gets the first day of the period (day, Monday-based week, month, quarter or year) holding
    // today, moved on by offset periods.  A working day is reckoned as a day.
    const startOfPeriod = (today, unit, offset) => {

        if (unit === "day" || unit === "workingDay") return addUtcDays(today, offset);

        if (unit === "week") return addUtcDays(today, offset * 7 - (today.getUTCDay() + 6) % 7);

        const months = MONTHS_PER_UNIT[unit];
        const firstMonth = Math.floor(today.getUTCMonth() / months) * months;

        return new Date(Date.UTC(today.getUTCFullYear(), firstMonth + offset * months, 1));
    };

    // Gets the day a number of months before today, on the last day of its month where that month
    // is too short (31 March less one month is 28 or 29 February).
    const monthsBefore = (today, months) => {

        const year = today.getUTCFullYear();
        const month = today.getUTCMonth() - months;
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

        return new Date(Date.UTC(year, month, Math.min(today.getUTCDate(), lastDayOfMonth)));
    };

    // Gets the Nth working day back from today, today counting as the first where it is one.
    // Gives up after a year's worth of days beyond N, should the non-working days run on forever.
    const nthWorkingDayBack = (today, count) => {

        let date = today;
        let found = 0;

        for (let i = 0; i < count + 366; i++) {

            if (Ren.WorkingDayUtils.isWorkingDay(date) && ++found === count) return date;

            date = addUtcDays(date, -1);
        }

        return date;
    };

    /**
     * Gets the inclusive window of sortable dates a relative date operator matches, or null where
     * its N is missing or not positive:
     *
     *     current   the whole of this period (today, this week, ...)
     *     toDate    this period up to and including today
     *     previous  the whole of the period before this one
     *     rolling   the N days, weeks, months, ... up to and including today, as "the last 3
     *               months" on 16 October runs from 17 July; working days span every date from
     *               the Nth working day back
     *     calendar  the N whole periods before this one, leaving this one out
     */
    const getRelativeDateWindow = (relativeDate, value, today) => {

        const kind = relativeDate.kind;
        const unit = relativeDate.unit;

        const thisPeriodStart = startOfPeriod(today, unit, 0);
        const thisPeriodEnd = addUtcDays(startOfPeriod(today, unit, 1), -1);
        const lastPeriodEnd = addUtcDays(thisPeriodStart, -1);

        switch (kind) {

            case "current": return { start: thisPeriodStart, end: thisPeriodEnd };
            case "toDate": return { start: thisPeriodStart, end: today };
            case "previous": return { start: startOfPeriod(today, unit, -1), end: lastPeriodEnd };
        }

        const count = Math.floor(toNumber(value));
        if (isNaN(count) || count <= 0) return null;

        if (kind === "calendar") {
            return { start: startOfPeriod(today, unit, -count), end: lastPeriodEnd };
        }

        switch (unit) {

            case "day": return { start: addUtcDays(today, 1 - count), end: today };
            case "week": return { start: addUtcDays(today, 1 - count * 7), end: today };
            case "workingDay": return { start: nthWorkingDayBack(today, count), end: today };
        }

        const monthsBack = count * MONTHS_PER_UNIT[unit];

        return { start: addUtcDays(monthsBefore(today, monthsBack), 1), end: today };
    };

    // Builds a date-comparison test for a cell.  An unparseable cell fails every date operator.
    const buildDateTest = (operatorId, value, value2) => {

        const relativeDate = getOperator(operatorId).relativeDate;

        if (relativeDate) {

            const window = getRelativeDateWindow(relativeDate, value, Ren.DateUtils.today());
            if (!window) return () => false;

            const start = toSortableUtc(window.start);
            const end = toSortableUtc(window.end);

            return (cell) => {

                const s = toSortableDate(cell);

                return s !== null && s >= start && s <= end;
            };
        }

        switch (operatorId) {

            case "dateBefore": {

                const referenceSortable = toSortableDate(value);
                if (!referenceSortable) return () => false;
                return (cell) => { const s = toSortableDate(cell); return s !== null && s < referenceSortable; };
            }

            // Inclusive, where "is before" is exclusive, so the pair form a half-open range.
            case "dateAfter": {

                const referenceSortable = toSortableDate(value);
                if (!referenceSortable) return () => false;
                return (cell) => { const s = toSortableDate(cell); return s !== null && s >= referenceSortable; };
            }

            // From the first date up to, but not including, the second, as a calendar picks a
            // range, and so as "is on or after" and "is before" together would.
            case "dateBetween": {

                let start = toSortableDate(value);
                let end = toSortableDate(value2);
                if (!start || !end) return () => false;

                // So a range typed either way round is the same.
                if (start > end) {

                    const swap = start;
                    start = end;
                    end = swap;
                }

                return (cell) => {

                    const s = toSortableDate(cell);

                    return s !== null && s >= start && s < end;
                };
            }
        }

        return null;
    };

    // --- Ranking (needs the whole column) -------------------------------------------------------

    // Builds a top-N / bottom-N test from the column's whole value population.  An invalid N keeps
    // every row rather than hiding them all, and ties at the cut-off are kept, as in Excel.
    const makeRankingScanTest = (operatorId, value, allValues) => {

        const count = Math.floor(toNumber(value));
        if (isNaN(count) || count <= 0) return () => true;

        const numbers = [];

        for (let i = 0; i < allValues.length; i++) {

            const number = toNumber(allValues[i]);
            if (!isNaN(number)) numbers.push(number);
        }

        if (numbers.length === 0) return () => true;

        const isTop = operatorId === "topN";

        numbers.sort((a, b) => isTop ? b - a : a - b);

        const threshold = numbers[Math.min(count, numbers.length) - 1];

        if (isTop) return (cell) => { const n = toNumber(cell); return !isNaN(n) && n >= threshold; };
        return (cell) => { const n = toNumber(cell); return !isNaN(n) && n <= threshold; };
    };

    // --- Public compile -------------------------------------------------------------------------

    /**
     * Compiles a compare predicate into a per-row test over a column's normalised string value, or
     * null for an unknown operator.  A ranking operator gives a makeScanTest(allValues) to build
     * from the whole column instead, and the custom function operator its source for the caller to
     * run per row.
     *
     * @returns {{ needsRow: boolean, needsScan: boolean, test: ?function, makeScanTest: ?function,
     *     functionSpecification: ?string }|null}
     */
    const compile = (predicate) => {

        if (!predicate || predicate.type !== "compare") return null;

        const descriptor = getOperator(predicate.operator);
        if (!descriptor) return null;

        // The caller runs the function itself, having the row context this module does not.
        if (descriptor.needsRow) {

            return {
                needsRow: true,
                needsScan: false,
                test: null,
                makeScanTest: null,
                functionSpecification: predicate.value
            };
        }

        if (descriptor.needsScan) {

            return {
                needsRow: false,
                needsScan: true,
                test: null,
                makeScanTest: (allValues) =>
                    makeRankingScanTest(predicate.operator, predicate.value, allValues)
            };
        }

        let test = null;

        switch (descriptor.group) {

            case "Text": test = buildTextTest(predicate.operator, predicate.value); break;
            case "Number": test = buildComparisonTest(predicate.operator, predicate.value, predicate.value2); break;
            case "Date":
                test = buildDateTest(predicate.operator, predicate.value, predicate.value2);
                break;
            case "Blank": test = buildBlankTest(predicate.operator); break;
        }

        if (!test) return null;

        return { needsRow: false, needsScan: false, test, makeScanTest: null };
    };

    // --- Validation, summary and list helpers ---------------------------------------------------

    // Gets a value indicating whether a predicate's value inputs are filled in enough to apply it.
    const isComplete = (operator, value, value2) => {

        const descriptor = getOperator(operator);
        if (!descriptor) return false;

        if (descriptor.arity >= 1 && normalise(value).trim() === "") return false;
        if (descriptor.arity >= 2 && normalise(value2).trim() === "") return false;

        return true;
    };

    // Builds a compare predicate for a column, or null when the inputs are incomplete.  orGroup
    // names the slot leading the OR group it belongs to, omitted where it leads its own.
    const buildPredicate = (column, operator, value, value2, slot, orGroup) => {

        if (!isComplete(operator, value, value2)) return null;

        const descriptor = getOperator(operator);
        const predicate = { type: "compare", column, operator };

        if (slot) predicate.slot = slot;

        if (orGroup !== null && orGroup !== undefined) predicate.orGroup = orGroup;

        if (descriptor.arity >= 1) predicate.value = value;
        if (descriptor.arity >= 2) predicate.value2 = value2;

        return predicate;
    };

    // Gets a short human summary of a compare predicate for a chip or label.
    const summarise = (predicate) => {

        if (!predicate || predicate.type !== "compare") return "";

        const descriptor = getOperator(predicate.operator);
        if (!descriptor) return "";

        const value = normalise(predicate.value);
        const value2 = normalise(predicate.value2);

        switch (predicate.operator) {

            case "contains": return `contains "${value}"`;
            case "notContains": return `excludes "${value}"`;
            case "beginsWith": return `starts "${value}"`;
            case "notBeginsWith": return `not starting "${value}"`;
            case "endsWith": return `ends "${value}"`;
            case "notEndsWith": return `not ending "${value}"`;
            case "equals": return `= "${value}"`;
            case "notEquals": return `≠ "${value}"`;
            case "matches": return `matches /${value}/`;
            case "matchesIgnoreCase": return `matches /${value}/i`;
            case "notMatches": return `not /${value}/`;
            case "notMatchesIgnoreCase": return `not /${value}/i`;
            case "greaterThan": return `> ${value}`;
            case "greaterThanOrEqual": return `≥ ${value}`;
            case "lessThan": return `< ${value}`;
            case "lessThanOrEqual": return `≤ ${value}`;
            case "between": return `${value} to ${value2}`;
            case "dateLastNDays": return `last ${value} days`;
            case "dateLastNWorkingDays": return `last ${value} working days`;
            case "dateLastNWeeks": return `last ${value} weeks`;
            case "dateLastNMonths": return `last ${value} months`;
            case "dateLastNQuarters": return `last ${value} quarters`;
            case "dateLastNYears": return `last ${value} years`;
            case "dateLastNCalendarWeeks": return `last ${value} calendar weeks`;
            case "dateLastNCalendarMonths": return `last ${value} calendar months`;
            case "dateLastNCalendarQuarters": return `last ${value} calendar quarters`;
            case "dateLastNCalendarYears": return `last ${value} calendar years`;
            case "dateBefore": return `before ${value}`;
            case "dateAfter": return `on or after ${value}`;
            case "dateBetween": return `from ${value}, before ${value2}`;
            case "topN": return `Top ${value}`;
            case "bottomN": return `Bottom ${value}`;
            case "customFunction": return "custom";
        }

        return descriptor.label;
    };

    const isCompareForColumn = (predicate, column) =>
        !!predicate && predicate.type === "compare" && predicate.column === column;

    // Gets the slot a compare predicate occupies among its column's compare filters, or 0.
    const slotOf = (predicate) => {

        const slot = Number(predicate?.slot);

        return isNaN(slot) ? 0 : slot;
    };

    // Gets the slot leading a compare predicate's OR group, its own slot where it names none.
    const orGroupLeadOf = (predicate) => predicate?.orGroup ?? slotOf(predicate);

    const isCompareForColumnSlot = (predicate, column, slot) =>
        isCompareForColumn(predicate, column) && slotOf(predicate) === (slot ?? 0);

    // Gets the compare predicate a column carries in one slot (the first by default), or null.
    const getComparePredicateForColumn = (predicates, column, slot) => {

        if (!Array.isArray(predicates)) return null;

        for (let i = 0; i < predicates.length; i++) {
            if (isCompareForColumnSlot(predicates[i], column, slot)) return predicates[i];
        }

        return null;
    };

    // Gets every compare predicate a column carries, in slot order.
    const getComparePredicatesForColumn = (predicates, column) => {

        const result = [];

        if (!Array.isArray(predicates)) return result;

        for (let i = 0; i < predicates.length; i++) {
            if (isCompareForColumn(predicates[i], column)) result.push(predicates[i]);
        }

        result.sort((left, right) => slotOf(left) - slotOf(right));

        return result;
    };

    // Gets the slots a column's compare predicates currently occupy, in order.
    const getUsedSlotsForColumn = (predicates, column) =>
        getComparePredicatesForColumn(predicates, column).map(slotOf);

    // Gets the lowest slot number not already taken.
    const getNextFreeSlot = (usedSlots) => {

        const taken = new Set(usedSlots);

        let slot = 0;

        while (taken.has(slot)) slot++;

        return slot;
    };

    // Returns a new predicate list with the column's compare predicate in one slot replaced, or
    // removed when newPredicate is null.
    const replaceComparePredicateForColumn = (predicates, column, newPredicate, slot) => {

        const result = [];
        const source = Array.isArray(predicates) ? predicates : [];

        for (let i = 0; i < source.length; i++) {
            if (!isCompareForColumnSlot(source[i], column, slot)) result.push(source[i]);
        }

        if (newPredicate) result.push(newPredicate);

        return result;
    };

    // Returns a new predicate list with every compare predicate the column carries taken out.
    const removeComparePredicatesForColumn = (predicates, column) => {

        const result = [];
        const source = Array.isArray(predicates) ? predicates : [];

        for (let i = 0; i < source.length; i++) {
            if (!isCompareForColumn(source[i], column)) result.push(source[i]);
        }

        return result;
    };

    return {
        GROUPS,
        COLUMN_KINDS,
        OPERATORS,
        getOperator,
        getOperatorsInGroup,
        operatorAppliesToColumnKind,
        getOperatorsInGroupForColumnKind,
        getGroupsForColumnKind,
        getDefaultOperatorForColumnKind,
        columnKindForFormat,
        compile,
        isComplete,
        buildPredicate,
        summarise,
        slotOf,
        orGroupLeadOf,
        getComparePredicateForColumn,
        getComparePredicatesForColumn,
        getUsedSlotsForColumn,
        getNextFreeSlot,
        replaceComparePredicateForColumn,
        removeComparePredicatesForColumn
    };
})();
