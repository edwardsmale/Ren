/**
 * Lets the user rearrange a tabbed module's tabs by dragging them.  Holding the mouse button down
 * on a tab header for half a second picks the tab up; while it is dragged the tabs are shown in the
 * order they will take if it is dropped there, and releasing the button commits that order.
 * Pressing Escape puts the tabs back where they were.
 *
 * The provisional order is shown by sliding the tab headers with translate rather than by moving
 * elements, so the tab contents (charts, grids, tab-relative popups) are only moved once, on drop.
 */
Ren.TabbedModuleTabDrag = (() => {

    const HOLD_DURATION_MS = 500;
    const HOLD_MOVE_TOLERANCE_PX = 5;

    let pendingHold = null;
    let drag = null;

    /**
     * Gets the tabs that are direct children of the given module, so a nested module's tabs are
     * left out.
     */
    const getModuleTabs = (moduleElement) =>
        Array.from(moduleElement.querySelectorAll(":scope > .ren-tabbed-module__tab"));

    /**
     * Gets the visualisation that rendered the given module element, or null for a module that
     * no visualisation owns.
     */
    const getModuleVisualisation = (moduleElement) => {

        const container = moduleElement.closest(".ren-visualisation");

        if (!container) {
            return null;
        }

        const guid = Ren.HtmlUtils.getGuidClassName(container, "ren-visualisation-");

        return guid
            ? Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid)
            : null;
    };

    const cancelPendingHold = () => {

        if (!pendingHold) return;

        clearTimeout(pendingHold.timer);
        pendingHold = null;
    };

    const getTabHeader = (tabElement) =>
        tabElement.querySelector(":scope > .ren-tabbed-module__tab-header");

    /**
     * Gets the left edge each tab would have in the given order, measured from the tabs' layout at
     * the start of the drag.  The tabs sit side by side, so each starts where the previous ends.
     */
    const getProvisionalLefts = (orderedTabs) => {

        const lefts = new Map();

        let left = drag.layouts.get(drag.originalTabs[0]).left;

        for (let index = 0; index < orderedTabs.length; index++) {

            lefts.set(orderedTabs[index], left);
            left += drag.layouts.get(orderedTabs[index]).width;
        }

        return lefts;
    };

    /**
     * Shows the given tab order by sliding each header from its own slot to its provisional one.
     * The headers' translate transition animates the move.
     */
    const applyProvisionalOrder = (orderedTabs) => {

        const lefts = getProvisionalLefts(orderedTabs);

        for (let index = 0; index < orderedTabs.length; index++) {

            const tab = orderedTabs[index];
            const offset = lefts.get(tab) - drag.layouts.get(tab).left;

            getTabHeader(tab)?.style.setProperty("--tab-drag-offset", offset + "px");
        }
    };

    const clearProvisionalOrder = (tabs) => {

        for (let index = 0; index < tabs.length; index++) {
            getTabHeader(tabs[index])?.style.removeProperty("--tab-drag-offset");
        }
    };

    const startDrag = (tabElement, moduleElement) => {

        const tabs = getModuleTabs(moduleElement);

        if (tabs.length < 2) return;

        // A tab's header is centred in it, but nested modules shift their headers sideways, so
        // record where each header's midpoint sits relative to its tab.
        const layouts = new Map();

        for (let index = 0; index < tabs.length; index++) {

            const tabRect = tabs[index].getBoundingClientRect();
            const headerRect = (getTabHeader(tabs[index]) ?? tabs[index]).getBoundingClientRect();

            layouts.set(tabs[index], {
                left: tabRect.left,
                width: tabRect.width,
                headerMidpointOffset:
                    headerRect.left + headerRect.width / 2 - tabRect.left
            });
        }

        drag = {
            tabElement,
            moduleElement,
            layouts,
            originalTabs: tabs,
            orderedTabs: tabs.slice()
        };

        tabElement.classList.add("ren-tabbed-module__tab--dragging");
        moduleElement.classList.add("ren-tabbed-module--tab-dragging");
    };

    /**
     * Moves the dragged tab to the slot under the pointer: before the first other tab whose
     * header's midpoint lies to the right of the pointer, or last if there is none.  Midpoints are
     * taken from where the tabs are heading rather than where they are mid-transition, so the
     * order does not flicker while they slide.
     */
    const updateDrag = (clientX) => {

        const lefts = getProvisionalLefts(drag.orderedTabs);
        const otherTabs = drag.orderedTabs.filter(tab => tab !== drag.tabElement);

        let targetIndex = otherTabs.length;

        for (let index = 0; index < otherTabs.length; index++) {

            const tab = otherTabs[index];
            const midpoint = lefts.get(tab) + drag.layouts.get(tab).headerMidpointOffset;

            if (clientX < midpoint) {

                targetIndex = index;
                break;
            }
        }

        if (drag.orderedTabs[targetIndex] === drag.tabElement) return;

        otherTabs.splice(targetIndex, 0, drag.tabElement);
        drag.orderedTabs = otherTabs;

        applyProvisionalOrder(drag.orderedTabs);
    };

    /**
     * Moves the tab elements into the dropped order and, for a module built from its tabs
     * settings, reorders those to match.
     */
    const commitOrder = () => {

        const { moduleElement, orderedTabs, originalTabs } = drag;

        const orderChanged = orderedTabs.some((tab, index) => tab !== originalTabs[index]);

        if (!orderChanged) return;

        const insertBeforeElement = originalTabs[originalTabs.length - 1].nextSibling;

        for (let index = 0; index < orderedTabs.length; index++) {
            moduleElement.insertBefore(orderedTabs[index], insertBeforeElement);
        }

        const visualisation = getModuleVisualisation(moduleElement);

        if (!visualisation?.tabs) return;

        const tabsByGuid = {};

        for (let index = 0; index < visualisation.tabs.length; index++) {
            tabsByGuid[visualisation.tabs[index].tabContentGuid] = visualisation.tabs[index];
        }

        const reorderedTabs = orderedTabs
            .map(tabElement => {

                const guid = tabElement
                    .querySelector(":scope > .ren-tabbed-module__tab-content")
                    ?.getAttribute("data-tab-content-guid");

                return guid ? tabsByGuid[guid] : null;
            })
            .filter(tab => !!tab);

        // Leave the settings alone unless every tab was matched, rather than drop any.
        if (reorderedTabs.length !== visualisation.tabs.length) return;

        visualisation.tabs = reorderedTabs;

        if (visualisation.clientSide) {
            Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
        }
    };

    /**
     * Swallows the click that follows releasing the mouse button, so dropping a tab does not
     * also select it.
     */
    const suppressNextClick = () => {

        const suppress = (event) => {

            event.stopPropagation();
            event.preventDefault();
            document.removeEventListener("click", suppress, true);
        };

        document.addEventListener("click", suppress, true);

        // A drop outside the header produces no click, so do not let the listener linger.
        setTimeout(() => document.removeEventListener("click", suppress, true), 0);
    };

    const endDrag = (commit) => {

        if (commit) {
            commitOrder();
        }

        clearProvisionalOrder(drag.originalTabs);

        drag.tabElement.classList.remove("ren-tabbed-module__tab--dragging");
        drag.moduleElement.classList.remove("ren-tabbed-module--tab-dragging");

        drag = null;
    };

    document.addEventListener("pointerdown", (event) => {

        if (event.button !== 0 || drag) return;

        const header = event.target.closest?.(".ren-tabbed-module__tab-header");
        const tabElement = header?.parentElement;
        const moduleElement = tabElement?.parentElement;

        if (!tabElement?.classList.contains("ren-tabbed-module__tab")) return;
        if (!moduleElement?.classList.contains("ren-tabbed-module")) return;

        cancelPendingHold();

        pendingHold = {
            startX: event.clientX,
            startY: event.clientY,
            timer: setTimeout(() => {

                pendingHold = null;
                startDrag(tabElement, moduleElement);
            }, HOLD_DURATION_MS)
        };
    });

    document.addEventListener("pointermove", (event) => {

        if (pendingHold) {

            const movedX = Math.abs(event.clientX - pendingHold.startX);
            const movedY = Math.abs(event.clientY - pendingHold.startY);

            if (movedX > HOLD_MOVE_TOLERANCE_PX || movedY > HOLD_MOVE_TOLERANCE_PX) {
                cancelPendingHold();
            }

            return;
        }

        if (!drag) return;

        event.preventDefault();
        updateDrag(event.clientX);
    });

    document.addEventListener("pointerup", () => {

        cancelPendingHold();

        if (!drag) return;

        endDrag(true);
        suppressNextClick();
    });

    document.addEventListener("pointercancel", () => {

        cancelPendingHold();

        if (drag) {
            endDrag(false);
        }
    });

    document.addEventListener("keydown", (event) => {

        if (event.key !== "Escape" || !drag) return;

        endDrag(false);
        suppressNextClick();
    });

    // A button released outside the window never reaches the document, so give up on the drag.
    window.addEventListener("blur", () => {

        cancelPendingHold();

        if (drag) {
            endDrag(false);
        }
    });

    return {};
})();
