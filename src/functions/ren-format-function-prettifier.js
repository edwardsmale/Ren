/**
 * Makes format functions more readable when displayed in the data grouping settings debug window.
 */
Ren.FormatFunctionPrettifier = (() => {

    const prettify = (valueFormatFunction) => {

        if (typeof valueFormatFunction !== "string") return valueFormatFunction;

        let json = valueFormatFunction;

        json = json.replace(/\r/g, "").trim();
        json = Ren.FormatFunctionUtils.reduceIndentation(json);

        json = json
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\\n/g, "<br />")
            .replace(/\n/g, "<br />");

        json = Ren.FormatFunctions.highlightExpressions(json);

        return json;
    };

    return {
        prettify
    };
})();
