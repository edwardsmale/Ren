/**
 * A conservative JavaScript minifier, used to shrink ren.js as it is written into a downloaded
 * report.  It removes comments, indentation and the whitespace between tokens, and joins lines only
 * where the line break cannot matter to automatic semicolon insertion.  Identifiers are left as
 * they are.  Strings, template literals and regular expression literals are copied verbatim.
 */
Ren.JsMinifier = (() => {

    // The words after which a "/" begins a regular expression rather than being a division.
    const KEYWORDS_BEFORE_REGEX = new Set([
        "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do",
        "else", "yield", "await"
    ]);

    // A line break after one of these, or before one of the next, is never needed.
    const JOINS_AFTER = "{([,;=:?&|";
    const JOINS_BEFORE = ")]},;.:?";

    const TOKEN_NONE = 0;
    const TOKEN_WORD = 1;
    const TOKEN_PUNCTUATOR = 2;
    const TOKEN_LITERAL = 3;

    const isWordChar = (char) => {

        const code = char.charCodeAt(0);

        return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) ||
            (code >= 48 && code <= 57) || code === 95 || code === 36 || code === 92 ||
            (code > 127 && !isWhitespace(char) && !isLineTerminator(char));
    };

    const isDigit = (char) => char >= "0" && char <= "9";

    const isLineTerminator = (char) => {

        return char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";
    };

    const isWhitespace = (char) => {

        return char === " " || char === "\t" || char === "\v" || char === "\f" ||
            char === "\u00a0" || char === "\ufeff";
    };

    // Gets a value indicating whether two tokens would run into each other, or into a comment,
    // without a space between them.
    const needsSpace = (previousChar, nextChar) => {

        if (isWordChar(previousChar) && isWordChar(nextChar)) return true;

        if ((previousChar === "+" || previousChar === "-") && previousChar === nextChar) {
            return true;
        }

        if (previousChar === "/" && (nextChar === "/" || nextChar === "*")) return true;

        // "1 .toString()" may not become "1.toString()", nor "a < !--b" an HTML comment.
        return (isDigit(previousChar) && nextChar === ".") ||
            (previousChar === "<" && nextChar === "!") ||
            (previousChar === "-" && nextChar === ">");
    };

    // Gets the index of the quote ending the string starting at the passed index.
    const findStringEnd = (source, startIndex) => {

        const quote = source[startIndex];
        let index = startIndex + 1;

        while (index < source.length && source[index] !== quote) {
            index += source[index] === "\\" ? 2 : 1;
        }

        return index;
    };

    // Gets the index of the "/" ending the regular expression starting at the passed index.
    const findRegexEnd = (source, startIndex) => {

        let index = startIndex + 1;
        let inCharacterClass = false;

        while (index < source.length) {

            const char = source[index];

            if (char === "\\") {

                index += 2;
                continue;
            }

            if (char === "[") {
                inCharacterClass = true;
            }
            else if (char === "]") {

                inCharacterClass = false;
            }
            else if (char === "/" && !inCharacterClass) {

                break;
            }

            index++;
        }

        return index;
    };

    // Gets the index just after the template literal text starting at the passed index (just after
    // a "`" or the "}" closing a substitution), which ends at either a "`" or a "${".
    const findTemplateTextEnd = (source, startIndex) => {

        let index = startIndex;

        while (index < source.length) {

            const char = source[index];

            if (char === "\\") {

                index += 2;
                continue;
            }

            if (char === "`") return index + 1;

            if (char === "$" && source[index + 1] === "{") return index + 2;

            index++;
        }

        return index;
    };

    const minify = (source) => {

        const output = [];
        const length = source.length;

        // For each template literal substitution being read, the depth of braces open within it.
        const templateBraceDepths = [];

        let index = 0;
        let pendingSpace = false;
        let pendingLineBreak = false;
        let lastTokenType = TOKEN_NONE;
        let lastChar = "";
        let charBeforeLast = "";
        let lastWord = "";

        const isRegexAllowed = () => {

            if (lastTokenType === TOKEN_NONE) return true;

            if (lastTokenType === TOKEN_WORD) return KEYWORDS_BEFORE_REGEX.has(lastWord);

            if (lastTokenType !== TOKEN_PUNCTUATOR) return false;

            // A postfix "++" or "--" is followed by a division.
            if ((lastChar === "+" || lastChar === "-") && charBeforeLast === lastChar) return false;

            return lastChar !== ")" && lastChar !== "]" && lastChar !== "}";
        };

        const writeSeparator = (nextChar) => {

            if (lastTokenType !== TOKEN_NONE) {

                if (pendingLineBreak &&
                    JOINS_AFTER.indexOf(lastChar) === -1 && JOINS_BEFORE.indexOf(nextChar) === -1) {

                    output.push("\n");
                }
                else if ((pendingLineBreak || pendingSpace) && needsSpace(lastChar, nextChar)) {

                    output.push(" ");
                }
            }

            pendingSpace = false;
            pendingLineBreak = false;
        };

        const writeToken = (text, tokenType) => {

            writeSeparator(text[0]);
            output.push(text);

            charBeforeLast = text.length > 1 ? text[text.length - 2] : lastChar;
            lastChar = text[text.length - 1];
            lastTokenType = tokenType;
        };

        // Writes template literal text starting at the passed index, and returns the index after
        // it.
        const writeTemplateText = (startIndex, tokenStartIndex) => {

            const endIndex = findTemplateTextEnd(source, startIndex);

            writeToken(source.slice(tokenStartIndex, endIndex), TOKEN_LITERAL);

            if (source[endIndex - 1] === "{" && source[endIndex - 2] === "$") {

                templateBraceDepths.push(0);

                // A substitution is read as code that follows an opening brace.
                lastTokenType = TOKEN_PUNCTUATOR;
            }

            return endIndex;
        };

        while (index < length) {

            const char = source[index];

            if (isLineTerminator(char)) {

                pendingLineBreak = true;
                index++;
                continue;
            }

            if (isWhitespace(char)) {

                pendingSpace = true;
                index++;
                continue;
            }

            if (char === "/" && source[index + 1] === "/") {

                while (index < length && !isLineTerminator(source[index])) index++;
                continue;
            }

            if (char === "/" && source[index + 1] === "*") {

                const commentEnd = source.indexOf("*/", index + 2);
                const endIndex = commentEnd === -1 ? length : commentEnd + 2;
                const comment = source.slice(index, endIndex);

                if (/[\n\r\u2028\u2029]/.test(comment)) {
                    pendingLineBreak = true;
                }
                else {

                    pendingSpace = true;
                }

                index = endIndex;
                continue;
            }

            if (char === "\"" || char === "'") {

                const endIndex = findStringEnd(source, index) + 1;

                writeToken(source.slice(index, endIndex), TOKEN_LITERAL);
                index = endIndex;
                continue;
            }

            if (char === "`") {

                index = writeTemplateText(index + 1, index);
                continue;
            }

            if (char === "/" && isRegexAllowed()) {

                let endIndex = findRegexEnd(source, index) + 1;

                while (endIndex < length && isWordChar(source[endIndex])) endIndex++;

                writeToken(source.slice(index, endIndex), TOKEN_LITERAL);
                index = endIndex;
                continue;
            }

            if (isWordChar(char)) {

                let endIndex = index + 1;

                while (endIndex < length && isWordChar(source[endIndex])) endIndex++;

                lastWord = source.slice(index, endIndex);
                writeToken(lastWord, TOKEN_WORD);
                index = endIndex;
                continue;
            }

            const depthCount = templateBraceDepths.length;

            if (char === "}" && depthCount > 0 && templateBraceDepths[depthCount - 1] === 0) {

                templateBraceDepths.pop();
                index = writeTemplateText(index + 1, index);
                continue;
            }

            if (depthCount > 0) {

                if (char === "{") {
                    templateBraceDepths[depthCount - 1]++;
                }
                else if (char === "}") {

                    templateBraceDepths[depthCount - 1]--;
                }
            }

            writeToken(char, TOKEN_PUNCTUATOR);
            index++;
        }

        return output.join("");
    };

    return {
        minify
    };
})();
