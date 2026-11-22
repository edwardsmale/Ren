/**
 * Resolves @ expressions in functions.
 */
Ren.FunctionResolver = (() => {

    const _updateModeEnum = {
        createFunction: 0,
        highlight: 1
    };

    const stripComments = (code) => {

        code = code.replace(/\/\*[\s\S]*?\*\//g, "");
        // A preceding ':' or '\' is excluded, keeping http:// and a regex literal like /^\//
        // intact.
        code = code.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
        return code;
    };

    // --- JSDoc Default Parameter Extraction ---
    /**
     * Gets the @param default values from the JSDoc comment at the top of a JS function file, as
     * { paramName: defaultValue, ...  }.
     */
    const parseJSDocDefaults = (fileContent) =>
        Ren.FunctionTemplateParameters.getValues(fileContent);

    /**
     * Applies the defaults from parseJSDocDefaults to a copy of a parameters object, replacing
     * {param} in each default value.
     */
    const applyJSDocDefaults = (parameters, defaults) => {

        const result = Object.assign({}, parameters);

        const defaultEntries = Object.entries(defaults);

        for (let i = 0; i < defaultEntries.length; i++) {

            const key = defaultEntries[i][0];
            const def = defaultEntries[i][1];

            if (!(key in result) || result[key] === undefined) {

                let value = def.replace(/\{(\w+)\}/g, (m, p1) => {

                    return (result[p1] !== undefined ? result[p1] : (defaults[p1] !== undefined ? defaults[p1] : m));
                });
                result[key] = value;
            }
        }
        return result;
    };

    // Recursively updates an expression replacing @ expressions with quoted/concatenated versions.
    const _update = (expression, expressionDepth, mode) => {

        let result = "";

        for (let outerIndex = 0; outerIndex < expression.length; outerIndex++) {

            if (expression[outerIndex] === "@") {

                let startIndex = outerIndex + 1;

                if (expression[startIndex] === "@") {

                    // Treat double @ as a single @, so that literal @ symbols can be used.
                    result += "@";
                    outerIndex++;
                    continue;
                }

                // Presume that the @ symbol is followed by an identifier.

                let stopIndex; // We'll read forward until we stop being in that identifier.
                let bracketCount = 0; // Keep count of opening brackets minus closing brackets.

                let hasOpeningBracket = false;

                // Allow expressions such as @parameters["foo"].
                let haveEncounteredFullStop = false;
                let insideSquareBrackets = false;

                for (stopIndex = startIndex; stopIndex < expression.length; stopIndex++) {

                    const ch = expression[stopIndex];

                    if (Ren.TextUtils.isLetterOrDigit(ch) || ch === ".") {

                        continue; // Keep going during identifier following @ symbol.

                    }
                    else if (ch === "(") {

                        bracketCount++;
                        hasOpeningBracket = true;

                    }
                    else if (ch === ")") {

                        if (bracketCount === 0) break;
                        bracketCount--;

                    }
                    else if (ch === "[" && !haveEncounteredFullStop && !insideSquareBrackets) {

                        insideSquareBrackets = true;
                        continue;

                    }
                    else if (ch === " " && insideSquareBrackets) {

                        continue; // Allow spaces inside square brackets.

                    }
                    else if (ch === '"' && insideSquareBrackets) {

                        continue;

                    }
                    else if (ch === "]" && insideSquareBrackets) {

                        insideSquareBrackets = false;
                        continue;
                    }
                    else if (bracketCount === 0 && !Ren.TextUtils.isLetterOrDigit(ch)) {

                        break;
                    }
                }

                if (stopIndex > startIndex) {

                    let identifier = expression.substring(startIndex, stopIndex);

                    // A function call's arguments may contain nested @ expressions.

                    if (hasOpeningBracket && identifier.includes("@")) {
                        identifier = _update(identifier, expressionDepth + 1, mode);
                    }

                    if (mode === _updateModeEnum.createFunction) {

                        const quoteContext = Ren.TextQuoteCounter.countQuotes(expression, startIndex);

                        const identifierWithDelimiters = addNecessaryQuoteSyntax(identifier, quoteContext);
                        result += identifierWithDelimiters;
                    }
                    else { // Highlight mode.

                        if (expressionDepth === 0) {
                            result += "<b>@" + identifier + "</b>";
                        }
                        else if (expressionDepth === 1) {

                            result += "<i>@" + identifier + "</i>";
                        }
                        else if (expressionDepth === 2) {

                            result += "<u>@" + identifier + "</u>";
                        }

                        // Greater depths will just have the depth 2 styling.
                    }

                    outerIndex = stopIndex - 1; // Skip to the end of the identifier.
                }
                else {

                    result += expression[outerIndex];
                }
            }
            else {

                // Strip newlines when creating functions; keep them when highlighting.
                const includeNewlines = mode === _updateModeEnum.highlight;

                if (includeNewlines || (expression[outerIndex] !== "\r" && expression[outerIndex] !== "\n")) {
                    result += expression[outerIndex];
                }
            }
        }

        return result;
    };

    /**
     * Converts a string containing JS code into a format function, resolving ＠ expressions, which
     * inject JS values without nested quotes. Inside a string, ＠value or a nested expression such
     * as ＠websiteUrl('/find?q=＠value') is wrapped in the quotes and + signs that string
     * needs.
     */
    const resolveAtExpressions = (functionString) => {

        functionString = stripComments(functionString);
        // If the function string contains a return statement, i.e. is not a simple expression,
        // wrap it in an IIFE to convert it into an expression.
        const match = /^\s*return\s*\{(.*)\};?\s*$/ .exec(functionString);
        if (match) functionString = "return (() => { " + match[1] + " })();";
        const resolvedFunctionString = _update(functionString, 0, _updateModeEnum.createFunction);
        return resolvedFunctionString;
    };

    const highlightExpressions = (functionString) => {

        const highlightedFunctionString = _update(functionString, 0, _updateModeEnum.highlight);
        return highlightedFunctionString;
    };

    /**
     * If the @ identifier is within single or double quotes, adds the surrounding quotes and +
     * signs needed in order to inject the identifier in that context.
     */
    const addNecessaryQuoteSyntax = (identifier, quoteContext) => {

        switch (quoteContext) {

            case Ren.QuoteContextEnum.InsideSingleQuotes:
                return `' + ${identifier} + '`;
            case Ren.QuoteContextEnum.InsideDoubleQuotes:
                return `" + ${identifier} + "`;
            case Ren.QuoteContextEnum.InsideBackticks:
                return '${' + identifier + '}';
            default:
                return identifier;
        }
    };

    return {
        stripComments,
        resolveAtExpressions,
        highlightExpressions,
        parseJSDocDefaults,
        applyJSDocDefaults
    };
})();
