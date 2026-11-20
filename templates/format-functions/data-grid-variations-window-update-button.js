/**
    Outputs an update button for the row in the variations window.

    TAGS: format, html, report-specific
*/

// The row's values are read off rowVals directly rather than through at-expressions, so that they
// can be escaped: a variation's name is whatever was typed for it, quotes and all.
const attribute = Ren.HtmlUtils.escapeAttribute;
const jsString = value => JSON.stringify(String(value));

const variationName = rowVals["Variation Name"];
const title = "Update the '" + variationName + "' variation with the current settings";

const onClick = "Ren.Messages.Requests.createOrUpdateVariation.notify(" + [
    jsString(rowVals.dataGroupingSettingsGroup),
    jsString(rowVals.gridStateGroup),
    jsString(variationName),
    jsString(rowVals.sourceVisualisationGuid)
].join(", ") + ");";

return `<button class="ren-data-grid-variations-window__cell-button" data-qa-update-variation-name="${attribute(rowVals.Label)}" onclick="${attribute(onClick)}" title="${attribute(title)}">Update</button>`;