Ren.DateAcronyms = (() => {

    const getSortableDateRangeByAcronym = (
        acronym,
        wholeWeeks,
        wholeMonths,
        wholeQuarters,
        wholeYears,
        upToToday) => {

        const actualToday = Ren.DateUtils.todayAsSortableDate();

        let today = actualToday;

        if (wholeWeeks) {
            today = Ren.DateUtils.startOfCurrentWeekAsSortableDate();
        }
        else if (wholeMonths) {

            today = Ren.DateUtils.startOfCurrentMonthAsSortableDate();
        }
        else if (wholeQuarters) {

            today = Ren.DateUtils.startOfCurrentQuarterAsSortableDate();
        }
        else if (wholeYears) {

            today = Ren.DateUtils.startOfCurrentYearAsSortableDate();
        }

        // The whole week/month/quarter/year snapping applies to the start of the range as usual,
        // but with upToToday the range runs to today rather than to the start of the current
        // period.
        const rangeEnd = upToToday ? actualToday : today;

        const wholeFn = (sortableDate) => {

            if (wholeWeeks) {
                return Ren.DateUtils.toSortableStartOfWeek(sortableDate);
            }
            else if (wholeMonths) {

                return Ren.DateUtils.toSortableStartOfMonth(sortableDate);
            }
            else if (wholeQuarters) {

                return Ren.DateUtils.toSortableStartOfQuarter(sortableDate);
            }
            else if (wholeYears) {

                return Ren.DateUtils.toSortableStartOfYear(sortableDate);
            }
            else {

                return sortableDate;
            }
        };

        const monthsMatch = acronym.match(/^L(\d+)M$/);

        if (monthsMatch) {

            const months = parseInt(monthsMatch[1], 10);
            return {
                getStartDate: () => wholeFn(Ren.DateUtils.addMonths(today, -months)),
                getEndDate: () => rangeEnd
            };
        }

        const daysMatch = acronym.match(/^L(\d+)D$/);

        if (daysMatch) {

            const days = parseInt(daysMatch[1], 10);
            return {
                getStartDate: () => wholeFn(Ren.DateUtils.addDaysToSortableDate(today, -days)),
                getEndDate: () => rangeEnd
            };
        }

        const yearsMatch = acronym.match(/^L(\d*)Y$/);

        if (yearsMatch) {

            const years = yearsMatch[1] ? parseInt(yearsMatch[1], 10) : 1;
            return {
                getStartDate: () => wholeFn(Ren.DateUtils.addYears(today, -years)),
                getEndDate: () => rangeEnd
            };
        }

        switch (acronym) {

            case "LM":
                return {
                    getStartDate: () => wholeFn(Ren.DateUtils.addMonths(today, -1)),
                    getEndDate: () => rangeEnd
                };
            case "LQ":
                return {
                    getStartDate: () => wholeFn(Ren.DateUtils.addQuarters(today, -1)),
                    getEndDate: () => rangeEnd
                };
            case "MTD":
                return {
                    getStartDate: () => wholeFn(Ren.DateUtils.startOfCurrentMonthAsSortableDate()),
                    getEndDate: () => rangeEnd
                };
            case "QTD":
                return {
                    getStartDate: () => wholeFn(Ren.DateUtils.startOfCurrentQuarterAsSortableDate()),
                    getEndDate: () => rangeEnd
                };
            case "YTD":
                return {
                    getStartDate: () => wholeFn(Ren.DateUtils.startOfCurrentYearAsSortableDate()),
                    getEndDate: () => rangeEnd
                };

            case "Not set":
                return {
                    getStartDate: () => "2000-01-01",
                    getEndDate: () => "2100-01-01"
                };
            default:
                return null;
        }
    };

    const getCompareDateRangeByAcronym = (acronym, sortableStartDate, sortableEndDate) => {

        switch (acronym) {

            case "YoY":
                return {
                    getStartDate: () => Ren.DateUtils.addYears(sortableStartDate, -1),
                    getEndDate: () => Ren.DateUtils.addYears(sortableEndDate, -1)
                };

            case "QoQ":
                return {
                    getStartDate: () => Ren.DateUtils.addMonths(sortableStartDate, -3),
                    getEndDate: () => Ren.DateUtils.addMonths(sortableEndDate, -3)
                };

            case "MoM":
                return {
                    getStartDate: () => Ren.DateUtils.addMonths(sortableStartDate, -1),
                    getEndDate: () => Ren.DateUtils.addMonths(sortableEndDate, -1)
                };

            case "WoW":
                return {
                    getStartDate: () => Ren.DateUtils.addWeeksToSortableDate(sortableStartDate, -1),
                    getEndDate: () => Ren.DateUtils.addWeeksToSortableDate(sortableEndDate, -1)
                };

            case "PreviousPeriod": {

                const days = Ren.DateUtils.daysBetweenSortableDates(sortableStartDate, sortableEndDate);
                return {
                    getStartDate: () => Ren.DateUtils.addDaysToSortableDate(sortableStartDate, -days),
                    getEndDate: () => sortableStartDate
                };
            }

            default:
                return null;
        }
    };

    return {
        getSortableDateRangeByAcronym,
        getCompareDateRangeByAcronym
    };
})();
