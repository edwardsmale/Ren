/**
 * The tab ids a tabbed module exposes to the popups scoped to its tabs.
 *
 * A popup linked to a tab (a date/value chart dropped into one, say) is shown and hidden by
 * matching its tabbed-module-tab-id- class against the selected tab's data-tab-id, and a
 * tab-relative one is moved inside the tab content carrying that id.  Where that id comes from
 * depends on how the module was made: a client-side module (built in the browser and persisted)
 * uses each tab's tabContentGuid, while a server-rendered one (from a <ren-tabbed-module> in a
 * view) regenerates its guids on every load and so derives the id from the tab's header text
 * instead - see Ren.CreateTabbedModule and Ren.TabbedModules.getContainingTabIds.
 *
 * Whenever a module is written to settings that will rebuild it as the other kind, the ids it
 * exposes would change and its popups would match no tab at all.  Capturing the live ids into each
 * tab's explicit tabId settles them, so the rebuilt module keeps exposing the ids its popups were
 * saved against.
 */
Ren.TabbedModuleTabIds = (() => {

    /**
     * The live id of the tab holding the given tab content, or null.  This is the tab's own id,
     * not the id its content element carries: a tab content is stamped with the chain of ids of
     * every tab containing it (a module nested in another module's tab), and getContainingTabIds
     * rebuilds that chain from the individual tabs, so it is the individual id that a rebuilt
     * module has to reproduce.
     */
    const getLiveTabId = (contentElement) => {

        const tabElement = contentElement?.closest(".ren-tabbed-module__tab");

        return tabElement ? tabElement.getAttribute("data-tab-id") : null;
    };

    /**
     * Captures the live tab ids of a rendered tabbed module into its tabs' explicit tabId,
     * returning a new tabs array.  The tabs passed in are left untouched, so the live
     * visualisation is not mutated.  A tab whose content element cannot be found in the module
     * (it has no guid, or has not rendered) is carried over unchanged.
     */
    const captureLiveTabIds = (moduleElement, tabs) => {

        const newTabs = [];

        for (let index = 0; index < tabs.length; index++) {

            const tab = tabs[index];

            const contentElement = (moduleElement && tab.tabContentGuid)
                ? moduleElement.querySelector(
                    ".ren-tabbed-module__tab-content[data-tab-content-guid=\"" + tab.tabContentGuid + "\"]"
                )
                : null;

            const liveTabId = getLiveTabId(contentElement);

            newTabs.push(liveTabId ? Object.assign({}, tab, { tabId: liveTabId }) : tab);
        }

        return newTabs;
    };

    return {
        captureLiveTabIds
    };
})();
