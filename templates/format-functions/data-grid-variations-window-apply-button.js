/**
    Outputs a apply button for the row in the variations window.

    TAGS: format, html, report-specific
*/

const title = "Apply the '@rowVals["Variation Name"]' settings";

// The report context the variations window was opened from, so that applying a variation only
// affects that instance of the report.  Rows without the column - reports that list variations from
// their own data rather than from a variations window - pass null, which every handler treats as
// "no report context to match", i.e. the behaviour there was before contexts were considered.
// Read off rowVals directly rather than through an at-expression, because an at-expression inside
// a string resolves to concatenation, which would make a missing column read as "undefined".
const containingReportGuid = rowVals.containingReportGuid;

const containingReportGuidArgument = containingReportGuid
    ? "'" + containingReportGuid + "'"
    : "null";

const onClick = `Ren.Messages.Requests.applyVariation.notify('@rowVals.dataGroupingSettingsGroup', '@rowVals.gridStateGroup', '@rowVals["Variation Name"]', ${containingReportGuidArgument});`;

return `<button class="ren-data-grid-variations-window__cell-button" data-qa-apply-variation-name="@rowVals.Label" onclick="${onClick}" title="${title}">Apply</button>`;
