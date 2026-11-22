/**
 * Turns format, calculation and binning functions' code into the source of a function, and
 * compiles source where the page lets it.
 *
 * A function's template parameters (its $name placeholders) aren't written into its code as text.
 * One in a string (quoted, or a template literal) becomes a read of the parameters argument, so
 * that its value is only ever data: it can't leave the string or run as code, whatever it holds.
 * Only one written straight into the code ("bare", as custom-format's $code is) is still written in
 * as text, as its value is meant to be code.
 *
 * So a function with no bare parameters compiles to the same source whatever its parameters'
 * values, which is how the build compiles the library's own functions ahead of time (see
 * build/Ren.Build/Templates.cs, which runs this file too), and they run where the page's content
 * security policy doesn't allow eval.
 *
 * Code that is only known on the page (the function editor's, a report's, the page's own) is
 * compiled with new Function where the policy allows eval.  Where it doesn't, it's compiled by
 * putting it in a <script> element carrying the page's nonce, which a policy allowing the page's
 * own scripts by nonce runs.  Where neither is allowed, compile throws an EvalError.
 */
Ren.FunctionCompiler = (() => {

    // The arguments every format and calc function is compiled with.  Hosts pass the first five;
    // the parameters and the report parameters are passed by the function Ren.FormatFunctions
    // makes around the compiled one.
    const ARGUMENTS =
        "(value, rowVals, groupSummaryStats, overallSummaryStats, compressedRowVals, parameters, paras)";

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
     * supply them all.  Returns "" for a function reading none of them.
     */
    const buildContextGuardPrefix = (functionBody) => {

        let prefix = "";

        for (let i = 0; i < CONTEXT_ARGUMENT_NAMES.length; i++) {

            const argumentName = CONTEXT_ARGUMENT_NAMES[i];

            // Comments have already been stripped, so an argument named only in a function's
            // documentation doesn't count as a use of it.
            if (!new RegExp("\\b" + argumentName + "\\b").test(functionBody)) continue;

            prefix += "if (" + argumentName + " == null) return " +
                JSON.stringify(NO_CONTEXT_RESULT) + "; ";
        }

        return prefix;
    };

    /**
     * Replaces each $name placeholder in a string in code with a read of the parameters argument,
     * written as that string needs it.  Where one name starts another, the longer is matched, so
     * that $column isn't read inside $columnIndex.  Returns { code, bareNames }, bareNames being
     * the names of those written straight into the code, which are left as they are.
     */
    const referenceParameters = (code, parameterNames) => {

        const names = parameterNames.slice().sort((first, second) => second.length - first.length);
        const bareNames = [];
        let result = "";

        for (let index = 0; index < code.length; index++) {

            const character = code[index];

            // An escaped $ (as in a regex, /\$\d/) is the character itself.
            if (character !== "$" || code[index - 1] === "\\") {

                result += character;
                continue;
            }

            const name = names.find(candidate => code.startsWith(candidate, index + 1));

            if (name === undefined) {

                result += character;
                continue;
            }

            const read = "parameters[" + JSON.stringify(name) + "]";

            switch (Ren.TextQuoteCounter.countQuotes(code, index)) {

                case Ren.QuoteContextEnum.InsideSingleQuotes:
                    result += "' + " + read + " + '";
                    break;
                case Ren.QuoteContextEnum.InsideDoubleQuotes:
                    result += "\" + " + read + " + \"";
                    break;
                case Ren.QuoteContextEnum.InsideBackticks:
                    result += "${" + read + "}";
                    break;
                default:
                    if (!bareNames.includes(name)) bareNames.push(name);
                    result += "$" + name;
                    break;
            }

            index += name.length;
        }

        return { code: result, bareNames };
    };

    /**
     * Gets the sources a function's code could compile to, to be tried in turn: an expression
     * first, where the code has no return statement, and then a block.  A function's code may be
     * either, and only compiling it tells which.
     */
    const getCandidateSources = (functionBody) => {

        const guardPrefix = buildContextGuardPrefix(functionBody);
        const block = ARGUMENTS + " => { " + guardPrefix + functionBody + "}";

        if (functionBody.includes("return ")) return [block];

        // Guards are statements, so a guarded expression body has to become the argument of a
        // return rather than staying an expression-bodied arrow.
        const expression = guardPrefix
            ? ARGUMENTS + " => { " + guardPrefix + "return (" + functionBody + "); }"
            : ARGUMENTS + " => " + functionBody;

        return [expression, block];
    };

    /**
     * Turns a function's code into the sources it could compile to (see getCandidateSources).
     * Returns { sources, bareNames }.  Where bareValues is given, the bare parameters are written
     * into the code from it, as code; otherwise they're left in, and the sources only compile
     * where there are none.
     */
    const buildSources = (code, parameterNames, bareValues) => {

        const referenced = referenceParameters(
            Ren.FunctionResolver.stripComments(code),
            parameterNames
        );

        let body = referenced.code;

        if (bareValues && referenced.bareNames.length > 0) {

            const values = {};

            for (let i = 0; i < referenced.bareNames.length; i++) {

                const name = referenced.bareNames[i];

                values[name] = bareValues[name];
            }

            body = Ren.FunctionTemplateParameters.substitute(body, values);
        }

        // A leading "=" is dropped, so that a body can be written like an Excel formula.  Stripped
        // after resolving, which removes comments, so that it may follow a header comment.
        body = Ren.FunctionResolver.resolveAtExpressions(body).replace(/^\s*=/, "");

        return { sources: getCandidateSources(body), bareNames: referenced.bareNames };
    };

    /**
     * Gets the source of a compiled function, or of a list of them, without the argument list each
     * is compiled with, which names every argument whether the function reads it or not.
     */
    const getSourceWithoutArguments = (compiledFunctions) =>
        String(compiledFunctions).split(ARGUMENTS).join("");

    const BLOCKED_MESSAGE = "The page's content security policy doesn't allow functions to be " +
        "compiled: it needs script-src 'unsafe-eval', or a nonce Ren can read from its scripts.";

    let isEvalBlocked = false;
    let isScriptBlocked = false;

    // The nonce of the script Ren loaded from, read while it loads, when it is the current script.
    // Read from the property: browsers hide the attribute's value.
    const loadingScriptNonce = typeof document !== "undefined"
        ? document.currentScript?.nonce || ""
        : "";

    const getNonce = () =>
        loadingScriptNonce || document.querySelector("script[nonce]")?.nonce || "";

    // The values compiled by script elements, by the number each was given.
    const compiledByScript = new Map();
    let nextScriptNumber = 0;

    /**
     * Called by a script element compileWithScript added, with what it compiled.
     */
    const receive = (number, value) => {

        compiledByScript.set(number, value);
    };

    /**
     * Compiles source by running it in a <script> element carrying the page's nonce.  Returns
     * { value } for what it compiled to, { error } for source that doesn't compile, or {} where the
     * page's policy didn't let it run.  An inline script runs as it's added, so this isn't
     * asynchronous; its syntax error is reported to the window as it's added too, and is taken
     * from there so that the page's error handlers don't see it.
     */
    const compileWithScript = (source) => {

        if (typeof document === "undefined" || !document.documentElement) return {};

        const number = nextScriptNumber++;
        let error = null;

        const onError = (event) => {

            error = event.error || new SyntaxError(event.message);
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        // Without a nonce, a policy that blocks eval would block the script too, and report it as
        // a violation, so it isn't tried.
        const nonce = getNonce();

        if (!nonce) return {};

        const script = document.createElement("script");

        script.nonce = nonce;

        script.textContent = "Ren.FunctionCompiler.receive(" + number + ", (" + source + "\n));";

        window.addEventListener("error", onError, true);

        try {

            (document.head || document.documentElement).appendChild(script);
        }
        finally {

            window.removeEventListener("error", onError, true);
            script.remove();
        }

        if (compiledByScript.has(number)) {

            const value = compiledByScript.get(number);

            compiledByScript.delete(number);

            return { value };
        }

        return error ? { error } : {};
    };

    /**
     * Compiles the source of an expression (a function's, say), giving its value.  Throws the
     * SyntaxError of source that doesn't compile, or an EvalError where the page compiles nothing.
     * Whichever way of compiling the page's policy blocks is remembered, so that it isn't tried,
     * and reported as a violation, every time.
     */
    const compile = (source) => {

        if (!isEvalBlocked) {

            try {

                // eslint-disable-next-line no-new-func -- the reason this module exists.
                return new Function("return (" + source + "\n);")();
            }
            catch (e) {

                if (!(e instanceof EvalError)) throw e;

                isEvalBlocked = true;
            }
        }

        if (!isScriptBlocked) {

            const result = compileWithScript(source);

            if ("value" in result) return result.value;

            if (result.error) throw result.error;

            isScriptBlocked = true;
        }

        throw new EvalError(BLOCKED_MESSAGE);
    };

    /**
     * Compiles the first of the specified sources that compiles, throwing the last one's error
     * where none does.  An EvalError is thrown straight away, as no other source would fare
     * differently.
     */
    const compileFirst = (sources) => {

        let lastError = null;

        for (let i = 0; i < sources.length; i++) {

            try {

                return compile(sources[i]);
            }
            catch (e) {

                if (e instanceof EvalError) throw e;

                lastError = e;
            }
        }

        throw lastError;
    };

    /**
     * Forgets which ways of compiling the page's policy blocked, for tests that block eval for a
     * while.
     */
    const forgetBlocking = () => {

        isEvalBlocked = false;
        isScriptBlocked = false;
    };

    return {
        ARGUMENTS,
        referenceParameters,
        buildSources,
        getSourceWithoutArguments,
        compile,
        compileFirst,
        forgetBlocking,
        receive
    };
})();
