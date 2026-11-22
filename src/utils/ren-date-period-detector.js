/**
 * Detects the date period (year down to second) for a set of dates.
 */
Ren.DatePeriodDetector = (() => {

    // Maps a date-grouping calc function name to the period it groups by.  Built on first use, as
    // Ren.DatePeriodEnum is defined after this file is loaded.
    let calcFunctionPeriods = null;

    const getCalcFunctionPeriods = () => {

        if (calcFunctionPeriods === null) {

            calcFunctionPeriods = {
                "date-second-start": Ren.DatePeriodEnum.Second,
                "date-minute-start": Ren.DatePeriodEnum.Minute,
                "date-quarter-hour-start": Ren.DatePeriodEnum.QuarterHour,
                "date-hour-start": Ren.DatePeriodEnum.Hour,
                "date-day-start": Ren.DatePeriodEnum.Day,
                "date-week-start": Ren.DatePeriodEnum.Week,
                "date-month-start": Ren.DatePeriodEnum.Month,
                "date-quarter-start": Ren.DatePeriodEnum.Quarter,
                "date-year-start": Ren.DatePeriodEnum.Year
            };
        }

        return calcFunctionPeriods;
    };

    /**
     * Gets the date period that the given date-grouping calc function groups by, or undefined if
     * the name is not a recognised date-grouping function.
     */
    const getPeriodForCalcFunction = (calcFunctionName) =>
        getCalcFunctionPeriods()[calcFunctionName];

    /**
     * Gets the name of the date-grouping calc function that groups by the given period, or
     * undefined where no function groups by it.
     */
    const getCalcFunctionForPeriod = (period) => {

        const periods = getCalcFunctionPeriods();

        for (const calcFunctionName in periods) {

            if (periods[calcFunctionName] === period) return calcFunctionName;
        }

        return undefined;
    };

    /**
     * Gets the date period for the given dates, plus an axis period coarsened to avoid overcrowding
     * the axis with labels (not wired up yet).
     */
    const detectDatePeriod = (dates) => {

        const datePeriod = calculatePeriod(dates);

        const dateRange = Ren.DateUtils.getDateRange(dates);

        let axisPeriod = datePeriod;

        while (axisPeriod < Ren.DatePeriodEnum.Year
            && getNumberOfDates(dateRange, axisPeriod) > 40) {

            axisPeriod++;
        }

        return {
            datePeriod,
            axisPeriod
        };
    };

    /**
     * Gets the number of dates that would be generated for a given date range and period.
     */
    const getNumberOfDates = (dateRange, period) => {

        const { min: minDate, max: maxDate } = dateRange;

        const numDays = Math.floor((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

        switch (period) {

            case Ren.DatePeriodEnum.Second:
                return Math.floor((maxDate - minDate) / 1000) + 1;

            case Ren.DatePeriodEnum.Minute:
                return Math.floor((maxDate - minDate) / 60000) + 1;

            case Ren.DatePeriodEnum.QuarterHour:
                return Math.floor((maxDate - minDate) / 900000) + 1;

            case Ren.DatePeriodEnum.Hour:
                return Math.floor((maxDate - minDate) / 3600000) + 1;

            case Ren.DatePeriodEnum.Year:
                return numDays / 365;

            case Ren.DatePeriodEnum.Quarter:
                return numDays / 92;

            case Ren.DatePeriodEnum.Month:
                return numDays / 30.5;

            case Ren.DatePeriodEnum.Week:
                return numDays / 7;

            case Ren.DatePeriodEnum.Day:
                return numDays;

            default:
                throw new Error("Invalid date period: " + period);
        }
    };

    /**
     * Narrows the periods the dates seen so far could all sit on the start of, returning false once
     * none survive.  The flags carry between calls so that rows can be read one at a time.
     */
    const narrowPeriodFlags = (date, flags) => {

        const seconds = date.getSeconds();
        const minutes = date.getMinutes();

        flags.allMinute &&= (seconds === 0);
        flags.allQuarterHour &&= (seconds === 0 && minutes % 15 === 0);
        flags.allHour &&= (seconds === 0 && minutes === 0);
        flags.allDay &&= (seconds === 0 && minutes === 0 && date.getHours() === 0);

        // A time of day rules out every period from a day up.
        if (!flags.allDay) {

            flags.allYear = flags.allQuarter = flags.allMonth = flags.allWeek = false;

            return flags.allMinute;
        }

        const day = date.getDate();
        const month = date.getMonth();
        const weekDay = date.getDay();

        flags.allYear &&= (day === 1 && month === 0);
        flags.allQuarter &&= (day === 1 && (month === 0 || month === 3 || month === 6 || month === 9));
        flags.allMonth &&= (day === 1);
        flags.allWeek &&= (weekDay === 1);

        return true;
    };

    // Gets the flags for a set of dates not yet looked at, which could sit on any period's start.
    const createPeriodFlags = () => ({
        allYear: true,
        allQuarter: true,
        allMonth: true,
        allWeek: true,
        allDay: true,
        allHour: true,
        allQuarterHour: true,
        allMinute: true
    });

    // Gets a value indicating whether more dates could still narrow the flags.
    const canNarrowFurther = (flags) => flags.allMinute;

    const getPeriodFromFlags = (flags) => {

        if (flags.allYear) return Ren.DatePeriodEnum.Year;
        if (flags.allQuarter) return Ren.DatePeriodEnum.Quarter;
        if (flags.allMonth) return Ren.DatePeriodEnum.Month;
        if (flags.allWeek) return Ren.DatePeriodEnum.Week;
        if (flags.allDay) return Ren.DatePeriodEnum.Day;
        if (flags.allHour) return Ren.DatePeriodEnum.Hour;
        if (flags.allQuarterHour) return Ren.DatePeriodEnum.QuarterHour;
        if (flags.allMinute) return Ren.DatePeriodEnum.Minute;

        return Ren.DatePeriodEnum.Second;
    };

    const calculatePeriod = (dates) => {

        const flags = createPeriodFlags();

        for (let i = 0, len = dates.length; i < len; i++) {

            if (!narrowPeriodFlags(dates[i], flags)) break;
        }

        return getPeriodFromFlags(flags);
    };

    /**
     * Gets the period a set of rows' dates under the given heading are granular to, or null if
     * there are no dates.
     */
    const detectDatePeriodForRows = (rows, dateHeading) => {

        const periodAndExtent = detectDatePeriodAndExtentForRows(rows, dateHeading);

        return periodAndExtent ? periodAndExtent.datePeriod : null;
    };

    /**
     * Gets both the period and extent ({ datePeriod, minDate, maxDate }) of a set of rows' dates,
     * or null if there are no dates.
     */
    const detectDatePeriodAndExtentForRows = (rows, dateHeading) => {

        if (!rows) return null;

        const parseTime = Ren.DateUtils.parseDateTimeUniversalToTime;

        const flags = createPeriodFlags();

        // Times are compared as numbers and read through this one Date, so that nothing is
        // allocated per value.
        const flagDate = new Date(0);

        let anyDates = false;
        let minTime = 0;
        let maxTime = 0;

        // A value already seen can move neither the extent nor the period, and rows repeat dates
        // heavily, so each distinct value is parsed only once.  Rows sorted by date repeat a value
        // one after another, which is cheaper to catch than by looking in the set.
        const seenValues = new Set();
        let previousValue = null;

        for (let i = 0, len = rows.length; i < len; i++) {

            const value = rows[i][dateHeading];

            if (value === previousValue || Ren.IsNull(value)) continue;

            const sizeBeforeAdd = seenValues.size;

            seenValues.add(value);

            if (seenValues.size === sizeBeforeAdd) continue;

            previousValue = value;

            // Values that don't parse (blank, group or totals rows) say nothing about granularity.
            const time = parseTime(value, true);

            if (time === null) continue;

            if (!anyDates || time < minTime) minTime = time;
            if (!anyDates || time > maxTime) maxTime = time;

            anyDates = true;

            if (canNarrowFurther(flags)) {

                flagDate.setTime(time);
                narrowPeriodFlags(flagDate, flags);
            }
        }

        if (!anyDates) return null;

        return {
            datePeriod: getPeriodFromFlags(flags),
            minDate: new Date(minTime),
            maxDate: new Date(maxTime)
        };
    };

    /**
     * Gets the period a column's dates are granular to, or null if there are no dates.
     */
    const detectDatePeriodForColumn = (tabularData, columnIdOrHeading) => {

        if (!tabularData || !tabularData.RowModels) return null;

        const columnIndex = tabularData.columnResolver?.getColumnIndex(columnIdOrHeading);

        if (columnIndex == null) return null;

        const rowModels = tabularData.RowModels;
        const isCompressed = tabularData.IsColumnCompressed[columnIndex];
        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const parseDate = Ren.DateUtils.parseDateTimeUniversal;

        const flags = createPeriodFlags();

        let anyDates = false;

        for (let i = 0, len = tabularData.DataRowCount; i < len; i++) {

            const compressedValue = rowModels[i].CV[columnIndex];

            if (Ren.IsNullOrEmpty(compressedValue)) continue;

            const value = isCompressed
                ? decompressValue(compressedValue, columnIndex)
                : compressedValue;

            const date = parseDate(value, true);

            if (!date) continue;

            anyDates = true;

            if (!narrowPeriodFlags(date, flags)) break;
        }

        return anyDates ? getPeriodFromFlags(flags) : null;
    };

    return {
        detectDatePeriod,
        detectDatePeriodForColumn,
        detectDatePeriodForRows,
        detectDatePeriodAndExtentForRows,
        getPeriodForCalcFunction,
        getCalcFunctionForPeriod
    };
})();
