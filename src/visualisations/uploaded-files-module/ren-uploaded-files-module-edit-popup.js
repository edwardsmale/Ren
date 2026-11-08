/**
 * Renders the edit popup for a single uploaded files module setting, in the same style as the
 * parameters module edit popup.
 */
Ren.UploadedFilesModuleEditPopup = (visualisation) => {

    let isPopupOpen = false;
    let currentPopup = null;

    const closePopupEditWindow = () => {

        if (!isPopupOpen) return;

        currentPopup.closeWindow();
        currentPopup = null;
        isPopupOpen = false;
    };

    // The delimiter options offered in the dropdown.  A stored value not in this list is added as a
    // custom option so it is not lost.
    const delimiterOptions = [
        { value: ",", text: "Comma" },
        { value: "\\t", text: "Tab" },
        { value: ";", text: "Semicolon" },
        { value: "|", text: "Pipe" },
        { value: " ", text: "Space" }
    ];

    // The setting currently being edited.
    let currentSetting = null;

    const commitValue = (value) => {

        Ren.UploadedFilesModuleUpdater.updateSetting(
            visualisation,
            currentSetting.settingKey,
            value
        );

        closePopupEditWindow();
    };

    const createTextInput = () => {

        const input = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleEditPopupTextInput",
            {}
        );

        // Set as a property rather than in the template, so that a value containing quotes cannot
        // break out of the attribute.
        input.value = currentSetting.value ?? "";

        return input;
    };

    // Builds one dropdown option.  Its value and text are set as properties rather than in the
    // template, so that values containing quotes cannot break out of their attribute.
    const createDropdownOption = (value, text, isSelected) => {

        const optionElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleEditPopupDropdownOption",
            {}
        );

        optionElement._set("value", value)._set("text", text);

        if (isSelected) optionElement._set("selected", "selected");

        return optionElement;
    };

    const createDropdown = (options, selectedValue) => {

        const select = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleEditPopupDropdown",
            {}
        );

        let selectedMatched = false;

        for (let i = 0; i < options.length; i++) {

            const option = options[i];
            const isSelected = option.value === selectedValue;

            if (isSelected) selectedMatched = true;

            select.appendChild(createDropdownOption(option.value, option.text, isSelected));
        }

        // Preserve an unrecognised stored value as a custom option.
        if (!selectedMatched && selectedValue !== undefined && selectedValue !== null &&
            selectedValue !== "") {

            select.appendChild(createDropdownOption(selectedValue, selectedValue, true));
        }

        return select;
    };

    const createBooleanInput = () => {

        const selectedValue = Ren.DataSourcesUploadedFiles.booleanToParameterString(
            currentSetting.value
        );

        return createDropdown(
            [{ value: "true", text: "Yes" }, { value: "false", text: "No" }],
            selectedValue
        );
    };

    const createDelimiterInput = () => createDropdown(delimiterOptions, currentSetting.value);

    const createInput = () => {

        switch (currentSetting.inputType) {

            case "Boolean":
                return createBooleanInput();

            case "Delimiter":
                return createDelimiterInput();

            default:
                return createTextInput();
        }
    };

    const renderEditPopupContent = (contentContainer, setting, popup) => {

        isPopupOpen = true;
        currentPopup = popup;
        currentSetting = setting;

        const module = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "UploadedFilesModuleEditPopup",
            {}
        );

        const inputContainer = module.querySelector(
            ".js-ren-uploaded-files-module-edit-popup-input-container"
        );

        const updateButton = module.querySelector(
            ".js-ren-uploaded-files-module-edit-popup-update-button"
        );

        const input = createInput();

        inputContainer.appendChild(input);

        contentContainer.innerHTML = "";
        contentContainer.appendChild(module);
        input.focus();

        // Dropdowns commit as soon as a choice is made; text inputs commit on the update button or
        // the Enter key.
        if (input.tagName === "SELECT") {

            input.addEventListener("change", () => commitValue(input.value));
        }
        else {

            input.select();

            input.addEventListener("keypress", (event) => {

                if (event.key === "Enter") commitValue(input.value.trim());
            });
        }

        updateButton.addEventListener("click", () => commitValue(input.value.trim()));
    };

    return {
        renderEditPopupContent
    };
};
