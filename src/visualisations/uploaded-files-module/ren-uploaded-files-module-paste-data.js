/**
 * Creates the uploaded files module's Paste data button and the popup it opens, where the user
 * pastes raw tabular data.  The pasted data is saved to a file in the managed upload area and the
 * module's uploaded files group is pointed at it, so grids in the group use it exactly as if it had
 * been uploaded.  This is handy for ad hoc data that isn't worth creating and uploading a file for.
 * The popup only asks for the data itself: the delimiter and whether the data has a header row come
 * from the group's current uploaded files settings, so pasted data is read exactly the same way an
 * uploaded file for the group would be (including the group's configured column headings when it
 * has no header row).
 */
Ren.UploadedFilesModulePasteData = (() => {

    const getGroupSettings = (visualisation) => {

        return Ren.UploadedFilesGroupsCollection.getGroupSettings(visualisation.uploadedFilesGroup);
    };

    const getDelimiter = (visualisation) => {

        return getGroupSettings(visualisation).uploadedFilesDelimiter || ",";
    };

    // Whether the group's uploaded files are configured as having header rows.  Pasted data is
    // treated the same way, so it is read with the same column headings as an uploaded file.
    const getHasHeaderRows = (visualisation) => {

        const settings = getGroupSettings(visualisation);

        if (settings.uploadedFilesHaveHeaderRows == null) return true;

        return Ren.DataSourcesUploadedFiles
            .booleanToParameterString(settings.uploadedFilesHaveHeaderRows) === "true";
    };

    // Saves the pasted data to the server, returning the parsed response ({ filePaths }).
    const savePastedData = (fields) => {

        return Ren.FetchUtils.fetch(Ren.Endpoints.getUrl("savePastedData"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(fields).toString()
        })
            .then((response) => response.ok
                ? response.json()
                : Promise.reject("Save failed: " + response.statusText));
    };

    // Applies the saved file to the group once the server has written it.  Only the files change:
    // the delimiter and header-rows settings are the group's own and already apply.
    const applySavedData = (visualisation, filePaths) => {

        if (!filePaths.length) return;

        Ren.UploadedFilesContentApplier.applyPaths(visualisation, filePaths);
    };

    // Builds the popup content: a data textarea and the OK/Cancel buttons.
    const renderPopupContent = (visualisation, contentContainer, popup) => {

        const wrapper = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModulePastePopup",
            {}
        );

        const dataTextArea = wrapper.querySelector(".js-ren-uploaded-files-module-paste-data");
        const okButton = wrapper.querySelector(".js-ren-uploaded-files-module-paste-ok");
        const cancelButton = wrapper.querySelector(".js-ren-uploaded-files-module-paste-cancel");

        const onOk = () => {

            const data = dataTextArea.value;

            if (!data.trim()) {

                popup.closeWindow();
                return;
            }

            const delimiter = getDelimiter(visualisation);
            const hasHeaderRows = getHasHeaderRows(visualisation);

            savePastedData({ data, filename: "", delimiter, hasHeaderRows, columnHeadings: "" })
                .then((result) => applySavedData(visualisation, (result && result.filePaths) || []))
                .catch((error) => Ren.Log.error(
                    "UploadedFilesModulePasteData",
                    Ren.Endpoints.getUrl("savePastedData"),
                    null,
                    null,
                    { error: String(error) }
                ));

            popup.closeWindow();
        };

        okButton.addEventListener("click", onOk);
        cancelButton.addEventListener("click", () => popup.closeWindow());

        // Ctrl+Enter anywhere in the popup submits, as if OK had been clicked.
        wrapper.addEventListener("keydown", (event) => {

            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {

                event.preventDefault();
                onOk();
            }
        });

        contentContainer.appendChild(wrapper);

        setTimeout(() => dataTextArea.focus(), 0);
    };

    const openPastePopup = (visualisation) => {

        Ren.PopupWindow(
            "ren-web-report-uploaded-files-module-paste-popup-window",
            (contentContainer, popup) => renderPopupContent(visualisation, contentContainer, popup),
            "Paste data",
            {
                width: 520,
                height: 320,
                centred: true,
                isResizable: true,
                horizontalScrollbar: false
            }
        );
    };

    // Builds the Paste data button, which the caller places in the module heading alongside the
    // Upload files button.
    const createPasteControl = (visualisation) => {

        const button = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModulePasteButton",
            {}
        );

        button.addEventListener("click", () => openPastePopup(visualisation));

        return { button };
    };

    return {
        createPasteControl
    };
})();
