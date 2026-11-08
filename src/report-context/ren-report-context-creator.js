/**
* Creates report context objects.
*/
Ren.ReportContextCreator = (() => {

    const createReportContext = (reportContextElement) => {

        const reportContext = {
            element: reportContextElement,
            reportContextGuid: reportContextElement.getAttribute("data-report-context-guid"),
            reportName: reportContextElement.getAttribute("data-report-name")
        };

        reportContext.usedDefaultSettingsGroupCounts = new Map();

        return reportContext;
    };

    return {
        createReportContext
    };
})();
