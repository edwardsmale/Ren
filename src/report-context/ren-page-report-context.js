/**
 * Makes part of the page its report context when it has none, as on a page that just includes
 * ren.js, after turning any <ren-report-context> elements into report contexts.  The context is the
 * closest common ancestor of the page's <ren-*> elements, so that a host page (such as the Admin
 * site) that puts them in one part of its layout keeps the rest of the page to itself, or the body
 * when there are no <ren-*> elements.
 * A page served through the web report layout is left alone, even before it has a report context
 * (the Home page adds them as reports are previewed), and is told apart by the URL globals the
 * layout declares.
 */
Ren.PageReportContext = (() => {

    const getReportName = () => {

        const segments = window.location.pathname.split("/");
        const fileName = segments[segments.length - 1].replace(/\.[^.]*$/, "");

        return fileName || "Page";
    };

    /**
     * Gets the closest element that contains every <ren-*> element, other than one of the <ren-*>
     * elements themselves (as they're replaced when the page is scanned), or the body when there
     * are none or they aren't all in the body.
     */
    const getContextElement = () => {

        const body = document.body;
        const renElements = Ren.GetAllRenElements();

        if (renElements.length === 0) return body;

        let ancestor = renElements[0].parentElement;

        while (ancestor && ancestor !== body
            && !renElements.every(element => element !== ancestor && ancestor.contains(element))) {

            ancestor = ancestor.parentElement;
        }

        return ancestor && body.contains(ancestor) ? ancestor : body;
    };

    const ensure = () => {

        Ren.ReportContextElement.upgradeElements();

        if (Ren.HostUrls.hasReportUrls()) return;

        if (document.querySelector(".js-ren-report-context")) return;

        const contextElement = getContextElement();

        contextElement.classList.add("js-ren-report-context", "js-ren-report-context--on-page");

        if (!contextElement.hasAttribute("data-report-name")) {
            contextElement.setAttribute("data-report-name", getReportName());
        }

        if (!contextElement.hasAttribute("data-request-url")) {

            contextElement.setAttribute(
                "data-request-url",
                window.location.pathname + window.location.search
            );
        }
    };

    return {
        ensure
    };
})();
