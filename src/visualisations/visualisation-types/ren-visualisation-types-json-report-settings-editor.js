Ren.VisualisationTypes_JsonReportSettingsEditor = {
    visualisationTypeName: "JsonReportSettingsEditor",
    tagName: "ren-json-report-settings-editor",
    availableOptions: {
        settingsName: "String",
        isPreset: "Boolean",
        isDefault: "Boolean",
        isPageReport: "Boolean",
        settingsReportName: "String"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        excludeFromSerialization: true,
        resizeToFitContentOnLoad: false,
        fillAvailableSpace: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateJsonReportSettingsEditor
};
