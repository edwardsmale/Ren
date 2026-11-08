/**
    Outputs a remove button for the row in the variations window.

    TAGS: format, html, report-specific
*/

const title = "Remove this variation";

const onClick = `Ren.Messages.Requests.removeVariation.notify('@rowVals.dataGroupingSettingsGroup', '@rowVals.gridStateGroup', '@rowVals["Variation Name"]');`;

return `<button class="ren-data-grid-variations-window__cell-button" data-qa-remove-variation-name="@rowVals.Label" onclick="${onClick}" title="${title}">Remove</button>`;