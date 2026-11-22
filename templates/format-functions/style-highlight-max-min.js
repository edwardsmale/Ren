/**
 * Highlights the largest and smallest values in the cell's group, or in the whole grid.
 *
 * TAGS: style
 *
 * @param {colour} [maxColour=#c8e6c9] - The background colour of the largest value, or blank not
 *     to highlight it.
 * @param {colour} [minColour=#ffcdd2] - The background colour of the smallest value, or blank not
 *     to highlight it.
 * @param {boolean} [bold=true] - Whether highlighted values are bold.
 * @param {boolean} [wholeGrid=false] - Whether the largest and smallest values are the whole
 *     grid's rather than the group's, so that only those are highlighted, at whichever level.
 */
const wholeGrid = Ren.TextUtils.isTrue("$wholeGrid");
const number = Ren.TextUtils.parseFloat(value);
const min = Ren.TextUtils.parseFloat(wholeGrid ? overallSummaryStats.min : groupSummaryStats.min);
const max = Ren.TextUtils.parseFloat(wholeGrid ? overallSummaryStats.max : groupSummaryStats.max);

// A group whose values are all the same has no largest or smallest to pick out.
if (number === null || min === null || max === null || min === max) return null;

const colour = number === max ? "$maxColour" : number === min ? "$minColour" : null;

if (!colour || !Ren.Colours.toRgb(colour)) return null;

return {
    "background-color": colour,
    "font-weight": Ren.TextUtils.isTrue("$bold") ? "bold" : null
};
