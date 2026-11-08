/**
 * Highlights JSON data.
 */
Ren.JsonHighlighter = (() => {

    const hasEscapedDoubleQuotes = (str) => /\\"/.test(str);

    const unescapeDoubleQuotes = (str) => {

        return str
            .replace(/(^|[^\\])"/g, "$1") // Remove any naked double quotes.
            .replace(/\\"/g, '"'); // Unescape escaped double quotes.
    };

    const highlightJsonMatchFunction = (match) => {

        let className = "number";

        if (/^"/.test(match)) {

            if (/:$/.test(match)) {

                className = "key";
            }
            else {

                className = "string";

                // Make format function values easier to read, by avoiding double quote
                // escaping, whilst leaving 'normal' strings with their double quote wrappers,
                // which looks more natural.

                if (hasEscapedDoubleQuotes(match)) {
                    match = unescapeDoubleQuotes(match);
                }
            }
        }
        else if (/true|false/.test(match)) {

            className = "boolean";
        }
        else if (/null/.test(match)) {

            className = "null";
        }

        return `<span class="ren-json-pretty__${className}">${match}</span>`;
    };

    /**
     * Does some basic syntax highlighting of JSON.
     */
    const highlightJson = (json) => {

        // To improve readability of string values which contain JS code with newlines:
        json = json.replace(/\\r?\\n/g, "\n");

        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
            highlightJsonMatchFunction
        );
    };

    const selectAllTextInsideDoubleQuotes = (element) => {

        const text = element.textContent;

        const start = 1; // Skip opening double quote.

        let stop;

        if (text[text.length - 1] === "\"") {

            // If it's a string value, then double-clicking by default includes the closing double
            // quote.  Exclude it.
            stop = text.length - 1;
        }
        else if (text[text.length - 1] === ":" || text[text.length - 2] === "\"") {

            // If it's a JSON object key, then double-clicking by default includes the closing
            // double quote and the colon.  Exclude both.
            stop = text.length - 2;
        }

        Ren.TextSelectionUtils.selectTextRange(element, start, stop);
    };

    /**
     * Adds double-click event handlers so that, when string values in highlighted JSON data, are
     * double-clicked, all the text inside the double quotes is selected.
     */
    const setupDoubleClickSelectsEntireString = () => {

        const classNamesToInclude = ["string", "key"];

        for (let i = 0; i < classNamesToInclude.length; i++) {

            const className = classNamesToInclude[i];

            const selector = ".ren-json-pretty__" + className;

            document.querySelectorAll(selector)
                .forEach((element) => {

                    element.removeEventListener("dblclick", () => selectAllTextInsideDoubleQuotes(element));
                    element.addEventListener("dblclick", () => selectAllTextInsideDoubleQuotes(element));
                });
        }
    };

    return {
        highlightJson,
        setupDoubleClickSelectsEntireString
    };
})();
