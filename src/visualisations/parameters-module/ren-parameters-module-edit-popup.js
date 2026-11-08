/**
 * Renders the report parameters module edit popup.
 */
Ren.ParametersModuleEditPopup = (visualisation) => {

    let isPopupOpen = false;
    let _popup = null;

    const closePopupEditWindow = () => {

        if (!isPopupOpen) return;

        _popup.closeWindow();
        _popup = null;
        isPopupOpen = false;
    };

    /**
     * Creates an input element based on the parameter type.
     */
    const createInputElement = (parameter) => {

        const input = Ren.HtmlUtils.create("input")
            ._addClass(
                "ren-web-report-parameters-module-edit-popup__input-box",
                "js-ren-parameters-module-edit-popup-input-box",
                "qa-ren-parameters-module-edit-popup-input-box"
            );

        switch (parameter.parameterType) {

            case Ren.ReportParameterTypeEnum.Int:
                input.type = "number";
                break;

            case Ren.ReportParameterTypeEnum.Float:
                input.type = "number";
                input.step = "0.01";
                break;

            case Ren.ReportParameterTypeEnum.Date:
                input.type = "date";
                break;

            default:
                input.type = "text";
                break;
        }

        input.value = parameter.parameterValue ?? "";

        return input;
    };

    /**
     * Creates a dropdown selector containing the options.
     */
    const createDropdownElement = (parameter) => {

        const select = Ren.HtmlUtils.create("select")
            ._addClass(
                "ren-web-report-parameters-module-edit-popup__dropdown-list",
                "qa-ren-parameters-module-edit-popup-input-box"
            )
            ._append(
                Ren.HtmlUtils.create("option")
                    ._addClass("ren-web-report-parameters-module-edit-popup__dropdown-list-option")
                    ._set("value", "")
                    ._set("text", "Not set")
            );

        parameter.parameterOptions.forEach(option => {

            // An option is either a plain string (value and label identical) or a { Value, Text }
            // pair when the view gave a value attribute distinct from the displayed text.
            const isValueTextPair = Ren.ObjectUtils.isObject(option);
            let optionValue = isValueTextPair ? option.Value : option;
            let optionText = isValueTextPair ? option.Text : option;

            if (optionValue === null) optionValue = "NULL";
            if (optionText === null) optionText = "NULL";

            const optionElement = Ren.HtmlUtils.create("option")
                ._addClass("ren-web-report-parameters-module-edit-popup__dropdown-list-option")
                ._set("value", optionValue)
                ._set("text", optionText);

            if (optionValue === parameter.parameterValue) {
                optionElement._set("selected", "selected");
            }

            select.appendChild(optionElement);
        });

        select.addEventListener("change", () => {

            Ren.ParametersModuleParameterUpdater.updateParameter(
                visualisation,
                parameter.parameterKey,
                select.value
            );

            closePopupEditWindow();
        });

        return select;
    };

    /**
     * Creates the appropriate kind of input element based on the parameter type and options.
     *
     * Toggle parameters aren't handled here - they render as a toggle switch directly in the
     * collapsed parameters module display, with no edit popup (see ren-parameters-module.js).
     */
    const createInput = (parameter) => {

        const inputType = Ren.ObjectUtils.getEnumValue(Ren.ReportInputTypeEnum, parameter.inputType);

        switch (inputType) {

            case Ren.ReportInputTypeEnum.Dropdown:
                return createDropdownElement(parameter);

            default:
                return createInputElement(parameter);
        }
    };

    const groupCountAndSortDescending = (array) => {

        const groupedValuesMap = Ren.ArrayUtils.groupByCountMap(array);

        const sortedGroupedCVs = Array.from(groupedValuesMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => {

                return {
                    CV: entry[0],
                    count: entry[1]
                };
            });

        return sortedGroupedCVs;
    };

    const parseParameterOptionsQueryResult = (response, optionsSqlColumn) => {

        const tabularData = response.TabularDataSets[0]?.TabularDatas[0];
        const rowModels = tabularData.RowModels;

        const columnResolver = Ren.DataGridColumnResolver(tabularData);
        const columnIndex = optionsSqlColumn ?
            columnResolver.getColumnIndex(optionsSqlColumn) :
            columnResolver.getFirstNotAutoAddedColumnIndex();

        const optionCVs = rowModels.map(rowModel => rowModel.CV[columnIndex]);

        const sortedOptions = groupCountAndSortDescending(optionCVs);

        // Sort options alphabetically.

        sortedOptions.sort((a, b) => {

            const aLabel = a.CV;
            const bLabel = b.CV;

            if (aLabel < bLabel) return -1;
            if (aLabel > bLabel) return 1;
            return 0;
        });

        const compressionDictionary = Ren.CompressionDictionary(
            response.CompressionDictionary,
            tabularData.IsColumnCompressed,
            tabularData.ColumnValueEncodings
        );

        for (let i = 0; i < sortedOptions.length; i++) {

            const sortedOption = sortedOptions[i];

            sortedOption.Value =
                compressionDictionary.decompressValue(sortedOption.CV, columnIndex);

            if (sortedOption.Value === "") sortedOption.Value = "NULL";
        }

        return sortedOptions;
    };

    const queryParameterOptionsCache = {};

    const queryParameterOptions = (contentContainer, parameter) => {

        const url = Ren.NamedDataSources.getUri(parameter.optionsSqlFilename);

        if (queryParameterOptionsCache[url]) {

            parameter.parameterOptions = queryParameterOptionsCache[url];

            Ren.Messages.Events.reportParametersModuleOptionsAvailable.notify(
                contentContainer,
                parameter
            );

            return;
        }

        Ren.FetchUtils.fetch(url)
            .then(r => r.ok ?
                r.json() :
                Promise.reject("There was an error getting the parameter options.  URL:" + url)
            )
            .then(response => {

                parameter.parameterOptions = parseParameterOptionsQueryResult(
                    response,
                    parameter.optionsSqlColumn
                ).map(option => option.Value);

                queryParameterOptionsCache[url] = parameter.parameterOptions;

                Ren.Messages.Events.reportParametersModuleOptionsAvailable.notify(
                    contentContainer,
                    parameter
                );
            })
            .catch(error => {

                Ren.PopupErrorMessage(error);
            });
    };

    const renderEditPopupContent = (contentContainer, parameter, popup) => {

        isPopupOpen = true;
        _popup = popup;

        if (parameter.parameterOptions) {

            Ren.Messages.Events.reportParametersModuleOptionsAvailable.notify(contentContainer, parameter);
        }
        else if (parameter.optionsSqlFilename && Ren.Endpoints.has("namedDataSources")) {

            queryParameterOptions(contentContainer, parameter);
        }
        else {

            parameter.parameterOptions = [];

            Ren.Messages.Events.reportParametersModuleOptionsAvailable.notify(contentContainer, parameter);
        }
    };

    const createClearButton = (input) => {

        const clearButton = Ren.HtmlUtils.create("span")
            ._addClass("ren-web-report-parameters-module-edit-popup__clear-button")
            ._set("text", "✖");

        clearButton.addEventListener("click", () => {

            input.value = "";
            input.focus();
        });

        return clearButton;
    };

    /**
     * Opens the dropdown list as soon as the popup appears, so the user can see the options
     * without having to click the down arrow first.
     *
     * showPicker isn't available in every browser, and throws if the user activation from the
     * edit button click has expired (the options query can take a moment to come back), so the
     * dropdown is simply left closed in those cases.
     */
    const openDropdownList = (select) => {

        if (typeof select.showPicker !== "function") return;

        try {

            select.showPicker();
        }
        catch (error) {

            // The user can still open the dropdown themselves.
        }
    };

    Ren.Messages.Events.reportParametersModuleOptionsAvailable.handle((contentContainer, parameter) => {

        if (!isPopupOpen) return;

        const module = Ren.HtmlUtils.create("div")
            ._addClass("ren-web-report-parameters-module-edit-popup");

        const flexContainer = Ren.HtmlUtils.create("div")
            ._addClass("ren-web-report-parameters-module-edit-popup__flex-container");

        const inputContainer = Ren.HtmlUtils.create("div")
            ._addClass("ren-web-report-parameters-module-edit-popup__input-container");

        const input = createInput(parameter);

        if (parameter.parameterLabel) {
            input.title = parameter.parameterLabel;
        }

        inputContainer.appendChild(input);

        if (input.tagName === "INPUT") {

            const clearButton = createClearButton(input);
            inputContainer.appendChild(clearButton);
        }

        flexContainer.appendChild(inputContainer);

        const button = Ren.HtmlUtils.create("span")
            ._addClass(
                "ren-web-report-parameters-module-edit-popup__update-button",
                "qa-ren-parameters-module-edit-popup-update-button"
            )
            ._set("innerHTML", "✔");

        flexContainer.appendChild(button);

        module.appendChild(flexContainer);
        contentContainer.innerHTML = "";
        contentContainer.appendChild(module);
        input.focus();

        if (input.tagName === "SELECT") openDropdownList(input);

        const update = () => {

            const value = input.value.trim();

            Ren.ParametersModuleParameterUpdater.updateParameter(
                visualisation,
                parameter.parameterKey,
                value
            );

            closePopupEditWindow();
        };

        button.addEventListener("click", update);

        input.addEventListener("keypress", (event) => {

            if (event.key === "Enter") update();
        });
    });

    return {
        renderEditPopupContent
    };
};
