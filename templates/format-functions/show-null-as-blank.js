/**
 * Shows NULL values as blank.
 *
 * TAGS: format
 *
 * @returns {string} An empty string for NULL values, original value otherwise.
 */
if (Ren.IsNull(value)) return "";
return value;
