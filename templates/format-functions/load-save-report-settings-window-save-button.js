/**
    Outputs a save button for user report settings files.

    TAGS: format, html, report-specific
*/

const filePath = value;
if (!filePath) return '';

const isDisabled = !rowVals.CanSave;
const title = isDisabled
    ? "The preset settings can only be saved from a dev PC"
    : "Overwrites the existing settings of this name";

const onClick = `Ren.Messages.Requests.saveReportSettings.notify('@rowVals.Name', @rowVals.IsPreset, @rowVals.OnEditorPage);`;

return `<button class="ren-load-save-report-settings-window__cell-button" data-qa-save-user-report-settings-name="@rowVals.Name" onclick="${onClick}" ${isDisabled ? 'disabled' : ''} title="${title}">Save</button>`;