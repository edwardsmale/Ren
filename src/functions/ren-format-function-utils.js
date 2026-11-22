/**
 * Utilities for format function parsing and formatting.
 */
Ren.FormatFunctionUtils = (() => {

    /**
     * Reduces the indentation of a multi-line string so that the minimum indentation is zero.
     */
    const reduceIndentation = (str) => {

        if (!str) return str;

        const lines = str.split("\n");
        if (lines.length === 1) return str;

        const firstLine = lines[0];
        const otherLines = lines.slice(1);

        let minIndentation = otherLines.reduce((minIndentation, line) => {

            if (line.trim() === "") return minIndentation;
            const indentation = line.match(/^\s*/)[0].length;
            return Math.min(minIndentation, indentation);
        }, Number.MAX_SAFE_INTEGER);

        const reducedLines = [firstLine].concat(otherLines.map(line => line.substring(minIndentation)));

        return reducedLines.join("\n");
    };

    const headerCommentRegex = new RegExp(/^\s*\/\*\*(.*?)\*\/(.*?)$/, "s");

    // Where a binning function whose BINNING: line states no order sorts: after the ordered ones,
    // among which it is put in name order by Ren.FunctionTags.
    const DEFAULT_BINNING_ORDER = 1000000;

    // "TAGS: format, calculation, binning" - the roles a function is fit for, which decide which
    // context menus offer it.  Any amount of space is tolerated after the colon and after each
    // comma, and the tags are matched case-insensitively, so a hand-written header is not a trap.
    const tagsLineRegex = new RegExp(/^\s*\*?\s*TAGS\s*:(.*)$/, "im");

    // The tag a BINNING: line implies, so that stating a placement is enough to be offered it.
    const BINNING_TAG = "binning";

    // "BINNING: numbers, "10", 20" - where a binning function sits on the binning submenus: the
    // group of values it reads (see Ren.FunctionTags.BINNING_GROUPS), the caption it is offered
    // under, and an optional number ordering it within that group.  A binning function without one
    // of these is still tagged binning - it just isn't offered on a menu.
    const binningLineRegex =
        new RegExp(/^\s*\*?\s*BINNING\s*:\s*([\w-]+)\s*,\s*"([^"]*)"\s*(?:,\s*(-?\d+)\s*)?$/, "im");

    // "OUTPUT: date" - the kind of value the function gives (see Ren.FunctionTags.getOutputKind).
    const outputLineRegex = new RegExp(/^\s*\*?\s*OUTPUT\s*:\s*(\w+)\s*$/, "im");

    /**
     * The tags named on a header comment's TAGS: line, lower-cased and with the blanks left by a
     * trailing comma or an empty line dropped.  Returns an empty array for a header without one.
     *
     * A header stating a binning menu placement is taken to be tagged binning whether or not it
     * says so, since a placement and the tags disagreeing could only ever be an oversight: the tag
     * is what the menus filter on, so a function offered a place on a binning menu without it would
     * silently never appear.  The tags a header does state are left in the order it states them,
     * with the implied one added last.
     *
     * @param {string} headerComment - The header comment to read the TAGS: line from.
     * @param {object} binning - The header's binning menu placement, or null if it states none.
     */
    const parseTags = (headerComment, binning) => {

        const tagsMatch = tagsLineRegex.exec(headerComment);
        const tags = [];

        if (tagsMatch) {

            const parts = tagsMatch[1].split(",");

            for (let i = 0; i < parts.length; i++) {

                const tag = parts[i].trim().toLowerCase();
                if (tag !== "") tags.push(tag);
            }
        }

        if (binning && tags.indexOf(BINNING_TAG) === -1) tags.push(BINNING_TAG);

        return tags;
    };

    /**
     * The binning menu placement named on a header comment's BINNING: line, as
     * { group, text, order }, or null for a header without one.  A line stating no order is given
     * the default one, which sorts it after every function that states its own.
     */
    const parseBinning = (headerComment) => {

        const binningMatch = binningLineRegex.exec(headerComment);

        if (!binningMatch) return null;

        return {
            group: binningMatch[1].trim().toLowerCase(),
            text: binningMatch[2],
            order: binningMatch[3] === undefined ? DEFAULT_BINNING_ORDER : parseInt(binningMatch[3], 10)
        };
    };

    // Gets the kind of value named on a header comment's OUTPUT: line, lower-cased, or null.
    const parseOutput = (headerComment) => {

        const outputMatch = outputLineRegex.exec(headerComment);

        return outputMatch ? outputMatch[1].toLowerCase() : null;
    };

    // Gets the @param declarations in a function body's header comment, as
    // { name: { type, description, optional, defaultValue } } (see Ren.FunctionTemplateParameters).
    const parseParameters = (body) => {

        const declarations = Ren.FunctionTemplateParameters.parse(body);
        const parameters = {};

        for (let index = 0; index < declarations.length; index++) {

            const declaration = declarations[index];
            const parameter = { type: declaration.type, description: declaration.description };

            if (declaration.optional) parameter.optional = true;
            if (declaration.value !== undefined) parameter.defaultValue = declaration.value;

            parameters[declaration.name] = parameter;
        }

        return parameters;
    };

    /**
     * Parses a function body for header comment, parameters, tags and binning menu placement.
     * Returns { headerComment, code, parameters, tags, binning } or { code, tags } if no comment.
     */
    const parseFunctionHeader = (body) => {

        const headerCommentMatch = headerCommentRegex.exec(body);

        if (headerCommentMatch) {

            const headerComment = headerCommentMatch[1].trim();
            const code = headerCommentMatch[2].trim();
            const binning = parseBinning(headerComment);

            return {
                headerComment,
                code,
                parameters: parseParameters(body),
                tags: parseTags(headerComment, binning),
                binning,
                output: parseOutput(headerComment)
            };
        }
        else {

            return {
                code: body,
                tags: [],
                binning: null,
                output: null
            };
        }
    };

    /**
     * Gets the source of a hand-written ("Custom...") function, or "" where the setting names a
     * listed function ({ name }) or none. A setting holding an array of specs is read by its first.
     */
    const getCustomCode = (specs) => {

        const firstSpec = Array.isArray(specs) ? specs[0] : specs;

        return typeof firstSpec === "string" && firstSpec.trim() !== "" ? firstSpec : "";
    };

    /**
     * Gets the name of the listed function a setting names, "default" where it names none, or null
     * for a hand-written function.  A setting holding an array of specs is read by its first.
     */
    const getFunctionName = (specs) => {

        const firstSpec = Array.isArray(specs) ? specs[0] : specs;

        if (typeof firstSpec === "string") return firstSpec.trim() === "" ? "default" : null;

        return firstSpec?.name ?? "default";
    };

    // The objects parseObjectParameter has read, by their text, as a function reads its parameter
    // for every value it's given.
    const objectParametersByText = new Map();
    const MAX_CACHED_OBJECT_PARAMETERS = 100;

    /**
     * Reads a function's parameter holding an object, such as {"Low": 0, "High": 1}, as JSON or
     * the looser JavaScript-like form Ren.JsonUtils_Lenient reads.  Gives an empty object for text
     * that isn't one.  Read as data rather than written into the function's code, so it can't
     * run.
     */
    const parseObjectParameter = (text) => {

        let parsed = objectParametersByText.get(text);

        if (parsed !== undefined) return parsed;

        parsed = Ren.JsonUtils_Lenient.parse(String(text ?? ""));

        if (!Ren.ObjectUtils.isObject(parsed)) parsed = {};

        if (objectParametersByText.size >= MAX_CACHED_OBJECT_PARAMETERS) objectParametersByText.clear();

        objectParametersByText.set(text, parsed);

        return parsed;
    };

    return {
        DEFAULT_BINNING_ORDER,
        reduceIndentation,
        parseFunctionHeader,
        parseObjectParameter,
        getCustomCode,
        getFunctionName
    };
})();
