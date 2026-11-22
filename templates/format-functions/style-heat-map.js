/**
 * Colours the cell from the low colour for its group's smallest value to the high colour for its
 * largest, through the middle colour for the middle of the range.  The text is dark or white,
 * whichever the background shows up better.
 *
 * TAGS: style
 *
 * @param {colour} [lowColour=#2166ac] - The colour of the smallest value.
 * @param {colour} [midColour=#f7f7f7] - The colour of the middle of the range, or blank to go
 *     straight from the low colour to the high one.
 * @param {colour} [highColour=#b2182b] - The colour of the largest value.
 * @param {number 0..45 step 1} [padding=0] - How far in from each end of the colour scale the
 *     smallest and largest values are coloured, in percent, for gentler colours at the extremes.
 * @param {boolean} [wholeGrid=false] - Whether the range is the whole grid's rather than the
 *     group's, so that every row, at every grouping level, is coloured on the same scale.
 */
const wholeGrid = Ren.TextUtils.isTrue("$wholeGrid");
const number = Ren.TextUtils.parseFloat(value);
const min = Ren.TextUtils.parseFloat(wholeGrid ? overallSummaryStats.min : groupSummaryStats.min);
const max = Ren.TextUtils.parseFloat(wholeGrid ? overallSummaryStats.max : groupSummaryStats.max);

if (number === null || min === null || max === null) return null;

const low = Ren.Colours.toRgb("$lowColour");
const middle = Ren.Colours.toRgb("$midColour");
const high = Ren.Colours.toRgb("$highColour");

if (!low || !high) return null;

const stops = middle ? [low, middle, high] : [low, high];
const padding = Math.min(Math.max(Ren.TextUtils.parseFloat("$padding") || 0, 0), 45) / 100;
const range = max > min ? Math.min(Math.max((number - min) / (max - min), 0), 1) : 0.5;
const heat = padding + range * (1 - padding * 2);
const position = heat * (stops.length - 1);
const stopIndex = Math.min(Math.floor(position), stops.length - 2);
const fraction = position - stopIndex;

const mix = (component) => {

    const from = stops[stopIndex][component];

    return Math.round(from + (stops[stopIndex + 1][component] - from) * fraction);
};

const rgb = [mix("red"), mix("green"), mix("blue")];
const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;

return {
    "background-color": "rgb(" + rgb.join(",") + ")",
    "color": brightness > 150 ? "#222" : "White"
};
