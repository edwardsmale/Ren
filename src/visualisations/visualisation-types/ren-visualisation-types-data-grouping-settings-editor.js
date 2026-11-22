Ren.VisualisationTypes_DataGroupingSettingsEditor = {
    visualisationTypeName: "DataGroupingSettingsEditor",
    tagName: "ren-data-grouping-settings-editor",
    availableOptions: {
        "dataGroupingSettingsGroup": "String",

        // Narrows the editor to a subset of its editing sections: any of "groupBy", "sort",
        // "columnSettings" and "groupFilters".  Omitted (or empty) shows them all.  Tiles left with
        // nothing to edit, and the structural controls belonging to the group-by section
        // (reordering, disabling and inserting groupings), are dropped.
        "editorSections": "Array",

        // Whether each grouping tile starts expanded rather than showing only its heading.
        "tilesExpandedInitially": "Boolean",

        // Opens only the named tile - a grouping entry index, or "dataRows" - leaving the rest
        // collapsed.  Overrides tilesExpandedInitially.
        "expandedTileKey": "String",

        // A column whose item the expanded tile's filter module shows from the start, even when
        // nothing filters it at that level.
        "includedColumnKey": "String",

        // Whether the collapsible sections within a tile start open.
        "sectionsExpandedInitially": "Boolean",

        // Whether rows that normally show their value as plain text with a pencil (the sort levels,
        // the group filters) start showing their edit controls instead.
        "editControlsRevealedInitially": "Boolean"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        excludeFromSerialization: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedHTML: () => {

    },
    getCreateFunction: () => Ren.CreateDataGroupingSettingsEditor
};
