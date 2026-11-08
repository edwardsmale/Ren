/**
 * The charts' date periods and date formats.
 *
 * A period is { getPeriodStartAtOrBefore, getPeriodStartAtOrAfter, addPeriods, getPeriodStarts }
 * over UTC periods, the chart's dates being UTC midnights (see
 * Ren.DateValueChartCalculator.getTimeInterval).
 */
Ren.ChartDateTime = (() => {

    const MILLISECONDS_PER_SECOND = 1000;
    const MILLISECONDS_PER_MINUTE = 60000;
    const MILLISECONDS_PER_HOUR = 3600000;

    const WEEKDAY_NAMES = [
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];

    /**
     * Creates a period from functions that move a date, in place, back to the start of its
     * period and on by a number of periods.
     */
    const createPeriod = (floorInPlace, offsetInPlace) => {

        const getPeriodStartAtOrBefore = date => {

            const result = new Date(+date);

            floorInPlace(result);

            return result;
        };

        const getPeriodStartAtOrAfter = date => {

            const result = new Date(date - 1);

            floorInPlace(result);
            offsetInPlace(result, 1);
            floorInPlace(result);

            return result;
        };

        const addPeriods = (date, count) => {

            const result = new Date(+date);

            offsetInPlace(result, Math.floor(count));

            return result;
        };

        /**
         * Gets the start of every period from start (inclusive) to stop (exclusive).
         */
        const getPeriodStarts = (start, stop) => {

            const dates = [];
            const current = getPeriodStartAtOrAfter(start);

            if (!(current < stop)) return dates;

            let previous;

            do {

                previous = new Date(+current);
                dates.push(previous);

                offsetInPlace(current, 1);
                floorInPlace(current);
            }
            while (previous < current && current < stop);

            return dates;
        };

        return {
            getPeriodStartAtOrBefore,
            getPeriodStartAtOrAfter,
            addPeriods,
            getPeriodStarts
        };
    };

    /**
     * Creates a period of every step-th smaller period, counted by the field getField reads
     * (minutes of the hour, say, or months of the year).
     */
    const createSteppedPeriod = (floorInPlace, offsetInPlace, getField, step) => {

        const isOnStep = date => getField(date) % step === 0;

        return createPeriod(
            date => {

                if (!(date >= date)) return;

                floorInPlace(date);

                while (!isOnStep(date)) {

                    date.setTime(date - 1);
                    floorInPlace(date);
                }
            },
            (date, count) => {

                if (!(date >= date)) return;

                const direction = count < 0 ? -1 : 1;

                for (let i = 0; i < Math.abs(count); i++) {

                    do {

                        offsetInPlace(date, direction);
                    }
                    while (!isOnStep(date));
                }
            }
        );
    };

    const floorToSecond = date => date.setTime(date - date.getUTCMilliseconds());
    const addSeconds = (date, count) => date.setTime(+date + count * MILLISECONDS_PER_SECOND);

    const floorToMinute = date => date.setUTCSeconds(0, 0);
    const addMinutes = (date, count) => date.setTime(+date + count * MILLISECONDS_PER_MINUTE);

    const floorToHour = date => date.setUTCMinutes(0, 0, 0);
    const addHours = (date, count) => date.setTime(+date + count * MILLISECONDS_PER_HOUR);

    const floorToDay = date => date.setUTCHours(0, 0, 0, 0);
    const addDays = (date, count) => date.setUTCDate(date.getUTCDate() + count);

    // Weeks start on Monday, not Sunday.
    const floorToWeek = date => {

        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
        date.setUTCHours(0, 0, 0, 0);
    };

    const addWeeks = (date, count) => date.setUTCDate(date.getUTCDate() + count * 7);

    const floorToMonth = date => {

        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
    };

    const addMonths = (date, count) => date.setUTCMonth(date.getUTCMonth() + count);

    const floorToYear = date => {

        date.setUTCMonth(0, 1);
        date.setUTCHours(0, 0, 0, 0);
    };

    const addYears = (date, count) => date.setUTCFullYear(date.getUTCFullYear() + count);

    const utcSecond = createPeriod(floorToSecond, addSeconds);
    const utcMinute = createPeriod(floorToMinute, addMinutes);
    const utcQuarterHour =
        createSteppedPeriod(floorToMinute, addMinutes, date => date.getUTCMinutes(), 15);
    const utcHour = createPeriod(floorToHour, addHours);
    const utcDay = createPeriod(floorToDay, addDays);
    const utcWeek = createPeriod(floorToWeek, addWeeks);
    const utcMonth = createPeriod(floorToMonth, addMonths);
    const utcQuarter = createSteppedPeriod(floorToMonth, addMonths, date => date.getUTCMonth(), 3);
    const utcYear = createPeriod(floorToYear, addYears);

    const getLocalParts = date => ({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds()
    });

    const getUtcParts = date => ({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds()
    });

    const createFormat = (pattern, getParts) => {

        const format = Ren.DatePattern.compile(pattern);

        return date => format(getParts(date instanceof Date ? date : new Date(+date)));
    };

    /**
     * Creates a function writing a date (or timestamp), in local time, to a Ren.DatePattern
     * pattern such as "d MMM yyyy".
     */
    const createLocalFormat = pattern => createFormat(pattern, getLocalParts);

    /**
     * Creates a function writing a date (or timestamp), in UTC, to a Ren.DatePattern pattern such
     * as "yyyy-MM-dd HH:mm:ss".
     */
    const createUtcFormat = pattern => createFormat(pattern, getUtcParts);

    /**
     * Gets the name of a date's day of the week, in local time.
     */
    const getWeekdayName = date => WEEKDAY_NAMES[date.getDay()];

    return {
        utcSecond,
        utcMinute,
        utcQuarterHour,
        utcHour,
        utcDay,
        utcWeek,
        utcMonth,
        utcQuarter,
        utcYear,
        createLocalFormat,
        createUtcFormat,
        getWeekdayName
    };
})();
