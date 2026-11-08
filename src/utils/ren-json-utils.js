/**
 * Functions for working with JSON data.
 */
Ren.JsonUtils = (() => {

    // Simplifies arrays of numbers by removing newlines between the numbers (optimized regex).
    // Only a bracket followed by a newline is matched, as JSON.stringify escapes newlines within
    // strings, so that text such as "[ 1-9 ]" inside a string value isn't altered.
    const simplifyNumberArrays = (str) =>
        str.replace(/\[\n\s*([\d\s,.\-+eE]+)\s*\]/gm, (_match, capture) => "[" + capture.replace(/[\r\n]/g, "").replace(/\s+/g, " ").trim() + "]");

    // Serializes data to JSON string, optionally with indentation.  Returns an empty string for
    // null / undefined / empty.
    const serialize = (data, indentation) => {

        if (data == null) return "";
        if (!indentation) return JSON.stringify(data);

        return simplifyNumberArrays(JSON.stringify(data, null, indentation));
    };

    // Tabular data refuses to be serialised, and JSON.stringify calls its toJSON before the
    // replacer sees it, so it is swapped for a placeholder in a copy of the object holding it.
    function replaceTabularData(_key, value) {

        if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return value;

        const keys = Object.keys(value);
        let copy = null;

        for (let index = 0; index < keys.length; index++) {

            const child = value[keys[index]];

            if (child && child.tabularDataGuid && typeof child.toJSON === "function") {

                if (copy === null) {
                    copy = Array.isArray(value) ? value.slice() : Object.assign({}, value);
                }

                copy[keys[index]] = "[TabularData " + child.tabularDataGuid + "]";
            }
        }

        return copy || value;
    }

    // Serializes data for a debug view, which may show objects holding tabular data.
    const serializeForDebug = (data, indentation) => {

        if (data == null) return "";

        // Wrapped, so that data which is itself tabular data is replaced too.
        const root = replaceTabularData("", { data }).data;
        const json = JSON.stringify(root, replaceTabularData, indentation);

        return indentation ? simplifyNumberArrays(json) : json;
    };

    // Parses a JSON string into an object.  Returns NULL if the string is not valid JSON.
    const parse = (json) => {

        if (typeof json !== "string" || !json) return null;

        try {

            return JSON.parse(json);
        }
        catch {

            return null;
        }
    };

    // Gets a value indicating whether the JSON represents an array, by looking for the opening
    // bracket past any leading whitespace.  This lets a caller that only cares about arrays skip
    // parsing anything else.
    const isJsonArray = (json) => {

        if (typeof json !== "string") return false;

        for (let index = 0; index < json.length; index++) {

            const character = json[index];

            if (character === "[") return true;

            if (character !== " " && character !== "\t"
                && character !== "\r" && character !== "\n") {

                return false;
            }
        }

        return false;
    };

    // Gets a value indicating whether the text is a .NET JSON date string.
    const isJsonDate = (text) =>
        typeof text === "string" && text.startsWith("/Date(") && text.endsWith(")/") && !isNaN(+text.slice(6, -2));

    // Parses a .NET JSON date string to a Date object.  Returns null if invalid.
    const parseJsonDate = (text) => {

        if (typeof text !== "string" || !text.startsWith("/Date(") || !text.endsWith(")/")) return null;

        const ms = +text.slice(6, -2);

        return isNaN(ms) ? null : new Date(ms);
    };

    return {
        serialize,
        serializeForDebug,
        parse,
        isJsonArray,
        parseJsonDate,
        isJsonDate
    };
})();
