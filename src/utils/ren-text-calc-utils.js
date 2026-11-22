/**
 * Functions for counting characters in text.  In particular, converting a text index (overall
 * position in a string) to the corresponding line number and character position, and vice versa.
 */
Ren.TextCalcUtils = (() => {

    /**
     * Converts a text index into a line number and character position.
     */
    const getLineNumberAndPosition = function (text, textIndex) {

        let x = textIndex;

        // Subtract the total characters of earlier lines in the text area.
        const earlierLines = text.substring(0, textIndex).split("\n");

        for (let i = 0; i < earlierLines.length - 1; i++) {
            x -= earlierLines[i].length + 1;
        }

        const y = earlierLines.length - 1;

        return {
            position: x,
            lineNumber: y
        };
    };

    /**
     * Converts a line number and character position into a text index.
     */
    const getTextIndex = function (text, lineNumber, position) {

        let i = 0;

        while (i < text.length && lineNumber > 0) {

            if (text[i] === "\n") { lineNumber--; }

            i++;
        }

        while (i < text.length && position > 0) {

            if (text[i] === "\n") { break; }

            position--;
            i++;
        }

        return i;
    };

    /**
     *  Gets the text index of the start of the line specified by the passed text index.
     */
    const getStartOfLineTextIndex = function (text, textIndex) {

        const lineNumber = getLineNumberAndPosition(text, textIndex).lineNumber;
        return getTextIndex(text, lineNumber, 0);
    };

    /**
     * Gets the text index of the end of the line specified by the passed text index.
     */
    const getEndOfLineTextIndex = function (text, textIndex) {

        for (let i = textIndex; i < text.length; i++) {

            if (text[i] === "\n") return i;
        }
        return text.length;
    };

    /**
     * Gets the number of spaces at the start of the specified line.
     */
    const getLineIndent = function (text, textIndex) {

        const startOfLine = getStartOfLineTextIndex(text, textIndex);

        for (let i = startOfLine; i < text.length; i++) {

            if (text[i] !== " ") return i - startOfLine;
        }
        return 0;
    };

    return {
        getLineNumberAndPosition,
        getTextIndex,
        getStartOfLineTextIndex,
        getEndOfLineTextIndex,
        getLineIndent
    };
});
