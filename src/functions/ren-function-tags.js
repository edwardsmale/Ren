/**
 * Reads the TAGS:, BINNING: and OUTPUT: lines off the format function files, so a function's own
 * header is the one place that says which menus offer it and what it gives.
 *
 *     TAGS: format, calculation, binning, sort, style, tooltip, html, report-specific
 *     BINNING: numbers, "10", 20
 *     OUTPUT: date
 *
 * A BINNING: line names the value group, the menu caption and an optional order within the group.
 * A function tagged binning without one is not offered on a menu.  A BINNING: line implies the
 * binning tag, so a header can never claim a menu place the menus would then filter out.
 *
 * An OUTPUT: line names the kind of value the function gives ("text", "number" or "date"), so a
 * compare filter on its results offers the operators for that kind.  Without one it gives text.
 */
Ren.FunctionTags = (() => {

    // "universal" functions are offered for every kind of column, and "date-times" ones read the
    // time of day, so are offered for a Date/Time column alone.
    const BINNING_GROUPS = {
        Numbers: "numbers",
        Text: "text",
        Dates: "dates",
        DateTimes: "date-times",
        Urls: "urls",
        UserAgents: "user-agents",
        Universal: "universal"
    };

    // Read on use rather than at load: the format functions are parsed from the page, which is not
    // there yet when the aggregated script runs.
    const getMetadata = (functionName) => Ren.FormatFunctions.getFunctionMetadata(functionName);

    /**
     * Gets a value indicating whether a function is tagged with a role.  An unknown function is
     * tagged with nothing, so a false here is not an answer for one (see isKnownFunction).
     */
    const hasTag = (functionName, tag) => {

        const metadata = getMetadata(functionName);

        if (!metadata || !metadata.tags) return false;

        return metadata.tags.indexOf(tag) !== -1;
    };

    /**
     * Gets a value indicating whether a function is known to the client at all.
     */
    const isKnownFunction = (functionName) => !!getMetadata(functionName);

    /**
     * Gets the tags a function's header names, or an empty array.
     */
    const getTags = (functionName) => {

        const metadata = getMetadata(functionName);

        return metadata && metadata.tags ? metadata.tags : [];
    };

    // Drops the "bin-" prefix, keeping menu item IDs stable ("bin-ua-browser" -> "ua-browser").
    const toIdSuffix = (functionName) =>
        functionName.indexOf("bin-") === 0 ? functionName.substring(4) : functionName;

    // Ties are broken by name, so the menu order does not depend on load order.
    const compareBinningFunctions = (first, second) => {

        if (first.order !== second.order) return first.order - second.order;

        return first.name < second.name ? -1 : (first.name > second.name ? 1 : 0);
    };

    /**
     * Gets the binning functions offered for one group of values, in menu order.
     * @param {string} group - One of BINNING_GROUPS.
     * @returns {object[]} { name, text, idSuffix, order } for each function.
     */
    const getBinningFunctions = (group) => {

        const functionNames = Ren.FormatFunctions.getFunctionNames();
        const binningFunctions = [];

        for (let i = 0; i < functionNames.length; i++) {

            const functionName = functionNames[i];
            const metadata = getMetadata(functionName);

            if (!metadata || !metadata.binning) continue;
            if (metadata.binning.group !== group) continue;
            if (metadata.tags.indexOf("binning") === -1) continue;

            binningFunctions.push({
                name: functionName,
                text: metadata.binning.text,
                idSuffix: toIdSuffix(functionName),
                order: metadata.binning.order
            });
        }

        binningFunctions.sort(compareBinningFunctions);

        return binningFunctions;
    };

    /**
     * Gets a binning function's BINNING: caption, or its name where it has none.
     */
    const getBinningText = (functionName) => {

        const metadata = getMetadata(functionName);

        return metadata && metadata.binning ? metadata.binning.text : functionName;
    };

    /**
     * Gets the kind of value a function's OUTPUT: line names, or "text" where it names none.
     */
    const getOutputKind = (functionName) => getMetadata(functionName)?.output ?? "text";

    return {
        BINNING_GROUPS,
        hasTag,
        isKnownFunction,
        getTags,
        getBinningFunctions,
        getBinningText,
        getOutputKind
    };
})();
