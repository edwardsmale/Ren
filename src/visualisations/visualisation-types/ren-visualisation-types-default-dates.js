Ren.VisualisationTypes_DefaultDates = {
    visualisationTypeName: "DefaultDates",
    tagName: "ren-default-dates",
    isVirtual: true,
    availableOptions: {
        startDate: "Date",
        endDate: "Date",
        dateRange: "String",
        compareEndDate: "Date",
        compareStartDate: "Date",
        compareDateRange: "String",
        wholeWeeks: "Boolean",
        wholeMonths: "Boolean",
        wholeQuarters: "Boolean",
        wholeYears: "Boolean",
        upToToday: "Boolean"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    getCreateFunction: null,
    getAddParametersFunction: () => Ren.SetDefaultDates
};
