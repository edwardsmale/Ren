/**
 * Shows NULL values as "None".
 *
 * TAGS: format
 *
 * @returns {string} "None" for NULL values, original value otherwise.
 */
if (Ren.IsNull(value)) return "None";
return value;
