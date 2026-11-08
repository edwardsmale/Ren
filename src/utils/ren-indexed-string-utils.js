/**
 * Utilities for working with IndexedString values (format: "index¬text").
 */
Ren.IndexedStringUtils = (() => {

    const SEPARATOR = "¬";

    /**
     * Returns true if the value appears to be an indexed string (contains ¬).
     *
     * For example, "1¬Low", "2¬Medium", "3¬High" are indexed strings; the number before the
     * separator is the index used for sorting and the text after is the display text.  Only the
     * value after the separator is displayed; the numeric value before the separator is used for
     * sorting.
     */
    const isIndexedString = (value) => {

        return typeof value === "string" && value.includes(SEPARATOR);
    };

    /**
     * Extracts the numeric index from an indexed string.
     */
    const getIndex = (value) => {

        if (!value || typeof value !== "string") return null;
        const sepIndex = value.indexOf(SEPARATOR);
        if (sepIndex === -1) return null;
        const indexPart = value.substring(0, sepIndex);
        const parsed = parseFloat(indexPart);
        return isNaN(parsed) ? null : parsed;
    };

    /**
     * Extracts the text part from an indexed string.
     */
    const getText = (value) => {

        if (!value || typeof value !== "string") return value;
        const sepIndex = value.indexOf(SEPARATOR);
        if (sepIndex === -1) return value;
        return value.substring(sepIndex + 1);
    };

    /**
     * Extracts the index if it's an indexed string, otherwise returns the value.
     */
    const getSortableValue = (value) => {

        const index = getIndex(value);
        return index !== null ? index : value;
    };

    return {
        isIndexedString,
        getIndex,
        getText,
        getSortableValue,
        SEPARATOR
    };
})();
