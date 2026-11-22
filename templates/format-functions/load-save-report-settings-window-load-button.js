/**
    Outputs a load button for user report settings files.

    TAGS: format, html, report-specific
*/

const title = "Load these settings";

const onClick = `Ren.Messages.Requests.loadReportSettings.notify('@rowVals.Name', @rowVals.IsPreset, @rowVals.OnEditorPage);`;

return `<button class="ren-load-save-report-settings-window__cell-button" data-qa-load-user-report-settings-name="@rowVals.Name" onclick="${onClick}" title="${title}" @(!rowVals.FileExists ? "disabled" : "")>Load</button>`;