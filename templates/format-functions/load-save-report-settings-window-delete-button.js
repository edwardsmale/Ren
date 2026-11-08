/**
    Outputs a delete button for user report settings files.

    TAGS: format, html, report-specific
*/

const title = rowVals.CanDelete
    ? "Delete these settings"
    : "The preset settings can only be deleted from a dev PC";

const isDisabled = !rowVals.CanDelete || !rowVals.FileExists;

const onClick = `Ren.Messages.Requests.deleteReportSettings.notify('@rowVals.Name', @rowVals.IsPreset);`;

const className = "ren-load-save-report-settings-window__cell-button qa-ren-user-report-settings-delete-button";

return `<button class="@className" data-qa-delete-user-report-settings-name="@rowVals.Name" data-qa-delete-report-settings-is-preset="@rowVals.IsPreset" onclick="${onClick}" title="${title}" ${isDisabled ? "disabled" : ""}>Delete</button>`;