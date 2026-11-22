/**
 * Converts HTML cell values into text.
 */
Ren.DataGridCellSelection_CellValueTextualiser = (() => {

    const hyperlinkRegex = /<a href="([^"]+)".*?>.+<\/a>/;
    const newlineRegex = /\r?\n/g;

    const textualise = (cellValue, options) => {

        // A format function can return a number, or anything else.
        if (typeof cellValue !== "string") {
            cellValue = cellValue == null ? "" : cellValue.toString();
        }

        if (options?.escapeNewlines) {
            cellValue = cellValue.replace(newlineRegex, "\\n");
        }
        else {

            cellValue = cellValue.replace(newlineRegex, " ");
        }

        if (!cellValue) return cellValue;

        if (typeof Ren.IndexedStringUtils !== 'undefined' && Ren.IndexedStringUtils.isIndexedString(cellValue)) {

            cellValue = Ren.IndexedStringUtils.getText(cellValue);
        }
        else if (typeof cellValue === "string" && cellValue.includes("¬")) {

            const sepIndex = cellValue.indexOf("¬");
            cellValue = cellValue.substring(sepIndex + 1);
        }

        if (!cellValue.includes("<")) return cellValue; // Not HTML

        const hyperlinkMatch = cellValue.match(hyperlinkRegex);

        if (hyperlinkMatch) return hyperlinkMatch[1]; // return the hyperlink URL

        return Ren.TextUtils.extractTextFromHtml(cellValue);
    };

    return {
        textualise
    };
})();
