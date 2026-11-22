/**
 * Formats a value based on whether it is greater than or equal to a specified comparison value.
 *
 * TAGS: format
 *
 * @param {number} compareTo - The value to compare against.
 * @param {string} [trueValue="≥ $compareTo"] - The string to return if the value is greater than or equal to compareTo.
 * @param {string} [falseValue="< $compareTo"] - The string to return if the value is less than compareTo.
 */

return @value >= Ren.TextUtils.parseFloat("$compareTo") ? "$trueValue" : "$falseValue";
