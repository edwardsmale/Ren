Ren.ReportContextUrlUpdater = (() => {

    /**
     * Finds the EmbeddedReport visualisation whose report context is the given one, or null if the
     * report context is not an embedded report's.  Matches on the report context guid the same way
     * ren-embedded-report.js does, so nested embedded reports resolve to the correct one.
     */
    const findEmbeddedReportForContext = (reportContext) => {

        const embeddedReports = Ren.VisualisationCollection.getVisualisations("EmbeddedReport");

        for (let i = 0; i < embeddedReports.length; i++) {

            const embeddedReport = embeddedReports[i];

            if (!embeddedReport.element) continue;

            const contextElement = embeddedReport.element.querySelector(".js-ren-report-context");

            if (!contextElement) continue;

            const guid = Ren.HtmlUtils.getClassName(contextElement, "report-context-");

            if (guid === reportContext.reportContextGuid) return embeddedReport;
        }

        return null;
    };

    const isRequestedFromPage = (visualisation) => {

        if (Ren.HostUrls.hasReportUrls() || !visualisation.containingReportUrl) return false;

        return new URL(visualisation.containingReportUrl, location.href).pathname === location.pathname;
    };

    /**
     * Sets the URL of a report, causing it to refresh as per the new URL.  Called when the user
     * changes the parameters using a parameters module or a date selector.
     */
    const updateReportUrl = (newUrl, visualisation) => {

        const reportContext = visualisation.reportContext;

        // A report context Ren made of a page outside the web report layout is requested from the
        // page's own URL (see Ren.PageReportContext), which gives the whole page rather than the
        // report alone, so the page is reloaded as a whole, as with reloadsPage.
        if (isRequestedFromPage(visualisation)) {

            location.href = newUrl;
            return;
        }

        // A popup report's settings (column visibility, aggregation types etc.) are applied
        // client-side, by the popup's onReportLoaded callback, when it is first opened. This reload
        // path replaces the report context HTML in place without going through that callback, so
        // those settings would otherwise be lost. Find the popup's EmbeddedReport visualisation now
        // (while its report context is still in the DOM) so we can re-run its onReportLoaded after
        // the reload.
        const embeddedReport = findEmbeddedReportForContext(reportContext);

        // Asks for the layout the report was rendered with.  isInsidePopup is also true of a popup
        // report, which is rendered as an embedded report.
        if (reportContext.element.classList.contains("js-ren-report-context--inside-popup")) {
            newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "isPopup", "true");
        }

        if (visualisation.isInsideEmbeddedReport) {
            newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "isEmbeddedReport", "true");
        }

        newUrl = Ren.UrlUtils.upsertQueryParameter(newUrl, "noStatics", "true");

        if (!newUrl.startsWith("http")) newUrl = Ren.UrlUtils.ensureLeadingSlash(newUrl);

        Ren.VisualisationCollection.destroyVisualisationsBelongingToReportContext(reportContext, visualisation.isInsidePopup);

        Ren.Messages.Events.reportUrlChanged.notify(reportContext.reportContextGuid, newUrl);

        Ren.QA.beginReload();

        Ren.FetchUtils.fetch(newUrl)
            .then(r => r.ok ?
                r.text() :
                Promise.reject("There was an error updating the contents of the popup.")
            )
            .then(response => {

                // Unregister the old GUID before replacing the element so that
                // addReportContextGuidAttributes can assign a fresh registration to the
                // new element that arrives in the response HTML.
                Ren.ReportContextCollection.unregisterContextElement(reportContext.reportContextGuid);

                reportContext.element.outerHTML = response;
                Ren.QA.reset();
                Ren.EmbeddedReportResponses.addResponse(newUrl, response);
                Ren.Messages.Events.reportAddedToDom.notify();

                if (embeddedReport?.isPopupReport) {

                    // Re-apply the popup's report settings to the freshly loaded report context,
                    // the same way (and with the same settingsName / isPreset) as when it was first
                    // opened.  onReportLoaded awaits a settings fetch, so by the time it reads the
                    // new report context guid, scanify (queued by reportAddedToDom above) has
                    // assigned it.
                    return embeddedReport.onReportLoaded?.(embeddedReport.element);
                }

                if (embeddedReport) {

                    // The page's settings hold the embedded report's client-side visualisations,
                    // destroyed above, so reload them now the new report is in the DOM.  Doing it
                    // any sooner builds them from the old report's data.
                    return Ren.ReportSettingsLoader.loadMostRecentSettings(false);
                }
            })
            .catch(error => {

                Ren.PopupErrorMessage(error);
            })
            .finally(() => {

                Ren.QA.endReload();
            });
    };

    return {
        updateReportUrl
    };
})();
