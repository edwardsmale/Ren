/**
 * Functions to get strings for sort directions (depending on the column format).
 */
Ren.SortDirectionStringsProvider = (() => {

    /**
     * Gets the sort direction strings for the given column index (depending on the format of the
     * column in the tabular data).
     */
    const getSortDirectionStrings = (valueFormat) => {

        if (valueFormat === Ren.SpreadsheetColumnFormatEnum.General) {

            return ["ascending", "descending"];
        }
        else if (valueFormat === Ren.SpreadsheetColumnFormatEnum.Date || valueFormat === Ren.SpreadsheetColumnFormatEnum.DateTime) {

            return ["oldest to newest", "newest to oldest"];
        }
        else if (valueFormat === Ren.SpreadsheetColumnFormatEnum.IndexedString) {

            return ["low to high", "high to low"];
        }
        else {

            return ["low to high", "high to low"];
        }
    };

    return {
        getSortDirectionStrings
    };
})();
