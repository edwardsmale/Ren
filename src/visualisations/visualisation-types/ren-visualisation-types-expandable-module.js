Ren.VisualisationTypes_ExpandableModule = {
    visualisationTypeName: "ExpandableModule",
    tagName: "ren-expandable-module",
    renderImmediately: true,
    availableOptions: {
        popupTitle: "String",
        isExpanded: "Boolean",
        key: "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        title: "",
        isExpanded: false,
        suppressLoadingAnimation: true
    },
    applyNestedHTML: (visualisation, _parameters, html) => {

        visualisation.contents = html;
    },
    getCreateFunction: () => Ren.CreateExpandableModule
};
