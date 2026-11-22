/**
 * Colours the text of values above their group's average one colour and those below it another.
 *
 * TAGS: style
 *
 * @param {colour} [aboveColour=#1a7f37] - The colour of values above the average, or blank to
 *     leave them as they are.
 * @param {colour} [belowColour=#c62828] - The colour of values below the average, or blank to
 *     leave them as they are.
 * @param {number 0..100 step 1} [tolerance=0] - How far either side of the average values are left
 *     as they are, in percent of the average.
 * @param {boolean} [wholeGrid=false] - Whether the average is the whole grid's rather than the
 *     group's, so that every row, at every grouping level, is compared with the same one.
 */
const wholeGrid = Ren.TextUtils.isTrue("$wholeGrid");
const number = Ren.TextUtils.parseFloat(value);
const average = Ren.TextUtils.parseFloat(
    wholeGrid ? overallSummaryStats.average : groupSummaryStats.average
);

if (number === null || average === null) return null;

const tolerance = Math.abs(average) * (Ren.TextUtils.parseFloat("$tolerance") || 0) / 100;

const colour = number > average + tolerance
    ? "$aboveColour"
    : number < average - tolerance ? "$belowColour" : null;

if (!colour || !Ren.Colours.toRgb(colour)) return null;

return { "color": colour };
