/**
 * Greys out zero and blank values, so that the values that matter stand out.
 *
 * TAGS: style
 *
 * @param {colour} [colour=#bbbbbb] - The colour of zero and blank values.
 * @param {boolean} [includeBlanks=true] - Whether blank values are greyed out as well as zeros.
 */
const isBlank = value == null || String(value).trim() === "";

if (isBlank && !Ren.TextUtils.isTrue("$includeBlanks")) return null;

if (!isBlank && Ren.TextUtils.parseFloat(value) !== 0) return null;

return { "color": "$colour" };
