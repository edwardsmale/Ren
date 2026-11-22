/**
 * Shows NULL values as "N/A".
 *
 * TAGS: format
 *
 * @returns {string} "N/A" for NULL values, original value otherwise.
 */
if (Ren.IsNull(value)) return "N/A";
return value;
