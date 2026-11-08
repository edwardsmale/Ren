Ren.VisualisationTypes_WordCloud = {
    visualisationTypeName: "WordCloud",
    tagName: "ren-word-cloud",
    supportsEffects: true,
    availableOptions: {
        dataSourceUri: "String",
        dataTabIndex: "Number",
        dataTabGroup: "String",
        wordHeading: "String",
        countHeading: "String",
        selectedColumns: "Array",
        wordCloudColourPalette: "String",
        wordCloudIndividualWords: "Boolean"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        visualisationWidth: "56rem",
        visualisationHeight: "37.5rem",
        popupWidth: "56rem",
        popupHeight: "37.5rem",
        dataTabIndex: 1,
        dataTabGroup: null,
        wordCloudColourPalette: "accent",
        wordCloudIndividualWords: false,
        resizeToFitContentOnLoad: false,
        fillAvailableSpace: true
    },
    applyDefaultLogic: () => {

    },
    getCreateFunction: () => Ren.CreateWordCloud
};
