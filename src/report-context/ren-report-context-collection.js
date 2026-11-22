/**
 * Maintains a list of the report contexts on the page.
 */
Ren.ReportContextCollection = (() => {

    const reportContexts = [];

    /**
     * Report context GUIDs to their DOM elements, to tell whether a context is present without
     * querying the DOM.
     */
    const registeredElements = new Map();

    /**
     * Registers a context element so that isAwaitingReportContextElement can find it.
     */
    const registerContextElement = (guid, element) => {

        registeredElements.set(guid, element);
    };

    /**
     * Removes a context element from the registry, so the GUID is available for re-assignment.
     */
    const unregisterContextElement = (guid) => {

        registeredElements.delete(guid);
    };

    /**
     * Gets a value indicating whether the given GUID is registered against an element still in the
     * DOM.  A popup report can be closed without going through removeReportContext, so a detached
     * element is dropped, or the reopened popup's grid would never render into the popup.
     */
    const isContextElementRegistered = (guid) => {

        const element = registeredElements.get(guid);

        if (!element) return false;

        if (!element.isConnected) {

            registeredElements.delete(guid);
            return false;
        }

        return true;
    };

    /**
     * Removes the visualisation from the page.
     */
    const destroyReportContext = (reportContext) => {

        if (!reportContext) return;

        reportContext.element.innerHTML = "";
    };

    /**
     * Adds a report context to the collection.
     */
    const addReportContext = (reportContext) => {

        if (reportContexts.some(r => r.reportContextGuid === reportContext.reportContextGuid)) {
            return;
        }

        reportContexts.push(reportContext);

        return reportContext;
    };

    /**
     * Removes a report context from the collection.
     */
    const removeReportContext = (reportContext) => {

        const index = reportContexts.indexOf(reportContext);

        if (index > -1) {
            reportContexts.splice(index, 1);
        }

        unregisterContextElement(reportContext.reportContextGuid);
        destroyReportContext(reportContext);
    };

    /**
     * Gets a value indicating whether the visualisation's report context element has not yet been
     * registered, which it must be before the visualisation can render.
     */
    const isAwaitingReportContextElement = (visualisation) => {

        const reportContextGuid = visualisation.reportContext?.reportContextGuid;

        if (!reportContextGuid) return false;

        return !isContextElementRegistered(reportContextGuid);
    };

    return {
        addReportContext,
        removeReportContext,
        destroyReportContext,
        reportContexts,
        registerContextElement,
        unregisterContextElement,
        isContextElementRegistered,
        isAwaitingReportContextElement
    };
})();
