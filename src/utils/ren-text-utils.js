/**
 * Various text-related functions.
 */
Ren.TextUtils = (() => {

    /**
     * Instantiates RegExp, swallowing any exceptions that arise (and returning null).
     */
    const createRegex = function (pattern, flags) {

        try {
            return new RegExp(pattern, flags);
        }
        catch {

            return null;
        }
    };

    const makeFirstCharLowerCase = function (str) {

        if (!str) return str;

        return str[0].toLowerCase() + str.substring(1);
    };

    const makeFirstCharUpperCase = function (str) {

        if (!str) return str;

        return str[0].toUpperCase() + str.substring(1);
    };

    const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    /**
     * Wipes schemas and database names followed by periods, by replacing them with spaces.
     */
    const wipeSchemaAndDbNamePrefixes = function (sql, schemas, databases) {

        const replaceableItems = schemas.concat(databases);

        // The name must not be the tail of a longer identifier (so "dbo" leaves "mydbo." alone).
        // The preceding character is kept, and only the name and its periods are wiped.
        const wipePrefix = (name, periods) => {

            const regex = new RegExp("(^|[^\\w@#$])" + escapeRegex(name) + periods, "g");

            sql = sql.replace(
                regex,
                (match, precedingChar) =>
                    precedingChar + " ".repeat(match.length - precedingChar.length)
            );
        };

        // Replace database names followed by two periods, with spaces.
        for (let i = 0; i < databases.length; i++) {
            wipePrefix(databases[i], "\\.\\.");
        }

        // Replace schemas followed by a period, and database names followed by a period, with
        // spaces.
        for (let i = 0; i < replaceableItems.length; i++) {
            wipePrefix(replaceableItems[i], "\\.");
        }

        return sql;
    };

    /**
     * Replaces comments in the passed SQL query with spaces (so as to not alter the positions of
     * the various parts of the query or its overall length) and returns the result.  Doesn't
     * remove directives (comments which start with a triple dash).  Comment markers inside
     * strings and square brackets are left alone.
     */
    const wipeComments = function (sql) {

        let result = "";

        let isDirective = false;
        let isOnDirectiveLine = false;
        let isAfterDashComment = false;
        let isInsideMultilineComment = false;
        let multilineCommentStartIndex = -1;
        let isInsideQuotes = false;
        let isInsideSq = false;

        for (let i = 0; i < sql.length; i++) {

            const char = sql[i];
            let isWiped = isInsideMultilineComment || isAfterDashComment;

            if (isInsideQuotes) {

                if (char === "'") isInsideQuotes = false;
            }
            else if (isInsideSq) {

                if (char === "]") isInsideSq = false;
            }
            else if (!isDirective && !isInsideMultilineComment && !isAfterDashComment) {

                if (char === "-" && sql[i + 1] === "-" && sql[i + 2] === "-") {

                    isDirective = true;
                    isOnDirectiveLine = true;
                }
                else if (char === "-" && sql[i + 1] === "-") {

                    isAfterDashComment = true;
                    isWiped = true;
                }
                else if (char === "/" && sql[i + 1] === "*") {

                    isInsideMultilineComment = true;
                    multilineCommentStartIndex = i;
                    isWiped = true;
                }
                // A directive's text is free-form, so an apostrophe in it doesn't open a string.
                else if (!isOnDirectiveLine && char === "'") {

                    isInsideQuotes = true;
                }
                else if (!isOnDirectiveLine && char === "[") {

                    isInsideSq = true;
                }
            }
            else if (isDirective) {

                if (" \n\t".indexOf(char) !== -1) isDirective = false;
            }
            else if (isInsideMultilineComment) {

                // The closing "*/" can't share its asterisk with the opening "/*".
                if (char === "/" && sql[i - 1] === "*" && i - 1 > multilineCommentStartIndex + 1) {
                    isInsideMultilineComment = false;
                }
            }
            else if (isAfterDashComment) {

                if (char === "\n") {

                    isAfterDashComment = false;
                    isWiped = false;
                }
            }

            if (char === "\n") isOnDirectiveLine = false;

            result += isWiped ? " " : char;
        }

        return result;
    };

    /**
     * Replaces comments and strings with spaces and returns the result.  This is to make parsing
     * easier (see comment on wipeComments).
     */
    const wipeCommentsAndStrings = function (sql) {

        sql = wipeComments(sql);

        let result = "";

        let isInsideString = false;

        for (let i = 0; i < sql.length; i++) {

            if (sql[i] === "'") {

                isInsideString = !isInsideString;
                result += "'";
            }
            else {

                result += isInsideString ? " " : sql[i];
            }
        }

        return result;
    };

    /**
     * Iterates through the passed SQL query, incrementing and decrementing a counter on every
     * opening and closing bracket.  Returns the value of that counter.  Ignores brackets inside
     * strings, comments, and square brackets.
     */
    const getBracketCount = function (sql) {

        sql = wipeComments(sql);

        let lpp = createLinePositionProperties();

        for (let i = 0; i < sql.length; i++) {

            lpp = updateLinePositionProperties(lpp, sql[i]);
        }

        return lpp.bracketCount;
    };

    /**
     * If the passed SQL query has unclosed brackets, returns the text index of the last unclosed
     * bracket.  If the query does not have unclosed brackets, returns -1.
     */
    const getTextIndexOfLastUnclosedBracket = function (sql) {

        sql = wipeComments(sql);

        // Records where each depth was last opened.  The last unclosed bracket is the one that
        // last opened the final depth, as the depth never drops below that afterwards.
        let lpp = createLinePositionProperties();
        const openIndexByDepth = [];

        for (let i = 0; i < sql.length; i++) {

            const previousBracketCount = lpp.bracketCount;

            lpp = updateLinePositionProperties(lpp, sql[i]);

            if (lpp.bracketCount > previousBracketCount && lpp.bracketCount > 0) {
                openIndexByDepth[lpp.bracketCount] = i;
            }
        }

        return lpp.bracketCount > 0 ? openIndexByDepth[lpp.bracketCount] : -1;
    };

    /**
     * Returns the string with the specified leading string removed, if it is present.  Otherwise,
     * returns the string unaltered.
     */
    const removeLeading = (text, leadingStringToRemove) => {

        if (typeof text !== "string") return text;

        return text.indexOf(leadingStringToRemove) === 0
            ? text.substring(leadingStringToRemove.length)
            : text;
    };

    /**
     * Returns the string with the specified leading string added, if it is not already present.
     */
    const ensureLeading = (text, leadingString) => {

        return text.indexOf(leadingString) === 0 ? text : leadingString + text;
    };

    /**
     * Returns the string with a leading forward slash added, if it is not already present.
     */
    const ensureLeadingSlash = (text) => ensureLeading(text, "/");

    /**
     * Returns the string with the specified trailing string removed, if it is present.  Otherwise,
     * returns the string unaltered.
     */
    const removeTrailing = (text, trailingStringToRemove) => {

        return text.endsWith(trailingStringToRemove)
            ? text.substring(0, text.length - trailingStringToRemove.length)
            : text;
    };

    /**
     * Gets the substring of the SQL string starting from startIndex and stopping when reaching any
     * of the specified characters.
     */
    const getTextUpTo = function (sql, startIndex, charsToStopAt) {

        for (let i = startIndex; i < sql.length; i++) {

            if (charsToStopAt.indexOf(sql[i]) !== -1) {
                return sql.substring(startIndex, i);
            }
        }

        return sql.substring(startIndex);
    };

    /**
     * Gets the text index of the close bracket that matches the specified open bracket.
     */
    const findMatchingCloseBracketIndex = function (sql, openBracketTextIndex) {

        sql = wipeComments(sql);

        let lpp = createLinePositionProperties();

        for (let i = openBracketTextIndex; i < sql.length; i++) {

            lpp = updateLinePositionProperties(lpp, sql[i]);

            if (lpp.bracketCount === 0) {
                return i;
            }
        }

        return -1;
    };

    /* Creates an object like this:

        {
            insideQuotes: false,
            insideSq: false,
            bracketCount: 0
        }

        The object indicates whether a given point in a string falls inside single quotes, square
        brackets, or regular brackets (and to what depth).

        If `str` and `index` are passed, initialises the object for the specified position in the
        passed string.
    */
    const createLinePositionProperties = function (str, index) {

        index ??= 0;

        let lpp = {
            insideQuotes: false,
            insideSq: false,
            bracketCount: 0
        };

        for (let i = 0; i < index; i++) {
            lpp = updateLinePositionProperties(lpp, str[i]);
        }

        return lpp;
    };

    /**
     * Returns a linePositionProperties object, containing the properties at the specified line and
     * position.
     */
    const getLinePositionProperties = function (sql, lineIndex, pos) {

        let textIndex = 0;

        for (let i = 0; i < lineIndex && textIndex < sql.length; i++) {

            const newlineIndex = sql.indexOf("\n", textIndex);
            textIndex = newlineIndex === -1 ? sql.length : newlineIndex + 1;
        }

        return createLinePositionProperties(
            wipeComments(sql),
            Math.min(textIndex + (pos || 0), sql.length)
        );
    };

    /**
     * Returns a new linePositionProperties object, the result of a new character being encountered.
     */
    const updateLinePositionProperties = function (linePositionProperties, char) {

        let lpp = {
            insideQuotes: linePositionProperties.insideQuotes,
            insideSq: linePositionProperties.insideSq,
            bracketCount: linePositionProperties.bracketCount
        };

        if (!lpp.insideSq && char === "'") { lpp.insideQuotes = !lpp.insideQuotes; }

        if (!lpp.insideQuotes && char === "[") { lpp.insideSq = true; }

        if (lpp.insideSq && char === "]") { lpp.insideSq = false; }

        if (!lpp.insideQuotes && !lpp.insideSq && char === "(") { lpp.bracketCount++; }

        if (!lpp.insideQuotes && !lpp.insideSq && char === ")") { lpp.bracketCount--; }

        return lpp;
    };

    /**
     * Returns a new linePositionProperties object, the result of a new character being encountered,
     * but moving backwards through the text rather than forwards.
     */
    const updateLinePositionPropertiesBackwards = function (linePositionProperties, char) {

        let lpp = {
            insideQuotes: linePositionProperties.insideQuotes,
            insideSq: linePositionProperties.insideSq,
            bracketCount: linePositionProperties.bracketCount
        };

        if (!lpp.insideSq && char === "'") { lpp.insideQuotes = !lpp.insideQuotes; }

        // Moving backwards, a closing square bracket is reached before its opening one.
        if (!lpp.insideQuotes && char === "]") { lpp.insideSq = true; }

        if (lpp.insideSq && char === "[") { lpp.insideSq = false; }

        if (!lpp.insideQuotes && !lpp.insideSq && char === "(") { lpp.bracketCount--; }

        if (!lpp.insideQuotes && !lpp.insideSq && char === ")") { lpp.bracketCount++; }

        return lpp;
    };

    /**
     * Gets a value indicating whether the text is null, undefined, empty, or nothing but
     * whitespace (space, tab, newline, carriage return, form feed, vertical tab or a byte order
     * mark).  Scans rather than trimming, so that testing a large string doesn't allocate a copy.
     */
    const isNullOrWhitespace = (text) => {

        if (text === null || text === undefined) return true;

        const length = text.length;

        for (let i = 0; i < length; i++) {

            const charCode = text.charCodeAt(i);

            const isWhitespace = charCode === 32 ||
                (charCode >= 9 && charCode <= 13) ||
                charCode === 0xFEFF;

            if (!isWhitespace) return false;
        }

        return true;
    };

    /**
     * Gets the number of whitespace characters at the start of the string.
     */
    const countLeadingWhitespace = function (text) {

        let count = 0;

        for (let i = 0; i < text.length; i++) {

            if (/\s/.test(text[i])) {
                count++;
            }
            else {

                break;
            }
        }

        return count;
    };

    /**
     * Gets the number of whitespace characters at the end of the string.
     */
    const countTrailingWhitespace = function (text) {

        let count = 0;

        for (let i = text.length - 1; i >= 0; i--) {

            if (/\s/.test(text[i])) {
                count++;
            }
            else {

                break;
            }
        }

        return count;
    };

    const replaceSpaces = function (text, replacement) {

        return text.replace(/\s/g, replacement);
    };

    const replaceNonWordChars = function (text, replacement) {

        return text.replace(/[^\w]+/g, replacement);
    };

    /**
     * Cleans a string so that it is safe to use as a CSS class name.
     */
    const cleanForCssClassName = function (text) {

        if (!text) return "";
        // Replace any character not allowed in CSS class names with a hyphen.
        // Allowed: letters, digits, underscores, hyphens
        return text.replace(/[^a-zA-Z0-9_-]/g, "-");
    };

    const removeSpaces = function (text) {

        return replaceSpaces(text, "");
    };

    const removeAllExceptNumbersAndCommas = function (text) {

        if (!text) return null;

        return text.replace(/[^0-9,]/g, "");
    };

    const removeAllExceptDigits = function (text) {

        if (!text) return null;

        return text.replace(/[^0-9]/g, "");
    };

    /**
     * Keeps the digits, the first period and a leading minus sign.
     */
    const removeAllExceptDigitsDashesAndFirstPeriod = function (text) {

        if (text == null) return null;

        text = String(text).trim();
        if (!text) return null;

        const negative = text[0] === "-";
        const periodIndex = text.indexOf(".");

        const result = periodIndex === -1
            ? text.replace(/[^0-9]/g, "")
            : text.substring(0, periodIndex).replace(/[^0-9]/g, "") + "." +
                text.substring(periodIndex + 1).replace(/[^0-9]/g, "");

        return negative ? "-" + result : result;
    };

    const removeAllExceptLettersDigitsAndSpaces = (text) => {

        if (!text) return null;

        return text.replace(/[^a-zA-Z0-9 ]/g, "");
    };

    /**
     * Parses a string as an integer, returning null if it is not a valid number.  Anything after
     * the first period is ignored.
     */
    const parseInt = (text) => {

        if (typeof text === "number") return Math.trunc(text);

        text = removeAllExceptDigitsDashesAndFirstPeriod(text);

        const parsed = text ? window.parseInt(text) : NaN;

        return isNaN(parsed) ? null : parsed;
    };

    /**
     * Parses a string as a float, returning null if it is not a valid number.  Removes all
     * characters except digits, dashes, and the first period before parsing.
     */
    const parseFloat = (text) => {

        if (text == null || text === "") return null;

        if (typeof text === "number") return text; // Already a number.

        text = removeAllExceptDigitsDashesAndFirstPeriod(text);

        const parsed = text ? window.parseFloat(text) : NaN;

        return isNaN(parsed) ? null : parsed;
    };

    /**
     * Gets a value indicating whether the value is a number or a string that can be parsed as a
     * number.
     */
    const isNumeric = (value) => {

        const parsed = parseFloat(value);

        return parsed !== null && !isNaN(parsed);
    };

    const removeNonFilenameChars = function (filename) {

        return filename.replace(/[/\\?%*:|"<>]/g, '-');
    };

    /**
     * Separates the sort key of a sortable value from the text it displays as.
     */
    const SORT_PREFIX_SEPARATOR = "¬";

    /**
     * The display half of a sortable value, written as "<sort key>¬<display text>" by a calc
     * function whose results have to order a certain way.  A value that carries no sort key, and
     * anything that is not a string, is returned as it stands.
     */
    const stripSortPrefix = function (value) {

        if (typeof value !== "string") return value;

        const separatorIndex = value.indexOf(SORT_PREFIX_SEPARATOR);

        return separatorIndex === -1 ? value : value.substring(separatorIndex + 1);
    };

    /**
     * The sort key half of a sortable value (see stripSortPrefix).  A value that carries no sort
     * key, and anything that is not a string, is returned as it stands.
     */
    const getSortKey = function (value) {

        if (typeof value !== "string") return value;

        const separatorIndex = value.indexOf(SORT_PREFIX_SEPARATOR);

        return separatorIndex === -1 ? value : value.substring(0, separatorIndex);
    };

    /**
     * Replaces all instances of a string within another string.  (The built-in replace function
     * only replaces the first instance, and regex replacement can be tricky when there are
     * symbols in the text to replace.)
     */
    const replace = function (text, textToReplace, replacementText) {

        return text.split(textToReplace).join(replacementText);
    };

    /**
     * Inserts a symbol before each capital letter in the string, except for the first letter and
     * upper case words or acronyms.
     */
    const addSpacesBeforeCapitals = (str) => {

        const isCharacterThatRequiresASpaceBeforeIt = (index) => {

            if (!str[index] || str[index] === " ") return false;

            if (str[index] === ")") return false; // Don't add space before closing brackets.
            return str[index] === str[index].toUpperCase();
        };

        const isLowerCase = (index) => {

            if (!str[index] || str[index] === " ") return false;
            return str[index] >= "a" && str[index] <= "z";
        };

        let result = "";

        for (let i = 0; i < str.length; i++) {

            if (i > 0) {

                if (isLowerCase(i - 1) && isCharacterThatRequiresASpaceBeforeIt(i)) {
                    result += " ";
                }
            }

            result += str[i];
        }

        return result;
    };

    /**
     * Splits the SQL string on every GO keyword.
     */
    const splitIntoBatches = function (sql) {

        // Wiping comments (which keeps positions) stops a GO in a comment splitting the batch.
        const wipedSql = wipeComments(sql);

        const batches = [];

        let lpp = createLinePositionProperties();
        let batchStartIndex = 0;

        for (let i = 0; i < wipedSql.length; i++) {

            if (wipedSql[i] === "G" && wipedSql[i + 1] === "O" &&
                lpp.bracketCount === 0 && !lpp.insideQuotes && !lpp.insideSq &&
                (i === 0 || !isLetterOrDigit(wipedSql[i - 1])) &&
                (i + 2 === wipedSql.length || !isLetterOrDigit(wipedSql[i + 2]))) {

                batches.push(sql.substring(batchStartIndex, i).trim());
                batchStartIndex = i + 2;
            }

            lpp = updateLinePositionProperties(lpp, wipedSql[i]);
        }

        const lastBatch = sql.substring(batchStartIndex);

        // Text following the last GO is a batch, even if empty, but an empty script has none.
        if (lastBatch || batchStartIndex > 0) batches.push(lastBatch.trim());

        return batches;
    };

    const measureTextFontSize = 12;

    // Width of each ASCII character, in pixels.
    const widths = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1556640625, 0.3, 0.4, 0.7, 0.6, 0.9, 0.7, 0.2, 0.4, 0.4, 0.4, 0.6, 0.3, 0.4, 0.3, 0.5, 0.6, 0.55625, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.3, 0.3, 0.6, 0.6, 0.6, 0.6, 1.1, 0.8, 0.7, 0.8, 0.7234375, 0.7, 0.6109375, 0.8, 0.7234375, 0.3, 0.5, 0.8, 0.6, 0.834375, 0.7234375, 0.8, 0.7, 0.8, 0.8, 0.7, 0.8, 0.7234375, 0.8, 1.1, 0.8, 0.8, 0.8, 0.3, 0.5, 0.3, 0.6, 0.7, 0.334375, 0.6, 0.6, 0.6, 0.6, 0.6, 0.5, 0.6, 0.6, 0.2234375, 0.3234375, 0.6, 0.2234375, 0.834375, 0.6, 0.6, 0.6, 0.6, 0.4, 0.5, 0.4, 0.6, 0.7, 0.9, 0.7, 0.7, 0.6, 0.5, 0.2609375, 0.5, 0.6];
    const avg = 0.588957648026316 * measureTextFontSize; // Used for characters outside of the array
                                                         // above.

    for (let i = 0; i < widths.length; i++) {
        widths[i] = widths[i] * measureTextFontSize; // Font size
    }

    /**
     * Measures the width of a string in pixels.
     * See https://blocks.roadtolarissa.com/tophtucker/62f93a4658387bb61e4510c37e2e97cf
     */
    const measureText = function (str) {

        if (!str) return 0;

        if (str.startsWith("<")) {
            str = extractTextFromHtml(str);
        }

        let totalWidth = 0;
        let charCode;

        for (let i = 0; i < str.length; i++) {

            charCode = str.charCodeAt(i);

            if (charCode < widths.length) {
                totalWidth += widths[charCode];
            }
            else {

                totalWidth += avg;
            }
        }

        return totalWidth;
    };

    const div = document.createElement("div");

    // A "<" that doesn't start a tag (as in "< 3") is text, as the browser reads it.
    const htmlhasTextRegex = /(^|>)(?:[^<]|<(?![a-z!/?]))*?(?:[^<\s]|<(?![a-z!/?]))/i;

    const extractedTextCache = new Map();

    const extractTextFromHtml = (input) => {

        // Simple short-circuit if the string doesn't contain any text outside of its tags.

        if (!htmlhasTextRegex.test(input)) return "";

        let text = extractedTextCache.get(input);
        if (text !== undefined) return text;

        div.innerHTML = input;
        text = div.textContent || "";

        if (extractedTextCache.size >= 10000) extractedTextCache.clear();
        extractedTextCache.set(input, text);
        return text;
    };

    const htmlEncode = (input) => {

        div.textContent = input;
        return div.innerHTML;
    };

    const isLetterOrDigit = (char) => char.match(/[a-z0-9_]/i);

    const ordinalSuffixes = ['th', 'st', 'nd', 'rd'];

    /**
     * Converts an integer to "1st", "2nd", "3rd", etc.
     */
    const ordinate = (number) => {

        const value = number % 100;

        return number +
            (ordinalSuffixes[(value - 20) % 10] || ordinalSuffixes[value] || ordinalSuffixes[0]);
    };

    const convertNullOrUndefinedToStyledNotSet = (value) => value == null ? "<span class='ren-not-set'>Not set</span>" : value;
    const convertNullOrUndefinedToNotSet = (value) => value == null ? "Not set" : value;
    const convertNullOrUndefinedToEmpty = (value) => value == null ? "" : value;

    const getEverythingUpToFirst = (text, substring) => {

        const index = text.indexOf(substring);
        return index === -1 ? text : text.substring(0, index);
    };

    const getEverythingAfterFirst = (text, substring) => {

        const index = text.indexOf(substring);
        return index === -1 ? "" : text.substring(index + substring.length);
    };

    const getEverythingUpToLast = (text, substring) => {

        const index = text.lastIndexOf(substring);
        return index === -1 ? text : text.substring(0, index);
    };

    const getEverythingAfterLast = (text, substring) => {

        const index = text.lastIndexOf(substring);
        return index === -1 ? "" : text.substring(index + substring.length);
    };

    const parseIntegerCSV = (csv) => {

        csv = removeAllExceptNumbersAndCommas(csv);

        if (!csv) return null;

        return csv.split(",").map(e => parseInt(e));
    };

    const isStringNumeric = (str) => {

        // Number() reads a blank string as 0.
        if (typeof str === "string" && isNullOrWhitespace(str)) return false;

        return Number.isFinite(Number(str));
    };

    const convertToPascalCase = (text) => {

        if (!text) return text;

        const result = convertToCamelCase(text);

        return result[0].toUpperCase() + result.substring(1);
    };

    const convertToCamelCase = (text) => {

        if (!text) return text;

        let result = text;

        if (result.indexOf("-") !== -1) {
            result = convertKebabCaseToCamelCase(result);
        }

        if (result.indexOf("_") !== -1) {
            result = convertSnakeCaseToCamelCase(result);
        }

        result = result[0].toLowerCase() + result.substring(1);

        return result;
    };

    const convertSeparatedCaseToCamelCase = (text, separator) => {

        if (!text) return text;

        let result = text;
        let index;

        while ((index = result.indexOf(separator)) !== -1) {

            // A trailing separator has no character after it to capitalise.
            const nextChar = index + 1 < result.length ? result[index + 1].toUpperCase() : "";
            result = result.substring(0, index) + nextChar + result.substring(index + 2);
        }

        return result;
    };

    const convertKebabCaseToCamelCase = (kebabCase) => convertSeparatedCaseToCamelCase(kebabCase, "-");

    const convertSnakeCaseToCamelCase = (snakeCase) => convertSeparatedCaseToCamelCase(snakeCase, "_");

    const convertToKebabCase = (text) => {

        let result = text;
        result = result.replace(/([a-z])([A-Z])/g, "$1-$2");
        result = result.toLowerCase();
        result = result.replace(/\s+/g, "-");
        return result;
    };

    const removeNewlines = (text) => {

        if (!text) return text;
        return text.replace(/\r?\n|\r/g, "");
    };

    const replaceNewlinesWithBRs = (text) => {

        if (!text) return text;
        return text.replace(/\r?\n|\r/g, "<br />");
    };

    const upTo2DecimalsWithCommasFormat = new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 2,
        signDisplay: "negative"
    });

    /**
     * Formats a number to at most two decimal places with a comma every thousand, as "1,234.5".
     */
    const formatUpTo2DecimalsWithCommas = (num) => {

        return upTo2DecimalsWithCommasFormat.format(num);
    };

    const getTextBeforeDoubleUnderscore = (text) => {

        const doubleUnderscoreIndex = text.indexOf("__");
        return doubleUnderscoreIndex === -1 ? text : text.substring(0, doubleUnderscoreIndex);
    };

    const getTextAfterDoubleUnderscore = (text) => {

        const doubleUnderscoreIndex = text.indexOf("__");
        return doubleUnderscoreIndex === -1 ? "" : text.substring(doubleUnderscoreIndex + 2);
    };

    const isTrue = (value) => {

        // Use standard truthy logic for booleans and numbers.
        if (typeof value === "boolean" || typeof value === "number") return value;

        // A column the format function names may not be among the values it is handed, and a value
        // that isn't there isn't true.
        if (value === null || value === undefined) return false;

        value = value.trim().toLowerCase();
        return value === "true" || value === "1" || value === "yes" || value === "y";
    };

    /**
     * Generates a hash from the text, which is useful for caching purposes.
     */
    const hash = (text_or_object) => {

        if (!text_or_object) return null;

        const text = typeof text_or_object === "string" ? text_or_object : JSON.stringify(text_or_object);

        let hash = 0;

        for (let i = 0; i < text.length; i++) {

            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }

        return hash;
    };

    const convertStringToBoolean = (value, defaultValue) => {

        if (typeof value === "boolean") return value;

        if (value == null) return defaultValue === undefined ? false : defaultValue;

        if (typeof value === "string") {

            value = value.trim().toLowerCase();

            if (value === "true") return true;
            if (value === "false" || value === "0" || value === "no" || value === "n") return false;
            if (value === "null") return null;
        }

        return !!value;
    };

    return {
        addSpacesBeforeCapitals,
        cleanForCssClassName,
        convertKebabCaseToCamelCase,
        convertNullOrUndefinedToEmpty,
        convertNullOrUndefinedToNotSet,
        convertNullOrUndefinedToStyledNotSet,
        convertSnakeCaseToCamelCase,
        convertStringToBoolean,
        convertToCamelCase,
        convertToKebabCase,
        convertToPascalCase,
        countLeadingWhitespace,
        countTrailingWhitespace,
        createLinePositionProperties,
        createRegex,
        ensureLeading,
        ensureLeadingSlash,
        extractTextFromHtml,
        findMatchingCloseBracketIndex,
        formatUpTo2DecimalsWithCommas,
        getBracketCount,
        getEverythingAfterFirst,
        getEverythingAfterLast,
        getEverythingUpToFirst,
        getEverythingUpToLast,
        getLinePositionProperties,
        getSortKey,
        getTextAfterDoubleUnderscore,
        getTextBeforeDoubleUnderscore,
        getTextIndexOfLastUnclosedBracket,
        getTextUpTo,
        hash,
        htmlEncode,
        isNumeric,
        isLetterOrDigit,
        isNullOrWhitespace,
        isStringNumeric,
        isTrue,
        makeFirstCharLowerCase,
        makeFirstCharUpperCase,
        measureText,
        ordinate,
        parseFloat,
        parseInt,
        parseIntegerCSV,
        removeAllExceptDigits,
        removeAllExceptDigitsDashesAndFirstPeriod,
        removeAllExceptLettersDigitsAndSpaces,
        removeAllExceptNumbersAndCommas,
        removeLeading,
        removeNewlines,
        removeNonFilenameChars,
        removeSpaces,
        removeTrailing,
        replace,
        replaceNewlinesWithBRs,
        replaceNonWordChars,
        replaceSpaces,
        splitIntoBatches,
        stripSortPrefix,
        updateLinePositionProperties,
        updateLinePositionPropertiesBackwards,
        wipeComments,
        wipeCommentsAndStrings,
        wipeSchemaAndDbNamePrefixes
    };
})();
