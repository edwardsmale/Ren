/**
    Outputs a remove button for the row in the variations window.

    TAGS: format, html, report-specific
*/

// The row's values are read off rowVals directly rather than through at-expressions, so that they
// can be escaped: a variation's name is whatever was typed for it, quotes and all.
const attribute = Ren.HtmlUtils.escapeAttribute;
const jsString = value => JSON.stringify(String(value));

const title = "Remove this variation";

const onClick = "Ren.Messages.Requests.removeVariation.notify(" + [
    jsString(rowVals.dataGroupingSettingsGroup),
    jsString(rowVals.gridStateGroup),
    jsString(rowVals["Variation Name"])
].join(", ") + ");";

return `<button class="ren-data-grid-variations-window__cell-button" data-qa-remove-variation-name="${attribute(rowVals.Label)}" onclick="${attribute(onClick)}" title="${attribute(title)}">Remove</button>`;