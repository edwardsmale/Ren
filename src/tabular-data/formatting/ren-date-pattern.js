/**
 * Formats dates to patterns such as "dd/MM/yyyy" or "MMM d, yyyy HH:mm", the date formats in
 * ren.config.  The patterns' letters are yyyy, yy, MMMM, MMM, MM, M, dd, d, HH, H, mm and ss, and
 * text in single quotes is written as it is ('' being a quote).
 */
Ren.DatePattern = (() => {

    // Longest first, so that "MMM" isn't read as "MM" followed by "M".
    const TOKENS = ["yyyy", "yy", "MMMM", "MMM", "MM", "M", "dd", "d", "HH", "H", "mm", "ss"];

    const EXCEL_TOKENS = {
        yyyy: "yyyy",
        yy: "yy",
        MMMM: "mmmm",
        MMM: "mmm",
        MM: "mm",
        M: "m",
        dd: "dd",
        d: "d",
        HH: "hh",
        H: "h",
        mm: "mm",
        ss: "ss"
    };

    const pad = (value) => String(value).padStart(2, "0");

    // Each takes date parts whose fields may be numbers or digit strings, as "05".
    const TOKEN_WRITERS = {
        yyyy: (parts) => String(parts.year).padStart(4, "0"),
        yy: (parts) => String(parts.year).slice(-2),
        MMMM: (parts) => Ren.DateUtils.monthNames[Number(parts.month) - 1],
        MMM: (parts) => Ren.DateUtils.monthNamesAbbrv[Number(parts.month) - 1],
        MM: (parts) => pad(parts.month),
        M: (parts) => String(Number(parts.month)),
        dd: (parts) => pad(parts.day),
        d: (parts) => String(Number(parts.day)),
        HH: (parts) => pad(parts.hour),
        H: (parts) => String(Number(parts.hour)),
        mm: (parts) => pad(parts.minute),
        ss: (parts) => pad(parts.second)
    };

    const findToken = (pattern, index) => {

        for (let i = 0; i < TOKENS.length; i++) {

            if (pattern.startsWith(TOKENS[i], index)) return TOKENS[i];
        }

        return null;
    };

    /**
     * Splits a pattern into its tokens and literal text, each element an object with either a
     * token or a literal.
     */
    const parse = (pattern) => {

        const elements = [];

        let literal = "";
        let index = 0;

        while (index < pattern.length) {

            if (pattern.charAt(index) === "'") {

                const closingIndex = pattern.indexOf("'", index + 1);
                const end = closingIndex === -1 ? pattern.length : closingIndex;

                literal += end === index + 1 ? "'" : pattern.substring(index + 1, end);
                index = end + 1;
                continue;
            }

            const token = findToken(pattern, index);

            if (token) {

                if (literal) elements.push({ literal });

                literal = "";
                elements.push({ token });
                index += token.length;
            }
            else {

                literal += pattern.charAt(index);
                index++;
            }
        }

        if (literal) elements.push({ literal });

        return elements;
    };

    /**
     * Creates a function formatting date parts ({ year, month, day, hour, minute, second }, the
     * month from 1) to the pattern.
     */
    const compile = (pattern) => {

        const elements = parse(pattern);
        const writers = [];

        for (let i = 0; i < elements.length; i++) {

            const literal = elements[i].literal;

            writers.push(elements[i].token ? TOKEN_WRITERS[elements[i].token] : () => literal);
        }

        return (parts) => {

            let result = "";

            for (let i = 0; i < writers.length; i++) {
                result += writers[i](parts);
            }

            return result;
        };
    };

    /**
     * Gets the Excel number format matching the pattern, with any literal text holding letters
     * quoted.
     */
    const toExcelFormat = (pattern) => {

        const elements = parse(pattern);

        let result = "";

        for (let i = 0; i < elements.length; i++) {

            const element = elements[i];

            if (element.token) {
                result += EXCEL_TOKENS[element.token];
            }
            else if (/^[\s/\-:.,]*$/.test(element.literal)) {

                result += element.literal;
            }
            else {

                result += "\"" + element.literal.replace(/"/g, "") + "\"";
            }
        }

        return result;
    };

    return {
        compile,
        toExcelFormat
    };
})();
