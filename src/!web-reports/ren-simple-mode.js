/**
 * Applies simple mode to report contexts whose request URL contains simple=1.  In simple mode,
 * elements with the class ren-hide-in-simple-mode are hidden via a scoped dynamic stylesheet.
 * Handles both full-page reports (via pageLoaded) and embedded/popup reports (via
 * reportAddedToDom).
 */
Ren.SimpleModeSetup = (() => {

    const processedGuids = new Set();

    /**
     * Gets a value indicating whether the given URL has the query parameter simple=1.
     */
    const isSimpleMode = (url) => Ren.UrlUtils.getParameterValue(url, "simple") === "1";

    /**
     * Checks every report context on the page for simple=1 and, for any that have it, hides
     * elements with the class ren-hide-in-simple-mode.
     */
    const applySimpleMode = () => {

        document.querySelectorAll(".js-ren-report-context").forEach(contextElement => {

            const guid = contextElement.getAttribute("data-report-context-guid");
            if (!guid || processedGuids.has(guid)) return;

            const url = contextElement.getAttribute("data-request-url") ?? "";

            if (!isSimpleMode(url)) return;

            processedGuids.add(guid);

            const stylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(guid, "simple-mode");

            const styles = [];

            if (isSimpleMode(url)) {
                styles.push(".ren-hide-in-simple-mode { display: none; }");
            }
            else {

                styles.push(".ren-only-show-in-simple-mode { display: none; }");
            }

            stylesheet.updateIfChanged(styles);
        });
    };

    Ren.Messages.Events.pageLoaded.handle(applySimpleMode);
    Ren.Messages.Events.reportAddedToDom.handle(applySimpleMode);
})();
