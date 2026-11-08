/**
 * Utils for working day calculations, by workingDays in ren.config: its weekendDays (0 being
 * Sunday) and its nonWorkingDays, the yyyy-MM-dd dates of the bank holidays and the like.
 */
Ren.WorkingDayUtils = (() => {

    let configuredNonWorkingDays = null;
    let nonWorkingDays = new Set();

    const getWorkingDaysConfig = () => Ren.Config.getConfig().workingDays;

    const getNonWorkingDays = () => {

        const configured = getWorkingDaysConfig().nonWorkingDays;

        if (configured !== configuredNonWorkingDays) {

            configuredNonWorkingDays = configured;
            nonWorkingDays = new Set(configured);
        }

        return nonWorkingDays;
    };

    const isWeekend = (date) => getWorkingDaysConfig().weekendDays.includes(date.getUTCDay());

    const isNonWorkingDay = (date) => {

        const dateString = toDateObject(date).toISOString().split("T")[0];
        return getNonWorkingDays().has(dateString);
    };

    const isWorkingDay = (date) => {

        return !isWeekend(date) && !isNonWorkingDay(date);
    };

    /**
     * The day a date stands for, as UTC midnight.  Counting is done in UTC throughout, so that the
     * day of the week and the date read for the non-working days both come off the same day; a
     * Date that carries a time of day is read in local time first, as that is the day it stands
     * for (a chart's dates are shifted an hour off UTC midnight over British Summer Time).
     */
    const toDateObject = (date) => {

        if (date instanceof Date) {

            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }

        const { y, m, d } = Ren.DateUtils.parseSortableDate(date);
        return new Date(Date.UTC(y, m - 1, d));
    };

    const countWorkingDays = (startDate, endDate) => {

        let count = 0;
        const current = new Date(toDateObject(startDate));
        endDate = toDateObject(endDate);

        while (current < endDate) {

            if (isWorkingDay(current)) count++;

            current.setUTCDate(current.getUTCDate() + 1);
        }

        return count;
    };

    return {
        isNonWorkingDay,
        isWorkingDay,
        countWorkingDays,
        toDateObject
    };
})();
