/**
 * Colours the text of positive values one colour and negative values another, leaving zero and
 * blank values as they are.
 *
 * TAGS: style
 *
 * @param {colour} [positiveColour=#1a7f37] - The colour of positive values, or blank to leave them
 *     as they are.
 * @param {colour} [negativeColour=#c62828] - The colour of negative values, or blank to leave them
 *     as they are.
 * @param {boolean} [bold=false] - Whether coloured values are bold too.
 */
const number = Ren.TextUtils.parseFloat(value);

if (!number) return null;

const colour = number > 0 ? "$positiveColour" : "$negativeColour";

if (!Ren.Colours.toRgb(colour)) return null;

return {
    "color": colour,
    "font-weight": Ren.TextUtils.isTrue("$bold") ? "bold" : null
};
