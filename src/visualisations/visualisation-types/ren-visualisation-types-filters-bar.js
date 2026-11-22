Ren.VisualisationTypes_FiltersBar = {
    visualisationTypeName: "FiltersBar",
    tagName: "ren-filters-bar",
    renderImmediately: true,
    availableOptions: {
        title: "String",
        style: "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedHTML: (visualisation, _parameters, html) => {

        visualisation.contents = html;
    },
    getCreateFunction: () => Ren.CreateFiltersBar
};
