/**
 * Highlights values that compare with a threshold as specified, e.g. those over 100.  As a row
 * style, highlights the whole row by this column's value.
 *
 * TAGS: style
 *
 * @param {string} [operator=>] - How the value is compared with the threshold: >, >=, <, <=, = or
 *     !=.
 * @param {number} [threshold=0] - The number the value is compared with.
 * @param {colour} [backgroundColour=#fff3b0] - The background colour of highlighted values, or
 *     blank to leave it as it is.
 * @param {colour} [textColour=""] - The text colour of highlighted values, or blank to leave it as
 *     it is.
 * @param {boolean} [bold=false] - Whether highlighted values are bold.
 */
const number = Ren.TextUtils.parseFloat(value);
const threshold = Ren.TextUtils.parseFloat("$threshold");

if (number === null || threshold === null) return null;

const isHighlighted = (() => {

    switch ("$operator".trim()) {

        case ">": return number > threshold;
        case ">=": return number >= threshold;
        case "<": return number < threshold;
        case "<=": return number <= threshold;
        case "=":
        case "==": return number === threshold;
        case "!=":
        case "<>": return number !== threshold;
        default: return false;
    }
})();

if (!isHighlighted) return null;

return {
    "background-color": Ren.Colours.toRgb("$backgroundColour") ? "$backgroundColour" : null,
    "color": Ren.Colours.toRgb("$textColour") ? "$textColour" : null,
    "font-weight": Ren.TextUtils.isTrue("$bold") ? "bold" : null
};
