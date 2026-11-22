/**
 * A report context GUID is a CSS class name that is added to the report context element (the
 * element with class "js-ren-report-context").  The GUID is based on the report name and is unique
 * within the page.
 */
Ren.ReportContextGuids = (() => {

    const getReportContextGuid = (reportName, occurrence) => {

        const defaultReportContextGuid =
            "report-context-" + Ren.TextUtils.cleanForCssClassName(reportName);

        return defaultReportContextGuid +
            (occurrence === 1 ? "" : "--" + Ren.TextUtils.ordinate(occurrence));
    };

    const addReportContextGuidAttributes = () => {

        // Ensure all existing context elements are in the registry (handles re-entrant calls
        // and any edge cases where the registry may be out of sync with the DOM).
        document.querySelectorAll(".js-ren-report-context[data-report-context-guid]").forEach(elem => {

            const guid = elem.getAttribute("data-report-context-guid");
            Ren.ReportContextCollection.registerContextElement(guid, elem);
        });

        const elems = document.querySelectorAll(".js-ren-report-context:not([data-report-context-guid])");

        elems.forEach(elem => {

            const reportName = elem.getAttribute("data-report-name");

            let occurrence = 1;

            while (true) {

                const reportContextGuid = getReportContextGuid(reportName, occurrence);

                if (!Ren.ReportContextCollection.isContextElementRegistered(reportContextGuid)) {

                    elem.classList.add(reportContextGuid);
                    elem.setAttribute("data-report-context-guid", reportContextGuid);
                    Ren.ReportContextCollection.registerContextElement(reportContextGuid, elem);
                    break;
                }

                occurrence++;
            }
        });
    };

    return {
        addReportContextGuidAttributes
    };
})();
