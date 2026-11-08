/**
 * Functions for setting up links that show reports in popup windows.
 */
Ren.PopupReports = (() => {

    const downloadedReportMessage = "This report will open in a new tab.  " +
        "(Popup reports are not supported in downloaded reports.)";

    const crossDomainRequestMessage = "This report will open in a new tab, as " +
        "its URL points to a different server.";

    const popupReportLinkOnClick = (e, link) => {

        e.preventDefault();

        // Add a marker that indicates which cell the popup is based on.
        link.appendChild(
            Ren.HtmlUtils.create("div")
                ._addClass("ren-popup-report-cell-marker")
        );

        const reportUrl = link.getAttribute("href");

        if (e.ctrlKey) {

            Ren.BrowserUtils.openNewBrowserTab(reportUrl);
        }
        else {

            const title = link.getAttribute("title") || "";

            Ren.ShowPopupReport(reportUrl, title);
        }
    };

    const linksProcessed = new WeakSet();

    /**
     * Sets up a popup report link.
     */
    const setupPopupReport = (link) => {

        if (linksProcessed.has(link)) return;

        linksProcessed.add(link);

        if (Ren.UrlContext.isDownloadedReport()) {

            link.title = downloadedReportMessage;
            link.target = "_blank";

            link.classList.add("ren-external-link");
        }
        else if (!Ren.UrlUtils.canAccessDomain(link.href)) {

            link.title = crossDomainRequestMessage;
            link.target = "_blank";

            link.classList.add("ren-external-link");
        }
        else {

            link.onclick = (e) => popupReportLinkOnClick(e, link);
        }
    };

    /**
     * Wires up links with class name 'popup-report' to open a popup window with the report.
     */
    const setupPopupReports = () => {

        // Visualisations call this after rendering their content, so it is also the point at which
        // links a format function has just written are first in the DOM.  In a downloaded report
        // any of those written relatively need making absolute before they are wired up.
        Ren.DownloadedReportLinks.absolutiseRelativeLinks();

        const links = document.querySelectorAll("a.popup-report");
        links.forEach(setupPopupReport);
    };

    // Set up popup report links when the page loads and whenever new content is added to the DOM
    Ren.Messages.Events.pageLoaded.handle(() => {

        setupPopupReports();
    });

    Ren.Messages.Events.reportAddedToDom.handle(() => {

        setupPopupReports();
    });

    return {
        setupPopupReports
    };
})();
