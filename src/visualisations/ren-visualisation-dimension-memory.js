/**
 * Remembers the size each inline visualisation renders at, in PermanentReporting, and reserves
 * that space for it on the next load so the page doesn't jump about as visualisations arrive.
 *
 * Sizes are stored per page and window width (to the nearest VIEWPORT_WIDTH_STEP), and not per
 * filter, so a reserved height is a guess that's usually close rather than an exact one.  The
 * page's sizes include those of its embedded reports, so that they're all fetched in one request
 * at the start, and are there by the time an embedded report's HTML arrives.
 */
Ren.VisualisationDimensionMemory = (() => {

    const VIEWPORT_WIDTH_STEP = 200;

    // Below this the visualisation isn't in the flow (a popup, or on a hidden tab).
    const MIN_RECORDED_HEIGHT = 20;

    // A change smaller than this proportion of the stored height isn't worth writing.
    const MIN_RECORDED_CHANGE = 0.1;

    // A promise of a map from visualisation key to { height, width }, fetched when first needed.
    let storedDimensions = null;

    // Keyed by target selector, each { visualisationKey, isReserving }.
    const trackedTargets = new Map();

    // Keyed by report context element, each a map from base key to the number seen so far.
    const keyCountsByReportContext = new WeakMap();

    const documentReportContext = {};

    const isEnabled = () => {

        return !Ren.UrlContext.isDownloadedReport() && !Ren.UrlContext.onEditorPage() &&
            Ren.Endpoints.has("visualisationDimensions");
    };

    const getViewportWidth = () => {

        return Math.round(window.innerWidth / VIEWPORT_WIDTH_STEP) * VIEWPORT_WIDTH_STEP;
    };

    const getPath = (url) => {

        return new URL(url, window.location.origin).pathname;
    };

    const getPagePath = () => {

        return getPath(Ren.UrlContext.browserRelativeUrl());
    };

    /**
     * Gets a key for the visualisation that stays the same from one load of the page to the next,
     * since its target selector is random.  It starts with the path of the report it's in, which
     * may be one embedded in the page, and a count tells apart those that are otherwise the same.
     */
    const createVisualisationKey = (visualisation, renElement) => {

        const baseKey = [
            visualisation.containingReportUrl
                ? getPath(visualisation.containingReportUrl)
                : getPagePath(),
            renElement.tagName.toLowerCase().replace(/^ren-/, ""),
            visualisation.sqlFilename ?? "",
            visualisation.dataTabIndex ?? ""
        ].join("|");

        const reportContext = visualisation.containingReport ?? documentReportContext;

        let keyCounts = keyCountsByReportContext.get(reportContext);

        if (!keyCounts) {

            keyCounts = new Map();
            keyCountsByReportContext.set(reportContext, keyCounts);
        }

        const count = (keyCounts.get(baseKey) ?? 0) + 1;

        keyCounts.set(baseKey, count);

        return baseKey + "#" + count;
    };

    const readStoredDimensions = async (response) => {

        const dimensions = new Map();

        const text = await response.text();

        if (!text) return dimensions;

        const { tabularDataSetCollection } =
            Ren.DataSourcesAdapter.adaptToTabularDataSetCollection(text, null);

        if (!tabularDataSetCollection?.TabularDataSets?.[0]?.TabularDatas?.length) {

            return dimensions;
        }

        Ren.DataSourcesDecompressAdapter.decompress(tabularDataSetCollection);

        const rows = Ren.DataSourcesToArrayAdapter.toArray(tabularDataSetCollection, {
            visualisationKey: { heading: "VisualisationKey" },
            height: { heading: "Height", type: "Number" },
            width: { heading: "Width", type: "Number" }
        });

        for (let index = 0; index < rows.length; index++) {

            dimensions.set(rows[index].visualisationKey, {
                height: rows[index].height,
                width: rows[index].width
            });
        }

        return dimensions;
    };

    /**
     * Gets a promise of the stored dimensions of the page's visualisations, fetching them only the
     * first time they're asked for.
     */
    const getStoredDimensions = () => {

        if (!storedDimensions) {

            const url = Ren.Endpoints.getUrl("visualisationDimensions");

            storedDimensions = Ren.FetchUtils.fetch(url, {
                suppressErrorLogging: true,
                jumpQueue: true,
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ReportPath: getPagePath(),
                    ViewportWidth: getViewportWidth()
                })
            })
                .then(response => response.ok ? readStoredDimensions(response) : new Map())
                .catch(() => new Map());
        }

        return storedDimensions;
    };

    const applyStoredHeight = (targetSelector, dimensionsByKey) => {

        const tracked = trackedTargets.get(targetSelector);

        if (!tracked?.isReserving) return;

        const dimensions = dimensionsByKey.get(tracked.visualisationKey);

        if (!dimensions?.height) return;

        const targetElement = document.querySelector(targetSelector);

        if (targetElement) {
            targetElement.style.minHeight = dimensions.height + "px";
        }
    };

    /**
     * Reserves the height the visualisation last rendered at in its newly created target element,
     * once the stored heights have arrived, unless it has rendered by then.
     */
    const reserveSpace = (visualisation, renElement) => {

        if (!isEnabled() || !visualisation.targetSelector) return;

        const targetSelector = visualisation.targetSelector;

        trackedTargets.set(targetSelector, {
            visualisationKey: createVisualisationKey(visualisation, renElement),
            isReserving: true
        });

        getStoredDimensions().then(dimensionsByKey => {

            applyStoredHeight(targetSelector, dimensionsByKey);
        });
    };

    /**
     * Gives up the space reserved for the visualisation, which has rendered or won't.
     */
    const releaseReservedSpace = (visualisation) => {

        const tracked = trackedTargets.get(visualisation?.targetSelector);

        if (!tracked?.isReserving) return;

        tracked.isReserving = false;

        const targetElement = document.querySelector(visualisation.targetSelector);

        if (targetElement) {
            targetElement.style.minHeight = "";
        }
    };

    const isWorthRecording = (height, dimensions) => {

        if (height < MIN_RECORDED_HEIGHT) return false;

        if (!dimensions) return true;

        return Math.abs(height - dimensions.height) > dimensions.height * MIN_RECORDED_CHANGE;
    };

    const writeDimensions = (tracked, height, width) => {

        const url = Ren.Endpoints.getUrl("upsertVisualisationDimensions");

        if (!url) return;

        Ren.FetchUtils.fetch(url, {
            suppressErrorLogging: true,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ReportPath: getPagePath(),
                ViewportWidth: getViewportWidth(),
                VisualisationKey: tracked.visualisationKey,
                Height: height,
                Width: width
            })
        }).catch(() => { });
    };

    const recordDimensions = async (targetSelector, tracked) => {

        const dimensionsByKey = await getStoredDimensions();

        const targetElement = document.querySelector(targetSelector);

        if (!targetElement) {

            trackedTargets.delete(targetSelector);
            return;
        }

        const height = targetElement.offsetHeight;
        const width = targetElement.offsetWidth;

        if (!isWorthRecording(height, dimensionsByKey.get(tracked.visualisationKey))) return;

        dimensionsByKey.set(tracked.visualisationKey, { height, width });

        writeDimensions(tracked, height, width);
    };

    /**
     * Records the size of each visualisation that has rendered, where it has changed noticeably.
     */
    const recordRenderedDimensions = () => {

        if (!isEnabled()) return;

        const entries = Array.from(trackedTargets.entries());

        for (let index = 0; index < entries.length; index++) {

            if (!entries[index][1].isReserving) {
                recordDimensions(entries[index][0], entries[index][1]);
            }
        }
    };

    // Measured a frame on, once the last visualisations' layout has settled.
    Ren.Messages.Events.allReportsLoaded.handle(() => {

        requestAnimationFrame(() => {

            recordRenderedDimensions();
        });
    });

    return {
        reserveSpace,
        releaseReservedSpace
    };
})();
