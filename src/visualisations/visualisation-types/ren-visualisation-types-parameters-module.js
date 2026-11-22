Ren.VisualisationTypes_ParametersModule = {
    visualisationTypeName: "ParametersModule",
    tagName: "ren-parameters-module",
    availableOptions: {
        reloadsPage: "Boolean"
    },
    synchronisedOptions: {

    },
    defaultOptions: {
        reloadsPage: false,
        suppressLoadingAnimation: true
    },
    applyDefaultLogic: () => {

    },
    applyNestedElement: (visualisation, _parameters, nestedElement, nestedElementType) => {

        if (nestedElementType === "ren-parameter") {

            const parameterSpec = {};

            const getAttr = Ren.HtmlUtils.getAttributeOrDefault;

            parameterSpec.Name = nestedElement.getAttribute("name");
            parameterSpec.Label = getAttr(nestedElement, "label", parameterSpec.Name);
            // The value attribute provides the initial value shown in the selector before the
            // user picks one.  A matching URL query parameter (applied later in
            // CreateParametersModule) takes precedence over it.
            parameterSpec.Value = getAttr(nestedElement, "value", null);
            parameterSpec.ParameterType = getAttr(nestedElement, "parameter-type", "String");
            parameterSpec.InputType = getAttr(nestedElement, "input-type", "InputElement");
            parameterSpec.OptionsSqlFilename = getAttr(nestedElement, "options-sql-filename", null);
            parameterSpec.OptionsSqlColumn = getAttr(nestedElement, "options-sql-column", null);

            visualisation.parameterSpecs ??= {};
            visualisation.parameterSpecs[parameterSpec.Name] = parameterSpec;

            const furtherNestedElements = Array.from(nestedElement.children);

            for (let i = 0; i < furtherNestedElements.length; i++) {

                const furtherNestedElement = furtherNestedElements[i];
                const furtherNestedElementType = furtherNestedElement.tagName.toLowerCase();

                if (furtherNestedElementType === "ren-parameter-option") {

                    // An optional value attribute lets the submitted value differ from the
                    // displayed text (e.g. show "Returning customers only" but send "Returning" to
                    // the SQL).  Without it the text content is used as both, preserving the
                    // original single-string behaviour.
                    const text = furtherNestedElement.textContent;
                    const valueAttribute = furtherNestedElement.getAttribute("value");
                    const option = valueAttribute === null
                        ? text
                        : { Value: valueAttribute, Text: text };
                    parameterSpec.parameterOptions ??= [];
                    parameterSpec.parameterOptions.push(option);
                }
            }
        }
    },
    getCreateFunction: () => Ren.CreateParametersModule
};
