Ren.VisualisationTypes_TabbedModule = {
    visualisationTypeName: "TabbedModule",
    tagName: "ren-tabbed-module",
    renderImmediately: true,
    availableOptions: {

    },
    synchronisedOptions: {},
    defaultOptions: {
        suppressLoadingAnimation: true
    },
    applyNestedHTML: (visualisation, parameters, html) => {

        visualisation.moduleAttributes = parameters;

        const temp = document.createElement("div");
        temp.innerHTML = html;

        // Copy each live Attr node into a plain {name, value} object.  Attr nodes expose name and
        // value as prototype getters (not own enumerable properties), so they serialize to {} when
        // the visualisation is written to a settings file (e.g. by the settings-only conversion),
        // silently dropping attributes such as a tab content's data-tab-id.  Plain objects survive
        // serialization and are consumed identically by applyRawAttributes.
        const toPlainAttributes = (attributes, excludedNames) =>
            Array.from(attributes ?? [])
                .filter(attribute => excludedNames.indexOf(attribute.name) === -1)
                .map(attribute => ({ name: attribute.name, value: attribute.value }));

        visualisation.tabs = Array.from(temp.querySelectorAll(":scope > ren-tabbed-module-tab")).map(tab => {

            const headerElement = tab.querySelector(":scope > ren-tabbed-module-tab-header");
            const contentElement = tab.querySelector(":scope > ren-tabbed-module-content");

            return {
                tabId: tab.getAttribute("tab-id") || null,
                tabAttributes: toPlainAttributes(tab.attributes, ["tab-id"]),
                headerAttributes: toPlainAttributes(headerElement?.attributes, []),
                headerHtml: headerElement?.innerHTML ?? "",
                contentAttributes: toPlainAttributes(contentElement?.attributes, ["width", "height"]),
                contentHtml: contentElement?.innerHTML ?? "",
                // Optional explicit dimensions for the tab content element, e.g. to give a tab that
                // hosts tab-relative popups a fixed clip area (see
                // ren-tab-relative-visualisations.js).
                contentWidth: contentElement?.getAttribute("width") || null,
                contentHeight: contentElement?.getAttribute("height") || null,
                tabContentGuid: Ren.RandomUtils.generateRandomClassName("tab-content")
            };
        });
    },
    getCreateFunction: () => Ren.CreateTabbedModule
};
