/**
 * Splits the input string by the pipe character and returns the last segment.
 *
 * TAGS: format, calculation
 *
 * @returns {string} The value after the last pipe.
 */

const val = value;
if (!val) return '';
if (!val.includes("|")) return val;
const split = val.split("|");
return split[split.length - 1];
