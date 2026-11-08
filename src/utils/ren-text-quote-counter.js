/**
 * Indicates whether a given index in a string is inside single or double quotes.
 */
Ren.QuoteContextEnum  = {
    NotInsideQuotes: 1,
    InsideSingleQuotes: 2,
    InsideDoubleQuotes: 3,
    InsideBackticks: 4
};

/**
 * Works out whether a given index in a string is inside single or double quotes.
 */
Ren.TextQuoteCounter = (() => {

    /**
     * Returns a value indicating whether a given index in a string is inside single or double
     * quotes.
     */
    const countQuotes = (html, index) => {

        let insideSingleQuotes = false;
        let insideDoubleQuotes = false;
        let insideBackticks = false;
        let insideRegex = false;
        let insideRegexCharClass = false;

        // The most recent non-whitespace character seen outside of any string or regex.  Used to
        // tell a regex literal (/.../) apart from a division operator: a regex can only appear
        // where a value is expected, i.e. not straight after something that itself yields a value.
        let previousSignificantChar = "";

        // Characters after which a '/' begins a regex literal rather than being a division sign.
        const regexAllowedAfter = "([{,;:=!&|?+-*%<>^~";

        for (let i = 0; i < index; i++) {

            const character = html[i];
            const insideAnyQuotes = insideSingleQuotes || insideDoubleQuotes || insideBackticks;

            // A backslash escapes the next character inside strings and regexes, so an escaped
            // quote (\") or an escaped slash (\/) is not mistaken for a closing delimiter.
            if ((insideAnyQuotes || insideRegex) && character === "\\") {

                i++; // Skip the escaped character too.
                continue;
            }

            // Inside a regex literal only a closing '/' (outside a [...] class) ends it; quote
            // characters within it are literal and must not toggle the string state.
            if (insideRegex) {

                if (character === "[") {
                    insideRegexCharClass = true;
                }
                else if (character === "]") {

                    insideRegexCharClass = false;
                }
                else if (character === "/" && !insideRegexCharClass) {

                    insideRegex = false;
                }
                continue;
            }

            if (character === "'" && !insideDoubleQuotes && !insideBackticks) {

                insideSingleQuotes = !insideSingleQuotes;
                previousSignificantChar = character;
                continue;
            }

            if (character === '"' && !insideSingleQuotes && !insideBackticks) {

                insideDoubleQuotes = !insideDoubleQuotes;
                previousSignificantChar = character;
                continue;
            }

            if (character === "`" && !insideSingleQuotes && !insideDoubleQuotes) {

                insideBackticks = !insideBackticks;
                previousSignificantChar = character;
                continue;
            }

            // Within a string nothing else affects the quote state.
            if (insideAnyQuotes) continue;

            if (character === "/" && (previousSignificantChar === "" ||
                regexAllowedAfter.includes(previousSignificantChar))) {

                insideRegex = true;
                insideRegexCharClass = false;
                previousSignificantChar = character;
                continue;
            }

            if (character !== " " && character !== "\t" && character !== "\r" && character !== "\n") {

                previousSignificantChar = character;
            }
        }

        if (insideSingleQuotes) {
            return Ren.QuoteContextEnum.InsideSingleQuotes;
        }
        else if (insideDoubleQuotes) {

            return Ren.QuoteContextEnum.InsideDoubleQuotes;
        }
        else if (insideBackticks) {

            return Ren.QuoteContextEnum.InsideBackticks;
        }
        else {

            return Ren.QuoteContextEnum.NotInsideQuotes;
        }
    };

    return {
        countQuotes
    };
})();
