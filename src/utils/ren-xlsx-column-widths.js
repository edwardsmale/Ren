/**
 * Works out column widths for Ren.XlsxWriter, as Excel's AutoFit would set them.  Excel can't be
 * asked to fit columns as a file opens, so each width is estimated from the text Excel will show:
 * each cell's text, or its number or date as its format shows it, measured in the widths of
 * Calibri 11's characters, in Excel's units (the width of a digit).
 */
Ren.XlsxColumnWidths = (() => {

    // The space Excel leaves around a cell's text, and the room a heading's filter button takes.
    const CELL_PADDING = 0.75;
    const FILTER_BUTTON_WIDTH = 4.5;

    // How much wider bold text is.
    const BOLD_FACTOR = 1.07;

    const MIN_WIDTH = 3;
    const MAX_WIDTH = 60;

    // Excel's General format shows a number in at most this many characters.
    const GENERAL_MAX_LENGTH = 11;

    // Text that stands in for each part of a date format, as wide as the part gets.
    const DATE_PART_TEXT = [
        [/^yyyy/i, "2026"], [/^yy/i, "26"],
        [/^mmmmm/i, "S"], [/^mmmm/i, "September"], [/^mmm/i, "Sep"], [/^mm?/i, "12"],
        [/^dddd/i, "Wednesday"], [/^ddd/i, "Wed"], [/^dd?/i, "28"],
        [/^\[?hh?\]?/i, "23"], [/^\[?ss?\]?/i, "59"],
        [/^am\/pm/i, "PM"], [/^a\/p/i, "P"]
    ];

    /**
     * Gets a character's width, in digits' widths, roughly as Calibri 11 draws it.
     */
    const getCharacterWidth = (c) => {

        if ("ijlI'|!".includes(c)) return 0.45;
        if (".,:;".includes(c)) return 0.55;
        if (" frt()[]{}-\\\"`".includes(c)) return 0.6;
        if (c === "/") return 0.8;
        if ("mwMW@%".includes(c)) return 1.5;
        if (c >= "0" && c <= "9") return 1;
        if (c >= "a" && c <= "z") return 0.9;
        if (c >= "A" && c <= "Z") return 1.1;
        if (c.charCodeAt(0) >= 0x2E80) return 1.7;

        return 1;
    };

    /**
     * Gets text's width in digits' widths, as its longest line's, stopping once past the most a
     * column takes.
     */
    const getTextWidth = (text) => {

        let widest = 0;

        for (const line of String(text).split("\n")) {

            let width = 0;

            for (const c of line) {

                width += getCharacterWidth(c);

                if (width > MAX_WIDTH) return width;
            }

            widest = Math.max(widest, width);
        }

        return widest;
    };

    /**
     * Splits a number format into its sections (for positive numbers, negatives, zero and text),
     * at semicolons outside quotes.
     */
    const splitSections = (format) => {

        const sections = [""];

        let quoted = false;

        for (let i = 0; i < format.length; i++) {

            const c = format[i];

            if (c === "\"") quoted = !quoted;

            if (c === "\\" && !quoted) {

                sections[sections.length - 1] += c + (format[i + 1] ?? "");
                i++;
            }
            else if (c === ";" && !quoted) {

                sections.push("");
            }
            else {

                sections[sections.length - 1] += c;
            }
        }

        return sections;
    };

    /**
     * Reads a format section into parts: { literal: true, text } for the text it shows as it is,
     * and { literal: false, text } for its codes.
     */
    const readSection = (section) => {

        const parts = [];

        const add = (literal, text) => {

            const last = parts[parts.length - 1];

            if (last && last.literal === literal) last.text += text;
            else parts.push({ literal, text });
        };

        for (let i = 0; i < section.length; i++) {

            const c = section[i];

            if (c === "\"") {

                const end = section.indexOf("\"", i + 1);
                const close = end < 0 ? section.length : end;

                add(true, section.substring(i + 1, close));
                i = close;
            }
            else if (c === "\\") {

                add(true, section[i + 1] ?? "");
                i++;
            }
            else if (c === "_") {

                // Space as wide as the next character.
                add(true, section[i + 1] ?? "");
                i++;
            }
            else if (c === "*") {

                // A character repeated to fill the cell, which takes no width of its own.
                i++;
            }
            else if (c === "[") {

                const end = section.indexOf("]", i + 1);
                const close = end < 0 ? section.length : end;
                const inside = section.substring(i + 1, close);

                if (inside.startsWith("$")) {

                    // A currency and locale, such as [$£-809]: only the currency is shown.
                    add(true, inside.substring(1).split("-")[0]);
                }
                else if (/^[hms]+$/i.test(inside)) {

                    // Elapsed hours, minutes or seconds.
                    add(false, inside);
                }

                // Otherwise a colour or condition, which isn't shown.
                i = close;
            }
            else {

                add(false, c);
            }
        }

        return parts;
    };

    const isDateFormat = (parts) => parts.some(part => !part.literal && /[dmyhs]/i.test(part.text));

    /**
     * Gets text as wide as a date shows in the given format parts.
     */
    const getDateText = (parts) => parts.map((part) => {

        if (part.literal) return part.text;

        let text = "";

        for (let rest = part.text; rest;) {

            const match = DATE_PART_TEXT.find(([pattern]) => pattern.test(rest));

            if (match) {

                const length = rest.match(match[0])[0].length;

                text += match[1];
                rest = rest.substring(length);
            }
            else {

                text += rest[0];
                rest = rest.substring(1);
            }
        }

        return text;
    }).join("");

    /**
     * Gets a number as the given format parts show it, closely enough to measure.
     */
    const getNumberText = (value, parts) => {

        const codes = parts.filter(part => !part.literal).map(part => part.text).join("");

        const percents = (codes.match(/%/g) || []).length;
        const scaled = value * Math.pow(100, percents);

        const point = codes.indexOf(".");
        const decimals = point < 0 ? 0 : (codes.substring(point + 1).match(/^[0#?]*/)[0].length);
        const integerCodes = point < 0 ? codes : codes.substring(0, point);

        let number;

        const exponent = codes.match(/E([+-])([0#?]*)/i);

        if (exponent) {

            // As 1.23E+04: E+ shows the exponent's sign either way, E- only a minus.
            number = scaled.toExponential(decimals).replace(/e([+-])(\d+)/, (_, sign, digits) =>
                "E" + (sign === "-" || exponent[1] === "+" ? sign : "") +
                digits.padStart(exponent[2].length, "0")
            );
        }
        else {

            const [integer, fraction] = scaled.toFixed(decimals).split(".");
            const minDigits = (integerCodes.match(/0/g) || []).length;

            let digits = integer === "0" && minDigits === 0 ? "" : integer.padStart(minDigits, "0");

            if (/[0#?],+[0#?]/.test(integerCodes)) digits = digits.replace(/\B(?=(\d{3})+$)/g, ",");

            number = digits + (fraction ? "." + fraction : (point < 0 ? "" : "."));
        }

        // The number goes where the format's first run of digit codes is, and the other codes,
        // such as a bracket or a percent sign, show as they are.
        let placed = false;

        const text = parts.map(part => part.literal
            ? part.text
            : part.text.replace(/[0#?.,]+(?:E[+-][0#?]+)?/gi, () => {

                if (placed) return "";

                placed = true;

                return number;
            })
        ).join("");

        return placed ? text : text + number;
    };

    /**
     * Gets a number as Excel's General format shows it.
     */
    const getGeneralText = (value) => {

        const text = String(value);

        if (text.length <= GENERAL_MAX_LENGTH) return text;

        return Math.abs(value) >= 1e11 || Math.abs(value) < 1e-9
            ? value.toExponential(5)
            : text.substring(0, GENERAL_MAX_LENGTH);
    };

    /**
     * Gets a number or date (as its serial number) as the given number format shows it, closely
     * enough to measure.
     */
    const getFormattedText = (value, format, isDate) => {

        if (!format || /^general$/i.test(format)) return getGeneralText(value);

        const sections = splitSections(format);

        let section = sections[0];
        let shown = value;
        let sign = "";

        if (value < 0) {

            if (sections.length > 1 && sections[1] !== "") {

                section = sections[1];
                shown = -value;
            }
            else if (!isDate) {

                sign = "-";
                shown = -value;
            }
        }
        else if (value === 0 && sections.length > 2) {

            section = sections[2];
        }

        const parts = readSection(section);

        return sign + (isDateFormat(parts) ? getDateText(parts) : getNumberText(shown, parts));
    };

    /**
     * Gets the text a cell shows, for measuring: a string, a number or date in its format, or a
     * formula's value.  An empty cell gives "".
     * @param {*} value - A cell value, as Ren.XlsxWriter takes it.
     * @param {string} format - The column's number format, if it has one.
     * @param {string} dateFormat - The format a date shows in where the column has none.
     */
    const getShownText = (value, format, dateFormat) => {

        if (value === null || value === undefined) return "";

        if (typeof value === "number") return isFinite(value) ? getFormattedText(value, format, false) : "";

        if (value instanceof Date) {

            return isFinite(value.getTime()) ? getFormattedText(1, format || dateFormat, true) : "";
        }

        if (typeof value === "object" && typeof value.formula === "string") {

            return value.value === null || value.value === undefined ? "" : String(value.value);
        }

        return String(value);
    };

    /**
     * Gets a column's width, in Excel's units, to fit its heading (in bold, beside its filter
     * button) and each of its cells.
     * @param {string} heading - The column's heading.
     * @param {string} format - The column's number format, if it has one.
     * @param {Iterable<*>} values - The column's cell values.
     * @param {string} dateFormat - The format a date shows in where the column has none.
     */
    const getColumnWidth = (heading, format, values, dateFormat) => {

        let widest = getTextWidth(heading ?? "") * BOLD_FACTOR + FILTER_BUTTON_WIDTH;

        for (const value of values) {

            if (widest >= MAX_WIDTH) break;

            widest = Math.max(widest, getTextWidth(getShownText(value, format, dateFormat)));
        }

        const width = Math.min(Math.max(widest + CELL_PADDING, MIN_WIDTH), MAX_WIDTH);

        return Math.round(width * 100) / 100;
    };

    return {
        getTextWidth,
        getShownText,
        getColumnWidth
    };
})();
