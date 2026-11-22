Ren.VisualisationTypes_DateSelector = {
    visualisationTypeName: "DateSelector",
    tagName: "ren-date-selector",
    availableOptions: {
        startDate: "Date",
        endDate: "Date",
        compareStartDate: "Date",
        compareEndDate: "Date",
        disabled: "Boolean",
        reloadsPage: "Boolean"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        reloadsPage: false,
        suppressLoadingAnimation: true
    },
    getCreateFunction: () => Ren.CreateDateSelector
};
