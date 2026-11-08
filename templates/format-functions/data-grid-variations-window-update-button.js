/**
    Outputs an update button for the row in the variations window.

    TAGS: format, html, report-specific
*/

const title = "Update the '@rowVals["Variation Name"]' variation with the current settings";

const onClick = `Ren.Messages.Requests.createOrUpdateVariation.notify(
    '@rowVals.dataGroupingSettingsGroup',
    '@rowVals.gridStateGroup',
    '@rowVals["Variation Name"]',
    '@rowVals.sourceVisualisationGuid');`;

return `<button class="ren-data-grid-variations-window__cell-button" data-qa-update-variation-name="@rowVals.Label" onclick="${onClick}" title="${title}">Update</button>`;