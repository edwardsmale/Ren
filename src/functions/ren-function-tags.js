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
 * An OUTPUT: line names the kind of value the function gives ("text", "number", "integer" or
 * "date"), so a compare filter on its results offers the operators for that kind, and a column
 * calculated with it is treated as holding that kind (see getCalcFunctionsValueFormat).  Without
 * one a compare filter takes it to give text, and a calculated column keeps its own kind.
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
     * Gets the kind of value a function's OUTPUT: line names, or "text" where it names none.  An
     * integer is a number, as far as a compare filter is concerned.
     */
    const getOutputKind = (functionName) => {

        const output = getMetadata(functionName)?.output ?? "text";

        return output === "integer" ? "number" : output;
    };

    /**
     * Gets the value format a column's values have once a chain of calc functions has run on them:
     * the format the last OUTPUT: line in the chain names, or null where no function in it names
     * one (a custom function among them), so that the caller keeps the format the values had.
     *
     * A date output keeps a date format the values already had, since it can't say which of
     * Date and DateTime it is.
     *
     * @param {*} calcFunction - The calc function specs, as a column's calcFunction holds them.
     * @param {number} inputValueFormat - The SpreadsheetColumnFormatEnum the values had before.
     * @returns {number|null} The SpreadsheetColumnFormatEnum the values have after, or null.
     */
    const getCalcFunctionsValueFormat = (calcFunction, inputValueFormat) => {

        const formats = Ren.SpreadsheetColumnFormatEnum;
        const specs = Ren.ArrayUtils.ensureArray(calcFunction);
        let valueFormat = null;

        for (let i = 0; i < specs.length; i++) {

            const functionName = Ren.FormatFunctionUtils.getFunctionName(specs[i]);
            const output = functionName ? getMetadata(functionName)?.output : null;

            if (!output) continue;

            const previousFormat = valueFormat ?? inputValueFormat;

            switch (output) {

                case "integer": valueFormat = formats.Integer; break;
                case "number": valueFormat = formats.Number; break;
                case "date":
                    valueFormat = formats.IsDate(previousFormat) ? previousFormat : formats.Date;
                    break;
                default: valueFormat = formats.General; break;
            }
        }

        return valueFormat;
    };

    /**
     * Gets the calc function a grouping by a column turns its values into the results of
     * (string-length, say, showing the lengths), or null where none does.  That is the function
     * the column is grouped by the results of, or a calc function on the column in a grouping by
     * it, which changes the value each of its groups shows.  The outermost such grouping's is
     * taken, as the groupings within it group by the column too.
     *
     * @param {Array} groupingEntries The groupings, innermost first, each with its
     *   groupByColumnIndexes, their groupByCalcFunctions and its columns settings.
     */
    const getGroupByCalcFunction = (groupingEntries, columnIndex, columnIdOrHeading) => {

        if (!groupingEntries) return null;

        for (let i = groupingEntries.length - 1; i >= 0; i--) {

            const entry = groupingEntries[i];
            const position = entry.groupByColumnIndexes?.indexOf(columnIndex) ?? -1;

            if (position === -1) continue;

            const calcFunction = entry.groupByCalcFunctions?.[position] ??
                entry.columns?.[columnIdOrHeading]?.calcFunction;

            if (calcFunction) return calcFunction;
        }

        return null;
    };

    /**
     * Gets the calc function a grouping's sum, average or the like applies to each of a column's
     * values before aggregating them, where it gives numbers (see Ren.Aggregation's
     * getPerValueCalcFunctions): the grouping's own calc function on the column, or where it has
     * none, the one the column is grouped by the results of (see getGroupByCalcFunction).
     * Whether it does give numbers is the caller's to check.
     *
     * @param {Array} groupingEntries The groupings, innermost first.
     * @param {Object} groupingColumns The grouping's columns settings.
     */
    const getPerValueCalcFunction = (
        groupingEntries, groupingColumns, columnIndex, columnIdOrHeading
    ) => groupingColumns?.[columnIdOrHeading]?.calcFunction ??
        getGroupByCalcFunction(groupingEntries, columnIndex, columnIdOrHeading);

    return {
        BINNING_GROUPS,
        hasTag,
        isKnownFunction,
        getTags,
        getBinningFunctions,
        getBinningText,
        getOutputKind,
        getCalcFunctionsValueFormat,
        getGroupByCalcFunction,
        getPerValueCalcFunction
    };
})();
