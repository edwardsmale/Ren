/**
 * Makes relative report links work in downloaded reports.
 *
 * A downloaded report is opened from the file system, so a relative link such as
 * "/SomeReport?Partner=X" resolves against the local file path rather than the reporting server.
 * Report markup and format functions are meant to build their links with reportUrl(), which makes
 * them absolute; this converts any that don't, so a report whose links were written relatively
 * still opens them from the reporting server.
 *
 * The conversion runs against the whole document rather than only the newly-rendered content,
 * because a downloaded report re-renders its visualisations on load - links written into the
 * downloaded HTML and links created by a format function both need converting, and re-converting
 * an already-absolute link is a no-op.
 */
Ren.DownloadedReportLinks = (() => {

    // Fragments, query-only links, script calls and anything carrying its own scheme (including a
    // protocol-relative "//host/path") are not relative report paths, so they are left alone.
    const nonRelativePathPattern = /^(#|\?|\/\/|[a-z][a-z0-9+.-]*:)/i;

    const absolutiseLink = (link) => {

        const href = link.getAttribute("href");

        if (!href || nonRelativePathPattern.test(href)) return;

        link.setAttribute("href", Ren.HostUrls.reportUrl(href));
    };

    /**
     * Converts every relative report link in the document to an absolute URL on the reporting
     * server.  Does nothing outside a downloaded report, where relative links resolve correctly of
     * their own accord.
     */
    const absolutiseRelativeLinks = () => {

        if (!Ren.UrlContext.isDownloadedReport()) return;

        if (!Ren.HostUrls.hasReportUrls()) return;

        const links = document.querySelectorAll("a[href]");

        links.forEach(absolutiseLink);
    };

    Ren.Messages.Events.pageLoaded.handle(() => {

        absolutiseRelativeLinks();
    });

    Ren.Messages.Events.reportAddedToDom.handle(() => {

        absolutiseRelativeLinks();
    });

    return {
        absolutiseRelativeLinks
    };
})();
