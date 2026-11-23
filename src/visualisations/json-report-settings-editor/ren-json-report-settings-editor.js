Ren.CreateJsonReportSettingsEditor = (_tabularData, visualisation) => {

    // Prevent serialization of the visualisation when it is shown inside a popup, and keep it on
    // the page when new report settings are loaded.
    visualisation.doNotSerializeIfPopup = true;
    visualisation.isTransitive = true;

    const element = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("JsonReportSettingsEditor", {});

    const textarea = element.querySelector(".js-ren-json-report-settings-editor-textarea");
    const copyButton = element.querySelector(".js-ren-json-report-settings-editor-copy");
    const closeButton = element.querySelector(".js-ren-json-report-settings-editor-close");

    // The settings shown are identified by the settings name and preset flag of the report
    // context that the editor was opened from.  These are passed in as visualisation options.
    const settingsName = visualisation.settingsName ?? null;
    const isPreset = visualisation.isPreset ?? true;
    const isDefault = visualisation.isDefault ?? false;
    const isPageReport = visualisation.isPageReport ?? false;
    const reportName = visualisation.settingsReportName ??
        Ren.WebReports.getWebReportName();

    let kind = isPreset ? "preset" : "user";

    if (isDefault) kind = "default";

    const closePopup = () => {

        if (visualisation.popup) {
            visualisation.popup.closeWindow();
        }
    };

    // Gets the settings to show: for the page's own report, those it has now, which Ctrl+S would
    // save; for a popup report, those saved in the store, as the page's settings aren't its.
    const getSettingsJson = () => {

        if (isPageReport) {
            return Promise.resolve(Ren.ReportSerializer.serializeReportSettings());
        }

        return Ren.SettingsStore.load(kind, reportName, settingsName).catch(() => null);
    };

    // How often the page's own report's settings are checked for changes while the window is open,
    // for changes that send none of the messages below.
    const FOLLOW_INTERVAL_MS = 2000;

    // The messages sent when the page's settings change, on which the window shows them at once.
    const SETTINGS_CHANGED_EVENT_NAMES = [
        "columnVisibilityChanged",
        "dataGridColumnFormattingChanged",
        "dataGroupingSettingsChanged",
        "filterChanged",
        "gridStateChanged",
        "groupingsChanged",
        "reportSettingsLoaded",
        "variationsChanged",
        "visualisationSettingsChanged"
    ];

    // The settings JSON last put in the textarea, to tell whether the user has edited it since.
    let shownSettingsJson = null;

    // Fetches the settings JSON and populates the editor.
    const loadSettings = async () => {

        const settingsJson = await getSettingsJson();

        textarea.value = settingsJson || "";
        shownSettingsJson = textarea.value;
    };

    copyButton.addEventListener(
        "click",
        () => Ren.ClipboardUtils.copyAllOfTextArea(textarea, copyButton)
    );

    closeButton.addEventListener("click", closePopup);

    // Keeps the page's own report's settings up to date as they change, until the text is edited
    // or the window closes.  The messages show most changes at once, and the polling catches
    // those that send no message, such as the date/value chart's menu settings.
    const followPageSettings = () => {

        let hasBeenShown = false;
        let intervalId = null;

        const listenerOwner = { jsonReportSettingsEditor: visualisation.visualisationGuid };

        const stopFollowing = () => {

            clearInterval(intervalId);
            Ren.Messages.removeListenersByOwner(listenerOwner);
        };

        const showChangedSettings = () => {

            if (!element.isConnected) {

                if (hasBeenShown) stopFollowing();
                return;
            }

            hasBeenShown = true;

            // Edited text is left alone, so the edits aren't lost.
            if (textarea.value !== shownSettingsJson) return;

            const settingsJson = Ren.ReportSerializer.serializeReportSettings();

            if (settingsJson === shownSettingsJson) return;

            textarea.value = settingsJson;
            shownSettingsJson = settingsJson;
        };

        Ren.Messages.withOwner(listenerOwner, () => {

            for (let i = 0; i < SETTINGS_CHANGED_EVENT_NAMES.length; i++) {

                Ren.Messages.Events[SETTINGS_CHANGED_EVENT_NAMES[i]].handle(showChangedSettings);
            }
        });

        intervalId = setInterval(showChangedSettings, FOLLOW_INTERVAL_MS);
    };

    loadSettings().finally(() => {

        if (isPageReport) followPageSettings();
    });

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
