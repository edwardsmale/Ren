/**
 * Shows a window that displays the current state of the report context collection as JSON.
 */
Ren.ReportContextCollection_Debug = (() => {

    const showReportContextCollectionDebugWindow = () => {

        const debugWindow = Ren.JsonDebugWindow(
            "ren-report-context-collection-debug-window",
            "Report Context Collection",
            550 - 120,
            300,
            () => ({
                pretty: Ren.ReportContextCollection,
                indented: Ren.ReportContextCollection,
                raw: Ren.ReportContextCollection
            })
        );

        debugWindow.updateOnStateChange(() => Ren.ReportContextCollection);
    };

    Ren.Messages.Requests.reportContextCollectionDebugWindow.handle(() => {

        showReportContextCollectionDebugWindow();
    });
})();
