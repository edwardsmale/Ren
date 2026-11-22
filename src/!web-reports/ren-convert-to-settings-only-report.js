/**
 * Converts a web report into a settings-only report, which has no view and declares
 * everything in its JSON report settings.  The page's rendered markup is captured into a single
 * HtmlContent visualisation, first in the settings, with each markup-origin visualisation swapped
 * for an empty placeholder element; each visualisation is then declared with a targetSelector
 * naming its placeholder, so it renders where it was rather than at measured coordinates.  The
 * server writes them into every settings file the report has and deletes the view.
 */
Ren.ConvertToSettingsOnlyReport = (() => {

    /**
     * Gets the container holding the on-page report's rendered view content.
     */
    const getReportRoot = () =>
        document.querySelector(".js-ren-report-context--on-page .ren-web-report-page") ??
        document.querySelector(".ren-web-report-page");

    /**
     * Gets a value indicating whether the page is a web report that can still be
     * converted (i.e. it has a view to delete and is not already settings-only).
     */
    const canConvert = () =>
        Ren.Endpoints.has("convertToSettingsOnlyReport") &&
        !!getReportRoot() &&
        !document.body.classList.contains("js-ren-settings-based-report") &&
        !!Ren.WebReports.getWebReportName();

    /**
     * Gets the visualisation that the passed element is the container of, if any.
     */
    const getVisualisationForContainer = (element) => {

        const guid = Ren.HtmlUtils.getGuidClassName(element, "ren-visualisation-");
        return guid ? Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid) : null;
    };

    /**
     * Gets a value indicating whether the passed visualisation originated from the web report's
     * markup (as opposed to being a client-side popup, an already-created child, or excluded from
     * serialization).
     */
    const isMarkupOriginVisualisation = (visualisation) =>
        !!visualisation &&
        !visualisation.clientSide &&
        !visualisation.isPopup &&
        !visualisation.excludeFromSerialization &&
        !visualisation.isTransitive &&
        !visualisation.isAlreadyCreated;

    const isVirtualVisualisation = (visualisation) =>
        !!Ren.VisualisationTypes.getByTypeName(visualisation.visualisationTypeName).isVirtual;

    /**
     * Gets the report context of the on-page report.
     */
    const getPageReportContext = () => {

        const contextElement = document.querySelector(".js-ren-report-context--on-page");

        return {
            reportContextGuid: contextElement?.getAttribute("data-report-context-guid"),
            reportName: contextElement?.getAttribute("data-report-name")
        };
    };

    /**
     * Gets the visualisation elements in a copy of the report's markup that are not inside another
     * visualisation, in document order.
     */
    const getOutermostVisualisationElements = (root) => {

        const elements = root.querySelectorAll(".ren-visualisation");
        const outermostElements = [];

        for (let i = 0; i < elements.length; i++) {

            if (!elements[i].parentElement.closest(".ren-visualisation")) {

                outermostElements.push(elements[i]);
            }
        }

        return outermostElements;
    };

    /**
     * Empties the element a visualisation was rendered into and gives it the passed class, for the
     * converted visualisation to target.  The scanifier wraps each visualisation in a generated
     * .ren-visualisation-target element, which is reused so that the layout it gave is kept; its
     * generated class is dropped, as it changes on every load.
     */
    const replaceWithPlaceholder = (visualisationElement, visualisation, className) => {

        const parent = visualisationElement.parentElement;

        if (parent.classList.contains("ren-visualisation-target")) {

            if (visualisation.isTargetSelectorGenerated && visualisation.targetSelector) {

                parent.classList.remove(visualisation.targetSelector.substring(1));
            }

            parent.textContent = "";
            parent.classList.add(className);
            return;
        }

        const placeholder = document.createElement("div");
        placeholder.classList.add("ren-visualisation-target", className);
        visualisationElement.replaceWith(placeholder);
    };

    /**
     * Builds the settings for a converted visualisation from the live one.
     */
    const buildConvertedVisualisation = (visualisation, targetSelector) => {

        // Cloned so the live visualisation is not mutated if the conversion later fails.
        const clone = Object.assign({}, visualisation);

        // A tabbed module's popups are scoped to its tabs by tab ID, so the live tab IDs are
        // preserved rather than the tabs being re-keyed by tabContentGuid.
        if (clone.tabs && visualisation.element) {

            clone.tabs = Ren.TabbedModuleTabIds.captureLiveTabIds(
                visualisation.element,
                clone.tabs
            );
        }

        // Marked clientSide so that it is written to the settings file.
        clone.clientSide = true;

        delete clone.targetElement;
        delete clone.isTargetSelectorGenerated;

        if (targetSelector) {

            clone.targetSelector = targetSelector;
        }
        else {

            delete clone.targetSelector;
        }

        return clone;
    };

    /**
     * Removes the scaffolding Ren and the layout add to a report's markup from a copy of it:
     * settings and config scripts, loading animations, and the generated targets of the virtual
     * visualisations, which have no place in the page.
     */
    const removeScaffolding = (root, virtualVisualisations) => {

        const scaffolding = root.querySelectorAll(
            "script.js-ren-report-settings, script.js-ren-config, " +
            ".ren-visualisation-loading-animation"
        );

        for (let i = 0; i < scaffolding.length; i++) {

            scaffolding[i].remove();
        }

        for (let i = 0; i < virtualVisualisations.length; i++) {

            const visualisation = virtualVisualisations[i];

            if (visualisation.isTargetSelectorGenerated && visualisation.targetSelector) {

                root.querySelector(visualisation.targetSelector)?.remove();
            }
        }
    };

    /**
     * Builds the converted visualisations: an HtmlContent holding the report's markup, followed by
     * the visualisations that render into the placeholders it holds, and any virtual ones.
     */
    const buildConversion = (reportRoot, reportName) => {

        const reportContext = getPageReportContext();
        const placeholderClassPrefix =
            "js-" + Ren.TextUtils.cleanForCssClassName(reportName) + "-target-";

        const root = reportRoot.cloneNode(true);
        const elements = getOutermostVisualisationElements(root);

        const targetedVisualisations = [];
        const convertedVisualisations = [];

        for (let i = 0; i < elements.length; i++) {

            const element = elements[i];
            const visualisation = getVisualisationForContainer(element);

            if (!isMarkupOriginVisualisation(visualisation)) {

                // Report settings visualisations, such as those targeting elements authored in the
                // view, are recreated from the settings into the markup left behind.
                element.remove();
                continue;
            }

            if (isVirtualVisualisation(visualisation)) {

                element.remove();
                convertedVisualisations.push(visualisation);
                continue;
            }

            const className = placeholderClassPrefix + (targetedVisualisations.length + 1);

            replaceWithPlaceholder(element, visualisation, className);
            targetedVisualisations.push({ visualisation, targetSelector: "." + className });
        }

        // Virtual visualisations, such as default dates, may have no element in the page.
        const allVisualisations = Ren.VisualisationCollection.getVisualisations();

        for (let i = 0; i < allVisualisations.length; i++) {

            const visualisation = allVisualisations[i];

            if (!isMarkupOriginVisualisation(visualisation) ||
                !isVirtualVisualisation(visualisation) ||
                visualisation.reportContext?.reportContextGuid !== reportContext.reportContextGuid ||
                convertedVisualisations.indexOf(visualisation) >= 0) {

                continue;
            }

            convertedVisualisations.push(visualisation);
        }

        removeScaffolding(root, convertedVisualisations);

        for (let i = 0; i < convertedVisualisations.length; i++) {

            convertedVisualisations[i] = buildConvertedVisualisation(convertedVisualisations[i]);
        }

        // First, so that its markup is in the page before the visualisations targeting it are
        // created (see Ren.VisualisationActuizer).
        convertedVisualisations.unshift({
            visualisationTypeName: "HtmlContent",
            reportContext,
            clientSide: true,
            contentHtml: root.innerHTML.trim(),
            suppressLoadingAnimation: true
        });

        for (let i = 0; i < targetedVisualisations.length; i++) {

            convertedVisualisations.push(buildConvertedVisualisation(
                targetedVisualisations[i].visualisation,
                targetedVisualisations[i].targetSelector
            ));
        }

        return {
            visualisations: targetedVisualisations.map((targeted) => targeted.visualisation),
            deltaVisualisations: convertedVisualisations
        };
    };

    /**
     * Gets a named attribute's value from a tab's captured contentAttributes, or null.
     */
    const getContentAttribute = (tab, name) => {

        const attributes = tab.contentAttributes ?? [];

        for (let i = 0; i < attributes.length; i++) {

            if (attributes[i].name === name) return attributes[i].value;
        }

        return null;
    };

    /**
     * Builds a map from every ID a tab is known by - its canonical live data-tab-id, the raw
     * data-tab-id the view declared, and its tabContentGuid - to the canonical live data-tab-id.
     */
    const buildTabIdNormalisationMap = (moduleVisualisation) => {

        const map = {};
        const tabs = moduleVisualisation.tabs ?? [];

        for (let i = 0; i < tabs.length; i++) {

            const tab = tabs[i];

            const contentElement = tab.tabContentGuid
                ? moduleVisualisation.element.querySelector(
                    ".ren-tabbed-module__tab-content[data-tab-content-guid=\"" + tab.tabContentGuid + "\"]"
                )
                : null;

            const canonicalTabId = contentElement?.getAttribute("data-tab-id");

            if (!canonicalTabId) continue;

            map[canonicalTabId] = canonicalTabId;

            const declaredTabId = getContentAttribute(tab, "data-tab-id");

            if (declaredTabId) map[declaredTabId] = canonicalTabId;

            if (tab.tabContentGuid) map[tab.tabContentGuid] = canonicalTabId;
        }

        return map;
    };

    /**
     * Gets the converted report's tabbed module visualisation (the one carrying tabs), or null.
     */
    const findTabbedModuleVisualisation = (visualisations) => {

        for (let i = 0; i < visualisations.length; i++) {

            if (visualisations[i].tabs) return visualisations[i];
        }

        return null;
    };

    /**
     * Builds a normalisation instruction for a single tab-scoped popup: the fields identifying it
     * across every settings file and the canonical tab ID the server should stamp onto it.
     */
    const buildPopupNormalisation = (visualisation, canonicalTabId) => ({
        visualisationTypeName: visualisation.visualisationTypeName ?? null,
        visualisationSettingsGroup: visualisation.visualisationSettingsGroup ?? null,
        dataGroupingSettingsGroup: visualisation.dataGroupingSettingsGroup ?? null,
        gridStateGroup: visualisation.gridStateGroup ?? null,
        tabbedModuleTabId: canonicalTabId
    });

    /**
     * Builds the popup normalisations for the conversion.  Existing tab-scoped popups carry a
     * tabbedModuleTabId that may be cased differently from the ID the converted module exposes, so
     * would stay hidden; each normalisation tells the server to re-key one to the canonical tab ID.
     */
    const buildPopupNormalisations = (convertedVisualisations) => {

        const moduleVisualisation = findTabbedModuleVisualisation(convertedVisualisations);

        if (!moduleVisualisation || !moduleVisualisation.element) return [];

        const normalisationMap = buildTabIdNormalisationMap(moduleVisualisation);

        const normalisations = [];
        const allVisualisations = Ren.VisualisationCollection.getVisualisations();

        for (let i = 0; i < allVisualisations.length; i++) {

            const visualisation = allVisualisations[i];

            if (!visualisation.isPopup || !visualisation.tabbedModuleTabId) continue;

            const canonicalTabId = normalisationMap[visualisation.tabbedModuleTabId];

            if (!canonicalTabId) continue;

            normalisations.push(buildPopupNormalisation(visualisation, canonicalTabId));
        }

        return normalisations;
    };

    /**
     * Posts the converted visualisations to the server, which writes them into every settings file
     * and deletes the view.
     */
    const saveConversion = async (reportName, deltaVisualisations, popupNormalisations) => {

        // The converted visualisations go first, as the HtmlContent among them must be created
        // before anything targeting the markup it holds.
        const fullSettings = Ren.ReportSerializer.getReportSettingsObject(false);
        fullSettings.visualisations = deltaVisualisations.concat(fullSettings.visualisations ?? []);

        const body = Ren.JsonUtils.serialize({
            reportName,
            deltaVisualisations: Ren.JsonUtils.serialize(deltaVisualisations, 4),
            popupNormalisations: Ren.JsonUtils.serialize(popupNormalisations, 4),
            fullSettings: Ren.JsonUtils.serialize(fullSettings, 4)
        });

        const url = Ren.Endpoints.getUrl("convertToSettingsOnlyReport");

        const response = await Ren.FetchUtils.fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body
        });

        return response.ok;
    };

    /**
     * Converts the current web report into a settings-only report.
     */
    const convert = () => {

        const reportName = Ren.WebReports.getWebReportName();

        if (!reportName) return;

        const reportRoot = getReportRoot();

        if (!reportRoot) return;

        const message =
            "This will convert this report to a settings-only report: the report's markup and " +
            "visualisations will be written into every settings file, and the view file for " +
            reportName + " will be deleted.\n\nContinue?";

        if (!window.confirm(message)) return;

        const conversion = buildConversion(reportRoot, reportName);

        const deltaVisualisations = Ren.VisualisationsTransformer.transform(
            false,
            conversion.deltaVisualisations
        );

        const popupNormalisations = buildPopupNormalisations(conversion.visualisations);

        (async () => {

            const success = await saveConversion(reportName, deltaVisualisations, popupNormalisations);

            if (success) {

                window.location.reload();
            }
            else {

                Ren.PopupErrorMessage("Failed to convert the report to a settings-only report.");
            }
        })();
    };

    return {
        canConvert,
        convert
    };
})();
