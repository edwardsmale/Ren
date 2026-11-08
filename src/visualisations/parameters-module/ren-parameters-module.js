Ren.CreateParametersModule = (_tabularData, visualisation) => {

    let popup = null;
    const getPopup = () => popup;

    // All editing functions are hidden and disabled in downloaded reports, since in that
    // context the report can't reload itself with different query parameters.
    const isDisabled = () => Ren.UrlContext.isDownloadedReport();

    const editPopup = Ren.ParametersModuleEditPopup(visualisation, getPopup);

    // When an option carries a value distinct from its label (a { Value, Text } pair), the
    // collapsed display should show the label matching the currently-selected value rather than the
    // raw value that is sent to the SQL.  Plain string options display as themselves.
    const getDisplayValue = (paramSpec) => {

        const options = paramSpec.parameterOptions;

        if (options) {

            for (let i = 0; i < options.length; i++) {

                const option = options[i];

                if (Ren.ObjectUtils.isObject(option) && option.Value === paramSpec.Value) {

                    return option.Text;
                }
            }
        }

        return paramSpec.Value;
    };

    const isToggleInputType = (paramSpec) => {

        return Ren.ObjectUtils.getEnumValue(Ren.ReportInputTypeEnum, paramSpec.InputType) ===
            Ren.ReportInputTypeEnum.Toggle;
    };

    // A toggle parameter is rendered as a toggle switch in place of the value display, clear
    // button and edit button, and updates the query parameter directly - unlike the other input
    // types it doesn't need an edit popup.
    const createToggleParameter = (paramSpec, key) => {

        const labelElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-web-report-parameters-module__parameter-key", "ren-shadow-module__heading-label")
            ._textContent(paramSpec.Label);

        const valueContainer = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-web-report-parameters-module__parameter-value",
                "qa-ren-parameters-module-value-" + key
            );

        let toggleValue = paramSpec.Value === "1";

        const toggleSwitch = Ren.ToggleSwitch.create(toggleValue);

        toggleSwitch.element.classList.add("ren-web-report-parameters-module__toggle");

        if (!isDisabled()) {

            toggleSwitch.onClick(() => {

                toggleValue = !toggleValue;
                toggleSwitch.setValue(toggleValue);

                if (toggleValue) {

                    Ren.ParametersModuleParameterUpdater.updateParameter(visualisation, key, "1");
                }
                else {

                    Ren.ParametersModuleParameterUpdater.clearParameter(visualisation, key);
                }
            });
        }

        valueContainer.appendChild(toggleSwitch.element);

        return Ren.HtmlUtils.create("div")
            ._addClass("ren-web-report-parameters-module__parameter")
            ._append(labelElement)
            ._append(valueContainer);
    };

    const createParametersModuleParameter = (parameterSpecs, key) => {

        const paramSpec = parameterSpecs[key];

        if (isToggleInputType(paramSpec)) return createToggleParameter(paramSpec, key);

        const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
            "ParametersModuleParameter",
            {
                key,
                value: Ren.TextUtils.convertNullOrUndefinedToStyledNotSet(getDisplayValue(paramSpec)),
                label: paramSpec.Label,
                hideButtons: isDisabled(),
                isClearButtonDisabled: !paramSpec.Value,
                serializedParamSpec: Ren.JsonUtils.serialize(paramSpec)
            }
        );

        const menuName = Ren.AutoMenu.getMenuNameForParameter(key);

        if (menuName) {

            Ren.AutoMenu.applyMenu(
                content.querySelector(".ren-web-report-parameters-module__parameter-value"),
                menuName,
                paramSpec.Value
            );
        }

        Ren.HtmlUtils.append(content,
            Ren.HtmlUtils.create("script")
                ._addClass("js-ren-web-report-parameters-module-parameter-spec-" + Ren.TextUtils.cleanForCssClassName(key))
                ._set("type", "application/json")
                ._textContent(Ren.JsonUtils.serialize(paramSpec))
        );

        return content;
    };

    /**
     * Creates the content for the parameters module.
     *
     * @param {object} parameterSpecs Specifies the parameters to display in the module.
     */
    const createParametersModuleContent = (parameterSpecs) => {

        const parameters = Object.keys(parameterSpecs)
            .map(key => createParametersModuleParameter(parameterSpecs, key));

        const module = Ren.HtmlUtils.create("div");

        const parametersContainer = Ren.HtmlUtils.create("div")
            ._addClass("ren-web-report-parameters-module__parameters");

        parameters.forEach(parameter => parametersContainer.appendChild(parameter));

        module.appendChild(parametersContainer);

        return module;
    };

    const parameters = Ren.ReportInputParameters.getInputParameters(
        visualisation.containingReport
    );

    const parameterSpecs = visualisation.parameterSpecs;

    for (const key in parameters) {

        const parameterSpecsKey = Ren.ObjectUtils.findKeyCaseInsensitively(parameterSpecs, key);

        if (parameterSpecsKey) {

            parameterSpecs[parameterSpecsKey].Value = parameters[key];
        }
    }

    const element = Ren.HtmlUtils.create("div")
        ._addClass(
            "ren-web-report-parameters-module",
            "ren-shadow-module"
        )
        ._append(
            createParametersModuleContent(parameterSpecs)
        );

    const bindClearButtonEvents = () => {

        const clearButton = element.querySelector(".ren-web-report-parameters-module__clear-button");

        if (!clearButton) return;

        clearButton.addEventListener("click", function () {

            const parameterKey = this.getAttribute("data-parameter-key");

            Ren.ParametersModuleParameterUpdater.clearParameter(
                visualisation,
                parameterKey
            );
        });
    };

    const getParameterSpec = (editButton, parameterKey) => {

        const json = editButton
            .closest(".ren-web-report-parameters-module__parameter")
            .querySelector(".js-ren-web-report-parameters-module-parameter-spec-" +
                Ren.TextUtils.cleanForCssClassName(parameterKey)
            )
            .textContent;

        return Ren.JsonUtils.parse(json);
    };

    const bindEditButtonEvents = () => {

        const editButton = element.querySelector(".js-ren-web-report-parameters-module-edit-button");

        if (!editButton) return;

        editButton.addEventListener("click", function (event) {

            const editButton = this;

            const parameterKey = editButton.getAttribute("data-parameter-key");
            const parameterSpec = getParameterSpec(editButton, parameterKey);

            const parameter = {
                parameterType: parameterSpec.ParameterType,
                inputType: parameterSpec.InputType,
                parameterKey: parameterKey,
                label: parameterSpec.Label,
                parameterOptions: parameterSpec.parameterOptions,
                optionsSqlFilename: parameterSpec.OptionsSqlFilename,
                optionsSqlColumn: parameterSpec.OptionsSqlColumn,
                parameterValue: parameterSpec.Value
            };

            const renderContent = (contentContainer, popup) => {

                editPopup.renderEditPopupContent(contentContainer, parameter, popup);

                const inputBox = contentContainer.querySelector(".js-ren-parameters-module-edit-popup-input-box");

                inputBox && inputBox.select();
            };

            popup = Ren.PopupWindow(
                "ren-web-report-parameters-module-edit-popup",
                renderContent,
                "", // title
                {
                    leftPos: event.pageX,
                    topPos: event.pageY,
                    titleBarModifier: "--thin",
                    width: 220,
                    height: 24,
                    closeWhenFocusLost: true,
                    horizontalScrollbar: false,
                    isResizable: "x",
                    showTitleBarButtons: false
                }
            );
        });
    };

    bindEditButtonEvents();
    bindClearButtonEvents();

    return {
        element
    };
};
