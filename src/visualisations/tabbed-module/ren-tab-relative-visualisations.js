/**
 * Tab-relative visualisations.
 * A popup visualisation linked to a tabbed module tab is normally a free-floating popup in page
 * coordinates.  One with "isTabRelative": true is instead moved inside its tab's content element,
 * so that its stored position is relative to that element and it is clipped to its bounds.  This
 * is opt-in so that existing reports' page-coordinate popups are unaffected.
 *
 * Ren.PopupVisualisationPlacement decides when a window is moved in or out of its tab.
 */
Ren.TabRelativeVisualisations = (() => {

    const tabRelativeWindowClass = "ren-report-popup-window--tab-relative";
    const clippingTabContentClass = "ren-tabbed-module__tab-content--clips-tab-relative";

    // Tracks the ResizeObserver watching each popup window's tab content for fill-to-tab resizing.
    const fillObservers = new Map(); // popupWindow element -> ResizeObserver

    const disconnectFillObserver = (popupWindow) => {

        const observer = fillObservers.get(popupWindow);

        if (observer) {

            observer.disconnect();
            fillObservers.delete(popupWindow);
        }
    };

    const setupFillObserver = (visualisation, popupWindow, tabContent) => {

        disconnectFillObserver(popupWindow);

        const observer = new ResizeObserver(() => {

            if (!popupWindow.isConnected) {

                disconnectFillObserver(popupWindow);
                return;
            }

            const width = tabContent.clientWidth;
            const height = tabContent.clientHeight;

            if (width && height && visualisation.popup) {

                visualisation.popup.setWidth(width);
                visualisation.popup.setHeight(height);
                visualisation.popup.setLeftPos(0);
                visualisation.popup.setTopPos(0);
            }
        });

        observer.observe(tabContent);
        fillObservers.set(popupWindow, observer);
    };

    /**
     * Gets the popup window element a visualisation lives inside, or null if it is not in a popup.
     *
     * A popup visualisation's own window is resolved via visualisation.popup, which exists from
     * creation; visualisation.instance is only set on render, so still-loading popups would be left
     * at their page-coordinate positions until their data arrived.  The instance-based fallback
     * covers a visualisation rendered inside another's popup.
     */
    const getPopupWindow = (visualisation) => {

        const contentContainer = visualisation.popup?.contentContainer;

        if (contentContainer) {

            const popupWindow = contentContainer.closest(".ren-report-popup-window");

            if (popupWindow) return popupWindow;
        }

        const element = visualisation?.instance?.element;

        return element ? element.closest(".ren-report-popup-window") : null;
    };

    /**
     * Asks a visualisation's popup to re-measure its container and notify any scale-to-fit
     * contents.  No-ops when the popup's container has no width (e.g. its tab is not currently
     * selected).
     */
    const notifyContainerResize = (visualisation) => {

        if (visualisation.popup && visualisation.popup.notifyContainerResize) {
            visualisation.popup.notifyContainerResize();
        }
    };

    /**
     * Moves a popup window into its tab content element and applies its stored position relative to
     * that element, which works for tabs that are not currently selected too.
     */
    const attachToTabContent = (visualisation, popupWindow, tabContent) => {

        tabContent.classList.add(clippingTabContentClass);

        const wasReparented = popupWindow.parentElement !== tabContent;

        if (wasReparented) {
            tabContent.appendChild(popupWindow);
        }

        popupWindow.classList.add(tabRelativeWindowClass);

        // The stored position is relative to the tab content element. Re-apply it explicitly, since
        // the popup was first positioned (and viewport-clamped) in page coordinates while it was a
        // child of the body.
        if (Ren.StylesUtils.isDimensionSet(visualisation.popupLeft)) {
            popupWindow.style.left = Ren.StylesUtils.convertToPixels(visualisation.popupLeft) + "px";
        }

        if (Ren.StylesUtils.isDimensionSet(visualisation.popupTop)) {
            popupWindow.style.top = Ren.StylesUtils.convertToPixels(visualisation.popupTop) + "px";
        }

        // When fillTabbedModuleContentTab is set, keep the popup sized to match the tab content.
        // Set up the observer if none exists yet (first attach, or setting just enabled).
        if (visualisation.fillTabbedModuleContentTab && !fillObservers.has(popupWindow)) {
            setupFillObserver(visualisation, popupWindow, tabContent);
        }

        // Moving the popup into the tab content gives its container its final size, so scale-to-fit
        // contents are told to re-measure, once the tab's layout and selection have settled.
        if (wasReparented) {
            Ren.FnUtils.defer(() => notifyContainerResize(visualisation));
        }
    };

    /**
     * Moves a popup window out of its tab content to the page body, converting its position back to
     * page coordinates so it stays put on screen.  Gets a value indicating whether it was in one.
     */
    const detachFromTabContent = (popupWindow) => {

        if (!popupWindow.classList.contains(tabRelativeWindowClass)) return false;

        disconnectFillObserver(popupWindow);

        const rect = popupWindow.getBoundingClientRect();
        const bodyScrollPos = Ren.HtmlUtils.getBodyScrollPos();

        Ren.HtmlUtils.getBody().appendChild(popupWindow);

        popupWindow.classList.remove(tabRelativeWindowClass);

        popupWindow.style.left = (rect.left + bodyScrollPos.left) + "px";
        popupWindow.style.top = (rect.top + bodyScrollPos.top) + "px";

        return true;
    };

    /**
     * Removes the clipping class from any tab content elements that no longer host a tab-relative
     * popup, so their layout and empty-state styling revert.
     */
    const clearEmptyClippingTabContents = () => {

        const clippingTabContents = document.querySelectorAll("." + clippingTabContentClass);

        for (let index = 0; index < clippingTabContents.length; index++) {

            const tabContent = clippingTabContents[index];

            if (!tabContent.querySelector("." + tabRelativeWindowClass)) {
                tabContent.classList.remove(clippingTabContentClass);
            }
        }
    };

    /**
     * Gets a value indicating whether a visualisation belongs inside a tab's content, whether or
     * not that tab content can be found just now.
     */
    const isLinkedToTab = (visualisation) => {

        return !!(visualisation.isTabRelative && visualisation.tabbedModuleTabId);
    };

    /**
     * Resolves the tab content element a tab-relative visualisation belongs inside, or null when
     * the visualisation is not currently linked to a tab (or its tab content is not resolvable yet
     * - e.g. while a module is mid-rerender and its new tab content has not been given its
     * data-tab-id).
     */
    const findTabContentForVisualisation = (visualisation) => {

        if (!isLinkedToTab(visualisation)) return null;

        return document.querySelector(
            ".ren-tabbed-module__tab-content[data-tab-id=\"" + visualisation.tabbedModuleTabId + "\"]"
        );
    };

    /**
     * Gets a value indicating whether a tab is the one its module shows.  A module whose tabs have
     * not been set up yet has none selected, and will show its first.
     */
    const isTabShown = (tab) => {

        if (tab.classList.contains("ren-tabbed-module__tab--selected")) return true;

        const tabbedModule = tab.closest(".ren-tabbed-module");

        if (tabbedModule.querySelector(":scope > .ren-tabbed-module__tab--selected")) return false;

        return tabbedModule.querySelector(":scope > .ren-tabbed-module__tab") === tab;
    };

    /**
     * Gets a value indicating whether a visualisation is linked to a tab that is not being shown,
     * either unselected itself or inside another tab that is.  False where the tab can't be found.
     */
    const isOnUnshownTab = (visualisation) => {

        const tabId = visualisation.tabbedModuleTabId;

        if (!tabId) return false;

        const tabIdSelector = "[data-tab-id=\"" + tabId + "\"]";

        // A tab content only has its data-tab-id once its module is set up, whereas a client-side
        // module's tab has one from the start.
        const tabContent = document.querySelector(".ren-tabbed-module__tab-content" + tabIdSelector);

        let tab = tabContent ?
            tabContent.closest(".ren-tabbed-module__tab") :
            document.querySelector(".ren-tabbed-module__tab" + tabIdSelector);

        while (tab) {

            if (!isTabShown(tab)) return true;

            tab = tab.parentElement?.closest(".ren-tabbed-module__tab");
        }

        return false;
    };

    /**
     * Re-places every popup window that is, or should be, in a tab's content, as a re-rendered
     * tabbed module has new tab content elements, and hidden tabs can now be entered.
     */
    const updateTabRelativeVisualisations = () => {

        const allVisualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < allVisualisations.length; index++) {

            const visualisation = allVisualisations[index];

            // Only a popup visualisation owns its popup window.  A non-popup one inside another's
            // popup (e.g. the gridset inside a filter module) resolves to that same window, and
            // acting on it here would wrongly detach the owner's popup.
            if (!visualisation.isPopup) continue;

            const popupWindow = getPopupWindow(visualisation);

            if (!popupWindow) continue;

            if (!isLinkedToTab(visualisation) &&
                !popupWindow.classList.contains(tabRelativeWindowClass)) continue;

            Ren.PopupVisualisationPlacement.place(visualisation, popupWindow, true);
        }

        // A tab whose popup has since been closed is not re-placed above.
        clearEmptyClippingTabContents();
    };

    /**
     * Frees a visualisation from the tab it belongs to, leaving it floating over the page rather
     * than pinned inside (and resized by) that tab.
     */
    const freeVisualisationFromTab = (visualisation) => {

        if (!visualisation.tabbedModuleTabId) return;

        const popupWindow = getPopupWindow(visualisation);

        if (!popupWindow || !visualisation.popup) return;

        // A visualisation deliberately positioned inside a tab keeps its scoping, since that
        // position still means something there.  One that fills its tab has no position of its own
        // to keep, and one already floating has nothing left to do but be freed.
        const isPoppedIn = popupWindow.classList.contains("ren-report-popup-window--popped-in");

        if (isPoppedIn && !visualisation.fillTabbedModuleContentTab) return;

        // Left set, the fill observer would immediately snap the popup back to the tab content's
        // size and origin.
        visualisation.fillTabbedModuleContentTab = false;
        disconnectFillObserver(popupWindow);

        visualisation.isTabRelative = false;
        Ren.TabbedModulePopupDrop.applyTabScoping(visualisation, popupWindow, null);

        if (detachFromTabContent(popupWindow)) clearEmptyClippingTabContents();

        // detachFromTabContent leaves the popup where it was on screen; offset it from there, and
        // store the page coordinates it now uses via the popup's own setters.
        const offset = Ren.StylesUtils.convertToPixels("1rem");
        const rect = popupWindow.getBoundingClientRect();
        const bodyScrollPos = Ren.HtmlUtils.getBodyScrollPos();

        visualisation.popup.setLeftPos(rect.left + bodyScrollPos.left + offset);
        visualisation.popup.setTopPos(rect.top + bodyScrollPos.top - offset);

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    /**
     * Turns the fill-its-tab setting on or off for a visualisation linked to a tab. Switching it on
     * also makes the visualisation tab-relative, since filling only means anything inside the tab.
     */
    const setFillTabbedModuleContentTab = (visualisation, shouldFill) => {

        visualisation.fillTabbedModuleContentTab = !!shouldFill;

        if (shouldFill) {

            visualisation.isTabRelative = true;
            updateTabRelativeVisualisations();
        }
        else {

            const popupWindow = getPopupWindow(visualisation);

            if (popupWindow) disconnectFillObserver(popupWindow);
        }

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    Ren.Messages.Events.reportAddedToDom.handle(() => {

        updateTabRelativeVisualisations();
    });

    // Selecting a tab makes its tab-relative popups visible, so their containers finally have a
    // measurable size.  Ask their contents to re-measure - otherwise a date/value chart stays at
    // whatever scale it had while the tab was hidden.
    Ren.Messages.Events.tabbedModuleTabChanged.handle(() => {

        const allVisualisations = Ren.VisualisationCollection.getVisualisations();

        for (let index = 0; index < allVisualisations.length; index++) {

            const visualisation = allVisualisations[index];

            if (visualisation.isTabRelative) {
                notifyContainerResize(visualisation);
            }
        }
    });

    return {
        isLinkedToTab,
        isOnUnshownTab,
        findTabContentForVisualisation,
        attachToTabContent,
        detachFromTabContent,
        clearEmptyClippingTabContents,
        updateTabRelativeVisualisations,
        freeVisualisationFromTab,
        setFillTabbedModuleContentTab
    };
})();
