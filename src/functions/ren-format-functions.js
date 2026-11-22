Ren.FormatFunctions = (() => {

    /**
     * Gets a value indicating whether a compiled function's body reads the named argument, so that
     * a host can skip building an argument that no function it calls reads.
     */
    const functionReadsArgument = (compiledFunction, argumentName) => {

        const source = String(compiledFunction);

        // The argument list names every argument, so only what follows the arrow counts.
        const body = source.slice(source.indexOf("=>") + 2);

        return new RegExp("\b" + argumentName + "\b").test(body);
    };

    /**
     * Gets the source of a compiled function, or of a list of them, without the argument list each
     * is compiled with, which names every argument whether the function reads it or not.
     */
    const getSourceWithoutArguments = (compiledFunctions) =>
        Ren.FunctionCompiler.getSourceWithoutArguments(compiledFunctions);

    /**
     * Gets the values of a function's parameters as the function reads them: each a string, with
     * a value naming another parameter ("≥ $compareTo") given that parameter's value.  Where
     * escapeValues is true, as for a function giving HTML, each is HTML-escaped, so that it's
     * shown as text wherever the function writes it into its HTML.
     */
    const getParameterValues = (parameters, escapeValues) => {

        const resolved = {};
        const values = {};

        for (const name in parameters) {

            resolved[name] = parameters[name] == null ? "" : String(parameters[name]);
        }

        for (const name in resolved) {

            const value = Ren.FunctionTemplateParameters.substitute(resolved[name], resolved);

            values[name] = escapeValues ? Ren.HtmlUtils.escapeAttribute(value) : value;
        }

        return { resolved, values };
    };

    /**
     * Makes the function a host calls, with the five arguments hosts pass, from a compiled one,
     * which is also given the parameters and the report parameters.  It stringifies to source,
     * which Ren.SummaryStats.populateStatsUsedByFunctions and functionReadsArgument read what it
     * uses off.
     */
    const bindFunction = (compiledFunction, values, paras, source) => {

        const boundFunction = (value, rowVals, groupSummaryStats, overallSummaryStats,
            compressedRowVals) => compiledFunction(value, rowVals, groupSummaryStats,
            overallSummaryStats, compressedRowVals, values, paras);

        Object.defineProperty(boundFunction, "toString", { value: () => source });

        return boundFunction;
    };

    // paras is the report parameters of the report the function belongs to.
    const createFunctionFromTemplate = (functionString, parameters, paras, escapeValues) => {

        const { resolved, values } = getParameterValues(parameters, escapeValues);

        // A bare parameter is written in as code, unescaped, as it is code.
        const { sources } = Ren.FunctionCompiler.buildSources(
            functionString,
            Object.keys(resolved),
            resolved
        );

        const compiledFunction = Ren.FunctionCompiler.compileFirst(sources);

        return bindFunction(compiledFunction, values, paras || {}, String(compiledFunction));
    };

    /**
     * Gets the source a function the build compiled reads as: its code as it was compiled, which
     * the compiled function itself may not read as, as the minified build renames its arguments.
     */
    const getPrecompiledSource = (func) => {

        if (func.precompiledSource === undefined) {

            const parameterNames = Object.keys(func.parameters || {});

            func.precompiledSource =
                Ren.FunctionCompiler.buildSources(func.code, parameterNames).sources[0];
        }

        return func.precompiledSource;
    };

    const functionCache = {};
    const formatFunctions = {};
    let initialised = false;

    // fromReportSettings marks a function that a report's settings added, which runs only where
    // the page allows user functions.  compiled is the function the build compiled from the body,
    // where it did, which is run in place of compiling the body on the page.
    const initialiseFunction = (functionName, body, fromReportSettings, compiled) => {

        const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(body);
        parsed.originalSource = body; // Store the full file content for JSDoc parsing.
        parsed.fromReportSettings = !!fromReportSettings;
        parsed.compiled = typeof compiled === "function" ? compiled : null;
        formatFunctions[functionName] = parsed;
    };

    // Gets a value indicating whether a function gives HTML, so that its parameters' values are
    // escaped for it.
    const givesHtml = (func) => !!func?.tags?.includes("html");

    /**
     * Gets a value indicating whether the page runs functions that come from report settings or
     * the function editor, rather than only the library's own and those the page itself provides
     * (its function elements and Ren.Extensions registrations).  The userFunctions feature flag
     * turns them off.
     */
    const areUserFunctionsAllowed = () => !Ren.Config.isFeatureDisabled("userFunctions");

    // Characters a parameter value from report settings can't have where user functions aren't
    // allowed, if the value is code: one written straight into a function's code, or one declared
    // as {code}.  Without them it can't call or assign anything, or leave a string or a comment
    // it's written into.
    const UNSAFE_CODE_CHARACTERS = /[=()[\]{};'"`\\\r\n\u2028\u2029]/;

    /**
     * Gets the names of the parameters a named function takes as code: those its header declares
     * as {code}, and, for one compiled on the page, those written straight into its code.
     */
    const getCodeParameterNames = (func, parameterNames) => {

        const declared = func.parameters || {};
        const names = Object.keys(declared).filter(name => declared[name].type === "code");

        if (func.compiled) return names;

        const bareNames = Ren.FunctionCompiler.referenceParameters(
            Ren.FunctionResolver.stripComments(func.code),
            Object.keys(declared).concat(parameterNames)
        ).bareNames;

        return names.concat(bareNames);
    };

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

        const parameters = spec.parameters || {};
        const func = spec.name === undefined ? null : formatFunctions[spec.name];

        // A function that isn't found shows that instead.
        if (!func) return null;

        const codeParameterNames = getCodeParameterNames(func, Object.keys(parameters));

        // What a function that doesn't give HTML gives is still shown as HTML where it has a "<"
        // in it, so a value that could add markup isn't let into it.  A style function's values
        // are written into CSS, which Ren.DataGridCellStyles guards.
        const couldAddMarkup = !givesHtml(func) && !func.tags.includes("style");

        for (const name in parameters) {

            const value = parameters[name];

            if (typeof value !== "string" && typeof value !== "number" &&
                typeof value !== "boolean" && value != null) {

                return `Parameter '${name}' isn't a plain value.`;
            }

            if (codeParameterNames.includes(name) && UNSAFE_CODE_CHARACTERS.test(String(value))) {

                return `Parameter '${name}' has characters that could run as code.`;
            }

            if (couldAddMarkup && String(value).includes("<")) {

                return `Parameter '${name}' has a "<", which could add HTML.`;
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

        initialiseFunction(
            registration.name,
            registration.source.trim(),
            false,
            registration.compiled
        );

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
        let escapeValues = false;

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
            const jsdocDefaults = Ren.FunctionResolver.parseJSDocDefaults(
                func.originalSource || func.code
            );

            parameters = Ren.FunctionResolver.applyJSDocDefaults(spec.parameters || {}, jsdocDefaults);
            escapeValues = givesHtml(func);

            if (func.compiled) {

                // Compiled by the build, so nothing is compiled here, and the page's policy needn't
                // allow eval.
                const { values } = getParameterValues(parameters, escapeValues);

                functionCache[serializedSpec] = bindFunction(
                    func.compiled,
                    values,
                    paras || {},
                    getPrecompiledSource(func)
                );

                return functionCache[serializedSpec];
            }

            template = func.code;
        }
        else {

            // Code from the function editor keeps its parameters' values in its own header.
            template = spec;
            parameters = Ren.FunctionResolver.applyJSDocDefaults(
                {},
                Ren.FunctionResolver.parseJSDocDefaults(spec)
            );
            escapeValues = givesHtml(Ren.FormatFunctionUtils.parseFunctionHeader(spec));
        }

        try {

            functionCache[serializedSpec] =
                createFunctionFromTemplate(template, parameters, paras, escapeValues);
        }
        catch (e) {

            if (throwOnError) throw e;

            // A warning, not an error: a mistake in the user's code is shown by the #VALUE! below,
            // and is not a fault for the global error banner to report.
            console.warn("[FormatFunctions] Error creating format function:", e);

            const title = escapeAttribute("Error in format function definition: " + e);

            functionCache[serializedSpec] = () => `<span title="${title}">#VALUE!</span>`;
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
