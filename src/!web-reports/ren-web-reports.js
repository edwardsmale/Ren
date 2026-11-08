Ren.WebReports = (() => {

    /**
     * Gets the name of the web report that the page contains.  On the editor page,
     * returns the name of the report that is loaded into the editor.
     */
    const getWebReportName = () => {

        if (Ren.UrlContext.onEditorPage()) {

            const reportNameFromHash = Ren.UrlContext.reportNameFromHash();

            if (reportNameFromHash) return reportNameFromHash;

            // If there's no report name in the hash (e.g., when previewing arbitrary SQL),
            // try to get it from the preview pane's report context element.
            const previewPane = document.querySelector(".js-ren-report-preview-content");
            const reportContext = previewPane?.querySelector(".js-ren-report-context");

            if (reportContext) {

                return reportContext.getAttribute("data-report-name");
            }

            return null;
        }
        else {

            const report = document.querySelector(".js-ren-report-context");

            if (!report) return null;

            return report.getAttribute("data-report-name");
        }
    };

    const initialiseContents = () => {

        if (Ren.UrlContext.isDownloadedReport()) {

            // Downloaded reports will include elements for these modules.  In the case of reset
            // report and load/save report settings, these will not be shown in downloaded reports.
            // The download module, however, is added by downloaded reports, to allow users to edit
            // an already-downloaded report and download it again.
            Ren.ReportDownloadModule.remove();
            Ren.LoadSaveReportSettingsModule.remove();
            Ren.SaveDefaultReportSettingsModule.remove();
            Ren.ResetReportSettingsModule.remove();
            Ren.ReportEditModeModule.remove();
        }

        if (!Ren.UrlContext.onHomePage() && !Ren.UrlContext.onEditorPage()) {

            Ren.ReportHeaderModule.initialise(".ren-web-report");
            Ren.TopRightLoadingAnimation.initialise();
            Ren.ReportEditModeModule.initialise();
            Ren.ResetReportSettingsModule.initialise();
            Ren.SaveDefaultReportSettingsModule.initialise();
            Ren.LoadSaveReportSettingsModule.initialise();
            Ren.ReportDownloadModule.initialise();
        }
        else if (Ren.UrlContext.onEditorPage()) {

            Ren.ReportEditModeModule.initialiseForEditorPage();
        }
    };

    const setUpFocus = () => {

        document.querySelectorAll(".js-ren-report-context").forEach(report => {

            report.addEventListener("mousedown", () => {

                Ren.VisualisationCollection.clearFocus();
            });
        });
    };

    Ren.Messages.Events.pageLoaded.handle(() => {

        window.addEventListener("resize", () => {

            Ren.Messages.Requests.repaint.notify();
        }, true);

        window.addEventListener("mouseup",
            (e) => { Ren.Messages.Events.windowMouseUp.notify(e.target); },
            true
        );

        window.addEventListener("mousedown",
            (e) => { Ren.Messages.Events.windowMouseDown.notify(e.target); },
            true
        );

        // Key presses on the rest of a host's page are left to the host.
        window.addEventListener("keydown", (e) => {

            if (!Ren.EventScope.isKeyboardEventInScope(e)) return;

            Ren.Messages.Events.keyDown.notifyImmediately(e);
            if (e.key === "Escape") Ren.Messages.Events.escapeKey.notify();

            // Ctrl+S saves the report's settings in place of the browser saving the page, unless
            // the page has turned that off with the saveShortcut feature flag.
            if ((e.key === "s" || e.key === "S") && e.ctrlKey && !Ren.UrlContext.onEditorPage() &&
                !Ren.Config.isFeatureDisabled("saveShortcut")) {

                e.preventDefault();
                Ren.Messages.Requests.saveCurrentReportSettings.notify();
            }
        });

        setUpFocus();
        initialiseContents();

        Ren.EmbeddedReportResponses.initialise();
    });

    Ren.Messages.Events.reportAddedToDom.handle(() => {

        // Settings are now loaded in generatePreview() before grids are created, so we just need
        // to scanify here.
        Ren.Scanifier.scanify();
    });

    return {
        getWebReportName
    };
})();
