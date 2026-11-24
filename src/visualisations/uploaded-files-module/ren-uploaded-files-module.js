/**
 * Renders the uploaded files module: a small module that makes an uploaded files group's three
 * uploaded files settings visible and editable, in the same style as the parameters module.
 */
Ren.CreateUploadedFilesModule = (_tabularData, visualisation) => {

    // Read each time, as the visualisation's properties can be filled in after the module is
    // created.
    const getGroup = () => visualisation.uploadedFilesGroup;

    let popup = null;
    const getPopup = () => popup;

    // A downloaded report cannot re-fetch its visualisations with different uploaded files.
    const isDisabled = () => Ren.UrlContext.isDownloadedReport();

    const editPopup = Ren.UploadedFilesModuleEditPopup(visualisation, getPopup);

    // renderContent is declared later, but only called once the module is built.
    const viewSettings = Ren.UploadedFilesModuleViewSettings(visualisation, () => renderContent());

    // Column headings are report-author configuration rather than a per-run choice, so are set from
    // the context menu rather than alongside the editable settings.
    const columnHeadingsEditor = Ren.UploadedFilesModuleColumnHeadingsEditor(visualisation);

    const uploadControl = isDisabled()
        ? null
        : Ren.UploadedFilesModuleUploader.createUploadControl(visualisation);

    const pasteControl = isDisabled()
        ? null
        : Ren.UploadedFilesModulePasteData.createPasteControl(visualisation);

    const settingDescriptors = [
        {
            key: "uploadedFiles",
            label: "Filenames",
            inputType: "Text",
            multiline: true,
            viewKey: "showFilenames"
        },
        {
            key: "uploadedFilesDelimiter",
            label: "Delimiter",
            inputType: "Delimiter",
            viewKey: "showDelimiter"
        },
        {
            key: "uploadedFilesHaveHeaderRows",
            label: "Header rows",
            inputType: "Boolean",
            viewKey: "showHeaderRows"
        }
    ];

    const getDescriptor = (key) => {

        for (let i = 0; i < settingDescriptors.length; i++) {

            if (settingDescriptors[i].key === key) return settingDescriptors[i];
        }

        return null;
    };

    // Gets just the file name from a full uploaded file path.
    const fileBaseName = (path) => {

        const trimmed = String(path).trim();
        const separatorIndex = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));

        return separatorIndex === -1 ? trimmed : trimmed.substring(separatorIndex + 1);
    };

    // Shows just the file names from a comma-separated list of uploaded file paths, one per line.
    const formatFileList = (value) => {

        const parts = String(value).split(",");
        const names = [];

        for (let i = 0; i < parts.length; i++) {

            const part = parts[i].trim();

            if (!part) continue;

            names.push(fileBaseName(part));
        }

        return Ren.HtmlTemplateFunctions.renderHtmlTemplate(
            "UploadedFilesModuleFileList",
            { names }
        );
    };

    // A "true" entry (the header-rows setting leaking through) or an empty list means nothing was
    // really uploaded, so the user is prompted to upload rather than told of missing files.
    const formatMissingFilesMessage = (missingFiles) => {

        const realMissingFiles = [];

        for (let index = 0; index < missingFiles.length; index++) {

            const file = missingFiles[index];

            if (file && file !== "true") realMissingFiles.push(file);
        }

        if (realMissingFiles.length === 0) {

            return Ren.HtmlTemplateFunctions.renderHtmlTemplate(
                "UploadedFilesModuleNoFilesUploaded",
                {}
            );
        }

        const messages = [];

        for (let index = 0; index < realMissingFiles.length; index++) {

            messages.push(fileBaseName(realMissingFiles[index]) + " could not be found");
        }

        return Ren.HtmlTemplateFunctions.renderHtmlTemplate(
            "UploadedFilesModuleMissingFiles",
            { messages }
        );
    };

    const formatDelimiter = (value) => {

        if (value === "\t" || value === "\\t") return "Tab";
        if (value === ",") return "Comma";

        return value;
    };

    // Gets the HTML shown for a setting's stored value.
    const formatDisplayValue = (descriptor, value) => {

        if (value === undefined || value === null || value === "") return null;

        if (descriptor.inputType === "Boolean") {

            return Ren.DataSourcesUploadedFiles.booleanToParameterString(value) === "true"
                ? "Yes"
                : "No";
        }

        if (descriptor.key === "uploadedFiles") return formatFileList(value);
        if (descriptor.key === "uploadedFilesDelimiter") {
            return Ren.HtmlUtils.escapeHtml(formatDelimiter(value));
        }

        return Ren.HtmlUtils.escapeHtml(value);
    };

    // A missing-files message replaces the Filenames value when the group's last data request
    // reported its uploaded files as missing.
    const formatRowValue = (descriptor, value) => {

        if (descriptor.key === "uploadedFiles") {

            const missingFiles = Ren.UploadedFilesGroupsCollection.getGroupMissingFiles(getGroup());

            if (missingFiles !== undefined) return formatMissingFilesMessage(missingFiles);
        }

        return Ren.TextUtils.convertNullOrUndefinedToStyledNotSet(
            formatDisplayValue(descriptor, value)
        );
    };

    const createSettingRow = (descriptor) => {

        const settings = Ren.UploadedFilesGroupsCollection.getGroupSettings(getGroup());
        const defaults = Ren.UploadedFilesGroupsCollection.getGroupDefaults(getGroup());

        const value = settings[descriptor.key];

        // The clear button reverts a setting to its declared default, so is disabled when already
        // there.
        const isClearButtonDisabled = value === defaults[descriptor.key];

        return Ren.HtmlTemplateFunctions.reifyHtmlTemplate("UploadedFilesModuleSetting", {
            key: descriptor.key,
            label: descriptor.label,
            value: formatRowValue(descriptor, value),
            cellClass: descriptor.multiline
                ? "ren-web-report-uploaded-files-module__setting--top-aligned"
                : "",
            hideButtons: isDisabled(),
            isClearButtonDisabled
        });
    };

    // Builds the grid of shown settings, or returns null when every row is hidden.
    const createSettingsContainer = () => {

        const shownDescriptors = [];

        for (let i = 0; i < settingDescriptors.length; i++) {

            if (viewSettings.isShown(settingDescriptors[i].viewKey)) {
                shownDescriptors.push(settingDescriptors[i]);
            }
        }

        if (!shownDescriptors.length) return null;

        const settingsContainer = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleSettings",
            {}
        );

        for (let i = 0; i < shownDescriptors.length; i++) {
            settingsContainer.appendChild(createSettingRow(shownDescriptors[i]));
        }

        return settingsContainer;
    };

    // Builds the row of buttons at the top of the module, or returns null when neither is shown.
    const createHeading = () => {

        const showUpload = uploadControl && viewSettings.isShown("showUploadButton");
        const showPaste = pasteControl && viewSettings.isShown("showPasteDataButton");

        if (!showUpload && !showPaste) return null;

        const heading = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleHeading",
            {}
        );

        if (showUpload) {

            heading.appendChild(uploadControl.button);
            heading.appendChild(uploadControl.fileInput);
        }

        if (showPaste) heading.appendChild(pasteControl.button);

        return heading;
    };

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("UploadedFilesModule", {});

    const renderContent = () => {

        element.innerHTML = "";

        const heading = createHeading();
        const settingsContainer = createSettingsContainer();

        if (heading) element.appendChild(heading);
        if (settingsContainer) element.appendChild(settingsContainer);
    };

    // Edits the Filenames setting one filename per line, joining the lines with commas on save.
    const openMultilineEditPopup = (settingKey, descriptor) => {

        const settings = Ren.UploadedFilesGroupsCollection.getGroupSettings(getGroup());
        const value = settings[settingKey];

        const initialText = value === undefined || value === null || value === ""
            ? ""
            : String(value).split(",").map((part) => part.trim()).join("\n");

        const onOk = (text) => {

            const lines = text.split("\n");
            const parts = [];

            for (let i = 0; i < lines.length; i++) {

                const line = lines[i].trim();

                if (line) parts.push(line);
            }

            Ren.UploadedFilesModuleUpdater.updateSetting(visualisation, settingKey, parts.join(","));
        };

        Ren.CreateOkCancelTextEditorPopupWindow(descriptor.label, onOk, {
            label: "One filename per line",
            initialText,
            multiline: true,
            // Filenames are long paths, so open three times the default width.
            width: 960
        });
    };

    const openEditPopup = (editButton, event) => {

        const settingKey = editButton.getAttribute("data-setting-key");
        const descriptor = getDescriptor(settingKey);

        if (!descriptor) return;

        if (descriptor.multiline) {

            openMultilineEditPopup(settingKey, descriptor);
            return;
        }

        const settings = Ren.UploadedFilesGroupsCollection.getGroupSettings(getGroup());

        const setting = {
            settingKey,
            label: descriptor.label,
            inputType: descriptor.inputType,
            value: settings[settingKey]
        };

        const renderPopupContent = (contentContainer, createdPopup) => {

            editPopup.renderEditPopupContent(contentContainer, setting, createdPopup);
        };

        popup = Ren.PopupWindow(
            "ren-web-report-uploaded-files-module-edit-popup",
            renderPopupContent,
            "", // title
            {
                leftPos: event.pageX,
                topPos: event.pageY,
                titleBarModifier: "--thin",
                width: 260,
                height: 24,
                closeWhenFocusLost: true,
                horizontalScrollbar: false,
                isResizable: "x",
                showTitleBarButtons: false
            }
        );
    };

    const bindEvents = () => {

        element.addEventListener("click", (event) => {

            if (isDisabled()) return;

            const editButton = event.target.closest(
                ".js-ren-web-report-uploaded-files-module-edit-button"
            );

            if (editButton) {

                openEditPopup(editButton, event);
                return;
            }

            const clearButton = event.target.closest(
                ".js-ren-web-report-uploaded-files-module-clear-button"
            );

            if (clearButton &&
                !clearButton.classList.contains(
                    "ren-web-report-uploaded-files-module__clear-button--disabled"
                )) {

                Ren.UploadedFilesModuleUpdater.clearSetting(
                    visualisation,
                    clearButton.getAttribute("data-setting-key")
                );
            }
        });
    };

    const setUpContextMenu = () => {

        if (isDisabled()) return;

        Ren.AddContextMenuItems(element, () => [
            viewSettings.getMenuItem(),
            {
                section: "Uploaded files",
                text: "Set default column headings...",
                id: "uploaded-files-module-set-default-column-headings",
                action: () => columnHeadingsEditor.open()
            }
        ]);
    };

    Ren.Messages.Events.uploadedFilesGroupSettingsChanged.handle((changedGroup) => {

        if (visualisation.isDestroyed) return false; // Unregister once the module is gone.

        if (changedGroup === getGroup()) renderContent();
    });

    // Applies the SQL's '---UploadedFiles:' settings, read off the loaded data sources as the
    // group's data may have loaded before this module existed.
    const applySqlDeclaredDefaults = () => {

        return Ren.UploadedFilesModuleUpdater.applyUploadedFilesDefaultsFromLoadedDataSources(
            getGroup()
        );
    };

    Ren.Messages.Events.dataSourcesChanged.handle(() => {

        if (visualisation.isDestroyed) return false; // Unregister once the module is gone.

        if (applySqlDeclaredDefaults()) renderContent();
    });

    applySqlDeclaredDefaults();

    renderContent();
    bindEvents();
    setUpContextMenu();

    return {
        element
    };
};
