Ren.VisualisationTypes_DataSource = {
    visualisationTypeName: "DataSource",
    tagName: "ren-data-source",
    isVirtual: true,
    availableOptions: {
        name: "String",
        startDate: "Date",
        endDate: "Date",
        dateRange: "String",
        compareStartDate: "Date",
        compareEndDate: "Date",
        compareDateRange: "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {

    },
    applyDefaultLogic: () => {

    },
    getCreateFunction: () => Ren.CreateDataSource
};
