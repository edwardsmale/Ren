Ren.CreateLoadSaveReportSettingsWindow = (_tabularData, visualisation) => {

    // Prevents serialization of the visualisation if it is inside a popup.
    visualisation.doNotSerializeIfPopup = true;

    // Make the visualisation stay on the page when new report settings are loaded.
    visualisation.isTransitive = true;

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-load-save-report-settings-window");

    // The load/save report settings window contains a gridset showing the files that exist, with
    // buttons to load, save, and delete them.  Create a settings group for that gridset.
    const gridSetSettingsGroup = Ren.BegottenVisualisationSettingsGroupProvider.getSettingsGroup(
        visualisation
    );

    const reportSettings = Ren.LoadSaveReportSettingsWindow_ReportSettings(gridSetSettingsGroup);

    Ren.ReportSettings_DataGroupingSettingsCollection.replaceDataGroupingSettingsWithExisting(reportSettings, gridSetSettingsGroup);
    Ren.ReportSettings_GridStateCollection.replaceGridStateWithExisting(reportSettings, gridSetSettingsGroup);

    let contents;

    const updateContents = () => {

        // The window is rebuilt whenever the list of files is refreshed, which can happen while a
        // name is being typed, so the name is carried over to the rebuilt input.
        const previousSaveAsInput =
            element.querySelector(".js-ren-load-save-report-settings-window-save-as-input");

        const previousSaveAsName = previousSaveAsInput ? previousSaveAsInput.value : "";
        const saveAsInputHadFocus = !!previousSaveAsInput &&
            document.activeElement === previousSaveAsInput;
        const selectionStart = saveAsInputHadFocus ? previousSaveAsInput.selectionStart : null;
        const selectionEnd = saveAsInputHadFocus ? previousSaveAsInput.selectionEnd : null;

        if (contents) {
            contents.remove();
        }

        const dataSourceUri = Ren.LoadSaveReportSettingsWindow_Data.createReportSettingsFilesDataSource();
        const anyData = !!dataSourceUri;

        const newContent =
            Ren.HtmlTemplateFunctions.reifyHtmlTemplate("LoadSaveReportSettingsWindow", {
                anyData,
                dataSourceUri,
                settingsGroup: gridSetSettingsGroup,
                reportSettings: Ren.JsonUtils.serialize(reportSettings)
            });

        element._append(newContent);

        contents = element.children[0];

        const saveButton = element.querySelector(".js-ren-load-save-report-settings-window-save-as-button");
        const saveAsInput = element.querySelector(".js-ren-load-save-report-settings-window-save-as-input");

        saveAsInput.value = previousSaveAsName;

        if (saveAsInputHadFocus) {

            saveAsInput.focus();
            saveAsInput.setSelectionRange(selectionStart, selectionEnd);
        }

        saveButton.addEventListener("click", () => {

            const settingsName = saveAsInput.value.trim();

            saveAsInput.value = "";

            if (settingsName) {

                Ren.Messages.Requests.saveReportSettings.notify(settingsName, false, false);
            }
            else {

                // Save as the default settings if no settings name is given, which are the preset
                // settings except outside the Editor page on the Reporting server.

                if (Ren.UrlContext.onEditorPage()) {

                    Ren.Messages.Requests.saveReportSettings.notify(null, true, true);
                }
                else {

                    Ren.Messages.Requests.saveDefaultReportSettings.notify();
                }
            }
        });

        saveAsInput.addEventListener("keypress", (event) => {

            if (event.key === "Enter") {

                event.preventDefault();
                saveButton.click();
            }
        });

        Ren.Messages.Events.reportAddedToDom.notify();
    };

    updateContents();

    Ren.Messages.Requests.updateLoadSaveReportSettingsWindow.handle(() => {

        updateContents();
    });

    if (Ren.UrlContext.onEditorPage()) {

        Ren.Messages.Events.sqlLoaded.handle(() => {

            updateContents();
        });
    }

    return {
        element
    };
};
