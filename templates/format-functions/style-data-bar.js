/**
 * Draws a bar in the cell's background, as long against the cell as its value is against its
 * group's largest, so that values can be compared at a glance.  Negative values are drawn leftwards
 * from zero, in their own colour.
 *
 * TAGS: style
 *
 * @param {colour} [colour=#9ec5ea] - The colour of the bars.
 * @param {colour} [negativeColour=#f2a7a7] - The colour of the bars of negative values, or blank
 *     to draw them in the same colour as the others.
 * @param {boolean} [fromZero=true] - Whether the bars start from zero, rather than from the
 *     group's smallest value, which then has no bar.  Starting from the smallest value tells
 *     values close together apart better.
 * @param {number 10..100 step 5} [height=100] - The height of the bars, in percent of the cell's.
 * @param {number 10..100 step 5} [fill=100] - How much of the cell's width the bar of the group's
 *     largest value fills, in percent, e.g. to leave room for the text beside the longest bars.
 * @param {boolean} [wholeGrid=false] - Whether the bars are scaled to the whole grid's values
 *     rather than the group's, so that every row, at every grouping level, is on the same scale.
 */
const wholeGrid = Ren.TextUtils.isTrue("$wholeGrid");
const number = Ren.TextUtils.parseFloat(value);
const min = Ren.TextUtils.parseFloat(wholeGrid ? overallSummaryStats.min : groupSummaryStats.min);
const max = Ren.TextUtils.parseFloat(wholeGrid ? overallSummaryStats.max : groupSummaryStats.max);

if (number === null || min === null || max === null) return null;

const fromZero = Ren.TextUtils.isTrue("$fromZero");
const lower = fromZero ? Math.min(min, 0) : min;
const upper = fromZero ? Math.max(max, 0) : max;

if (upper <= lower) return null;

const fill = Math.min(Math.max(Ren.TextUtils.parseFloat("$fill") || 100, 10), 100);

// Rounded to whole percents, so that cells share a handful of rules.
const toPosition = (amount) =>
    Math.round(Math.min(Math.max((amount - lower) / (upper - lower), 0), 1) * fill);

const zero = fromZero ? toPosition(0) : 0;
const end = toPosition(number);

if (end === zero) return null;

const colour = end < zero && Ren.Colours.toRgb("$negativeColour") ? "$negativeColour" : "$colour";

if (!Ren.Colours.toRgb(colour)) return null;

const start = Math.min(zero, end) + "%";
const stop = Math.max(zero, end) + "%";
const height = Math.min(Math.max(Ren.TextUtils.parseFloat("$height") || 100, 10), 100);

return {
    "background-image": "linear-gradient(to right, transparent " + start + ", "
        + colour + " " + start + ", " + colour + " " + stop + ", transparent " + stop + ")",
    "background-size": "100% " + height + "%",
    "background-position": "center",
    "background-repeat": "no-repeat"
};
