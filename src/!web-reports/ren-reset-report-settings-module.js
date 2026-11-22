/**
 * Renders a button to reset report settings to their defaults.
 */
Ren.ResetReportSettingsModule = (() => {

    let isModuleDisabled = true;

    const enableResetReportSettingsModule = (module) => {

        const isSettingsBasedReport = document.body.classList.contains("js-ren-settings-based-report");

        const settingsBasedReportTooltipText = `
~ settings based report ~`;

        const tooltip = "Reset report settings" +
            (isSettingsBasedReport ? settingsBasedReportTooltipText : "");

        isModuleDisabled = false;
        Ren.ReportHeaderModule.setButtonEnabled(module, true, tooltip);
    };

    const disableResetReportSettingsModule = (module) => {

        isModuleDisabled = true;
        Ren.ReportHeaderModule.setButtonEnabled(module, false);
    };

    const initialise = () => {

        const module = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-web-report__web-report-reset-report-settings-module",
                "ren-web-report-reset-report-settings-module",
                "js-ren-web-report-reset-report-settings-module"
            );

        const resetReportSettingsButton = Ren.HtmlUtils.create("a")
            ._addClass(
                "ren-web-report-reset-report-settings-module__reset-report-settings",
                "qa-ren-reset-report-settings-button"
            )
            ._attr("href", "javascript:void(0)");

        disableResetReportSettingsModule(module);

        resetReportSettingsButton.addEventListener("click", () => {

            if (!isModuleDisabled) {

                const onEditorPage = Ren.UrlContext.onEditorPage();
                Ren.Messages.Requests.loadReportSettings.notify("", true, onEditorPage);
            }
        });

        module.appendChild(resetReportSettingsButton);

        Ren.ReportHeaderModule.addButton(module);

        Ren.Messages.Events.allReportsLoaded.handle(() => {

            enableResetReportSettingsModule(module);
        });
    };

    const remove = () => {

        Ren.HtmlUtils.removeElements(".js-ren-web-report-reset-report-settings-module");
    };

    return {
        initialise,
        remove
    };
})();
