/**
 * Renders a button to save the current settings over the settings named in the URL, or as the
 * report's default settings if none are.
 */
Ren.SaveDefaultReportSettingsModule = (() => {

    let isModuleDisabled = true;

    const tooltip = "Save report settings";

    const enableSaveDefaultReportSettingsModule = (module) => {

        isModuleDisabled = false;
        Ren.ReportHeaderModule.setButtonEnabled(module, true, tooltip);
    };

    const disableSaveDefaultReportSettingsModule = (module) => {

        isModuleDisabled = true;
        Ren.ReportHeaderModule.setButtonEnabled(module, false);
    };

    const initialise = () => {

        if (!Ren.SettingsStore.canSave()) return;

        const module = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-web-report__web-report-save-default-report-settings-module",
                "ren-web-report-save-default-report-settings-module",
                "js-ren-web-report-save-default-report-settings-module"
            );

        const saveDefaultReportSettingsButton = Ren.HtmlUtils.create("a")
            ._addClass(
                "ren-web-report-save-default-report-settings-module__save-default-report-settings",
                "qa-ren-save-default-report-settings-button"
            )
            ._attr("href", "javascript:void(0)");

        disableSaveDefaultReportSettingsModule(module);

        saveDefaultReportSettingsButton.addEventListener("click", () => {

            if (!isModuleDisabled) {

                Ren.Messages.Requests.saveCurrentReportSettings.notify();
            }
        });

        module.appendChild(saveDefaultReportSettingsButton);

        Ren.ReportHeaderModule.addButton(module);

        Ren.Messages.Events.allReportsLoaded.handle(() => {

            enableSaveDefaultReportSettingsModule(module);
        });
    };

    const remove = () => {

        Ren.HtmlUtils.removeElements(".js-ren-web-report-save-default-report-settings-module");
    };

    return {
        initialise,
        remove
    };
})();
