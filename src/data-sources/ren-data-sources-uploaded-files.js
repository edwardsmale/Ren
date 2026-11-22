/**
 * Handling for the uploaded files parameters on data source URIs.
 */
Ren.DataSourcesUploadedFiles = (() => {

    const uploadedFilesParameterKeys = [
        "uploadedFile",
        "uploadedFiles",
        "uploadedFilesDelimiter",
        "uploadedFilesHaveHeaderRows",
        "uploadedFilesColumnHeadings",
        "uploadedFilesSkipIISNoise",
        "uploadedFilesApplyBSTCorrection"
    ];

    // The uploaded-files settings an uploaded files module holds for its group.
    const groupSettingKeys = [
        "uploadedFiles",
        "uploadedFilesDelimiter",
        "uploadedFilesHaveHeaderRows",
        "uploadedFilesColumnHeadings"
    ];

    // A pipe, as a free-text column heading is far more likely to contain a comma.
    const COLUMN_HEADINGS_SEPARATOR = "|";

    const booleanToParameterString = (value) => {

        if (value === true || value === "true") return "true";
        if (value === false || value === "false") return "false";
        return value;
    };

    const applyDefaultUploadedFilesOptions = (options) => {

        if (options.uploadedFile) {
            options.uploadedFiles = options.uploadedFile;
        }

        // No delimiter default: the server detects one from the files when none is given.
        if (options.uploadedFiles) {
            options.uploadedFilesHaveHeaderRows = options.uploadedFilesHaveHeaderRows ?? true;
        }
    };

    /**
     * Removes a grouped visualisation's own uploaded-files parameters, which its group's module
     * supplies instead, warning so an author notices the redundant markup.
     */
    const stripUploadedFilesOptionsForGroup = (visualisation, options) => {

        const strippedKeys = [];

        for (let i = 0; i < uploadedFilesParameterKeys.length; i++) {

            const key = uploadedFilesParameterKeys[i];

            if (options[key] !== undefined) {

                strippedKeys.push(key);
                delete options[key];
            }
        }

        if (strippedKeys.length) {

            console.warn(
                `[UploadedFilesGroup] The ${visualisation.visualisationTypeName} visualisation ` +
                `belongs to uploaded files group "${visualisation.uploadedFilesGroup}", so its ` +
                `own uploaded-files attributes (${strippedKeys.join(", ")}) are ignored.  Remove ` +
                `them from the markup and configure the files via the uploaded files module.`
            );
        }
    };

    /**
     * Writes an uploaded files group's settings onto a data source parameters object, replacing any
     * existing uploaded-files parameters.
     */
    const applyGroupSettingsToParameters = (parameters, settings) => {

        for (let i = 0; i < uploadedFilesParameterKeys.length; i++) {
            delete parameters[uploadedFilesParameterKeys[i]];
        }

        if (settings.uploadedFiles) {
            parameters.uploadedFiles = settings.uploadedFiles;
        }

        if (settings.uploadedFilesDelimiter != null && settings.uploadedFilesDelimiter !== "") {
            parameters.uploadedFilesDelimiter = settings.uploadedFilesDelimiter;
        }

        if (settings.uploadedFilesHaveHeaderRows != null) {

            parameters.uploadedFilesHaveHeaderRows =
                booleanToParameterString(settings.uploadedFilesHaveHeaderRows);
        }

        if (settings.uploadedFilesColumnHeadings) {
            parameters.uploadedFilesColumnHeadings = settings.uploadedFilesColumnHeadings;
        }
    };

    /**
     * Gets a copy of a data source URI with its uploaded-files parameters replaced by an uploaded
     * files group's settings.
     */
    const applyGroupSettingsToUri = (uri, settings) => {

        let newUri = Ren.UrlUtils.upsertQueryParameter(
            uri,
            "uploadedFiles",
            settings.uploadedFiles ?? ""
        );

        newUri = Ren.UrlUtils.upsertQueryParameter(
            newUri,
            "uploadedFilesDelimiter",
            settings.uploadedFilesDelimiter ?? ""
        );

        newUri = Ren.UrlUtils.upsertQueryParameter(
            newUri,
            "uploadedFilesHaveHeaderRows",
            settings.uploadedFilesHaveHeaderRows == null
                ? ""
                : booleanToParameterString(settings.uploadedFilesHaveHeaderRows)
        );

        newUri = Ren.UrlUtils.upsertQueryParameter(
            newUri,
            "uploadedFilesColumnHeadings",
            settings.uploadedFilesColumnHeadings ?? ""
        );

        return Ren.UrlUtils.sortDataSourceUriParameters(newUri);
    };

    const columnHeadingsToArray = (value) => {

        if (value === undefined || value === null || value === "") return [];

        return String(value).split(COLUMN_HEADINGS_SEPARATOR);
    };

    const columnHeadingsToSetting = (headings) => headings.join(COLUMN_HEADINGS_SEPARATOR);

    return {
        uploadedFilesParameterKeys,
        groupSettingKeys,
        booleanToParameterString,
        columnHeadingsToArray,
        columnHeadingsToSetting,
        applyDefaultUploadedFilesOptions,
        stripUploadedFilesOptionsForGroup,
        applyGroupSettingsToParameters,
        applyGroupSettingsToUri
    };
})();
