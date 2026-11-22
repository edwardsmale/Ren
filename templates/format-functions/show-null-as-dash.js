/**
 * Shows NULL values as "-".
 *
 * TAGS: format
 *
 * @returns {string} "-" for NULL values, original value otherwise.
 */
if (Ren.IsNull(value)) return "-";
return value;
