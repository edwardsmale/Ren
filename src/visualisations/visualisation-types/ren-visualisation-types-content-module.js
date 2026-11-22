Ren.VisualisationTypes_ContentModule = {
    visualisationTypeName: "ContentModule",
    tagName: "ren-content-module",
    availableOptions: {
        "maxRows": "Number",
        "dataTabIndex": "Number",
        "moduleCssClass": "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedHTML: (visualisation, _parameters, html) => {

        visualisation.formatFunction = html;
    },
    getCreateFunction: () => Ren.CreateContentModule
};
