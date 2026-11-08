Ren.VisualisationTypes_KeyValueGrid = {
    visualisationTypeName: "KeyValueGrid",
    tagName: "ren-key-value-grid",
    availableOptions: {
        dataSourceUri: "String",
        settingsGroup: "String",
        dataTabIndex: "Number",
        dataTabGroup: "String",
        maxWidth: "String",
        maxHeight: "String",

        // Leaves out the rows whose value is null or undefined.  Off by default: an empty value is
        // part of what the row says, so the grid shows every column unless told otherwise.  With
        // several source rows a key is only left out when none of them has a value for it.
        hideNullOrUndefinedColumns: "Boolean",

        // How several source rows are laid out: "columns" (the default) gives each row its own
        // column beside the keys, "rows" stacks the rows underneath each key.
        multipleRowLayout: "String",

        // Stops the values that differ between the source rows being picked out.  Only ever
        // applies when there is more than one row to compare.
        hideDifferenceHighlighting: "Boolean",

        // Leaves out the keys whose value is the same in every source row, so that only what the
        // rows disagree about is listed.
        showOnlyDifferingColumns: "Boolean"
    },
    synchronisedOptions: {

    },

    // The properties saved with the report settings (see Ren.VisualisationPropertiesTransformer),
    // so that a grid declared as markup keeps the settings made through its context menu.
    persistedProperties: [
        "hideNullOrUndefinedColumns",
        "multipleRowLayout",
        "hideDifferenceHighlighting",
        "showOnlyDifferingColumns"
    ],
    defaultOptions: {
        dataTabIndex: 1
    },
    applyDefaultLogic: (_visualisation, parameters) => {

        if (parameters.dataTabGroup) {
            parameters.dataTabIndex = null;
        }
    },
    getCreateFunction: () => Ren.CreateKeyValueGrid
};
