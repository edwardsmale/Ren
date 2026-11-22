/**
 * The functions the function editor can load beyond typing them: the format function files, the
 * code recently applied and the functions saved for oneself (both kept in this browser), and the
 * functions saved on the Reporting server for everyone.  Saved functions are kept in the form the
 * format function files are, a header comment with a TAGS: line followed by the code.
 */
Ren.FunctionLibrary = (() => {

    const RECENT_FUNCTIONS_KEY = "renRecentFunctions";
    const MY_FUNCTIONS_KEY = "renMyFunctions";
    const MAX_RECENT_FUNCTIONS = 25;

    // A plain object, as Ren.DefineEnum may not have loaded yet when this file runs.
    const SharedFunctionsStatusEnum = Object.freeze({
        Loading: 1,
        Loaded: 2,
        Failed: 3
    });

    let sharedFunctions = [];
    let sharedFunctionsStatus = SharedFunctionsStatusEnum.Loading;

    // Blocked or full storage leaves the library looking empty rather than breaking the editor.
    const readStoredValue = (key, emptyValue) => {

        try {

            const stored = localStorage.getItem(key);

            return stored ? JSON.parse(stored) : emptyValue;
        }
        catch (e) {

            return emptyValue;
        }
    };

    const writeStoredValue = (key, value) => {

        try {

            localStorage.setItem(key, JSON.stringify(value));

            return true;
        }
        catch (e) {

            return false;
        }
    };

    /**
     * Gets the first paragraph of a header comment, without the asterisks starting its lines.
     */
    const getDescription = (headerComment) => {

        if (!headerComment) return "";

        const lines = headerComment.split("\n");
        const descriptionLines = [];

        for (let index = 0; index < lines.length; index++) {

            const line = lines[index].replace(/^\s*\*?/, "").trim();

            if (line === "") {

                if (descriptionLines.length) break;

                continue;
            }

            if (/^(TAGS|BINNING)\s*:/i.test(line) || line.indexOf("@") === 0) break;

            descriptionLines.push(line);
        }

        return descriptionLines.join(" ");
    };

    /**
     * Splits a function's source into the prose and tags opening its header comment, for showing
     * apart from the code, and the code with the rest of its header (the @param lines the template
     * parameter inputs read and write) left above it.  Any BINNING: or OUTPUT: line is dropped.
     * @returns {object} { description, tags, header, body, code }, description holding the prose's
     *     paragraphs separated by blank lines, header the rest of the header comment ("" where
     *     nothing is left of it), body the code beneath it, and code the two together.
     */
    const splitIntro = (source) => {

        source = source == null ? "" : String(source);

        const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(source.trim());

        if (!parsed.headerComment) {
            return { description: "", tags: [], header: "", body: source, code: source };
        }

        const lines = parsed.headerComment.split("\n");
        const paragraphs = [];
        const keptLines = [];
        let paragraph = [];
        let inIntro = true;

        for (let index = 0; index < lines.length; index++) {

            const line = lines[index].replace(/^\s*\*?\s?/, "").replace(/\s+$/, "");
            const text = line.trim();

            // BINNING: and OUTPUT: lines describe a named function, so mean nothing in inline code.
            if (/^(TAGS|BINNING|OUTPUT)\s*:/i.test(text)) continue;

            if (text[0] === "@") inIntro = false;

            if (!inIntro) {

                keptLines.push(line);
            }
            else if (text !== "") {

                paragraph.push(text);
            }
            else if (paragraph.length) {

                paragraphs.push(paragraph.join(" "));
                paragraph = [];
            }
        }

        if (paragraph.length) paragraphs.push(paragraph.join(" "));

        while (keptLines.length && keptLines[keptLines.length - 1] === "") keptLines.pop();

        let header = "";

        if (keptLines.length) {

            const commentLines = ["/**"];

            for (let index = 0; index < keptLines.length; index++) {

                commentLines.push(keptLines[index] === "" ? " *" : " * " + keptLines[index]);
            }

            commentLines.push(" */", "");
            header = commentLines.join("\n");
        }

        return {
            description: paragraphs.join("\n\n"),
            tags: parsed.tags,
            header,
            body: parsed.code,
            code: header + parsed.code
        };
    };

    /**
     * Puts the description and tags splitIntro took from a function's header comment back at the
     * top of it, above what is left of the header in the code, so that it splits the same again.
     */
    const joinIntro = (description, tags, code) => {

        if (description === "" && !tags.length) return code;

        const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(code.trim());
        const headerLines = ["/**"];

        // A description closing the comment early would leave the rest of it as code.
        const paragraphs = description === ""
            ? []
            : description.replace(/\*\//g, "* /").split("\n\n");

        for (let index = 0; index < paragraphs.length; index++) {
            headerLines.push(" * " + paragraphs[index], " *");
        }

        if (tags.length) {
            headerLines.push(" * TAGS: " + tags.join(", "));
        }
        else {

            headerLines.pop();
        }

        if (parsed.headerComment) {

            const lines = parsed.headerComment.split("\n");

            headerLines.push(" *");

            for (let index = 0; index < lines.length; index++) {

                const line = lines[index].replace(/^\s*\*?\s?/, "").replace(/\s+$/, "");

                headerLines.push(line === "" ? " *" : " * " + line);
            }
        }

        headerLines.push(" */", "");

        return headerLines.join("\n") + parsed.code;
    };

    const describeFunction = (name, source) => {

        const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(source);

        return {
            name,
            source,
            description: getDescription(parsed.headerComment),
            tags: parsed.tags
        };
    };

    // Turns { name: source } into described functions, in name order.
    const toFunctionList = (sourcesByName) => {

        const names = Object.keys(sourcesByName).sort();
        const functions = [];

        for (let index = 0; index < names.length; index++) {

            functions.push(describeFunction(names[index], sourcesByName[names[index]]));
        }

        return functions;
    };

    /**
     * Gets the format functions, including any a report's own settings added, in name order.
     */
    const getBuiltInFunctions = () => {

        const names = Ren.FormatFunctions.getFunctionNames().slice(0).sort();
        const functions = [];

        for (let index = 0; index < names.length; index++) {

            const metadata = Ren.FormatFunctions.getFunctionMetadata(names[index]);

            functions.push({
                name: names[index],
                source: metadata.originalSource || metadata.code,
                description: getDescription(metadata.headerComment),
                tags: metadata.tags
            });
        }

        return functions;
    };

    /**
     * Gets the code to put in the editor for a function's source: the source as it stands, as its
     * $parameters take their values from its header (see Ren.FunctionTemplateParameters).
     */
    const getCodeToLoad = (source) => source;

    /**
     * Gets the code applied in the function editor most recently, newest first, as
     * { code, usedAt, functionTag } objects, where functionTag is that of the editor it was
     * applied in (and missing from those recorded before editors had one).
     */
    const getRecentFunctions = () => readStoredValue(RECENT_FUNCTIONS_KEY, []);

    const recordRecentFunction = (code, functionTag) => {

        if (typeof code !== "string" || code.trim() === "") return;

        const recent = getRecentFunctions();
        const updated = [
            { code, usedAt: new Date().toISOString(), functionTag: functionTag ?? null }
        ];

        for (let index = 0; index < recent.length; index++) {

            if (updated.length === MAX_RECENT_FUNCTIONS) break;

            if (recent[index].code !== code) updated.push(recent[index]);
        }

        writeStoredValue(RECENT_FUNCTIONS_KEY, updated);
    };

    const clearRecentFunctions = () => writeStoredValue(RECENT_FUNCTIONS_KEY, []);

    const getMyFunctions = () => toFunctionList(readStoredValue(MY_FUNCTIONS_KEY, {}));

    const hasMyFunction = (name) =>
        Object.prototype.hasOwnProperty.call(readStoredValue(MY_FUNCTIONS_KEY, {}), name);

    /**
     * Saves a function in this browser, replacing any of the same name.  Returns false where the
     * browser would not store it.
     */
    const saveMyFunction = (name, source) => {

        const stored = readStoredValue(MY_FUNCTIONS_KEY, {});

        stored[name] = source;

        return writeStoredValue(MY_FUNCTIONS_KEY, stored);
    };

    const deleteMyFunction = (name) => {

        const stored = readStoredValue(MY_FUNCTIONS_KEY, {});

        delete stored[name];

        writeStoredValue(MY_FUNCTIONS_KEY, stored);
    };

    // A downloaded report has no server to ask, and its fetches never settle.
    const canUseSharedFunctions = () =>
        !Ren.UrlContext.isDownloadedReport() && Ren.Endpoints.has("listSharedFunctions");

    /**
     * Fetches the shared functions afresh.  The menu is built synchronously, so it shows the list
     * last fetched.
     */
    const refreshSharedFunctions = async () => {

        if (!canUseSharedFunctions()) return;

        try {

            const url = Ren.Endpoints.getUrl("listSharedFunctions");

            const response = await Ren.FetchUtils.fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) throw new Error("HTTP " + response.status);

            sharedFunctions = toFunctionList(await response.json());
            sharedFunctionsStatus = SharedFunctionsStatusEnum.Loaded;
        }
        catch (e) {

            sharedFunctionsStatus = SharedFunctionsStatusEnum.Failed;
        }
    };

    const getSharedFunctions = () => sharedFunctions;

    const getSharedFunctionsStatus = () => sharedFunctionsStatus;

    const hasSharedFunction = (name) => {

        for (let index = 0; index < sharedFunctions.length; index++) {

            if (sharedFunctions[index].name === name) return true;
        }

        return false;
    };

    // Returns whether the server did as asked, having refreshed the list either way.
    const postSharedFunctionChange = async (action, data, failureMessage) => {

        const baseUrl = Ren.Endpoints.getUrl("sharedFunctions");

        if (!baseUrl) return false;

        let succeeded = false;

        try {

            const response = await Ren.FetchUtils.fetch(baseUrl + action, {
                method: "POST",
                body: JSON.stringify(data),
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            });

            succeeded = response.ok;
        }
        catch (e) {

            succeeded = false;
        }

        if (!succeeded) Ren.PopupErrorMessage(failureMessage);

        await refreshSharedFunctions();

        return succeeded;
    };

    const saveSharedFunction = (name, source) => postSharedFunctionChange(
        "SaveSharedFunction",
        { functionName: name, source },
        "The shared function \"" + name + "\" could not be saved."
    );

    const deleteSharedFunction = (name) => postSharedFunctionChange(
        "DeleteSharedFunction",
        { functionName: name },
        "The shared function \"" + name + "\" could not be deleted."
    );

    /**
     * Gets a name in the form function files are named, lower-case words joined by hyphens, or ""
     * where nothing usable was typed.
     */
    const toFunctionName = (text) => {

        return String(text ?? "")
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    };

    // Gets the @param lines of a header comment, each with any description lines following it.
    const getParamLines = (headerComment) => {

        const lines = headerComment ? headerComment.split("\n") : [];
        const paramLines = [];
        let inParam = false;

        for (let index = 0; index < lines.length; index++) {

            const line = lines[index].replace(/^\s*\*?\s?/, "").replace(/\s+$/, "");

            if (line.indexOf("@param") === 0) {

                inParam = true;
            }
            else if (line === "" || line[0] === "@" || /^(TAGS|BINNING)\s*:/i.test(line)) {

                inParam = false;
            }

            if (inParam) paramLines.push(" * " + line);
        }

        return paramLines;
    };

    /**
     * Builds a saved function's source: a header comment describing and tagging the code, which
     * replaces any header the code already had but for its @param lines (see
     * Ren.FunctionTemplateParameters).
     */
    const buildSource = (description, tags, code) => {

        const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(code.trim());
        const paramLines = getParamLines(parsed.headerComment);
        const headerLines = ["/**"];

        // A description closing the comment early would leave the rest of it as code.
        if (description) headerLines.push(" * " + description.replace(/\*\//g, "* /"), " *");

        headerLines.push(" * TAGS: " + tags.join(", "));

        if (paramLines.length) headerLines.push(" *", paramLines.join("\n"));

        headerLines.push(" */", "");

        return headerLines.join("\n") + parsed.code;
    };

    return {
        SharedFunctionsStatusEnum,
        getBuiltInFunctions,
        getCodeToLoad,
        getDescription,
        splitIntro,
        joinIntro,
        getRecentFunctions,
        recordRecentFunction,
        clearRecentFunctions,
        getMyFunctions,
        hasMyFunction,
        saveMyFunction,
        deleteMyFunction,
        canUseSharedFunctions,
        refreshSharedFunctions,
        getSharedFunctions,
        getSharedFunctionsStatus,
        hasSharedFunction,
        saveSharedFunction,
        deleteSharedFunction,
        toFunctionName,
        buildSource
    };
})();
