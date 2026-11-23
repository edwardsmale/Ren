/**
 * Creates a gridset and its child datagrids in the DOM.
 */
Ren.CreateGridSet = (tabularDataSet, visualisation) => {

    Ren.GridSetStyleUpdater(visualisation);

    const gridStateGroup = visualisation.gridStateGroup;
    const dataGroupingSettingsGroup = visualisation.dataGroupingSettingsGroup;

    const dataTabIndexes = Ren.ArrayUtils.convertToZeroBased(visualisation.dataTabIndexes);

    const gridSetTitle = tabularDataSet.Title;
    const gridSetGuid = Ren.RandomUtils.generateRandomClassName(gridSetTitle);

    const dataGrids = [];

    let activeDataGridIndex = 0;

    const gridSet = Ren.HtmlUtils.create("grid-set");

    if (visualisation.gridSetWidth) gridSet._style("width", visualisation.gridSetWidth);

    const tabs = document.createElement("div");
    tabs.classList.add("ren-grid-set__tabs");
    gridSet.appendChild(tabs);

    const gridSetViewport = document.createElement("div");
    gridSetViewport.classList.add("ren-grid-set__viewport", "ren-visualisation__viewport");

    gridSetViewport.addEventListener("scroll", () => {

        dataGrids[activeDataGridIndex].onViewportScroll({
            x: gridSetViewport.scrollLeft,
            y: gridSetViewport.scrollTop
        });
    });

    const scrollToBottom = () => {

        gridSetViewport.scrollTop = gridSetViewport.scrollHeight;
    };

    // Set once the grids are created, for a grid whose grid state scrolls it to the bottom when
    // first shown, and cleared once it has been: when the viewport has been sized to its rows.
    let isScrollToBottomPending = false;

    const getActiveDataTabIndex = () => dataGrids[activeDataGridIndex].tabularData.dataTabIndex;

    // Gets the live settings of the grid showing a data tab, or null.  A set's grids share one
    // visualisation GUID, so the settings collection cannot find a grid's settings by it.
    const getDataGroupingSettingsForDataTabIndex = (dataTabIndex) => {

        for (let i = 0; i < dataGrids.length; i++) {

            if (dataGrids[i].tabularData.dataTabIndex === dataTabIndex) {
                return dataGrids[i].dataGroupingSettings;
            }
        }

        return null;
    };
    const getActiveDataTabGroup = () => dataGrids[activeDataGridIndex].tabularData.dataTabGroup;
    const getActiveDataTabTitle = () => dataGrids[activeDataGridIndex].tabularData.Title;
    const getActiveDataGridGuid = () => dataGrids[activeDataGridIndex].dataGridGuid;

    if (visualisation.showTabTitles) gridSetViewport.style.marginBottom = "1.5rem";
    gridSet.appendChild(gridSetViewport);

    const contextMenu = Ren.SetUpContextMenu();

    const visualisationStyles = Ren.VisualisationStyles(visualisation, gridStateGroup);

    const maxHeightResizeHandle = Ren.GridSetMaxHeightResizeHandle(
        visualisation,
        gridSet,
        gridSetViewport,
        visualisationStyles
    );

    const selectDataGrid = (dataGrid, gridSet, index) => {

        const gridSetTabs = gridSet.querySelectorAll(".ren-grid-set__tab");

        gridSet.querySelectorAll("data-grid").forEach((d) => {

            d.style.display = "none";
            d.classList.remove("ren-data-grid--active");
        });

        dataGrid.show();
        dataGrid.element.classList.add("ren-data-grid--active");

        if (gridSetTabs.length) {

            gridSetTabs.forEach(tab => tab.classList.remove("ren-grid-set__tab--active"));
            gridSetTabs[index].classList.add("ren-grid-set__tab--active");
        }
    };

    /**
     * Makes the gridset big enough for all of its datagrids.
     */
    const updateGridSetDimensions = () => {

        if (visualisation.isReportPreview && Ren.UrlContext.onEditorPage()) return;

        window.requestAnimationFrame(() => {

            let viewportWidth = -1;
            let viewportHeight = -1;

            const scrollBarWidth = Ren.DataGridConstants.scrollBarWidth;
            const rowHeight = Ren.DataGridConstants.rowHeight;

            for (let i = 0, len = dataGrids.length; i < len; i++) {

                const dataGrid = dataGrids[i];
                const dims = dataGrid.dimensions;
                if (!dims) continue;

                const outerWidth = dims.dataGridWidth + scrollBarWidth;
                const outerHeight = dims.dataGridHeight + rowHeight * (dataGrid.gridState.showRowAndColumnHeadings + 1);

                if (outerWidth > viewportWidth) viewportWidth = outerWidth;
                if (outerHeight > viewportHeight) viewportHeight = outerHeight;
            }

            if (!visualisation?.hasDimensions) {

                const widthPx = viewportWidth + "px";
                const heightPx = (viewportHeight + 2) + "px";

                let isResized = false;

                if (gridSetViewport.style.width !== widthPx) {

                    gridSetViewport.style.width = widthPx;
                    isResized = true;
                }

                if (gridSetViewport.style.height !== heightPx) {

                    gridSetViewport.style.height = heightPx;
                    isResized = true;
                }

                // The grids measured the viewport before this resized it, so their stat and paging
                // bars would otherwise stay put until a later repaint.
                if (isResized) {

                    for (let i = 0; i < dataGrids.length; i++) {
                        dataGrids[i].updateDimensions();
                    }
                }
            }
            else {

                if (gridSetViewport.style.width) delete gridSetViewport.style.width;
                if (gridSetViewport.style.height) delete gridSetViewport.style.height;
            }

            maxHeightResizeHandle.updatePosition();

            if (isScrollToBottomPending &&
                dataGrids[activeDataGridIndex].dimensions?.dataGridHeight &&
                gridSetViewport.clientHeight) {

                isScrollToBottomPending = false;
                scrollToBottom();
            }
        });
    };

    Ren.Messages.Events.dataGridDimensionsUpdated.handle(() => {

        updateGridSetDimensions();
    });

    const tabularDatas = tabularDataSet.TabularDatas.filter((tabularData, dataTabIndex) => {

        if (!visualisation.dataTabGroup && dataTabIndexes && !dataTabIndexes.includes(dataTabIndex)) return false;
        if (visualisation.dataTabGroup && tabularData.dataTabGroup !== visualisation.dataTabGroup) return false;

        return true;
    });

    if (!tabularDatas.length) return;

    /**
     * Gets a report preview gridstate group, shared by datagrids with the same columns.
     */
    const reportPreviewGridStateGroup = (tabularData) => {

        return tabularData.ColumnModels.map(c => c.Heading).join("|");
    };

    const getDataGridDataGroupingSettingsGroup = ((dataTabIndex) => {

        if (dataGroupingSettingsGroup) {
            return dataGroupingSettingsGroup + "[" + dataTabIndex + "]";
        }
        else {

            return Ren.RandomUtils.generateRandomClassName("settings-group");
        }
    });

    // Gets the index of the first data tab with the same columns as the given one.
    const getFirstDataTabIndexWithSameColumns = (dataTabIndex) => {

        const columnsGroup = reportPreviewGridStateGroup(tabularDatas[dataTabIndex]);

        for (let i = 0; i < dataTabIndex; i++) {

            if (reportPreviewGridStateGroup(tabularDatas[i]) === columnsGroup) return i;
        }

        return dataTabIndex;
    };

    // Gets the settings group of a data tab's grid.  The first grid keeps the set's own group, so
    // settings saved before each grid had its own still apply to it.  With syncTabSettings, tabs
    // with the same columns share the group of the first of them, so a change made on one tab is
    // made on them all; their filters stay apart, being held by tab title.
    const getDataGridSettingsGroup = (dataTabIndex) => {

        if (!dataGroupingSettingsGroup) {
            return dataGroupingSettingsGroup;
        }

        const settingsTabIndex = visualisation.syncTabSettings ?
            getFirstDataTabIndexWithSameColumns(dataTabIndex) :
            dataTabIndex;

        if (settingsTabIndex === 0) {
            return dataGroupingSettingsGroup;
        }

        return dataGroupingSettingsGroup + "[" + settingsTabIndex + "]";
    };

    // Gets the grid state group of a data tab's grid.  Tabs with the same columns share a group,
    // so that their grid state stays synchronised.  It is numbered by the first tab with those
    // columns, and the first tab keeps the set's own group, so older grid state applies to it.
    // A preview's group is named by its columns, so is shared in the same way.
    const getDataGridGridStateGroup = (dataTabIndex, tabularData) => {

        if (!gridStateGroup) {
            return reportPreviewGridStateGroup(tabularData);
        }

        const firstTabIndex = getFirstDataTabIndexWithSameColumns(dataTabIndex);

        if (firstTabIndex === 0) {
            return gridStateGroup;
        }

        return gridStateGroup + "[" + firstTabIndex + "]";
    };

    const gridStateGroups = new Array(tabularDatas.length);
    const dataGridSettingsGroups = new Array(tabularDatas.length);

    for (let dataTabIndex = 0; dataTabIndex < tabularDatas.length; dataTabIndex++) {

        gridStateGroups[dataTabIndex] =
            getDataGridGridStateGroup(dataTabIndex, tabularDatas[dataTabIndex]);

        dataGridSettingsGroups[dataTabIndex] = getDataGridSettingsGroup(dataTabIndex);
    }

    // The grids' settings are checked against their queries together, so that where queries have
    // been added, removed or moved in the SQL, each grid gets the settings saved against its own.
    const settingsTabs = {
        gridState: {
            tabularDatas,
            settingsGroups: gridStateGroups,
            familyGroup: gridStateGroup || null
        },
        dataGroupingSettings: dataGroupingSettingsGroup ?
            {
                tabularDatas,
                settingsGroups: dataGridSettingsGroups,
                familyGroup: dataGroupingSettingsGroup
            } :
            null
    };

    // Document fragments reduce layout thrashing.
    const gridSetViewportFragment = document.createDocumentFragment();
    const tabsFragment = document.createDocumentFragment();

    for (let dataTabIndex = 0; dataTabIndex < tabularDatas.length; dataTabIndex++) {

        const tabularData = tabularDatas[dataTabIndex];

        const dataGridDataGroupingSettingsGroup = getDataGridDataGroupingSettingsGroup(dataTabIndex);

        const dataGridGuid = Ren.RandomUtils.generateRandomClassName("ren-data-grid");
        const dataTabTitle = tabularData.Title;

        const dataGrid = Ren.CreateDataGrid(
            tabularData,
            dataTabIndex,
            dataTabTitle,
            visualisation,
            visualisationStyles,
            gridStateGroups[dataTabIndex],
            gridSet,
            gridSetViewport,
            gridSetGuid,
            dataGridGuid,
            contextMenu,
            dataGridDataGroupingSettingsGroup,
            visualisation.tabularDataTransformers,
            dataGridSettingsGroups[dataTabIndex],
            settingsTabs
        );

        gridSetViewportFragment.appendChild(dataGrid.element);
        dataGrids.push(dataGrid);

        if (!visualisation.showTabTitles) continue;

        const tabTitle = tabularData.Title;
        const tab = document.createElement("div");

        tab.classList.add(
            "ren-grid-set__tab",
            "qa-ren-grid-set-tab-" + dataTabIndex,
            "ren-grid-set-tab-" + Ren.TextUtils.convertToKebabCase(tabTitle)
        );

        tab.textContent = tabTitle;
        tabsFragment.appendChild(tab);

        tab.addEventListener("click", () => {

            activeDataGridIndex = Array.from(tab.parentNode.children).indexOf(tab);
            selectDataGrid(dataGrid, gridSet, activeDataGridIndex);
            Ren.Messages.Events.dataGridTabChanged.notify(dataGrids[activeDataGridIndex].dataGridGuid);
            Ren.Messages.Requests.repaint.notify();
        });

        Ren.FnUtils.defer(() => {

            Ren.Messages.Events.dataGridTabChanged.notify(dataGrids[activeDataGridIndex].dataGridGuid);
        });
    }

    gridSetViewport.appendChild(gridSetViewportFragment);
    tabs.appendChild(tabsFragment);

    selectDataGrid(dataGrids[activeDataGridIndex], gridSet, activeDataGridIndex);
    gridSet.appendChild(gridSetViewport);

    isScrollToBottomPending = !!dataGrids[activeDataGridIndex].gridState.scrollToBottom;

    Ren.Messages.Requests.exportData.handle((guid) => {

        if (guid === gridSetGuid) {

            Ren.Excel.exportToExcel(dataGrids, gridSetTitle + ".xlsx");
        }
    });

    Ren.Messages.Requests.repaint.handle(() => {

        if (visualisation.isDestroyed) return false;

        updateGridSetDimensions();
    });

    visualisationStyles.setMaxWidthAndHeight(
        visualisation.maxWidth,
        visualisation.resizedMaxHeight || visualisation.maxHeight,
        false // explicitMaxHeightSet
    );

    const copySelectedCellsToClipboard = () => {

        const text = dataGrids[activeDataGridIndex].getSelectedCellsTsv();

        navigator.clipboard.writeText(text);
    };

    /**
     * Opens the Find window, closing any already open, so a second Ctrl+F brings it back into view.
     */
    const showFindWindow = () => {

        const openFindWindows = Ren.VisualisationCollection.getVisualisations("FindWindow");

        for (let i = openFindWindows.length - 1; i >= 0; i--) {

            const openFindWindow = openFindWindows[i];

            if (openFindWindow.popup) {
                openFindWindow.popup.closeWindow();
            }
            else {

                Ren.VisualisationCollection.destroyVisualisation(openFindWindow);
            }
        }

        const popupLeft = Math.round(window.scrollX + 128);
        const popupTop = Math.round(window.scrollY + 160);

        Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "FindWindow",
            popupTitle: "🔍 Find",
            isPopup: true,
            popupLeft,
            popupTop,
            popupReuseId: "FindWindow",
            sourceVisualisation: visualisation,
            sourceVisualisationGuid: visualisation.visualisationGuid
        });
    };

    Ren.Messages.Events.keyDown.handle((e) => {

        if (!Ren.VisualisationCollection.hasFocus(visualisation)) return;

        if (e.ctrlKey && e.key === "c") {

            e.preventDefault();
            copySelectedCellsToClipboard();
        }
        else if (e.ctrlKey && e.key === "f") {

            e.preventDefault();
            showFindWindow();
        }
        else if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "Home") {

            e.preventDefault();
            gridSetViewport.scrollTop = 0;
        }
        else if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "End") {

            e.preventDefault();
            scrollToBottom();
        }
    });

    Ren.Messages.Events.dataGridDimensionsUpdated.notify(dataGrids[activeDataGridIndex].dataGridGuid);

    return {
        element: gridSet,
        gridSetGuid,
        gridSetTitle,
        dataGrids,
        dataGroupingSettings: Array.from(dataGrids.map(w => w.dataGroupingSettings)),
        gridState: Array.from(dataGrids.map(w => w.gridState)),
        getActiveDataTabIndex,
        getActiveDataTabTitle,
        getActiveDataTabGroup,
        getActiveDataGridGuid,
        getDataGroupingSettingsForDataTabIndex,
        // The dataGroupingSettings array above is indexed by grid order, not by dataTabIndex.
        getActiveDataGroupingSettings: () => dataGrids[activeDataGridIndex].dataGroupingSettings
    };
};
