/**
 * Shows NULL values as "0".
 *
 * TAGS: format
 *
 * @returns {string} "0" for NULL values, original value otherwise.
 */
if (Ren.IsNull(value)) return "0";
return value;
