Ren.FormatFunctions = (() => {

    // The fixed argument list every format and calc function is compiled with.
    const FUNCTION_ARGUMENTS =
        "(value, rowVals, groupSummaryStats, overallSummaryStats, compressedRowVals)";

    // The arguments carrying a function's context, as opposed to the value it transforms.
    const CONTEXT_ARGUMENT_NAMES = [
        "rowVals", "groupSummaryStats", "overallSummaryStats", "compressedRowVals"
    ];

    // Returned when the context a function needs was not supplied.  Blank rather than the
    // unformatted value, which would read as though it had been transformed.
    const NO_CONTEXT_RESULT = "";

    /**
     * Builds the guard statements prefixed to a function's body so that it returns
     * NO_CONTEXT_RESULT where a context argument it reads wasn't supplied, as not every host can
     * supply them all. Returns "" for a function reading none of them. Prefixed rather than wrapped
     * around the compiled function so that it still stringifies to its own source, which
     * Ren.SummaryStats.populateStatsUsedByFunctions reads the stats it needs off.
     */
    const buildContextGuardPrefix = (functionBody) => {

        let prefix = "";

        for (let i = 0; i < CONTEXT_ARGUMENT_NAMES.length; i++) {

            const argumentName = CONTEXT_ARGUMENT_NAMES[i];

            // resolveAtExpressions has already stripped comments, so an argument named only in a
            // function's documentation doesn't count as a use of it.
            if (!new RegExp("\\b" + argumentName + "\\b").test(functionBody)) continue;

            prefix += "if (" + argumentName + " == null) return " +
                JSON.stringify(NO_CONTEXT_RESULT) + "; ";
        }

        return prefix;
    };

    /**
     * Gets a value indicating whether a compiled function's body reads the named argument, so that
     * a host can skip building an argument that no function it calls reads.
     */
    const functionReadsArgument = (compiledFunction, argumentName) => {

        const source = String(compiledFunction);

        // The argument list names every argument, so only what follows the arrow counts.
        const body = source.slice(source.indexOf("=>") + 2);

        return new RegExp("\\b" + argumentName + "\\b").test(body);
    };

    /**
     * Gets the source of a compiled function, or of a list of them, without the argument list each
     * is compiled with, which names every argument whether the function reads it or not.
     */
    const getSourceWithoutArguments = (compiledFunctions) =>
        String(compiledFunctions).split(FUNCTION_ARGUMENTS).join("");

    // paras is the report parameters of the report the function belongs to.  It isn't one of
    // FUNCTION_ARGUMENTS: the compiled function closes over it, so every host calls it alike.
    const createFunctionFromTemplate = (functionString, parameters, paras) => {

        // eslint-disable-next-line no-unused-vars -- read by the evaluated bodies.
        paras = paras || {};

        functionString = Ren.FunctionTemplateParameters.substitute(functionString, parameters);

        // A leading "=" is dropped, so that a body can be written like an Excel formula.  Stripped
        // after resolving, which removes comments, so that it may follow a header comment.
        const resolvedFunctionString = Ren.FunctionResolver.resolveAtExpressions(functionString)
            .replace(/^\s*=/, "");
        const guardPrefix = buildContextGuardPrefix(resolvedFunctionString);

        // The evals stay in this scope: a resolved body can name what is in scope here, e.g. an
        // @parameters["x"] expression resolving to the parameters argument above.
        if (resolvedFunctionString.includes("return ")) {

            return eval(FUNCTION_ARGUMENTS + " => { " + guardPrefix + resolvedFunctionString + "}");
        }

        try {

            // Guards are statements, so a guarded expression body has to become the argument of a
            // return rather than staying an expression-bodied arrow.
            return eval(guardPrefix
                ? FUNCTION_ARGUMENTS + " => { " + guardPrefix + "return (" + resolvedFunctionString + "); }"
                : FUNCTION_ARGUMENTS + " => " + resolvedFunctionString);
        }
        catch (e) {

            return eval(FUNCTION_ARGUMENTS + " => { " + guardPrefix + resolvedFunctionString + "}");
        }
    };

    const functionCache = {};
    const formatFunctions = {};
    let initialised = false;

    // fromReportSettings marks a function that a report's settings added, which runs only where
    // the page allows user functions.
    const initialiseFunction = (functionName, body, fromReportSettings) => {

        const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(body);
        parsed.originalSource = body; // Store the full file content for JSDoc parsing.
        parsed.fromReportSettings = !!fromReportSettings;
        formatFunctions[functionName] = parsed;
    };

    /**
     * Gets a value indicating whether the page runs functions that come from report settings or
     * the function editor, rather than only the library's own and those the page itself provides
     * (its function elements and Ren.Extensions registrations).  The userFunctions feature flag
     * turns them off.
     */
    const areUserFunctionsAllowed = () => !Ren.Config.isFeatureDisabled("userFunctions");

    // Characters a parameter value from report settings can't have where user functions aren't
    // allowed, as the value is written into the function's code.  Without them it can't call or
    // assign anything, or leave a string or a comment it's written into.
    const UNSAFE_PARAMETER_CHARACTERS = /[=()[\]{};'"`\\\r\n\u2028\u2029]/;

    // Escapes text for a double-quoted attribute, as a function's name or parameter may be
    // anything.
    const escapeAttribute = (text) => Ren.HtmlUtils.escapeHtml(text).replace(/"/g, "&quot;");

    /**
     * Gets why the specified spec can't be run where user functions aren't allowed, or null if it
     * can be.
     */
    const getUserFunctionRefusal = (spec) => {

        if (typeof spec === "string") return "Functions written into a report are turned off.";

        if (!Ren.ObjectUtils.isObject(spec)) return null;

        if (spec.html !== undefined) return "HTML written into a report is turned off.";

        if (spec.name !== undefined && formatFunctions[spec.name]?.fromReportSettings) {

            return `Function '${spec.name}' is from the report's settings, which are turned off.`;
        }

        for (const name in spec.parameters || {}) {

            const value = spec.parameters[name];

            if (typeof value !== "string" && typeof value !== "number" &&
                typeof value !== "boolean" && value != null) {

                return `Parameter '${name}' isn't a plain value.`;
            }

            if (UNSAFE_PARAMETER_CHARACTERS.test(String(value))) {

                return `Parameter '${name}' has characters that could run as code.`;
            }
        }

        return null;
    };

    // Whether the page has been searched for the source element in the code running now.
    let isSourceElementLookedFor = false;

    const initialiseFormatFunctions = () => {

        // Left uninitialised rather than caching the emptiness, so that the functions are picked up
        // if the element arrives later.  But looked for again only once the code running now has
        // finished, as a page without the element (one hosting Ren without its own functions) would
        // otherwise be searched for every value formatted.
        if (isSourceElementLookedFor) return;

        const sourceElement = document.querySelector(".format-function-source-code");

        if (!sourceElement) {

            isSourceElementLookedFor = true;
            queueMicrotask(() => { isSourceElementLookedFor = false; });
            return;
        }

        const formatFunctionsSource = JSON.parse(sourceElement.innerHTML);

        for (const key in formatFunctionsSource) {

            initialiseFunction(key, formatFunctionsSource[key].trim());
        }
        initialised = true;
    };

    // A registered function is overridden by the page's function of the same name, loaded over it
    // by initialiseFormatFunctions.
    Ren.Extensions.handle("formatFunction", (registration) => {

        if (formatFunctions[registration.name]) return;

        initialiseFunction(registration.name, registration.source.trim());

        // The cache may hold the not-found stand-in for the name, under any of its specs.
        for (const key in functionCache) delete functionCache[key];
    });

    /**
     * Gets what a function's header comment says about it.  Returns undefined for an unknown name,
     * which Ren.FunctionTags reads as "not known" rather than as "tagged with nothing".
     */
    const getFunctionMetadata = (functionName) => {

        if (typeof functionName !== "string" || functionName === "") return undefined;

        if (!initialised) initialiseFormatFunctions();

        return formatFunctions[functionName];
    };

    // Gets the names of every function loaded, including any a report's own settings added.
    const getFunctionNames = () => {

        if (!initialised) initialiseFormatFunctions();

        return Object.keys(formatFunctions);
    };

    /**
     * Gets a value indicating whether a named format function exists, telling a function's name
     * from a function's own source, as both are stored as plain strings.
     */
    const isFunctionName = (name) => {

        if (typeof name !== "string" || name === "") return false;

        if (!initialised) initialiseFormatFunctions();

        return !!formatFunctions[name];
    };

    /**
     * Creates a function from a spec.  paras is the report parameters of the containing report,
     * which the function can read as paras; functions made for different paras are separate.
     * Where throwOnError is true, code that fails to compile throws, rather than being logged as an
     * error and given a function that shows #VALUE!.
     */
    const createFunction = (spec, paras, throwOnError) => {

        if (!initialised) initialiseFormatFunctions();

        // Checked before the cache, and not cached, so that turning the flag off stops a function
        // already made from running again.
        const refusal = areUserFunctionsAllowed() ? null : getUserFunctionRefusal(spec);

        if (refusal) {

            if (throwOnError) throw new Error(refusal);

            console.warn("[FormatFunctions] " + refusal);

            return () => `<span title="${escapeAttribute(refusal)}">#VALUE!</span>`;
        }

        const hasParas = paras != null && Object.keys(paras).length > 0;
        const serializedSpec = hasParas
            ? JSON.stringify(spec) + "\u0000" + JSON.stringify(paras)
            : JSON.stringify(spec);

        if (functionCache[serializedSpec]) {
            return functionCache[serializedSpec];
        }
        let template;
        let parameters = {};

        if (Ren.ObjectUtils.isObject(spec) && spec.html) {

            template = "Ren.HtmlTemplateFunctions.createFunctionFromTemplate(`" + spec.html + "`)()";
        }
        else if (Ren.ObjectUtils.isObject(spec)) {

            let func;

            if (spec.name !== undefined) {

                func = formatFunctions[spec.name];

                if (!func) {

                    // The name is from the report's settings, and the message is HTML.
                    const notFound = `Format function '${spec.name}' not found.`;

                    Ren.PopupErrorMessage(Ren.HtmlUtils.escapeHtml(notFound));
                    functionCache[serializedSpec] = () =>
                        `<span title="${escapeAttribute(notFound)}">#VALUE!</span>`;
                    return functionCache[serializedSpec];
                }
            }
            let code = func.code;

            const jsdocDefaults = Ren.FunctionResolver.parseJSDocDefaults(
                func.originalSource || code
            );

            parameters = Ren.FunctionResolver.applyJSDocDefaults(spec.parameters || {}, jsdocDefaults);
            template = Ren.FunctionTemplateParameters.substitute(code, parameters);
        }
        else {

            // Code from the function editor keeps its parameters' values in its own header.
            template = spec;
            parameters = Ren.FunctionResolver.applyJSDocDefaults(
                {},
                Ren.FunctionResolver.parseJSDocDefaults(spec)
            );
        }

        try {

            functionCache[serializedSpec] = createFunctionFromTemplate(template, parameters, paras);
        }
        catch (e) {

            if (throwOnError) throw e;

            // A warning, not an error: a mistake in the user's code is shown by the #VALUE! below,
            // and is not a fault for the global error banner to report.
            console.warn("[FormatFunctions] Error creating format function:", e);
            functionCache[serializedSpec] = () =>
                `<span title="Error in format function definition: ${e}">#VALUE!</span>`;
        }

        return functionCache[serializedSpec];
    };

    const highlightExpressions = (functionString) => {

        return Ren.FunctionResolver.highlightExpressions(functionString);
    };

    const createFunctionsFromReportSettings = (reportSettings) => {

        if (reportSettings.functions) {

            for (const [functionName, functionBody] of Object.entries(reportSettings.functions)) {

                if (!formatFunctions[functionName]) {
                    initialiseFunction(functionName, functionBody, true);
                }
            }
        }
    };

    return {
        areUserFunctionsAllowed,
        createFunction,
        functionReadsArgument,
        getSourceWithoutArguments,
        isFunctionName,
        getFunctionMetadata,
        getFunctionNames,
        highlightExpressions,
        createFunctionsFromReportSettings
    };
})();
