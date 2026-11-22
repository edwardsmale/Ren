/**
 * Sorts values into the order the given map lists them in, putting anything it doesn't name
 * last.
 *
 * TAGS: calculation, sort
 *
 * @param {object} enumOrder - Each value's place in the order, as a JSON object keyed by value,
 *     e.g. {"Low": 0, "Medium": 1, "High": 2}.
 */
const enumOrder = $enumOrder;
return enumOrder[value] ?? 999999;
