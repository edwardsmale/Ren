/**
 * Lenient JSON parsing with automatic error correction.
 */
Ren.JsonUtils_Lenient = (() => {

    /**
     * Escapes the line breaks and tabs in a string, so that a long string value, such as an
     * HtmlContent's markup, can be laid out over several lines in a settings file.
     */
    const escapeLineBreaks = (string) => string
        .replace(/\r\n|\r|\n/g, "\\n")
        .replace(/\t/g, "\\t");

    /**
     * Gets the index just past the end of the quoted string starting at start.
     */
    const getQuotedStringEnd = (text, start) => {

        const quote = text[start];
        const length = text.length;
        let index = start + 1;

        while (index < length) {

            if (text[index] === "\\") {

                index += 2;
            }
            else if (text[index] === quote) {

                return index + 1;
            }
            else {

                index++;
            }
        }

        return length;
    };

    /**
     * Gets a value indicating whether the rest of a value's line is a delimiter, rather than the
     * start of a value.
     */
    const isDelimiter = (text) => text.length > 0 && !/^[\p{L}\p{Nd}_$"'{}[\],:/+.-]/u.test(text);

    /**
     * Reads the delimited string, if there is one, in the value starting at start, just past its
     * key's colon.  Returns the string's value and the index just past its closing delimiter, or
     * null.
     */
    const readDelimitedString = (text, start) => {

        let delimiterStart = start;

        while (text[delimiterStart] === " " || text[delimiterStart] === "\t") {

            delimiterStart++;
        }

        const lineEnd = text.indexOf("\n", delimiterStart);

        if (lineEnd === -1) {

            return null;
        }

        const delimiter = text.slice(delimiterStart, lineEnd).trimEnd();

        if (!isDelimiter(delimiter)) {

            return null;
        }

        const valueStart = delimiterStart + delimiter.length;
        const valueEnd = text.indexOf(delimiter, valueStart);

        if (valueEnd === -1) {

            return null;
        }

        return {
            value: text.slice(valueStart, valueEnd).replace(/\r\n/g, "\n"),
            end: valueEnd + delimiter.length
        };
    };

    /**
     * Turns each delimited string into an ordinary JSON string.  A value whose first character
     * after its key's colon cannot start a JSON value is delimited: the rest of the colon's line
     * is its delimiter, and the value is the raw text from there up to the delimiter's next
     * occurrence, so that a long value, such as an HtmlContent's markup, can be laid out over
     * several lines in a settings file.
     */
    const readDelimitedStrings = (text) => {

        const parts = [];
        const length = text.length;
        let copiedTo = 0;
        let index = 0;

        while (index < length) {

            const character = text[index];
            const next = text[index + 1];

            if (character === "\"" || character === "'") {

                index = getQuotedStringEnd(text, index);
            }
            else if (character === "/" && next === "/") {

                const lineEnd = text.indexOf("\n", index);

                index = lineEnd === -1 ? length : lineEnd;
            }
            else if (character === "/" && next === "*") {

                const commentEnd = text.indexOf("*/", index + 2);

                index = commentEnd === -1 ? length : commentEnd + 2;
            }
            else if (character === ":") {

                index++;

                const delimitedString = readDelimitedString(text, index);

                if (delimitedString) {

                    parts.push(text.slice(copiedTo, index), JSON.stringify(delimitedString.value));
                    index = delimitedString.end;
                    copiedTo = index;
                }
            }
            else {

                index++;
            }
        }

        parts.push(text.slice(copiedTo));

        return parts.join("");
    };

    /**
     * Converts single-quoted strings to double-quoted and strips comments.  Each string is added to
     * strings and swapped for an empty "" placeholder, for closeBrackets to put back in order.
     */
    const normaliseQuotesAndComments = (text, strings) => {

        let result = "";
        let i = 0;
        const len = text.length;

        while (i < len) {

            const c = text[i];

            if (c === "\"") {

                // Double-quoted string — copy verbatim.
                const start = i;
                i++;

                while (i < len) {

                    const sc = text[i];

                    if (sc === "\\") {

                        i += 2;
                    }
                    else if (sc === "\"") {

                        i++;
                        break;
                    }
                    else {

                        i++;
                    }
                }

                strings.push(escapeLineBreaks(text.slice(start, Math.min(i, len))));
                result += "\"\"";
            }
            else if (c === "'") {

                // Single-quoted string — convert to double-quoted.
                let string = "\"";
                i++;

                while (i < len) {

                    const sc = text[i];

                    if (sc === "\\") {

                        i++;
                        const next = i < len ? text[i] : "";

                        // \' is not a valid JSON escape; emit the literal character.
                        if (next === "'") {

                            string += "'"; i++;
                        }
                        else {

                            string += "\\" + next; i++;
                        }

                    }
                    else if (sc === "\"") {

                        // Escape any bare double quotes inside a single-quoted string.
                        string += "\\\"";
                        i++;

                    }
                    else if (sc === "'") {

                        string += "\"";
                        i++;
                        break;

                    }
                    else {

                        string += sc;
                        i++;
                    }
                }

                strings.push(escapeLineBreaks(string));
                result += "\"\"";
            }
            else if (c === "/" && i + 1 < len && text[i + 1] === "/") {

                // Single-line comment — skip to end of line.
                while (i < len && text[i] !== "\n") {
                    i++;
                }

            }
            else if (c === "/" && i + 1 < len && text[i + 1] === "*") {

                // Block comment — skip to closing */.
                i += 2;

                while (i + 1 < len && !(text[i] === "*" && text[i + 1] === "/")) {
                    i++;
                }

                if (i + 1 < len) i += 2;

            }
            else {

                result += c;
                i++;
            }
        }

        return result;
    };

    /**
     * Inserts any missing closing brackets and braces inline (before a mismatched closer) and
     * appends any that remain unclosed at the end, in string-aware order.  Puts back the strings
     * normaliseQuotesAndComments swapped for placeholders.
     */
    const closeBrackets = (text, strings) => {

        const stack = [];
        let result = "";
        let stringIndex = 0;
        let i = 0;
        const len = text.length;

        while (i < len) {

            const c = text[i];

            if (c === "\"") {

                result += strings[stringIndex++];
                i += 2;
            }
            else if (c === "{" || c === "[") {

                stack.push(c === "{" ? "}" : "]");
                result += c;
                i++;
            }
            else if (c === "}" || c === "]") {

                // Flush any inner containers that were left unclosed before this closer.
                while (stack.length && stack[stack.length - 1] !== c) {

                    result += stack.pop();
                }

                if (stack.length) stack.pop();

                result += c;
                i++;
            }
            else {

                result += c;
                i++;
            }
        }

        if (stack.length) result += stack.reverse().join("");

        return result;
    };

    /**
     * Truncates any text after the top-level value's final closing brace or bracket (e.g. notes
     * after a complete object). Unbalanced text is returned unchanged, for closeBrackets to handle.
     */
    const stripTrailingText = (text) => {

        let depth = 0;
        let started = false;
        let i = 0;
        const len = text.length;

        while (i < len) {

            const c = text[i];

            if (c === "\"" || c === "'") {

                const quote = c;
                i++;

                while (i < len) {

                    const sc = text[i];

                    if (sc === "\\") {
                        i += 2;
                    }
                    else if (sc === quote) {

                        i++;
                        break;
                    }
                    else {

                        i++;
                    }
                }

                continue;
            }

            if (c === "{" || c === "[") {

                depth++;
                started = true;
                i++;
                continue;
            }

            if (c === "}" || c === "]") {

                depth--;
                i++;

                if (started && depth === 0) return text.slice(0, i);

                continue;
            }

            i++;
        }

        return text;
    };

    /**
     * Reads an object key beginning at start, tolerating missing, mismatched or extra surrounding
     * quotes.  Returns the key in quotes and the index just past the key (and any trailing quotes),
     * or null if no key-like token is present.
     */
    const readKey = (text, start) => {

        const len = text.length;
        const quote = text[start];

        // A properly quoted key followed by its colon is taken whole, as it may hold escapes,
        // colons and the other kind of quote.  normaliseQuotesAndComments converts single quotes
        // later.
        if ((quote === "\"" || quote === "'") && text[start + 1] !== quote) {

            let end = start + 1;

            while (end < len && text[end] !== quote && text[end] !== "\n") {

                end += text[end] === "\\" ? 2 : 1;
            }

            let colon = end + 1;

            while (colon < len && (text[colon] === " " || text[colon] === "\t"
                || text[colon] === "\r" || text[colon] === "\n")) {

                colon++;
            }

            if (text[end] === quote && text[colon] === ":") {

                return { text: text.slice(start, end + 1), end: end + 1 };
            }
        }

        let i = start;
        let quoted = false;

        while (i < len && (text[i] === "\"" || text[i] === "'")) { i++; quoted = true; }

        const nameStart = i;

        if (quoted) {

            // A quoted key may contain spaces, so read up to the closing quote or the colon.
            while (i < len && text[i] !== "\"" && text[i] !== "'" && text[i] !== ":") i++;
        }
        else {

            while (i < len && /[A-Za-z0-9_$]/.test(text[i])) i++;
        }

        if (i === nameStart) return null;

        const name = text.slice(nameStart, i).trim();

        if (!name) return null;

        while (i < len && (text[i] === "\"" || text[i] === "'")) i++;

        return { text: "\"" + name + "\"", end: i };
    };

    /**
     * Normalizes object keys so each is wrapped in exactly one pair of double quotes, whether it
     * had none, single, mismatched (e.g. "key') or extra stray quotes.
     */
    const normaliseObjectKeys = (text) => {

        // Each open container's kind, as only a comma inside an object introduces a key.
        const stack = [];

        let expectKey = false;

        let result = "";
        let i = 0;
        const len = text.length;

        while (i < len) {

            const c = text[i];

            // Copy comments verbatim without letting their contents affect key detection.
            if (c === "/" && i + 1 < len && text[i + 1] === "/") {

                while (i < len && text[i] !== "\n") { result += text[i]; i++; }
                continue;
            }

            if (c === "/" && i + 1 < len && text[i + 1] === "*") {

                result += "/*";
                i += 2;

                while (i + 1 < len && !(text[i] === "*" && text[i + 1] === "/")) {
                    result += text[i]; i++;
                }

                if (i + 1 < len) {

                    result += "*/";
                    i += 2;
                }
                else {

                    while (i < len) { result += text[i]; i++; }
                }

                continue;
            }

            if (c === " " || c === "\t" || c === "\r" || c === "\n") {

                result += c; i++;
                continue;
            }

            if (c === "{") {

                stack.push("object");
                expectKey = true;
                result += c; i++;
                continue;
            }

            if (c === "[") {

                stack.push("array");
                expectKey = false;
                result += c; i++;
                continue;
            }

            if (c === "}" || c === "]") {

                if (stack.length) stack.pop();
                expectKey = false;
                result += c; i++;
                continue;
            }

            if (c === ",") {

                expectKey = stack.length > 0 && stack[stack.length - 1] === "object";
                result += c; i++;
                continue;
            }

            if (c === ":") {

                expectKey = false;
                result += c; i++;
                continue;
            }

            if (expectKey) {

                const key = readKey(text, i);

                if (key) {

                    result += key.text;
                    i = key.end;
                    expectKey = false;
                    continue;
                }
            }

            // String values are copied whole so that their contents are never mistaken for keys.
            if (c === "\"" || c === "'") {

                const quote = c;
                result += c; i++;

                while (i < len) {

                    const sc = text[i];
                    result += sc;

                    if (sc === "\\") {

                        i++;

                        if (i < len) { result += text[i]; i++; }
                    }
                    else if (sc === quote) {

                        i++;
                        break;
                    }
                    else {

                        i++;
                    }
                }

                continue;
            }

            result += c; i++;
        }

        return result;
    };

    /**
     * Parses a JSON string, correcting common mistakes such as comments, single quotes, trailing
     * commas, badly quoted keys, unclosed brackets and line breaks in strings, and reading
     * delimited strings.  Pass element to show an error if it fails.
     */
    const parse = (json, element) => {

        if (typeof json !== "string" || !json) return null;

        let text = json.trim();

        if (!text) return null;

        try {

            return JSON.parse(text);
        }
        catch { }

        text = readDelimitedStrings(text);

        try {

            return JSON.parse(text);
        }
        catch { }

        // Bare object properties get braces, so that top-level keys are recognised as keys below.
        if (!/^[{[]/.test(text)) text = "{\n" + text + "\n}";

        text = stripTrailingText(text);

        // Keys come before string quotes, so that mismatched key quotes don't confuse the scanner.
        text = normaliseObjectKeys(text);

        // The fixes below are regexes, so string values are swapped out while they run, lest
        // e.g. "[0-9]" gain a comma or "a,]" lose one.
        const strings = [];

        text = normaliseQuotesAndComments(text, strings);

        // Insert commas missing between adjacent array/object elements (e.g. } { or } "key").
        text = text.replace(/([}\]])\s*([{["])/g, "$1,\n$2");

        text = text.replace(/,(\s*[}\]])/g, "$1");

        text = text.replace(/:\s*undefined\b/g, ": null")
            .replace(/([,[]\s*)undefined\b/g, "$1null")
            .replace(/:\s*NaN\b/g, ": null")
            .replace(/:\s*-?Infinity\b/g, ": null");

        text = closeBrackets(text, strings);

        try {
            return JSON.parse(text);
        }
        catch {

            const message = "Couldn't parse the JSON settings.";

            console.warn("[JsonUtils_Lenient]", message, text);

            if (element) {

                // Removed so that the next scanify pass does not find it again and show another
                // popup.
                element.remove();

                Ren.PopupErrorMessage(message);
            }
        }
    };

    return {
        parse
    };
})();
