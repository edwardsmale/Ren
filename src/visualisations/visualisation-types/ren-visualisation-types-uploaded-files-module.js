Ren.VisualisationTypes_UploadedFilesModule = {
    visualisationTypeName: "UploadedFilesModule",
    tagName: "ren-uploaded-files-module",
    availableOptions: {

        // The group whose uploaded files this module makes visible and editable.  All
        // visualisations declaring the same uploaded-files-group are updated together.
        uploadedFilesGroup: "String",

        // Optional initial values for the three editable uploaded files settings.
        defaultUploadedFiles: "String",
        defaultUploadedFilesDelimiter: "String",
        defaultUploadedFilesHaveHeaderRows: "Boolean",

        // Optional pipe-separated column headings to give the data when the uploaded (or pasted)
        // files have no header rows of their own.  Editable via the module's context menu.
        defaultUploadedFilesColumnHeadings: "String"
    },
    synchronisedOptions: {

    },

    // The properties saved with the report settings (see Ren.VisualisationPropertiesTransformer):
    // which of the module's parts the user has hidden via its "View settings" context menu. Omitted
    // while empty, so a module with everything shown adds nothing to the saved settings.
    persistedProperties: [
        {
            name: "viewSettings",
            transform: (viewSettings) =>
                viewSettings && Object.keys(viewSettings).length > 0 ? viewSettings : undefined
        }
    ],
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyDefaultLogic: (_visualisation, parameters) => {

        // Register the module's markup-declared defaults with the collection during element
        // parsing, before any grid in the group has its data source URI resolved.  This lets grids
        // fetch with the correct uploaded files on the very first render.
        if (parameters.uploadedFilesGroup) {

            Ren.UploadedFilesGroupsCollection.registerGroupDefaults(parameters.uploadedFilesGroup, {
                uploadedFiles: parameters.defaultUploadedFiles,
                uploadedFilesDelimiter: parameters.defaultUploadedFilesDelimiter,
                uploadedFilesHaveHeaderRows: parameters.defaultUploadedFilesHaveHeaderRows,
                uploadedFilesColumnHeadings: parameters.defaultUploadedFilesColumnHeadings
            });
        }
    },
    getCreateFunction: () => Ren.CreateUploadedFilesModule
};
