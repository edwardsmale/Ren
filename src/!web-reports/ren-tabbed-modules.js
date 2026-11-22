/**
 * Sets up the tabbed modules on the page.
 */
Ren.TabbedModules = (() => {

    const initialise = () => {

        const showHidePopupsStylesheet = Ren.DynamicStylesheets
            .setupDynamicStylesheet("tabbed-modules", "tabbed-modules-show-hide-popups")
            .getStylesheet();

        const updateTabbedModuleStylesheet = () => {

            // For each selected tab, show the popups associated with that tab, and hide the others.
            const selectedTabIds = Array.from(document.querySelectorAll(".ren-tabbed-module__tab--selected"))
                .filter(tab => tab.clientWidth)
                .map(tab => getContainingTabIds(tab))
                .filter(tabId => !!tabId);

            const styles = [];

            // Hide all popups associated with any tab.
            styles.push(`.ren-report-popup-window[class*="ren-tabbed-module-tab-id-"] { opacity: 0; pointer-events: none }`);

            // Show popups associated with the selected tab.  Popups that are not scoped to any tab
            // have no tabbed-module-tab-id- class, so the hide rule above never matches them and
            // they stay visible without needing a rule here.
            selectedTabIds.forEach(tabId => {

                styles.push(`.ren-report-popup-window.ren-tabbed-module-tab-id-${tabId} { opacity: 1; pointer-events: all }`);
            });

            showHidePopupsStylesheet.textContent = styles.join("\n");
        };

        /**
         * Sets up any new tabbed modules that have been added to the DOM.
         */
        const setupNewTabbedModules = () => {

            /**
             * For each tab header, set up the click handler to switch tabs, make sure the
             * associated tab content element has a data-tab-id attribute, and mark the tab header
             * as done.
             */
            Array.from(document.querySelectorAll(".ren-tabbed-module__tab-header"))
                .filter(tabHeader => !tabHeader.getAttribute("data-tabbed-module-done"))
                .forEach(tabHeader => {

                    // Set up the click handler to switch tabs.
                    tabHeader.addEventListener("click", function () {

                        const tab = this.closest(".ren-tabbed-module__tab");
                        const tabs = tab.closest(".ren-tabbed-module").querySelectorAll(":scope > .ren-tabbed-module__tab");

                        // Select this tab and deselect its siblings in the same module.
                        tabs.forEach(t => t.classList.toggle("ren-tabbed-module__tab--selected", t === tab));

                        updateTabbedModuleStylesheet();
                        Ren.Messages.Events.tabbedModuleTabChanged.notify();
                    });

                    const kebabHeaderText = Ren.TextUtils.convertToKebabCase(
                        Ren.TextUtils.cleanForCssClassName(tabHeader.textContent.trim())
                    );

                    tabHeader.classList.add("qa-ren-tabbed-module-tab-header-" + kebabHeaderText);

                    tabHeader.setAttribute("data-tabbed-module-done", "true");

                    // Make sure the associated tab content element has a data-tab-id attribute.
                    // This is needed to support hiding popup visualisations based on tab selection.
                    // The content element may not be rendered yet (e.g. when
                    // ren-tabbed-module-tab-header fires reportAddedToDom before
                    // ren-tabbed-module-content has rendered); in that case skip it here and let
                    // the next reportAddedToDom cycle complete the setup.
                    const tabContent = tabHeader.parentElement.querySelector(".ren-tabbed-module__tab-content");

                    if (!tabContent) return;

                    const containingTabIds = getContainingTabIds(tabContent);

                    tabContent.setAttribute("data-tab-id", containingTabIds);
                });

            /**
             * For each tabbed module, if no tab is currently selected, select the first one.
             * Then mark the tabbed module as done.
             */
            Array.from(document.querySelectorAll(".ren-tabbed-module"))
                .filter(tabbedModule => !tabbedModule.getAttribute("data-tabbed-module-done"))
                .forEach(tabbedModule => {

                    const firstTab = tabbedModule.querySelector(".ren-tabbed-module__tab");

                    if (!firstTab) return;

                    if (tabbedModule.querySelectorAll(".ren-tabbed-module__tab--selected").length === 0) {
                        firstTab.classList.add("ren-tabbed-module__tab--selected");
                    }

                    tabbedModule.setAttribute("data-tabbed-module-done", "true");
                });
        };

        /**
         * Recursively find all tabs that contain the given element and concatenate their tab IDs to
         * get a unique tab ID for the tab.  Returns a concatenated string of tab IDs.
         */
        const getContainingTabIds = (tabContentElement) => {

            const tabIds = [];

            let currentElement = tabContentElement;

            while (currentElement) {

                const tab = currentElement.closest(".ren-tabbed-module__tab");

                if (!tab) break;

                let tabId = tab.getAttribute("data-tab-id");

                if (!tabId) {

                    // Find the tab header within this tab and use its text.
                    const tabHeader = tab.querySelector(".ren-tabbed-module__tab-header");

                    tabId = tabHeader ? tabHeader.textContent.trim() : "NULL";
                }

                // The tab ID must be suitable for use as a CSS class name, as this is how we
                // hide/show the visualisations based on tab selection.
                tabId = Ren.TextUtils.cleanForCssClassName(tabId);

                tab.setAttribute("data-tab-id", tabId);

                tabIds.unshift(tabId);

                // Find the parent ren-tabbed-module__tab-content, then its parent tab.
                currentElement = tab.parentElement?.closest(".ren-tabbed-module__tab-content");
            }

            return tabIds.join("_-_");
        };

        Ren.Messages.Events.reportAddedToDom.handle(() => {

            setupNewTabbedModules();

            Ren.TabRelativeVisualisations.updateTabRelativeVisualisations();

            updateTabbedModuleStylesheet();
        });
    };

    Ren.Messages.Events.pageLoaded.handle(() => {

        initialise();
    });
})();
