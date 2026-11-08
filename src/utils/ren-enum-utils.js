/**
 * Functions for working with enums.
 */
Ren.EnumUtils = (() => {

    /**
     * Parses a string to get the corresponding enum value.  Returns null if the string does not
     * match any enum key.
     *
     * @param {object} enumType - The enum type to parse against.
     * @param {string} str - The string to parse.
     * @param {any} defaultValue - The value to return if the string does not match any enum key.
     */
    const parseEnumString = (enumType, str, defaultValue) => {

        return Object.prototype.hasOwnProperty.call(enumType, str) ? enumType[str] : defaultValue;
    };

    return {
        parseEnumString
    };
})();
