/**
 * Creates the uploaded files module's Upload button and its hidden file input, and wires them so
 * that choosing file(s) from the native file dialog uploads them to the server and points the group
 * at the saved paths.  The server saves the files under the managed upload area and returns their
 * paths; the content applier then applies them to the group (auto-detecting the delimiter).
 */
Ren.UploadedFilesModuleUploader = (() => {

    // Uploads the chosen files to the existing upload endpoint, returning the parsed response
    // ({ filePaths, hasIISLogFiles }).
    const uploadFiles = (fileList) => {

        const formData = new FormData();

        for (let i = 0; i < fileList.length; i++) {

            formData.append("files", fileList[i]);
        }

        return Ren.FetchUtils.fetch(Ren.Endpoints.getUrl("uploadFiles"), {
            method: "POST",
            body: formData
        })
            .then((response) => response.ok
                ? response.json()
                : Promise.reject("Upload failed: " + response.statusText));
    };

    const onFilesChosen = (visualisation, fileInput) => {

        if (!fileInput.files || !fileInput.files.length) return;

        uploadFiles(fileInput.files)
            .then((data) => {

                const filePaths = (data && data.filePaths) || [];

                if (!filePaths.length) return;

                Ren.UploadedFilesContentApplier.applyPaths(visualisation, filePaths, {
                    autoDetectDelimiter: true,
                    hasIISLogFiles: data.hasIISLogFiles
                });
            })
            .catch((error) => Ren.Log.error(
                "UploadedFilesModuleUpload",
                Ren.Endpoints.getUrl("uploadFiles"),
                null,
                null,
                { error: String(error) }
            ))
            .finally(() => {

                // Reset so choosing the same file again still fires a change event.
                fileInput.value = "";
            });
    };

    // Builds the Upload button and its associated hidden file input.  The caller places the button
    // in the module heading; the file input can live anywhere in the module (it is not displayed).
    const createUploadControl = (visualisation) => {

        const fileInput = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleFileInput",
            {}
        );

        const button = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleUploadButton",
            {}
        );

        button.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => onFilesChosen(visualisation, fileInput));

        return { button, fileInput };
    };

    return {
        createUploadControl
    };
})();
