/**
    Outputs a apply button for the row in the variations window.

    TAGS: format, html, report-specific
*/

// The row's values are read off rowVals directly rather than through at-expressions, so that they
// can be escaped: a variation's name is whatever was typed for it, quotes and all.
const attribute = Ren.HtmlUtils.escapeAttribute;
const jsString = value => JSON.stringify(String(value));

const variationName = rowVals["Variation Name"];
const title = "Apply the '" + variationName + "' settings";

// The report context the variations window was opened from, so that applying a variation only
// affects that instance of the report.  Rows without the column - reports that list variations from
// their own data rather than from a variations window - pass null, which every handler treats as
// "no report context to match", i.e. the behaviour there was before contexts were considered.
const containingReportGuid = rowVals.containingReportGuid;

const containingReportGuidArgument = containingReportGuid ? jsString(containingReportGuid) : "null";

const onClick = "Ren.Messages.Requests.applyVariation.notify(" + [
    jsString(rowVals.dataGroupingSettingsGroup),
    jsString(rowVals.gridStateGroup),
    jsString(variationName),
    containingReportGuidArgument
].join(", ") + ");";

return `<button class="ren-data-grid-variations-window__cell-button" data-qa-apply-variation-name="${attribute(rowVals.Label)}" onclick="${attribute(onClick)}" title="${attribute(title)}">Apply</button>`;
