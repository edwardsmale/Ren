/**
 * UI module containing the load / save report settings button.
 */
Ren.LoadSaveReportSettingsModule = (() => {

    let isModuleDisabled = true;

    const tooltip = "Load / save report settings";

    const enableLoadSaveReportSettingsModule = (module) => {

        isModuleDisabled = false;
        Ren.ReportHeaderModule.setButtonEnabled(module, true, tooltip);
    };

    const disableLoadSaveReportSettingsModule = (module) => {

        isModuleDisabled = true;
        Ren.ReportHeaderModule.setButtonEnabled(module, false);
    };

    const initialise = () => {

        Ren.ReportSettingsSaver.initialise();

        // The window lists the report's settings, so isn't offered where they can't be listed.
        if (!Ren.SettingsStore.canList()) return;

        const module = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-web-report__web-report-save-report-settings-module",
                "ren-web-report-save-report-settings-module",
                "js-ren-web-report-save-report-settings-module"
            );

        const loadSaveReportSettingsButton = Ren.HtmlUtils.create("a")
            ._addClass(
                "ren-web-report-save-report-settings-module__save-report-settings",
                "qa-ren-load-save-report-settings-popup-button"
            )
            ._attr("href", "javascript:void(0)");

        disableLoadSaveReportSettingsModule(module);

        const showFileWindow = () => {

            Ren.VisualisationCreator.createVisualisation({
                visualisationTypeName: "LoadSaveReportSettingsWindow",
                excludeFromSerialization: true,
                sourceVisualisation: null,
                popupTitle: "📁 Load / save report settings",
                isPopup: true,
                popupRight: "8rem",
                popupTop: "4rem",
                popupWidth: "42rem",
                popupHeight: "100%"
            });
        };

        loadSaveReportSettingsButton.addEventListener("click", () => {

            if (!isModuleDisabled) showFileWindow();
        });

        Ren.Messages.Events.reportSettingsSaved.handle((success, url, errorDetails) => {

            module._removeClass("ren-web-report-save-report-settings-module--is-processing");

            if (success) {

                Ren.PopupSuccessMessage("Report settings saved", { centredYOffset: "-4rem" });
            }
            else {

                Ren.DataSourceErrorPopup.show(
                    url,
                    errorDetails,
                    "Failed to save report settings."
                );
            }
        });

        module.appendChild(loadSaveReportSettingsButton);

        Ren.ReportHeaderModule.addButton(module);

        Ren.Messages.Events.allReportsLoaded.handle(() => {

            enableLoadSaveReportSettingsModule(module);
        });
    };

    const remove = () => {

        Ren.HtmlUtils.removeElements(".js-ren-web-report-save-report-settings-module");
    };

    return {
        initialise,
        remove
    };
})();
