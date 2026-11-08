/**
 * Applies a set of freshly-produced uploaded file paths to an uploaded files group, so grids in the
 * group re-fetch with them.  Shared by the uploaded files module's Upload button and the paste data
 * module: both end up with one or more server file paths that should become the group's uploaded
 * files.  Optionally auto-detects the delimiter from the files' content, and applies any additional
 * settings (delimiter, header-rows) supplied by the caller, in a single group update.
 */
Ren.UploadedFilesContentApplier = (() => {

    // Asks the server for the most appropriate delimiter for the given files.  Resolves to the
    // detected delimiter, or null if it could not be detected.
    const detectDelimiter = (filePaths, hasIISLogFiles) => {

        return Ren.FetchUtils.fetch(Ren.Endpoints.getUrl("autoDetectUploadedFileDelimiter"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePaths, hasIISLogFiles: hasIISLogFiles === true })
        })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => (data && data.delimiter) || null)
            .catch(() => null);
    };

    // Applies the given file paths (and any extra settings) to the group.  When autoDetectDelimiter
    // is set and the caller has not supplied a delimiter, the delimiter is detected first so the
    // group is updated once with everything in place.
    const applyPaths = (visualisation, filePaths, options) => {

        options ??= {};

        const settings = Object.assign(
            { uploadedFiles: filePaths.join(",") },
            options.settings || {}
        );

        const apply = () => Ren.UploadedFilesModuleUpdater.updateSettings(visualisation, settings);

        const needsDelimiter = options.autoDetectDelimiter &&
            (settings.uploadedFilesDelimiter === undefined ||
                settings.uploadedFilesDelimiter === null ||
                settings.uploadedFilesDelimiter === "");

        if (needsDelimiter) {

            detectDelimiter(filePaths, options.hasIISLogFiles).then((delimiter) => {

                if (delimiter) settings.uploadedFilesDelimiter = delimiter;

                apply();
            });
        }
        else {

            apply();
        }
    };

    return {
        applyPaths
    };
})();
