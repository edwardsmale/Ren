Ren.CreateJsonReportSettingsEditor = (_tabularData, visualisation) => {

    // Prevent serialization of the visualisation when it is shown inside a popup, and keep it on
    // the page when new report settings are loaded.
    visualisation.doNotSerializeIfPopup = true;
    visualisation.isTransitive = true;

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("JsonReportSettingsEditor", {});

    const textarea = element.querySelector(".js-ren-json-report-settings-editor-textarea");
    const filePathElement = element.querySelector(".js-ren-json-report-settings-editor-filepath");
    const saveButton = element.querySelector(".js-ren-json-report-settings-editor-save");
    const cancelButton = element.querySelector(".js-ren-json-report-settings-editor-cancel");

    // The settings to edit are identified by the settings name and preset flag of the report
    // context that the editor was opened from.  These are passed in as visualisation options.
    const settingsName = visualisation.settingsName ?? null;
    const isPreset = visualisation.isPreset ?? true;
    const isDefault = visualisation.isDefault ?? false;
    const isPageReport = visualisation.isPageReport ?? false;
    const reportName = visualisation.settingsReportName ??
        Ren.WebReports.getWebReportName();

    let kind = isPreset ? "preset" : "user";

    if (isDefault) kind = "default";

    // Builds the URL of the endpoint that gives the settings' file path, which only the server has.
    const buildFilePathUrl = () => {

        const path = Ren.Endpoints.getUrl("getReportSettingsFilePath");

        if (!path) return null;

        let url = Ren.UrlUtils.upsertQueryParameter(path, "reportName", reportName);

        if (settingsName) {
            url = Ren.UrlUtils.upsertQueryParameter(url, "settingsName", settingsName);
        }

        return Ren.UrlUtils.upsertQueryParameter(url, "isPreset", isPreset);
    };

    const closePopup = () => {

        if (visualisation.popup) {
            visualisation.popup.closeWindow();
        }
    };

    // Gets the settings to edit: for the page's own report, those it has now, which Ctrl+S would
    // save; for a popup report, those saved in the store, as the page's settings aren't its.
    const getSettingsJson = () => {

        if (isPageReport) {
            return Promise.resolve(Ren.ReportSerializer.serializeReportSettings());
        }

        return Ren.SettingsStore.load(kind, reportName, settingsName).catch(() => null);
    };

    // Fetches the settings JSON and its file path, and populates the editor.
    const loadSettings = async () => {

        const settingsJson = await getSettingsJson();

        textarea.value = settingsJson || "";

        const pathUrl = buildFilePathUrl();

        const pathResponse = pathUrl ?
            await Ren.FetchUtils.fetch(pathUrl, {
                method: "GET",
                headers: { "Accept": "text/plain" }
            }) :
            null;

        const filePath = pathResponse && pathResponse.ok ? await pathResponse.text() : "";
        filePathElement.textContent = filePath;
        filePathElement.title = filePath;
    };

    // Saves the edited JSON to the settings store verbatim.
    const saveSettings = async () => {

        const result =
            await Ren.SettingsStore.save(kind, reportName, settingsName, textarea.value);

        if (result && result.ok) {

            // Evict any cached embedded-report responses for this report so that the next popup
            // open re-fetches from the server with the corrected settings JSON.
            if (reportName) {
                Ren.EmbeddedReportResponses.invalidateResponsesForReport(reportName);
            }
        }
        else {

            Ren.GlobalErrorHandler.logError(
                "[JsonReportSettingsEditor] Failed to save report settings."
            );
        }
    };

    saveButton.addEventListener("click", () => {

        // Close the popup regardless of whether the save succeeds, so the button always dismisses
        // the window as expected.
        saveSettings().finally(closePopup);
    });

    cancelButton.addEventListener("click", () => {

        closePopup();
    });

    loadSettings();

    return {
        element
    };
};

/**
 * Opens the JSON report settings editor in a popup window for the given settings name and preset
 * flag, or for the report's default settings.  For the page's own report, it shows the settings
 * the page has now rather than those saved.
 */
Ren.ShowJsonReportSettingsEditor = (
    settingsName,
    isPreset,
    reportName,
    { isDefault = false, isPageReport = false } = {}
) => {

    Ren.VisualisationCreator.createVisualisation({
        visualisationTypeName: "JsonReportSettingsEditor",
        excludeFromSerialization: true,
        sourceVisualisation: null,
        settingsName: settingsName ?? null,
        isPreset: isPreset ?? true,
        isDefault,
        isPageReport,
        settingsReportName: reportName ?? null,
        popupTitle: "JSON settings",
        isPopup: true,
        popupWidth: "50rem",
        popupHeight: "500px"
    });
};

/**
 * Opens the JSON report settings editor for the report context that contains the given element,
 * reading the settings name and preset flag from that context.
 */
Ren.ShowJsonReportSettingsEditorForElement = (element) => {

    // Resolve to the report context that contains the element, falling back to the on-page report
    // (e.g. when triggered from the report-wide menu, whose menu element is outside any context).
    const reportContext = (element && Ren.HtmlUtils.getContainingReportContext(element)) ||
        document.querySelector(".js-ren-report-context--on-page");

    let settingsName = null;
    let isPreset = true;
    let reportName = null;

    // A report context that doesn't say which settings it was rendered from has its default
    // settings, which are those Ctrl+S saves.
    let isDefault = true;
    let isPageReport = true;

    if (reportContext) {

        settingsName = reportContext.getAttribute("data-settings-name") || null;
        isPreset = reportContext.getAttribute("data-is-preset") !== "false";
        reportName = reportContext.getAttribute("data-report-name") || null;
        isDefault = !reportContext.hasAttribute("data-is-preset");
        isPageReport = reportContext.classList.contains("js-ren-report-context--on-page");
    }

    Ren.ShowJsonReportSettingsEditor(
        settingsName,
        isPreset,
        reportName,
        { isDefault, isPageReport }
    );
};
