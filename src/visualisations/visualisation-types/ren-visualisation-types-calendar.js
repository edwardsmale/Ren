Ren.VisualisationTypes_Calendar = {
    visualisationTypeName: "Calendar",
    tagName: "ren-calendar",
    availableOptions: {

        /**
         * The name under which the date ranges picked are announced, and under which changes made
         * elsewhere to the range being edited are listened for.
         */
        calendarGroup: "String",

        /**
         * The first day of the range to show as picked.
         */
        startDate: "Date",

        /**
         * The day after the last day of the range to show as picked.
         */
        endDate: "Date",

        /**
         * When true, a click picks a single day, announced as the range of that day, rather than
         * starting a range.
         */
        pickSingleDate: "Boolean",

        /**
         * The number of months shown side by side before the window is measured.
         */
        monthColumns: "Number",

        /**
         * The number of rows of months shown before the window is measured.
         */
        monthRows: "Number",

        /**
         * The dates to highlight, each a day, a month ("May 2026") or a quarter ("Q2 2026"),
         * written alone or as { date, label }, or a range of days as { start, end, label } with an
         * exclusive end.
         */
        highlightedDates: "Array",

        /**
         * The data source of further dates to highlight, declared as a date/value chart's
         * dateMarkers is: dataSourceUri or sqlFilename, and optionally dateColumn and labelColumn.
         */
        highlightedDatesSource: "Object",

        /**
         * The shorthand for a highlightedDatesSource that names its data source and nothing else.
         */
        highlightedDatesDataSourceUri: "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        excludeFromSerialization: true,
        isTransitive: true,

        // The calendar stays open while the report it is picking dates for reloads.
        isIndependentOfReportContext: true,

        // The window opens fitted to its first months, and resizing it then fits as many months
        // as the new size allows.
        fillAvailableSpace: true,
        fitPopupToContentExactly: true,
        resizeToFitContentOnLoad: true,

        // A calendar opened near the bottom of the page moves up to show its first months whole.
        raisePopupToFitContent: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateCalendar
};
