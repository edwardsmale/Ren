/**
 * Lets the user drop an existing popup visualisation into a tabbed module's tab content, so that it
 * shows and hides with that tab.
 */
Ren.TabbedModulePopupDrop = (() => {

    const dropTargetClass = "ren-tabbed-module__tab-content--drop-target";

    // How far outside a tab content the popup's corner may sit and still count as being over it.
    const dropTolerancePx = 6;

    /**
     * Gets the visualisation rendered inside the given popup window element, if any.
     */
    const getPopupVisualisation = (popupWindow) => {

        const visualisationElement = popupWindow.querySelector(".ren-visualisation");

        if (!visualisationElement) return null;

        const guid = Ren.HtmlUtils.getGuidClassName(visualisationElement, "ren-visualisation-");

        return guid
            ? Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid)
            : null;
    };

    /**
     * Gets the height of the popup window's title bar, which is zero if it has none.
     */
    const getTitleBarHeight = (popupWindow) => {

        const titleBar = popupWindow.querySelector(".ren-report-popup-window__title-bar");

        return titleBar ? titleBar.getBoundingClientRect().height : 0;
    };

    /**
     * Gets a value indicating whether a tab content is inside a popup window that can't be seen.  A
     * popup scoped to a tab that isn't selected is only made transparent, so it keeps its box, and
     * a popup dropped into it would vanish with it.
     */
    const isInHiddenPopupWindow = (tabContent) => {

        let popupWindow = tabContent.closest(".ren-report-popup-window");

        while (popupWindow) {

            if (window.getComputedStyle(popupWindow).opacity === "0") return true;

            popupWindow = popupWindow.parentElement?.closest(".ren-report-popup-window");
        }

        return false;
    };

    /**
     * Gets the tab content the popup would be dropped into, if any.  The popup's top-left corner is
     * tested rather than the mouse, and may sit above the tab content by the title bar's height so
     * that the visualisation can be placed against the tab's top edge.  Where several qualify, the
     * smallest is the innermost.
     */
    const getTabContentUnderPopup = (popupWindow) => {

        const popupRect = popupWindow.getBoundingClientRect();
        const aboveAllowance = getTitleBarHeight(popupWindow) + dropTolerancePx;

        const tabContents = document.querySelectorAll(".ren-tabbed-module__tab-content[data-tab-id]");

        let bestTabContent = null;
        let bestArea = 0;

        for (let index = 0; index < tabContents.length; index++) {

            const tabContent = tabContents[index];

            // A tab content inside the dragged popup (a popup holding its own tabbed module) is
            // part of what is being dragged, not a target for it.
            if (popupWindow.contains(tabContent)) continue;

            const rect = tabContent.getBoundingClientRect();
            const area = rect.width * rect.height;

            // An unselected tab's content is display: none, so it has no box to aim at.
            if (area === 0) continue;

            if (popupRect.left < rect.left - dropTolerancePx) continue;
            if (popupRect.left > rect.right) continue;
            if (popupRect.top < rect.top - aboveAllowance) continue;
            if (popupRect.top > rect.bottom) continue;

            if (isInHiddenPopupWindow(tabContent)) continue;

            if (!bestTabContent || area < bestArea) {

                bestTabContent = tabContent;
                bestArea = area;
            }
        }

        return bestTabContent;
    };

    const clearDropTargetHighlight = () => {

        Array.from(document.querySelectorAll("." + dropTargetClass))
            .forEach(tabContent => tabContent.classList.remove(dropTargetClass));
    };

    /**
     * Highlights the tab content a dragged popup would be dropped into, in edit mode.
     */
    const updateDropTargetHighlight = (popupWindow) => {

        clearDropTargetHighlight();

        if (!Ren.ReportEditModeModule.getIsEditMode()) return;

        if (!getPopupVisualisation(popupWindow)) return;

        const tabContent = getTabContentUnderPopup(popupWindow);

        if (tabContent) tabContent.classList.add(dropTargetClass);
    };

    /**
     * Scopes the visualisation and its popup window to the given tab ID, so the show/hide
     * stylesheet controls its visibility.  Pass a NULL tab ID to remove the scoping.
     */
    const applyTabScoping = (visualisation, popupWindow, tabId) => {

        visualisation.tabbedModuleTabId = tabId;

        const existingTabbedModuleClass =
            Ren.HtmlUtils.getClassName(popupWindow, "ren-tabbed-module-tab-id-");

        if (existingTabbedModuleClass) {
            popupWindow.classList.remove(existingTabbedModuleClass);
        }

        if (tabId) {
            popupWindow.classList.add("ren-tabbed-module-tab-id-" + tabId);
        }
    };

    /**
     * Makes a tab-relative visualisation's position relative to the specified tab content element,
     * instead of relative to the page, while preserving its on-screen position.
     */
    const makePositionRelativeToTabContent = (visualisation, popupWindow, tabContent) => {

        const popupRect = popupWindow.getBoundingClientRect();
        const tabContentRect = tabContent.getBoundingClientRect();

        const relativeLeft =
            Math.max(popupRect.left - tabContentRect.left - tabContent.clientLeft, 0);

        const relativeTop = Math.max(popupRect.top - tabContentRect.top - tabContent.clientTop, 0);

        visualisation.popupLeft = Math.round(relativeLeft);
        visualisation.popupTop = Math.round(relativeTop);
        visualisation.visualisationLeft = visualisation.popupLeft;
        visualisation.visualisationTop = visualisation.popupTop;
    };

    /**
     * Gets the page-level popups that are scoped (via their tabbed-module-tab-id class) to a tab
     * inside the given popup window.
     */
    const getPagePopupsScopedToModule = (moduleWindow) => {

        const tabContents = moduleWindow.querySelectorAll(
            ".ren-tabbed-module__tab-content[data-tab-id]"
        );

        const tabIds = [];

        for (let index = 0; index < tabContents.length; index++) {

            const tabId = tabContents[index].getAttribute("data-tab-id");

            if (tabId && tabIds.indexOf(tabId) === -1) tabIds.push(tabId);
        }

        const scopedPopups = [];

        if (tabIds.length === 0) return scopedPopups;

        const allPopups = document.querySelectorAll(
            ".ren-report-popup-window[class*=\"ren-tabbed-module-tab-id-\"]"
        );

        for (let index = 0; index < allPopups.length; index++) {

            const popup = allPopups[index];

            // A popup nested inside the module already moves and stacks with it, so skip it.
            if (moduleWindow.contains(popup)) continue;

            for (let tabIndex = 0; tabIndex < tabIds.length; tabIndex++) {

                if (popup.classList.contains("ren-tabbed-module-tab-id-" + tabIds[tabIndex])) {

                    scopedPopups.push(popup);
                    break;
                }
            }
        }

        return scopedPopups;
    };

    /**
     * Scopes a dropped popup's visualisation to the tab it lands in, if any, in edit mode.
     */
    const dropPopup = (popupWindow) => {

        clearDropTargetHighlight();

        if (!Ren.ReportEditModeModule.getIsEditMode()) return;

        const visualisation = getPopupVisualisation(popupWindow);

        if (!visualisation) return;

        // A dragged tabbed module would resolve to a nested child popup, which the un-scoping below
        // would eject from its tab; its nested children already move with it.
        if (popupWindow.querySelector(".ren-tabbed-module__tab-content")) return;

        const tabContent = getTabContentUnderPopup(popupWindow);

        // The cleaned, possibly nested tab ID chain the show/hide stylesheet matches on.
        const tabId = tabContent ? tabContent.getAttribute("data-tab-id") : null;

        if (tabContent) {

            // A tab-relative popup is nested inside the tab content, so its position is converted
            // first or it would jump down by the tab's page offset once reparented.
            makePositionRelativeToTabContent(visualisation, popupWindow, tabContent);
            visualisation.isTabRelative = true;
        }
        else {

            visualisation.isTabRelative = false;
        }

        applyTabScoping(visualisation, popupWindow, tabId || null);

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        Ren.Messages.Events.reportAddedToDom.notify();
    };

    return {
        applyTabScoping,
        updateDropTargetHighlight,
        dropPopup,
        getPagePopupsScopedToModule
    };
})();
