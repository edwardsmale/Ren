/**
 * Handles client-side editing of tabbed modules: adding, renaming and deleting tabs, creating
 * visualisations inside a tab, and re-rendering the module after changes.
 */
Ren.TabbedModuleEditor = (() => {

    /**
     * Re-creates the inner DOM of a tabbed module from its current visualisation.tabs array and
     * notifies the system that settings have changed.
     */
    const rerenderModule = (visualisation) => {

        const instance = Ren.CreateTabbedModule(null, visualisation);

        // Tab-relative popups are parented inside this module's tab contents, so are moved out to
        // the body first or wiping the inner DOM would destroy them.
        const tabRelativePopups = Array.from(
            visualisation.element.querySelectorAll(".ren-report-popup-window--tab-relative")
        );

        const body = Ren.HtmlUtils.getBody();

        for (let index = 0; index < tabRelativePopups.length; index++) {
            body.appendChild(tabRelativePopups[index]);
        }

        visualisation.element.innerHTML = "";
        visualisation.element.appendChild(instance.element);

        // Dispatched synchronously, as the rebuilt tabs must be wired up before this returns:
        // addTab then selects the new tab, and the moved-out popups must be re-attached.
        Ren.Messages.Events.reportAddedToDom.notifyImmediately();
        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    /**
     * Gets an HTML-escaped version of the given string, safe for insertion into innerHTML.
     */
    const escapeHtml = (text) => {

        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * Gets the plain-text title from a tab's headerHtml.
     */
    const getTabTitle = (tab) => {

        const div = document.createElement("div");
        div.innerHTML = tab.headerHtml;
        return div.textContent.trim();
    };

    /**
     * Selects the tab at the given index by clicking its header, the one place that deselects the
     * other tabs, updates the show/hide stylesheet and notifies listeners.
     */
    const selectTab = (visualisation, tabIndex) => {

        const module = visualisation.element.querySelector(".ren-tabbed-module");

        if (!module) return;

        const tabElements = module.querySelectorAll(":scope > .ren-tabbed-module__tab");
        const tabElement = tabElements[tabIndex];

        if (!tabElement) return;

        const tabHeader = tabElement.querySelector(".ren-tabbed-module__tab-header");

        if (tabHeader) tabHeader.click();
    };

    /**
     * Prompts for a title and appends a new tab to the module.
     */
    const addTab = (visualisation) => {

        const title = prompt("Tab title:");

        if (!title) return;

        visualisation.tabs = visualisation.tabs ?? [];
        visualisation.tabs.push({
            headerHtml: "<h2>" + escapeHtml(title) + "</h2>",
            contentHtml: "",
            tabContentGuid: Ren.RandomUtils.generateRandomClassName("tab-content")
        });

        rerenderModule(visualisation);

        // The rerender leaves the first tab selected.
        selectTab(visualisation, visualisation.tabs.length - 1);
    };

    /**
     * Prompts for a new title and updates the tab's headerHtml.
     */
    const renameTab = (visualisation, tab) => {

        const newTitle = prompt("Tab title:", getTabTitle(tab));

        if (!newTitle) return;

        tab.headerHtml = "<h2>" + escapeHtml(newTitle) + "</h2>";

        rerenderModule(visualisation);
    };

    /**
     * Removes a tab after confirmation.
     */
    const deleteTab = (visualisation, tab) => {

        if (!confirm("Delete tab \"" + getTabTitle(tab) + "\"?")) return;

        visualisation.tabs = visualisation.tabs.filter(t => t !== tab);

        rerenderModule(visualisation);
    };

    /**
     * Gets the first data source in the visualisation collection, as the default for a new
     * visualisation inside a tab.
     */
    const getFirstAvailableDataSource = () => {

        const source = Ren.VisualisationCollection.getVisualisations()
            .find(v => v.dataSourceUri && v.visualisationTypeName !== "TabbedModule");

        return {
            dataSourceUri: source?.dataSourceUri ?? null,
            sqlFilename: source?.sqlFilename ?? null
        };
    };

    /**
     * Creates a popup visualisation linked to the given tab so that it is only visible when that
     * tab is selected.
     */
    const createVisualisationInTab = (visualisation, tab, visualisationTypeName) => {

        const { dataSourceUri, sqlFilename } = getFirstAvailableDataSource();

        Ren.VisualisationCreator.createVisualisation({
            dataSourceUri,
            sqlFilename,
            visualisationTypeName,
            isPopup: true,
            tabbedModuleTabId: tab.tabContentGuid,
            sourceVisualisation: visualisation
        });
    };

    return {
        addTab,
        renameTab,
        deleteTab,
        createVisualisationInTab,
        rerenderModule
    };
})();
