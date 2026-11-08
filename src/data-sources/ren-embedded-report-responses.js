/**
 * Stores and retrieves responses to fetch requests made by the embedded report visualisation.
 */
Ren.EmbeddedReportResponses = (() => {

    const embeddedReportResponses = {};

    // Report-name leaves (lowercased) whose next fetch must bypass both the JS cache and the
    // browser HTTP cache.  Populated by invalidateResponsesForReport; entries are removed once the
    // matching force-reload fetch has been issued.
    const forceReloadReportNames = [];

    const addResponse = (reportUrl, response) => {

        embeddedReportResponses[reportUrl] = response;
    };

    const initialise = () => {

        // Load all responses from template elements on the page.
        const templateElements = document.querySelectorAll(".js-ren-embedded-report-response");

        for (let i = 0; i < templateElements.length; i++) {

            const reportUrl = templateElements[i].getAttribute("data-request-url");

            if (reportUrl) {
                embeddedReportResponses[reportUrl] = templateElements[i].innerHTML;
            }
        }

        // Remove all template elements from the DOM.
        templateElements.forEach(templateElement => templateElement.remove());
    };

    /**
     * Returns the embedded report fetch response for the specified report URL, or undefined if not
     * found.
     */
    const getResponse = (reportUrl) => {

        return embeddedReportResponses[reportUrl];
    };

    /**
     * Extracts the report name (the last path segment, lowercased) from a report URL, ignoring any
     * query string.  Works for both absolute (https://host/Report?...) and relative (/Report?...)
     * URLs, so that a saved report's cached responses can be matched regardless of URL form.
     */
    const getReportNameFromUrl = (url) => {

        const path = url.split("?")[0].split("#")[0].replace(/\\/g, "/").replace(/\/+$/, "");

        return path.substring(path.lastIndexOf("/") + 1).toLowerCase();
    };

    /**
     * Normalizes a report name to its bare leaf (no path, no extension), lowercased, for matching
     * against URL path segments.
     */
    const normaliseReportName = (reportName) => {

        let leaf = reportName.replace(/\\/g, "/").replace(/\/+$/, "");
        leaf = leaf.substring(leaf.lastIndexOf("/") + 1);
        leaf = leaf.replace(/\.[^.]+$/, ""); // Drop any file extension.

        return leaf.toLowerCase();
    };

    /**
     * Returns true if the next fetch for this URL should bypass the browser HTTP cache.  Call
     * clearForceReload after the fetch so subsequent opens use normal caching again.
     */
    const needsForceReload = (reportUrl) => {

        return forceReloadReportNames.indexOf(getReportNameFromUrl(reportUrl)) !== -1;
    };

    /**
     * Removes the force-reload flag for the report the given URL belongs to.
     */
    const clearForceReload = (reportUrl) => {

        const reportNameLeaf = getReportNameFromUrl(reportUrl);
        const index = forceReloadReportNames.indexOf(reportNameLeaf);

        if (index !== -1) {
            forceReloadReportNames.splice(index, 1);
        }
    };

    /**
     * Removes all cached responses belonging to the given report and marks the report for
     * force-reload so the next fetch bypasses the browser HTTP cache.  Call this after saving
     * report settings so that the next popup open re-fetches with the corrected JSON.
     */
    const invalidateResponsesForReport = (reportName) => {

        const reportNameLeaf = normaliseReportName(reportName);
        const keys = Object.keys(embeddedReportResponses);

        for (let i = 0; i < keys.length; i++) {

            if (getReportNameFromUrl(keys[i]) === reportNameLeaf) {
                delete embeddedReportResponses[keys[i]];
            }
        }

        if (forceReloadReportNames.indexOf(reportNameLeaf) === -1) {
            forceReloadReportNames.push(reportNameLeaf);
        }
    };

    /**
     * Returns all embedded report fetch responses, formatting each as an HTML <template> element.
     */
    const getAllResponsesAsTemplateElements = () => {

        const data = [];

        for (const reportUrl in embeddedReportResponses) {

            const response = embeddedReportResponses[reportUrl];

            const templateElement = Ren.HtmlUtils.create("template")
                ._addClass("js-ren-embedded-report-response")
                ._attr("data-request-url", reportUrl);

            // Set innerHTML directly - we don't want the logic in the _html() function.
            templateElement.innerHTML = response;

            data.push(templateElement.outerHTML);
        }

        return data;
    };

    return {
        initialise,
        addResponse,
        getResponse,
        needsForceReload,
        clearForceReload,
        invalidateResponsesForReport,
        getAllResponsesAsTemplateElements
    };
})();
