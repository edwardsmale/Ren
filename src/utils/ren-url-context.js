/**
 * Functions for determining which page we're on.
 */
Ren.UrlContext = (() => {

    const browserLocation = () => window.top.location;

    const browserLocationHref = () => {

        try {
            return browserLocation().href;
        }
        catch {

            return "";
        }
    };

    const browserRelativeUrl = () => {

        try {

            return browserLocation().pathname + browserLocation().search + browserLocation().hash;
        }
        catch {

            return "";
        }
    };

    const browserLocationPathname = () => {

        try {
            return browserLocation().pathname;
        }
        catch {

            return "";
        }
    };

    const browserLocationHash = () => {

        try {
            return browserLocation().hash;
        }
        catch {

            return "";
        }
    };

    const browserDomain = () => Ren.UrlUtils.getDomain(browserLocationHref());

    const onHomePage = () => browserLocationPathname() === "/";

    const onEditorPage = () => Ren.PageHooks.isEditorPage();

    // Gets a value indicating whether we're on the local reporting domain rather than the
    // reporting server, whose root URL is the reportRootUrl in ren.config's links.liveRootUrls.
    const onLocalReportingDomain = () => {

        const liveReportingDomain =
            Ren.UrlUtils.getDomain(Ren.Config.getConfig().links.liveRootUrls.reportRootUrl);

        return !liveReportingDomain || browserLocationHref().indexOf(liveReportingDomain) === -1;
    };

    const isDownloadedReport = () => {

        return browserLocationHref().indexOf("file://") !== -1;
    };

    const isLatestReport = () => {

        return document.body.hasAttribute("data-is-latest-report-file");
    };

    // Gets a value indicating whether the report is rendered from a JSON settings file rather than
    // a web report's view.
    const isSettingsBasedReport = () => {

        return document.body.classList.contains("js-ren-settings-based-report");
    };

    // Gets the report name part of the hash's backslash-separated directory and name, or null.
    const reportNameFromHash = () => {

        const hashValue = Ren.HashUtils.readHash().reportName;

        if (!hashValue) return null;

        const split = hashValue.split("\\");

        return split[split.length - 1];
    };

    return {
        browserDomain,
        browserLocationHref,
        browserRelativeUrl,
        browserLocationHash,
        onHomePage,
        onEditorPage,
        onLocalReportingDomain,
        isDownloadedReport,
        isLatestReport,
        isSettingsBasedReport,
        reportNameFromHash
    };
})();
