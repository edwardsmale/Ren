/**
 * Renders a button to download the report.
 */
Ren.ReportDownloadModule = (() => {

    let isModuleDisabled = true;

    const tooltip = "Download report";

    const enableReportDownloadModule = (module) => {

        isModuleDisabled = false;
        Ren.ReportHeaderModule.setButtonEnabled(module, true, tooltip);
    };

    const disableReportDownloadModule = (module) => {

        isModuleDisabled = true;
        Ren.ReportHeaderModule.setButtonEnabled(module, false);
    };

    const initialise = () => {

        const module = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-web-report__web-report-download-module",
                "ren-web-report-download-module",
                "js-ren-web-report-download-module"
            );

        const downloadButton = Ren.HtmlUtils.create("a")
            ._addClass(
                "ren-web-report-download-module__download-report",
                "qa-ren-download-report-button"
            )
            ._attr("href", "javascript:void(0)");

        // If we're in a downloaded report, the data are already all available in the DOM, so there
        // is no need to disable the download module.
        if (!Ren.UrlContext.isDownloadedReport()) {
            disableReportDownloadModule(module);
        }

        const download = (convertToLiveUrls, compressed) => {

            if (isModuleDisabled) return;

            module._addClass(
                "ren-web-report-download-module--is-processing",
                "qa-ren-download-report-is-downloading"
            );

            Ren.Messages.Requests.downloadReport.notify(convertToLiveUrls, compressed);
        };

        downloadButton.addEventListener("click", () => {

            download(true, true);
        });

        const endProcessing = () => {

            module._removeClass("ren-web-report-download-module--is-processing");
            module._removeClass("qa-ren-download-report-is-downloading");
        };

        Ren.Messages.Events.reportDownloaded.handle(() => {

            endProcessing();

            Ren.PopupSuccessMessage("Report downloaded");
        });

        Ren.Messages.Events.reportDownloadFailed.handle(() => {

            endProcessing();
        });

        module.appendChild(downloadButton);

        Ren.ReportHeaderModule.addButton(module);

        Ren.Messages.Events.allReportsLoaded.handle(() => {

            enableReportDownloadModule(module);
        });

        Ren.ReportDownloader.initialise();

        Ren.AddContextMenuItems(downloadButton, [
            {
                section: "Download Report",
                text: "With live URLs (default)",
                className: "qa-ren-download-with-live-urls",
                action: () => { download(true, true); }
            },
            {
                section: "Download Report",
                text: "With dev URLs",
                className: "qa-ren-download-with-dev-urls",
                visible: () => Ren.HostUrls.hasDevelopmentUrls(),
                action: () => { download(false, true); }
            },
            {
                section: "Download Report",
                text: "Download compressed",
                className: "qa-ren-download-compressed",
                action: () => { download(true, true); }
            },
            {
                section: "Download Report",
                text: "Download uncompressed",
                className: "qa-ren-download-uncompressed",
                action: () => { download(true, false); }
            }
        ]);
    };

    const remove = () => {

        Ren.HtmlUtils.removeElements(".js-ren-web-report-download-module");
    };

    return {
        initialise,
        remove
    };
})();
