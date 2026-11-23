/**
 * Loads <ren-report-settings src="..."> elements, so a page can name the endpoint that gives its
 * settings rather than writing them into a settings script itself.  Each element is replaced by a
 * ".js-ren-report-settings" script holding the JSON the endpoint returns, or just removed if the
 * endpoint has none.  The page's settings are read only once these are in place (see Scanifier).
 */
Ren.ReportSettingsElementLoader = (() => {

    const TAG_NAME = "ren-report-settings";

    const LOADING_CLASS = "js-ren-report-settings-loading";

    // The loads in progress, for scanify to wait for.
    const loads = new Set();

    /**
     * HTML5 has no self-closing custom tags, so whatever follows <ren-report-settings ... /> ends
     * up inside it.  This moves it back out, in order, to follow the element.
     */
    const moveChildrenOut = (element) => {

        while (element.lastChild) {

            element.after(element.lastChild);
        }
    };

    /**
     * Gets the settings JSON the endpoint returns, or null if it has none: it isn't found, or the
     * response is empty or null.
     */
    const fetchSettingsJson = async (src) => {

        const response = await Ren.FetchUtils.fetch(src, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        // Not found is an endpoint with no settings to give, as the settings stores treat it.
        if (response.status === 404) return null;

        if (!response.ok) throw new Error("the response's status was " + response.status);

        // Fetching is turned off, as in a downloaded report, so there's no body to read.
        if (typeof response.text !== "function") return null;

        const text = (await response.text()).trim();

        return text === "" || text === "null" ? null : text;
    };

    const loadElement = async (element) => {

        element.classList.add(LOADING_CLASS);

        moveChildrenOut(element);

        const src = element.getAttribute("src");

        try {

            if (!src) throw new Error("it has no src attribute");

            const settingsJson = await fetchSettingsJson(src);

            if (settingsJson !== null) {

                element.after(
                    Ren.HtmlUtils.create("<script>")
                        ._addClass("js-ren-report-settings")
                        ._attr("type", "application/json")
                        ._textContent(settingsJson)
                );
            }
        }
        catch (error) {

            Ren.GlobalErrorHandler.logError(
                "[ReportSettingsElement] Couldn't load the report settings from " +
                (src || "<ren-report-settings>") + ": " + error.message
            );
        }
        finally {

            element.remove();
        }
    };

    /**
     * Starts loading any <ren-report-settings> elements not already loading.  Gets a promise that
     * settles when every load in progress has finished, or null if none is in progress.
     */
    const load = () => {

        const elements = document.querySelectorAll(TAG_NAME + ":not(." + LOADING_CLASS + ")");

        for (let i = 0; i < elements.length; i++) {

            const loading = loadElement(elements[i]);

            loads.add(loading);
            loading.finally(() => loads.delete(loading));
        }

        return loads.size > 0 ? Promise.all(loads) : null;
    };

    return {
        load
    };
})();
