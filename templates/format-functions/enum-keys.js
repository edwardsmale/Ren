/**
 * Replaces a value with its label from the given map, leaving one the map doesn't name alone.
 *
 * TAGS: format, calculation
 *
 * @param {object} values - The labels, as a JSON object keyed by value, e.g. {"1": "Yes"}.
 */
const map = Ren.FormatFunctionUtils.parseObjectParameter("$values");
if (value === null || value === undefined) return null;
return map[String(value)] ?? String(value);
