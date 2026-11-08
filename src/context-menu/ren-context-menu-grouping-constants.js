/**
 * Constants and helpers for grouping context menu items.
 *
 * The binning function lists are read off the format functions themselves rather than written out
 * here: each states the group it belongs to, the caption it is offered under and its place in the
 * order on a BINNING: line in its own header comment (see Ren.FunctionTags).  They stay reachable
 * under the names they always had, as properties that fetch them on use, because the functions are
 * parsed from the page and there is none to parse when this file runs.
 */
Ren.GroupingMenuConstants = (() => {

    const dateGroupingOptions = [
        // "By Date" suits both a Date column and a Date/Time one: on a Date column the calc
        // function leaves the day as it is, so the grouping is simply one group per date.
        {
            id: "date",
            text: "By Date",
            calcFunction: "date-day-start"
        },
        // DateTime-only options
        {
            id: "date-time",
            text: "By Date/Time",
            calcFunction: null,
            dateTimeOnly: true
        },
        {
            id: "hour",
            text: "Hour of Day",
            calcFunction: "date-hour-of-day",
            requiresColumns: true,
            dateTimeOnly: true,
            separator: "before"
        },
        {
            id: "working-hours",
            text: "Working Hours",
            calcFunction: "date-working-hours",
            requiresColumns: true,
            dateTimeOnly: true
        },
        // Common date options
        {
            id: "week",
            text: "By Week",
            calcFunction: "date-week-start",
            separator: "before"
        },
        {
            id: "month",
            text: "By Month",
            calcFunction: "date-month-start"
        },
        {
            id: "quarter",
            text: "By Quarter",
            calcFunction: "date-quarter-start"
        },
        {
            id: "year",
            text: "By Year",
            calcFunction: "date-year-start"
        },
        {
            id: "day-of-week",
            text: "Day of Week",
            calcFunction: "date-day-of-week",
            requiresColumns: true,
            separator: "before"
        },
        {
            id: "december",
            text: "December / Non-December",
            calcFunction: "date-december-vs-ex-dec",
            requiresColumns: true
        },
        {
            id: "weekday-weekend",
            text: "Weekday / Weekend",
            calcFunction: "date-weekday-vs-weekend",
            requiresColumns: true
        }
    ];

    const groups = () => Ren.FunctionTags.BINNING_GROUPS;

    return {
        get numberBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().Numbers);
        },
        get stringBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().Text);
        },
        get dateBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().Dates);
        },
        get dateTimeBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().DateTimes);
        },
        get universalBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().Universal);
        },
        get urlBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().Urls);
        },
        get userAgentBinningFunctions() {

            return Ren.FunctionTags.getBinningFunctions(groups().UserAgents);
        },
        dateGroupingOptions
    };
})();
