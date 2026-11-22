/**
 * Pure helpers for the data grouping settings editor that translate stored function/format specs
 * into editable code, display labels and <select> option lists.  These are free of editor state,
 * so they live here as a standalone module the editor destructures at construction time.
 */
Ren.DataGroupingSettingsEditorFunctionSpecs = (() => {

    const isNumberType = (type) => type === "Number" || type === "Currency" || type === "Percentage";
    const isTextType = (type) => type === "Text" || type === "String";
    const isDateType = (type) => type === "Date" || type === "Date/Time";

    // --- Function-spec helpers --------------------------------------------------------------

    // Converts a stored function spec (raw code string, array of specs, or named/parameterised
    // object) into editable code for the function editor.
    const specToCode = (spec) => Ren.FunctionTemplateParameters.specToCode(spec);

    // Derives a short display label for a function spec (sort or calc): a named spec shows its
    // name, a raw code string (the only shape the function editor itself writes) shows "custom".
    const functionSpecLabel = (spec) => {

        if (!spec) return "";
        if (typeof spec === "string") return "custom";
        if (Array.isArray(spec)) return spec.length ? functionSpecLabel(spec[0]) : "";
        return spec.name || "custom";
    };

    // --- Binning (group-by calc function) options -------------------------------------------

    // Encodes a binning menu list as { value: "name:<fn>", label } select options.
    const binningFunctionsToOptions = (functions) =>
        functions.map(fn => ({ value: "name:" + (fn.name || fn.calcFunction), label: fn.text }));

    const getBinningOptions = (columnType) => {

        const {
            numberBinningFunctions,
            stringBinningFunctions,
            universalBinningFunctions,
            urlBinningFunctions,
            userAgentBinningFunctions,
            dateGroupingOptions
        } = Ren.GroupingMenuConstants;

        const options = [{ value: "", label: "(no binning)" }];
        const push = (list) => {

            const mapped = binningFunctionsToOptions(list);
            for (let i = 0; i < mapped.length; i++) options.push(mapped[i]);
        };

        if (isNumberType(columnType)) {

            push(numberBinningFunctions);
            push(universalBinningFunctions);
        }
        else if (isTextType(columnType)) {

            push(stringBinningFunctions);
            push(urlBinningFunctions);
            push(userAgentBinningFunctions);
            push(universalBinningFunctions);
        }
        else if (isDateType(columnType)) {

            const dateOptions = dateGroupingOptions.filter(option => option.calcFunction);

            for (let i = 0; i < dateOptions.length; i++) {

                options.push({
                    value: "name:" + dateOptions[i].calcFunction,
                    label: dateOptions[i].text
                });
            }
        }
        else {

            push(universalBinningFunctions);
        }

        options.push({ value: "custom", label: "Custom..." });
        return options;
    };

    const binningSpecToSelectValue = (spec) => {

        if (!spec) return "";
        if (typeof spec === "string") return "custom";
        if (spec.name) return "name:" + spec.name;
        return "custom";
    };

    // --- Format-function options ------------------------------------------------------------

    let formatOptions = null;

    Ren.Config.onChange(() => {

        formatOptions = null;
    });

    /**
     * Creates the format options, whose currency examples use the configured currency symbol.
     */
    const createFormatOptions = (formatting) => {

        const currencyText = (amount) =>
            formatting.currencyPrefix + amount + formatting.currencySuffix;

        return [
            { value: "", label: "(inherit)" },
            { value: "name:default", label: "Normal" },
            { value: "name:blank", label: "Blank" },
            { value: "name:number-no-dp", label: "Number (no DP)" },
            { value: "name:number-1-dp", label: "Number (1 DP)" },
            { value: "name:number-2-dp", label: "Number (2 DP)" },
            { value: "name:number-abbreviated-no-dp", label: "Number abbreviated (32k)" },
            { value: "name:number-abbreviated-1-dp", label: "Number abbreviated (32.2k)" },
            {
                value: "name:number-abbreviated-auto-dp",
                label: "Number abbreviated, auto DP (1.5m, 32k)"
            },
            { value: "name:number-thousands", label: "Number in thousands (32k)" },
            { value: "name:currency", label: "Currency" },
            { value: "name:currency-no-dp", label: "Currency (no DP)" },
            {
                value: "name:currency-abbreviated-no-dp",
                label: `Currency abbreviated (${currencyText("32k")})`
            },
            {
                value: "name:currency-abbreviated-1-dp",
                label: `Currency abbreviated (${currencyText("32.2k")})`
            },
            {
                value: "name:currency-abbreviated-auto-dp",
                label: "Currency abbreviated, auto DP "
                    + `(${currencyText("1.5m")}, ${currencyText("32k")})`
            },
            {
                value: "name:currency-thousands",
                label: `Currency in thousands (${currencyText("32k")})`
            },
            { value: "name:percentage-no-dp", label: "Percentage (no DP)" },
            { value: "name:percentage-2-dp", label: "Percentage (2 DP)" },
            { value: "name:percentage-div-100-no-dp", label: "Percentage ÷100 (no DP)" },
            { value: "name:date", label: "Date" },
            { value: "name:date-with-day-name", label: "Date with day name" },
            { value: "name:date-time", label: "Date and time" },
            { value: "name:date-time-with-day-name", label: "Date and time with day name" },
            { value: "name:time", label: "Time" },
            { value: "name:date-MMM-yyyy", label: "Month name and year" },
            { value: "name:date-quarter-name", label: "Quarter name" },
            { value: "custom", label: "Custom..." }
        ];
    };

    /**
     * Gets the options for a column's format select.
     */
    const getFormatOptions = () => {

        formatOptions ??= createFormatOptions(Ren.Config.getConfig().formatting);
        return formatOptions;
    };

    const formatSpecToSelectValue = (valueFormatFunction) => {

        if (!valueFormatFunction || !valueFormatFunction.length) return "";
        const first = valueFormatFunction[0];
        if (typeof first === "string") return "custom";
        if (first && first.name) return "name:" + first.name;
        return "custom";
    };

    // Derives the display label already used for the matching select option.
    const formatSpecLabel = (valueFormatFunction) => {

        const value = formatSpecToSelectValue(valueFormatFunction);
        if (!value) return "";

        const options = getFormatOptions();

        for (let i = 0; i < options.length; i++) {
            if (options[i].value === value) return options[i].label;
        }

        return value;
    };

    return {
        specToCode,
        functionSpecLabel,
        getBinningOptions,
        binningSpecToSelectValue,
        getFormatOptions,
        formatSpecToSelectValue,
        formatSpecLabel
    };
})();
