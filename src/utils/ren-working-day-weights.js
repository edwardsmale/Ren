/**
 * The share of a period's trade each day usually brings, as a weight, for scaling a running
 * period's value up to an estimate of the whole.  The rules are those of workingDays in
 * ren.config: a working day weighs 1 unless one of its workingDayWeights lowers it, and a
 * non-working day weighs what the first of its nonWorkingDayWeights to apply gives it.
 *
 * A rule is { name, listedAs, weight, when }, listedAs being the name the tooltip lists it under
 * where that is not its own.  It applies to a day that meets every condition of its when, or to
 * every day if it has none:
 *
 *   dayRanges: [{ month, fromDay, toDay }] - the day falls in any of the ranges (month 1 being
 *     January).
 *   daysOfWeek: [] - the day of the week is one of these, 0 being Sunday.
 *   easterHolidays: { daysBefore, daysAfter } - the day falls within so many days of Easter
 *     Sunday.
 *   firstWorkingDaysOfYear: n - the day is in January and fewer than n working days follow New
 *     Year's Day before it.
 */
Ren.WorkingDayWeights = (() => {

    const easterSundays = new Map();

    const getEasterSunday = (year) => {

        let easterSunday = easterSundays.get(year);

        if (!easterSunday) {

            easterSunday = Ren.DateUtils.easterSunday(year);
            easterSundays.set(year, easterSunday);
        }

        return easterSunday;
    };

    /** Gets a value indicating whether a UTC-midnight date falls in one of the day ranges. */
    const isInDayRanges = (date, dayRanges) => {

        for (let i = 0; i < dayRanges.length; i++) {

            const dayRange = dayRanges[i];

            if (date.getUTCMonth() === dayRange.month - 1
                && date.getUTCDate() >= dayRange.fromDay
                && date.getUTCDate() <= dayRange.toDay) {

                return true;
            }
        }

        return false;
    };

    const isInEasterHolidays = (date, easterHolidays) => {

        const daysFromEaster = Ren.DateUtils.daysBetween(
            getEasterSunday(date.getUTCFullYear()),
            date
        );

        return daysFromEaster >= -easterHolidays.daysBefore
            && daysFromEaster <= easterHolidays.daysAfter;
    };

    const isInFirstWorkingDaysOfYear = (date, count) =>
        date.getUTCMonth() === 0
            && Ren.WorkingDayUtils.countWorkingDays(
                new Date(Date.UTC(date.getUTCFullYear(), 0, 1)),
                date
            ) < count;

    /** Gets a value indicating whether a rule applies to a UTC-midnight date. */
    const appliesTo = (rule, date) => {

        const when = rule.when;

        if (!when) return true;

        if (when.dayRanges && !isInDayRanges(date, when.dayRanges)) return false;

        if (when.daysOfWeek && !when.daysOfWeek.includes(date.getUTCDay())) return false;

        if (when.easterHolidays && !isInEasterHolidays(date, when.easterHolidays)) return false;

        if (when.firstWorkingDaysOfYear !== undefined
            && !isInFirstWorkingDaysOfYear(date, when.firstWorkingDaysOfYear)) {

            return false;
        }

        return true;
    };

    /** Gets the rule that sets a UTC-midnight day's weight, or null for an ordinary working day. */
    const getRule = (date) => {

        const workingDays = Ren.Config.getConfig().workingDays;
        const rules = Ren.WorkingDayUtils.isWorkingDay(date)
            ? workingDays.workingDayWeights
            : workingDays.nonWorkingDayWeights;

        for (let i = 0; i < rules.length; i++) {

            if (appliesTo(rules[i], date)) return rules[i];
        }

        return null;
    };

    /** Gets the rule that sets a day's weight, or null for an ordinary working day. */
    const getDayRule = (date) => getRule(Ren.WorkingDayUtils.toDateObject(date));

    /** Gets the weight of a day. */
    const getDayWeight = (date) => {

        const rule = getDayRule(date);

        return rule ? rule.weight : 1;
    };

    /**
     * Gets the weight of the days from one date up to (but not including) another.
     *
     * @returns {object} { weight, ruleNames }, ruleNames being the names the rules that weighted a
     *     day are listed under, in the order they first did.
     */
    const sumWeights = (startDate, endDate) => {

        let weight = 0;
        const ruleNames = [];
        const current = new Date(Ren.WorkingDayUtils.toDateObject(startDate));
        const end = Ren.WorkingDayUtils.toDateObject(endDate);

        while (current < end) {

            const rule = getRule(current);

            if (!rule) {

                weight += 1;
            }
            else {

                weight += rule.weight;

                const ruleName = rule.listedAs ?? rule.name;
                if (ruleNames.indexOf(ruleName) === -1) ruleNames.push(ruleName);
            }

            current.setUTCDate(current.getUTCDate() + 1);
        }

        return { weight, ruleNames };
    };

    return {
        getDayRule,
        getDayWeight,
        sumWeights
    };
})();
