/**
 * Sets up the context menu that appears when the user right-clicks the page background, or the
 * background of a tabbed module tab content container.
 */
Ren.ReportWideContextMenu = (() => {

    const menuItems = Ren.ContextMenuItems_Windows().getMenuItems();

    Ren.Messages.Events.pageLoaded.handle(() => {

        const body = document.querySelector("html > body");
        const contextMenu = Ren.SetUpContextMenu();

        // What was right-clicked.  Read through a function because these items are contributed once
        // and consulted on every right-click.
        const rightClickTarget = () => Ren.LastRightClickTarget;

        const findVisualisationForElement = (element) => {

            const container = element?.closest(".ren-visualisation");

            if (!container) return null;

            const guid = Ren.HtmlUtils.getGuidClassName(container, "ren-visualisation-");

            return guid
                ? Ren.VisualisationCollection.getVisualisationByVisualisationGuid(guid)
                : null;
        };

        const getTabbedModuleVisualisation = () =>
            findVisualisationForElement(rightClickTarget()?.closest(".ren-tabbed-module"));

        const getClickedTab = (vis) => {

            const tabElement = rightClickTarget()?.closest(".ren-tabbed-module__tab");

            if (!tabElement || !vis?.tabs) return null;

            const guid = tabElement
                .querySelector(".ren-tabbed-module__tab-content")
                ?.getAttribute("data-tab-content-guid");

            return vis.tabs.find(t => t.tabContentGuid === guid) ?? null;
        };

        const isInsideClientSideTabbedModule = () => {

            const vis = getTabbedModuleVisualisation();
            return !!(vis?.clientSide);
        };

        const getNearestVisualisationElement = () =>
            rightClickTarget()?.closest(".ren-visualisation");

        /**
         * Gets a value indicating whether the right-click was on the page background, as opposed to
         * on a visualisation or other element that contributes context menu items.
         */
        const isPageBackgroundClick = () => {

            const contributingElements =
                Ren.ContextMenuRegistry.getRightClickContributingElements();

            return contributingElements.length === 1 && contributingElements[0] === body;
        };

        /**
         * Gets a value indicating whether the right-click was on the page background or on a tabbed
         * module's tab background, as opposed to on a visualisation or other element that
         * contributes context menu items.
         */
        const isPageOrTabBackgroundClick = () => {

            const visualisationElement = getNearestVisualisationElement();

            if (!visualisationElement) return true;

            return visualisationElement.contains(rightClickTarget()?.closest(".ren-tabbed-module"));
        };

        // --- Standard windows items ---

        contextMenu.addMenuItems(body, menuItems);

        // --- Close popup ---

        const getContainingPopupWindow = () => rightClickTarget()?.closest(".ren-report-popup-window");

        // The visualisation whose own popup window the click landed in.  Resolved by matching the
        // window rather than by walking up to the nearest .ren-visualisation, so a click on a
        // visualisation rendered inside another's popup (e.g. the grid inside a filter module)
        // still answers with the popup's owner - the one whose settings position and size it.
        const getPopupWindowVisualisation = () => {

            const popupWindow = getContainingPopupWindow();

            if (!popupWindow) return null;

            const allVisualisations = Ren.VisualisationCollection.getVisualisations();

            for (let index = 0; index < allVisualisations.length; index++) {

                const visualisation = allVisualisations[index];

                if (!visualisation.isPopup) continue;

                const contentContainer = visualisation.popup?.contentContainer;

                if (contentContainer?.closest(".ren-report-popup-window") === popupWindow) {
                    return visualisation;
                }
            }

            return null;
        };

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: () => {

                const popupWindow = getContainingPopupWindow();

                return popupWindow?.classList.contains("ren-report-popup-window--popped-in")
                    ? "Remove visualisation"
                    : "Close popup";
            },
            visible: () => {

                const popupWindow = getContainingPopupWindow();

                if (!popupWindow) return false;

                // Shift on the right-click offers it outside Edit Mode too.
                return Ren.ReportEditModeModule.getIsEditModeFor(popupWindow)
                    || Ren.ContextMenuRenderer.getIsTechMode();
            },
            action: () => {

                const popupWindow = getContainingPopupWindow();

                if (!popupWindow) return;

                const closeButton = popupWindow.querySelector(".ren-report-popup-window__close-button");

                if (closeButton) closeButton.click();
            }
        }]);

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: "Convert to popup",

            // Offered for a popped-in visualisation, and for any popup belonging to a tab: one that
            // was popped out and dragged back into a tab is a floating popup already, but the
            // conversion still has its tab association to free it from.
            visible: () => {

                const popupWindow = getContainingPopupWindow();

                if (!popupWindow) return false;

                return popupWindow.classList.contains("ren-report-popup-window--popped-in")
                    || !!getPopupWindowVisualisation()?.tabbedModuleTabId;
            },
            action: () => {

                const popupWindow = getContainingPopupWindow();

                if (!popupWindow) return;

                const convertButton =
                    popupWindow.querySelector(".ren-visualisation__convert-to-popup-button");

                if (convertButton) convertButton.click();
            }
        }]);

        // --- Scale content to fit ---

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: "Scale content to fit",
            ticked: () => !!getPopupWindowVisualisation()?.scalePopupContentToFit,
            visible: () => !!getPopupWindowVisualisation()?.popup,
            action: () => {

                const visualisation = getPopupWindowVisualisation();

                if (!visualisation?.popup) return;

                visualisation.scalePopupContentToFit = !visualisation.scalePopupContentToFit;
                visualisation.popup.setScaleContentToFit(visualisation.scalePopupContentToFit);

                Ren.VisualisationSettingsSynchroniser.commitChange(visualisation);
            }
        }]);

        // --- Fill tab ---

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: "Fill tab",
            ticked: () => !!getPopupWindowVisualisation()?.fillTabbedModuleContentTab,
            visible: () => !!getPopupWindowVisualisation()?.tabbedModuleTabId,
            action: () => {

                const visualisation = getPopupWindowVisualisation();

                if (!visualisation) return;

                Ren.TabRelativeVisualisations.setFillTabbedModuleContentTab(
                    visualisation,
                    !visualisation.fillTabbedModuleContentTab
                );
            }
        }]);

        // --- Raise report ---

        // A setting of the report as a whole, so offered only where nothing more specific was
        // clicked: the page background, a visualisation's root element, or a blank area of a tab.
        const isRaiseReportClickTarget = () => {

            const classList = rightClickTarget()?.classList;

            return !!classList && (classList.contains("ren-visualisation")
                || classList.contains("ren-tabbed-module__tab-content"));
        };

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: "Raise report",
            visible: () => isPageBackgroundClick() || isRaiseReportClickTarget(),
            ticked: () => !!Ren.GlobalReportSettingsCollection.getAllGlobalSettings().raiseReport,
            action: () => Ren.GlobalReportSettingsCollection.toggleRaiseReport()
        }]);

        // --- Show report header ---

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: "Show report header",
            visible: () => isPageBackgroundClick() || isRaiseReportClickTarget(),
            ticked: () => Ren.GlobalReportSettingsCollection.getShowReportHeader(),
            action: () => Ren.GlobalReportSettingsCollection.toggleShowReportHeader()
        }]);

        // --- Convert to settings-only report ---

        contextMenu.addMenuItems(body, [{
            section: "Other",
            text: "Convert to settings-only report",
            techOnly: true,
            visible: () => (isPageBackgroundClick() || isRaiseReportClickTarget()) &&
                Ren.ConvertToSettingsOnlyReport.canConvert(),
            action: () => Ren.ConvertToSettingsOnlyReport.convert()
        }]);

        // --- Create > Tabbed Module / Filter Module ---

        // A Filter Module always drives a source data grid's filter, so the report-wide item only
        // offers it when the report context containing the click (the page itself, or the specific
        // embedded report/popup the click landed in) contains exactly one currently visible grid
        // (GridSet).
        const getOnlyGridSetVisualisation = () => {

            const clickedReportContextGuid = Ren.HtmlUtils
                .getContainingReportContext(rightClickTarget())
                ?.getAttribute("data-report-context-guid");

            const gridSets = Ren.VisualisationCollection.getVisualisations("GridSet")
                .filter(vis => vis.containingReportGuid === clickedReportContextGuid
                    && Ren.HtmlUtils.isElementVisible(vis.element));

            return gridSets.length === 1 ? gridSets[0] : null;
        };

        contextMenu.addMenuItems(body, [{
            section: "Create",
            text: "Create",
            visible: isPageOrTabBackgroundClick,
            submenu: [{
                text: "Tabbed Module",
                action: () => {

                    // If the right-click was inside another module's tab content, scope the new
                    // popup to that containing tab so it only appears when the tab is selected.
                    const containingTabContent =
                        rightClickTarget()?.closest(".ren-tabbed-module__tab-content");

                    const containingTabId =
                        containingTabContent?.getAttribute("data-tab-id") ?? null;

                    const clickPosition = Ren.LastRightClickPosition;

                    Ren.VisualisationCreator.createVisualisation({
                        visualisationTypeName: "TabbedModule",
                        title: "Tabbed Module",
                        isPopup: true,
                        fillAvailableSpace: true,
                        clientSide: true,
                        tabbedModuleTabId: containingTabId,
                        popupLeft: clickPosition ? clickPosition.x : null,
                        popupTop: clickPosition ? clickPosition.y : null,
                        tabs: [{
                            headerHtml: "<h2>Tab 1</h2>",
                            contentHtml: "",
                            tabContentGuid: Ren.RandomUtils.generateRandomClassName("tab-content")
                        }]
                    });
                }
            },
            {
                text: "Filter Module",
                visible: () => !!getOnlyGridSetVisualisation(),
                action: () => {

                    const gridSetVisualisation = getOnlyGridSetVisualisation();

                    if (!gridSetVisualisation) return;

                    Ren.CreateFilterModuleCreator.createFilterModule(gridSetVisualisation);
                }
            }]
        }]);

        // --- Tabbed module structural editing (client-side modules only) ---

        contextMenu.addMenuItems(body, [
            {
                section: "Tabbed Module",
                text: "Add Tab",
                visible: () => isPageOrTabBackgroundClick() && isInsideClientSideTabbedModule(),
                action: () => {

                    const vis = getTabbedModuleVisualisation();

                    if (vis) Ren.TabbedModuleEditor.addTab(vis);
                }
            }
        ]);

        contextMenu.addMenuItems(body, [
            {
                section: "Tab",
                text: "Rename Tab",
                visible: () => isInsideClientSideTabbedModule() &&
                    !!rightClickTarget()?.closest(".ren-tabbed-module__tab-header"),
                action: () => {

                    const vis = getTabbedModuleVisualisation();
                    const tab = getClickedTab(vis);

                    if (vis && tab) Ren.TabbedModuleEditor.renameTab(vis, tab);
                }
            },
            {
                section: "Tab",
                text: "Delete Tab",
                visible: () => isInsideClientSideTabbedModule() &&
                    !!rightClickTarget()?.closest(".ren-tabbed-module__tab-header"),
                action: () => {

                    const vis = getTabbedModuleVisualisation();
                    const tab = getClickedTab(vis);

                    if (vis && tab) Ren.TabbedModuleEditor.deleteTab(vis, tab);
                }
            }
        ]);

        contextMenu.addMenuItems(body, [{
            section: "Tab",
            text: "Add Visualisation",
            visible: () => isPageOrTabBackgroundClick() &&
                isInsideClientSideTabbedModule() &&
                !!rightClickTarget()?.closest(".ren-tabbed-module__tab-content"),
            submenu: [
                {
                    text: "Grid",
                    action: () => {

                        const vis = getTabbedModuleVisualisation();
                        const tab = getClickedTab(vis);

                        if (vis && tab) Ren.TabbedModuleEditor.createVisualisationInTab(vis, tab, "GridSet");
                    }
                },
                {
                    text: "Chart",
                    action: () => {

                        const vis = getTabbedModuleVisualisation();
                        const tab = getClickedTab(vis);

                        if (vis && tab) Ren.TabbedModuleEditor.createVisualisationInTab(vis, tab, "DateValueChart");
                    }
                },
                {
                    text: "Word Cloud",
                    action: () => {

                        const vis = getTabbedModuleVisualisation();
                        const tab = getClickedTab(vis);

                        if (vis && tab) Ren.TabbedModuleEditor.createVisualisationInTab(vis, tab, "WordCloud");
                    }
                },
                {
                    text: "Key/Value Grid",
                    action: () => {

                        const vis = getTabbedModuleVisualisation();
                        const tab = getClickedTab(vis);

                        if (vis && tab) Ren.TabbedModuleEditor.createVisualisationInTab(vis, tab, "KeyValueGrid");
                    }
                }
            ]
        }]);
    }, true);
})();
