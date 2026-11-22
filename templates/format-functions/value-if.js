/**
 * Returns the given text if the value is truthy, otherwise returns an empty string.
 *
 * TAGS: format
 *
 * @param {string} value - The text to return where the value is truthy.
 * @returns {string} The value or an empty string.
 */
if (Ren.TextUtils.convertStringToBoolean(value)) {
    return "$value";
}
else {
    return "";
}