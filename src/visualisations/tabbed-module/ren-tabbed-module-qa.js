/**
 * QA helpers for driving and inspecting client-side tabbed modules from integration tests.
 * Tabbed module behaviour - a module in a popup, with visualisations scoped to a tab, moved with
 * the module, clipped to it, and dragged in and out - is awkward to set up and assert against
 * purely from the DOM. The modules and popups are created through the same Ren.VisualisationCreator
 * path the context menu uses, and each popup's scoping, tab-relative state, clipping and visibility
 * reported alongside the geometry a real mouse drag needs.
 *
 * Everything here operates on the whole document, since popup windows are appended to the body and
 * so live outside the report's scoped container.
 */
Ren.QA.TabbedModule = (() => {

    /**
     * Gets the popup window element hosting the visualisation with the given guid, or null.
     */
    const getPopupWindowForGuid = (visualisationGuid) => {

        const element = document.querySelector("." + visualisationGuid);

        return element ? element.closest(".ren-report-popup-window") : null;
    };

    /**
     * Gets the integer viewport coordinates of the centre of an element, as an [x, y] pair.
     */
    const getCentreXY = (element) => {

        const rect = element.getBoundingClientRect();

        return [
            Math.round(rect.left + rect.width / 2),
            Math.round(rect.top + rect.height / 2)
        ];
    };

    /**
     * Gets the first available data source (uri and sql filename) from the existing visualisations,
     * so a draggable grid popup can be bound to the same data as the report's grid.  Mirrors the
     * lookup in Ren.TabbedModuleEditor.createVisualisationInTab.
     */
    const getFirstDataSource = () => {

        const source = Ren.VisualisationCollection.getVisualisations()
            .find(v => v.dataSourceUri && v.visualisationTypeName !== "TabbedModule");

        return {
            dataSourceUri: source ? source.dataSourceUri : null,
            sqlFilename: source ? source.sqlFilename : null
        };
    };

    /**
     * Creates a client-side tabbed module inside a popup at the given page position, with the given
     * number of tabs, as the report-wide "Create > Tabbed Module" context menu item does.  With a
     * tabId the module itself is scoped to that tab, and so shows and hides with it.  Returns the
     * module's visualisation guid and the tab content guids, which are the stable tab ids popups
     * are scoped to.
     */
    const createClientSideModule = (left, top, tabCount, tabId) => {

        tabCount = tabCount || 1;

        const tabs = [];

        for (let index = 0; index < tabCount; index++) {

            tabs.push({
                headerHtml: "<h2>Tab " + (index + 1) + "</h2>",
                contentHtml: "",
                tabContentGuid: Ren.RandomUtils.generateRandomClassName("tab-content")
            });
        }

        const options = {
            visualisationTypeName: "TabbedModule",
            title: "Tabbed Module",
            isPopup: true,
            fillAvailableSpace: true,
            clientSide: true,
            popupLeft: left + "px",
            popupTop: top + "px",
            popupWidth: "400px",
            popupHeight: "300px",
            tabs
        };

        if (tabId) {
            options.tabbedModuleTabId = tabId;
        }

        const visualisation = Ren.VisualisationCreator.createVisualisation(options);

        const tabIds = [];

        for (let index = 0; index < tabs.length; index++) {
            tabIds.push(tabs[index].tabContentGuid);
        }

        return {
            visualisationGuid: visualisation.visualisationGuid,
            tabIds
        };
    };

    /**
     * Creates a draggable grid popup at the given page position, bound to the report's data source.
     * With a tabId it is scoped to that tab, and so shows and hides with it; without one it is
     * free-floating.  Returns the visualisation guid.
     */
    const createPopupGrid = (left, top, tabId) => {

        const dataSource = getFirstDataSource();

        const options = {
            dataSourceUri: dataSource.dataSourceUri,
            sqlFilename: dataSource.sqlFilename,
            visualisationTypeName: "GridSet",
            isPopup: true,
            clientSide: true,
            popupLeft: left + "px",
            popupTop: top + "px",
            popupWidth: "200px",
            popupHeight: "150px"
        };

        if (tabId) {
            options.tabbedModuleTabId = tabId;
        }

        const visualisation = Ren.VisualisationCreator.createVisualisation(options);

        return {
            visualisationGuid: visualisation.visualisationGuid
        };
    };

    /**
     * Selects the tab at the given index in the module by clicking its header, exercising the same
     * show/hide path the user would.  Returns true if the tab was found.
     */
    const selectTab = (moduleVisualisationGuid, tabIndex) => {

        const popupWindow = getPopupWindowForGuid(moduleVisualisationGuid);

        if (!popupWindow) return false;

        const tabs = popupWindow.querySelectorAll(".ren-tabbed-module > .ren-tabbed-module__tab");
        const tab = tabs[tabIndex];

        if (!tab) return false;

        const header = tab.querySelector(".ren-tabbed-module__tab-header");

        if (!header) return false;

        header.click();

        return true;
    };

    /**
     * Dispatches a mouse event of the given type to the target element, carrying the given viewport
     * coordinates.  The popup title-bar drag handler reads clientX / clientY, so they must be set
     * explicitly.
     */
    const dispatchMouseEvent = (target, type, x, y) => {

        target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons: type === "mouseup" ? 0 : 1,
            clientX: x,
            clientY: y
        }));
    };

    /**
     * Carries out a drag of a popup window by dispatching the same mousedown / mousemove / mouseup
     * sequence the production title-bar drag handler listens for, grabbing the window by the centre
     * of its drag handle and moving it to (toX, toY) in two steps.  Events are dispatched directly
     * to the drag handle and the document rather than driven by the real mouse, so the drag is not
     * affected by which element happens to be topmost at the coordinates: the handle is invisible
     * and absolutely positioned, so a real press can fall through to whatever is painted beneath
     * it.
     */
    const dragPopupWindow = (popupWindow, toX, toY) => {

        const handle = popupWindow.querySelector(".ren-report-popup-window__title-bar-drag-handle");

        if (!handle) return false;

        const centre = getCentreXY(handle);
        const fromX = centre[0];
        const fromY = centre[1];

        const midX = Math.round((fromX + toX) / 2);
        const midY = Math.round((fromY + toY) / 2);

        dispatchMouseEvent(handle, "mousedown", fromX, fromY);
        dispatchMouseEvent(document, "mousemove", midX, midY);
        dispatchMouseEvent(document, "mousemove", toX, toY);
        dispatchMouseEvent(document, "mouseup", toX, toY);

        return true;
    };

    /**
     * Drags a popup window so that its top-left corner ends up at the given viewport coordinates.
     * The mouse is held at the centre of the title bar's drag handle, so it has to be aimed at the
     * corner position offset by that grab point - otherwise the popup lands up and to the left of
     * where it is wanted by half its width.  The corner is what dropPopup hit-tests, not the mouse.
     */
    const dragPopupCornerTo = (popupWindow, cornerX, cornerY) => {

        const handle = popupWindow.querySelector(".ren-report-popup-window__title-bar-drag-handle");

        if (!handle) return false;

        const popupRect = popupWindow.getBoundingClientRect();
        const centre = getCentreXY(handle);

        return dragPopupWindow(
            popupWindow,
            Math.round(cornerX + centre[0] - popupRect.left),
            Math.round(cornerY + centre[1] - popupRect.top)
        );
    };

    /**
     * Drags the popup hosting the given visualisation to the given viewport coordinates (e.g. an
     * empty area, to drag it out of a tab).  Returns true if the popup was found.
     */
    const dragPopupToPoint = (visualisationGuid, toX, toY) => {

        const popupWindow = getPopupWindowForGuid(visualisationGuid);

        if (!popupWindow) return false;

        return dragPopupWindow(popupWindow, toX, toY);
    };

    // How far inside the tab content's top-left corner a popup is dropped, so the drop is not
    // decided on the pixel where the tab content's border sits.
    const dropInsetPx = 10;

    /**
     * Drags the popup hosting the given visualisation onto the currently-selected tab content of
     * the given module, so its visualisation becomes scoped to (and nested in) that tab.  The
     * popup's top-left corner is put just inside the tab content's own, which is where a popup
     * wider or taller than the tab has to land to count as being over it.  Returns true if both the
     * popup and the tab content were found.
     */
    const dragPopupToTabContent = (popupGuid, moduleVisualisationGuid) => {

        const popupWindow = getPopupWindowForGuid(popupGuid);
        const modulePopupWindow = getPopupWindowForGuid(moduleVisualisationGuid);

        if (!popupWindow || !modulePopupWindow) return false;

        const tabContent = modulePopupWindow.querySelector(
            ".ren-tabbed-module__tab--selected > .ren-tabbed-module__tab-content"
        );

        if (!tabContent) return false;

        const tabContentRect = tabContent.getBoundingClientRect();

        return dragPopupCornerTo(
            popupWindow,
            tabContentRect.left + dropInsetPx,
            tabContentRect.top + dropInsetPx
        );
    };

    /**
     * Drags the module's popup by the given delta, to test that scoped / nested visualisations move
     * with it.  Returns true if the module's popup was found.
     */
    const dragPopupByDelta = (moduleVisualisationGuid, dx, dy) => {

        const popupWindow = getPopupWindowForGuid(moduleVisualisationGuid);

        if (!popupWindow) return false;

        const handle = popupWindow.querySelector(".ren-report-popup-window__title-bar-drag-handle");

        if (!handle) return false;

        const centre = getCentreXY(handle);

        return dragPopupWindow(popupWindow, centre[0] + dx, centre[1] + dy);
    };

    /**
     * Runs an editor action that would normally prompt the user, with window.prompt and
     * window.confirm temporarily stubbed to supply the given answers.  promptAnswer is returned
     * from prompt(); confirm() always returns true.
     */
    const withStubbedDialogs = (promptAnswer, action) => {

        const originalPrompt = window.prompt;
        const originalConfirm = window.confirm;

        window.prompt = () => promptAnswer;
        window.confirm = () => true;

        try {

            action();
        } finally {

            window.prompt = originalPrompt;
            window.confirm = originalConfirm;
        }
    };

    /**
     * Adds a tab with the given title to the module, via the real editor add-tab path. Returns true
     * if the module was found.
     */
    const addTabToModule = (moduleVisualisationGuid, title) => {

        const visualisation =
            Ren.VisualisationCollection.getVisualisationByVisualisationGuid(moduleVisualisationGuid);

        if (!visualisation) return false;

        withStubbedDialogs(title, () => Ren.TabbedModuleEditor.addTab(visualisation));

        return true;
    };

    /**
     * Renames the tab at the given index to the given title, via the real editor rename path.
     * Returns true if the module and tab were found.
     */
    const renameModuleTab = (moduleVisualisationGuid, tabIndex, newTitle) => {

        const visualisation =
            Ren.VisualisationCollection.getVisualisationByVisualisationGuid(moduleVisualisationGuid);

        if (!visualisation || !visualisation.tabs || !visualisation.tabs[tabIndex]) return false;

        withStubbedDialogs(
            newTitle,
            () => Ren.TabbedModuleEditor.renameTab(visualisation, visualisation.tabs[tabIndex])
        );

        return true;
    };

    /**
     * Deletes the tab at the given index, via the real editor delete path (its confirm is
     * accepted).  Returns true if the module and tab were found.
     */
    const deleteModuleTab = (moduleVisualisationGuid, tabIndex) => {

        const visualisation =
            Ren.VisualisationCollection.getVisualisationByVisualisationGuid(moduleVisualisationGuid);

        if (!visualisation || !visualisation.tabs || !visualisation.tabs[tabIndex]) return false;

        withStubbedDialogs(
            null,
            () => Ren.TabbedModuleEditor.deleteTab(visualisation, visualisation.tabs[tabIndex])
        );

        return true;
    };

    /**
     * Gets the module's tab state: the tab count, each tab's header text and stable tab id (its
     * tabContentGuid), and the index of the currently-selected tab.  Header texts are read from the
     * rendered DOM so they reflect what the user sees after a rerender.
     */
    const getModuleTabInfo = (moduleVisualisationGuid) => {

        const visualisation =
            Ren.VisualisationCollection.getVisualisationByVisualisationGuid(moduleVisualisationGuid);
        const popupWindow = getPopupWindowForGuid(moduleVisualisationGuid);

        if (!visualisation || !popupWindow) {
            return { exists: false };
        }

        const tabElements = popupWindow.querySelectorAll(
            ".ren-tabbed-module > .ren-tabbed-module__tab"
        );

        const headers = [];
        let selectedIndex = -1;

        for (let index = 0; index < tabElements.length; index++) {

            const tabElement = tabElements[index];
            const header = tabElement.querySelector(".ren-tabbed-module__tab-header");

            headers.push(header ? header.textContent.trim() : "");

            if (tabElement.classList.contains("ren-tabbed-module__tab--selected")) {
                selectedIndex = index;
            }
        }

        const tabIds = [];

        for (let index = 0; index < (visualisation.tabs ?? []).length; index++) {
            tabIds.push(visualisation.tabs[index].tabContentGuid);
        }

        return {
            exists: true,
            tabCount: tabElements.length,
            headers,
            tabIds,
            selectedIndex
        };
    };

    /**
     * Builds an information object describing a popup window: its tab scoping, tab-relative state,
     * where it is parented, whether it is clipped to a tab content, the height of the tab content
     * clipping it, its computed opacity (the show/hide mechanism), and its viewport rectangle.
     */
    const buildPopupInfo = (visualisation, popupWindow) => {

        const parent = popupWindow.parentElement;

        const clippingTabContent = parent
            ? parent.closest(".ren-tabbed-module__tab-content--clips-tab-relative")
            : null;

        const rect = popupWindow.getBoundingClientRect();

        return {
            exists: true,
            tabbedModuleTabId: visualisation.tabbedModuleTabId || null,
            isTabRelative: !!visualisation.isTabRelative,
            parentIsTabContent: !!(parent &&
                parent.classList.contains("ren-tabbed-module__tab-content")),
            isNestedInTabContent: !!popupWindow.closest(".ren-tabbed-module__tab-content"),
            isClipped: !!(clippingTabContent &&
                window.getComputedStyle(clippingTabContent).overflow === "hidden"),
            clippingTabContentHeight: clippingTabContent
                ? Math.round(clippingTabContent.getBoundingClientRect().height)
                : 0,
            opacity: parseFloat(window.getComputedStyle(popupWindow).opacity),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    };

    /**
     * Gets the information object for the popup hosting the given visualisation guid, or an object
     * with exists: false where no such popup is present.
     */
    const getPopupInfo = (visualisationGuid) => {

        const visualisation =
            Ren.VisualisationCollection.getVisualisationByVisualisationGuid(visualisationGuid);
        const popupWindow = getPopupWindowForGuid(visualisationGuid);

        if (!visualisation || !popupWindow) {
            return { exists: false };
        }

        return buildPopupInfo(visualisation, popupWindow);
    };

    /**
     * Gets the information object for the first popup scoped to the given tab id, which is how a
     * popup is identified after a page reload, its visualisation guid no longer applying.
     */
    const getScopedPopupInfo = (tabId) => {

        const popupWindow = document.querySelector(
            ".ren-report-popup-window.ren-tabbed-module-tab-id-" + tabId
        );

        if (!popupWindow) {
            return { exists: false };
        }

        const visualisationElement = popupWindow.querySelector(".ren-visualisation");
        const guid = visualisationElement
            ? Ren.HtmlUtils.getGuidClassName(visualisationElement, "ren-visualisation-")
            : null;
        const visualisation = guid
            ? Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid)
            : null;

        if (!visualisation) {
            return { exists: false };
        }

        return buildPopupInfo(visualisation, popupWindow);
    };

    return {
        createClientSideModule,
        createPopupGrid,
        selectTab,
        dragPopupToPoint,
        dragPopupToTabContent,
        dragPopupByDelta,
        addTabToModule,
        renameModuleTab,
        deleteModuleTab,
        getModuleTabInfo,
        getPopupInfo,
        getScopedPopupInfo
    };
})();
