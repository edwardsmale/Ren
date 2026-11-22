/**
 * Reads and writes a function's template parameters: the $name placeholders in its code, each
 * replaced by a value before the code is compiled.  They are declared in the function's header
 * comment by JSDoc @param lines giving each one's type, value and description, e.g.
 *
 *     @param {colour} [lowColour=#2166ac] - The colour of the smallest value.
 *     @param {number 0..45} [padding=0] - How far in from each end the colours start, in percent.
 *
 * The types the function editor has an input for are string, number (with an optional range and
 * step, as in "number 0..1 step 0.05", which adds a slider), colour and boolean.  A value holding
 * spaces or characters that would end the declaration is written as a JSON string.
 *
 * A declaration's value is its default, used where a { name, parameters } spec names no value
 * for it.  Code with no name to refer to (as the function editor writes) keeps its values there
 * too, so that they are still there to edit when it is next opened.
 */
Ren.FunctionTemplateParameters = (() => {

    const HEADER_COMMENT_REGEX = /^\s*\/\*\*([\s\S]*?)\*\//;

    // @param {type} [name=value] - description, or @param {type} name description.
    const PARAM_REGEX = new RegExp(
        "(@param\\s+\\{([^}]*)\\}\\s+)" +
        "(\\[\\s*(\\w+)\\s*(?:=\\s*(\"(?:[^\"\\\\]|\\\\.)*\"|[^\\]]*?))?\\s*\\]|(\\w+))" +
        "[ \\t]*(?:-\\s+)?([^\\r\\n]*)\\r?$"
    );

    const RANGE_REGEX = /(-?\d*\.?\d+)\s*\.\.\s*(-?\d*\.?\d+)/;
    const STEP_REGEX = /\bstep\s+(\d*\.?\d+)/i;

    const TYPE_ALIASES = { color: "colour", bool: "boolean", int: "number", integer: "number" };

    // A value is quoted where it is empty, has spaces at either end, or could end the comment,
    // the brackets or the quotes it is written in.
    const needsQuotes = (value) => value === "" || /^\s|\s$|["'\]\\\r\n]|\*\//.test(value);

    const encodeValue = (value) => {

        if (!needsQuotes(value)) return value;

        return JSON.stringify(value)
            .replace(/\]/g, "\\u005d")
            .replace(/\*\//g, "*\\u002f");
    };

    const decodeValue = (text) => {

        const trimmed = text.trim();

        if (trimmed.length > 1 && trimmed[0] === "\"" && trimmed[trimmed.length - 1] === "\"") {

            try {

                return JSON.parse(trimmed);
            }
            catch (e) {

                return trimmed.slice(1, -1);
            }
        }

        if (trimmed.length > 1 && trimmed[0] === "'" && trimmed[trimmed.length - 1] === "'") {
            return trimmed.slice(1, -1);
        }

        return trimmed;
    };

    const parseType = (typeText) => {

        const words = typeText.trim().split(/\s+/);
        const typeName = (words[0] || "string").toLowerCase();
        const range = RANGE_REGEX.exec(typeText);
        const step = STEP_REGEX.exec(typeText);

        return {
            type: TYPE_ALIASES[typeName] || typeName,
            min: range ? parseFloat(range[1]) : null,
            max: range ? parseFloat(range[2]) : null,
            step: step ? parseFloat(step[1]) : null
        };
    };

    // Gets a comment line's text without the indentation and asterisk starting it.
    const stripCommentLineStart = (line) => line.replace(/^\s*\*?\s?/, "").trim();

    const isDescriptionContinuation = (text) =>
        text !== "" && text[0] !== "@" && !/^(TAGS|BINNING)\s*:/i.test(text);

    /**
     * Gets the parameters declared in the header comment of a function's source, in the order
     * declared, as { name, type, min, max, step, optional, value, description } objects.  value is
     * undefined for a parameter declared without one.
     */
    const parse = (source) => {

        const parameters = [];

        if (typeof source !== "string") return parameters;

        const headerMatch = HEADER_COMMENT_REGEX.exec(source);

        if (!headerMatch) return parameters;

        const lines = headerMatch[1].split("\n");

        for (let index = 0; index < lines.length; index++) {

            const match = PARAM_REGEX.exec(lines[index]);

            if (!match) continue;

            const typeInfo = parseType(match[2]);
            let description = match[7].trim();

            while (index + 1 < lines.length
                && isDescriptionContinuation(stripCommentLineStart(lines[index + 1]))) {

                index++;
                description += " " + stripCommentLineStart(lines[index]);
            }

            parameters.push({
                name: match[4] || match[6],
                type: typeInfo.type,
                min: typeInfo.min,
                max: typeInfo.max,
                step: typeInfo.step,
                optional: !!match[4],
                value: match[5] === undefined ? undefined : decodeValue(match[5]),
                description: description.replace(/\*\/?$/, "").trim()
            });
        }

        return parameters;
    };

    /**
     * Gets the values of the parameters declared in a function's source, as { name: value }, for
     * those declared with one.
     */
    const getValues = (source) => {

        const parameters = parse(source);
        const values = {};

        for (let index = 0; index < parameters.length; index++) {

            if (parameters[index].value !== undefined) {
                values[parameters[index].name] = parameters[index].value;
            }
        }

        return values;
    };

    /**
     * Gets a function's source with a declared parameter's value set, or the source unchanged
     * where the parameter is not declared in its header comment.
     */
    const setValue = (source, name, value) => {

        const headerMatch = HEADER_COMMENT_REGEX.exec(source);

        if (!headerMatch) return source;

        const header = headerMatch[0];
        const lines = header.split("\n");

        for (let index = 0; index < lines.length; index++) {

            const match = PARAM_REGEX.exec(lines[index]);

            if (!match || (match[4] || match[6]) !== name) continue;

            const declaration = "[" + name + "=" + encodeValue(String(value ?? "")) + "]";
            const nameStart = match.index + match[1].length;

            // A declaration without a description is followed by nothing to separate it from.
            lines[index] = lines[index].substring(0, nameStart) + declaration
                + lines[index].substring(nameStart + match[3].length);

            return lines.join("\n") + source.substring(header.length);
        }

        return source;
    };

    /**
     * Replaces each $name placeholder in code with its value.  Longer names are replaced first, so
     * that $column is not replaced inside $columnIndex.  A value may itself refer to another
     * parameter (as "≥ $compareTo" does), so the replacing repeats until nothing changes, with
     * the number of passes bounded so that a value referring to itself cannot repeat it forever.
     */
    const substitute = (code, values) => {

        if (!values) return code;

        const names = Object.keys(values).sort((first, second) => second.length - first.length);

        for (let pass = 0; pass <= names.length; pass++) {

            const previousCode = code;

            for (let index = 0; index < names.length; index++) {

                code = Ren.TextUtils.replace(
                    code,
                    "$" + names[index],
                    String(values[names[index]])
                );
            }

            if (code === previousCode) break;
        }

        return code;
    };

    /**
     * Gets the code for a function spec to be edited as: the code itself for a string, and the
     * named function's source with the spec's parameter values written into its header for a
     * { name, parameters } spec (and substituted into its code where it declares none).  Returns ""
     * for anything else.
     */
    const specToCode = (spec) => {

        if (!spec) return "";

        if (typeof spec === "string") return spec;

        if (Array.isArray(spec)) return spec.length ? specToCode(spec[0]) : "";

        if (typeof spec !== "object" || typeof spec.name !== "string") return "";

        const metadata = Ren.FormatFunctions.getFunctionMetadata(spec.name);

        if (!metadata) return "";

        let code = metadata.originalSource || metadata.code;
        const declared = parse(code);
        const declaredNames = {};

        for (let index = 0; index < declared.length; index++) {
            declaredNames[declared[index].name] = true;
        }

        const values = spec.parameters || {};
        const undeclaredValues = {};

        for (const name in values) {

            if (declaredNames[name]) {

                code = setValue(code, name, values[name]);
            }
            else {

                undeclaredValues[name] = values[name];
            }
        }

        return substitute(code, undeclaredValues);
    };

    return {
        parse,
        getValues,
        setValue,
        substitute,
        specToCode
    };
})();
