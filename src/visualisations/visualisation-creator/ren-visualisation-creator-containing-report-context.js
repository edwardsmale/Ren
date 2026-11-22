Ren.VisualisationContainingReportContext = (() => {

    /**
     * Adds info about the containing report context to a visualisations object.
     */
    const populateVisualisationContainingReportContext = (visualisation) => {

        if (visualisation.isIndependentOfReportContext) return;

        // ren-* elements have already had their containing report context set when they were
        // created, but report settings file-based visualisations have not.
        if (!visualisation.containingReport) {

            visualisation.containingReport = Ren.HtmlUtils.getContainingReportContext(visualisation.element);
        }

        // A visualisation declared as markup inside a container that has been popped out - a
        // filters bar's parameters module, for instance - is scanified in a popup window that is a
        // sibling of the report context rather than a descendant of it, so walking up from the
        // element finds nothing.  Fall back to the report context on the page, as
        // Ren.VirtualVisualisationActivator does for the date selector beside it, so that such a
        // visualisation still knows the report whose URL its controls update.
        //
        // Only guess this way for a visualisation that does not already know which report it
        // belongs to.  One that does - recreated from a settings file against an embedded report,
        // or created programmatically as a popup report - is not necessarily part of the page's
        // first report context, and adopting that context would both retarget its messages and
        // hand it the page's query parameters to inherit.
        if (!visualisation.containingReport && !visualisation.reportContext) {

            visualisation.containingReport = document.querySelector(".js-ren-report-context");
        }

        if (!visualisation.containingReport) return;

        visualisation.isInsidePopup =
            Ren.HtmlUtils.isReportContextInsidePopup(visualisation.containingReport);

        visualisation.isInsideEmbeddedReport = !visualisation.containingReport.classList.contains("js-ren-report-context--on-page");

        visualisation.containingReportUrl = visualisation.containingReport.getAttribute("data-request-url");
        visualisation.containingReportGuid = visualisation.containingReport.getAttribute("data-report-context-guid");

        visualisation.reportContext =
            Ren.ReportContextCreator.createReportContext(visualisation.containingReport);

        Ren.ReportContextCollection.addReportContext(visualisation.reportContext);
    };

    return {
        populateVisualisationContainingReportContext
    };
})();
