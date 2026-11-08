/**
 * Gives each distinct value its own pale background colour, the same wherever it appears, so that
 * values such as statuses or types can be picked out at a glance.
 *
 * TAGS: style
 *
 * @param {number 0..100 step 5} [saturation=65] - How strong the colours are, in percent.
 * @param {number 50..97 step 1} [lightness=87] - How light the colours are, in percent.
 */
if (value == null || String(value).trim() === "") return null;

const text = String(value).trim().toLowerCase();
let hash = 0;

for (let index = 0; index < text.length; index++) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
}

// One of 24 hues, stepped around the colour wheel by the golden angle so that neighbouring
// hashes get far apart colours.
const hue = Math.round(((hash >>> 0) % 24) * 137.508) % 360;
const saturation = Math.min(Math.max(Ren.TextUtils.parseFloat("$saturation") ?? 65, 0), 100);
const lightness = Math.min(Math.max(Ren.TextUtils.parseFloat("$lightness") ?? 87, 50), 97);

return {
    "background-color": "hsl(" + hue + "," + saturation + "%," + lightness + "%)",
    "color": lightness < 65 ? "White" : null
};
