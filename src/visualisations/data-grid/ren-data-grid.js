/**
 * Creates a datagrid in the DOM.
 */
Ren.CreateDataGrid = (
    tabularData,
    dataTabIndex,
    dataTabTitle,
    visualisation,
    visualisationStyles,
    gridStateGroup,
    container,
    containerViewport,
    gridSetGuid,
    dataGridGuid,
    contextMenu,
    dataGridDataGroupingSettingsGroup,
    tabularDataTransformers,
    dataGroupingSettingsGroupOption,
    settingsTabs) => {

    tabularData = Ren.TabularDataPool.provideClone(
        tabularData,
        visualisation.dataSourceUri,
        [dataTabIndex],
        null, //dataTabGroup,
        dataGridDataGroupingSettingsGroup,
        tabularDataTransformers
    );

    // Settings hold columns by position, so a grid set's grids each need a group of their own, or
    // one grid would take another's settings and apply them to whatever columns it has there.
    const dataGroupingSettingsGroup =
        dataGroupingSettingsGroupOption ?? visualisation.dataGroupingSettingsGroup;

    const existingDataGroupingSettings =
        Ren.DataGroupingSettingsCollection.getDataGroupingSettingsTransformed(
            dataGroupingSettingsGroup,
            tabularData
        );

    const expandedGroups = new Set();

    const dataGroupingSettings = Ren.DataGroupingSettingsFactory.createDataGroupingSettings(
        tabularData,
        visualisation,
        expandedGroups,
        true,
        dataGroupingSettingsGroup
    );

    // Set before any settings are applied, so that the first rows placed are already paged.
    dataGroupingSettings.paging.pageSize = Ren.DataGridPaging.getPageSize(visualisation);

    Ren.Messages.Requests.tabularDataColumnSummary.handle((guid, columnIndex, anchorElement) => {

        if (visualisation.isDestroyed) return false;

        if (tabularData.tabularDataGuid === guid) {

            Ren.ShowTabularDataColumnSummaryWindow(tabularData, columnIndex, anchorElement);
        }
    });

    Ren.DataGroupingSettings_Debug(tabularData, dataGridGuid, dataGroupingSettings);

    // A height dragged with the grid set's resize handle takes the place of the declared one.
    const maxHeight = visualisation.resizedMaxHeight || visualisation.maxHeight;

    visualisationStyles.setMaxWidthAndHeight(
        visualisation.maxWidth,
        maxHeight,
        !!maxHeight  // explicitMaxHeightSet
    );

    const sortFilterGroup = dataGroupingSettings.sortFilterGroup;

    const existingGridState = Ren.GridStateCollection.getGridStateTransformed(
        gridStateGroup,
        visualisation.visualisationGuid,
        tabularData
    );

    const gridState = Ren.GridState(
        tabularData,
        visualisation,
        dataGroupingSettings,
        gridStateGroup,
        dataGridGuid
    );

    const dataGridColumnLeftPositions = Ren.DataGridColumnLeftPositions(
        dataGroupingSettings,
        gridState
    );

    const dataGridCellSelection = Ren.DataGridCellSelection(
        tabularData,
        dataGroupingSettings,
        dataGridGuid,
        gridState,
        visualisation
    );

    Ren.GridState_Debug(tabularData, gridState);

    const setColumnVisibility = (columnIndex, visible) => {

        gridState.setColumnVisibility(columnIndex, visible);
        Ren.Messages.Events.gridStateChanged.notify(gridState);
        Ren.Messages.Events.columnVisibilityChanged.notify();
    };

    const dataGridScrollPos = { x: 0, y: 0 };

    const freezePanesCoords = {
        x: tabularData.FreezePanesColumnIndex,
        y: 0
    };

    // The qa-ren-grid-index class lets the IVTs address a grid.  It must stay in step with the
    // grid's index in Ren.QA's list, which is why Ren.QA.init is called from this same function.
    const className = `${gridState.dataGridGuid} qa-ren-grid-index-${Ren.QADataGridCount}`;
    Ren.QADataGridCount++;

    const dataGridSections = Ren.DataGridSections(
        gridState,
        containerViewport,
        className
    );

    const dimensionManager = Ren.DataGridDimensionManager(
        tabularData,
        visualisation,
        dataGroupingSettings,
        dataGridGuid,
        dataGridSections,
        dataGridColumnLeftPositions,
        visualisationStyles,
        containerViewport,
        freezePanesCoords
    );

    const dimensions = dimensionManager.dimensions;

    const _dataGrid = {
        element: dataGridSections.dataGrid,
        container,
        dataGridGuid,
        dataGroupingSettings,
        dataTabIndex,
        dimensions,
        gridState,
        tabularData,
        expandedGroups
    };

    dataGridSections.dataGrid.addEventListener("click", (e) => {

        if (!e.target.classList.contains("ren-data-grid__group-expand-collapse-button")) return;

        const cell = e.target.closest(".ren-data-grid__cell");
        if (!cell) return;

        const r = Ren.HtmlUtils.getRowIndex(cell);
        Ren.Messages.Requests.groupExpandCollapse.notify(gridState.dataGridGuid, r - tabularData.HeadingCount);
    });

    const contextMenuItems = Ren.ContextMenuItems(
        tabularData,
        dataGroupingSettings,
        expandedGroups,
        setColumnVisibility,
        contextMenu,
        gridSetGuid,
        dataGridGuid,
        dataGridCellSelection,
        gridState,
        visualisation
    );

    dataGridCellSelection.setRowHeadingContextMenuItems(contextMenuItems);

    const totalsRowPositioner = Ren.DataGridTotalsRowPositioner(
        tabularData,
        dataGroupingSettings,
        dataGridSections,
        dataGridScrollPos,
        gridState
    );

    // Repositions the frozen left and top sections so that they appear to stand still.
    const onDataGridScroll = (scrollPos) => {

        dataGridScrollPos.x = scrollPos.x;
        dataGridScrollPos.y = scrollPos.y;

        dataGridRenderer.renderNewlyVisibleRows();

        containerViewport.scrollLeft = dataGridScrollPos.x;
        containerViewport.scrollTop = dataGridScrollPos.y;

        dataGridSections.frozenTopSection.style.left = -scrollPos.x + "px";
        dataGridSections.frozenLeftSection.style.top = -scrollPos.y + "px";

        totalsRowPositioner.positionTotalsRow(); // Done in scroll event handler to avoid lagging.

        Ren.Messages.Requests.repaint.notify();
    };

    _dataGrid.onDataGridScroll = onDataGridScroll;

    const scrollDataGridTo = (scrollPos) => {

        const maxScrollY = Math.max(0,
            dimensions.dataGridHeight +
            dimensions.frozenHeight -
            dataGridSections.frozenLeftSection_Viewport.clientHeight -
            Ren.DataGridConstants.rowHeight);

        scrollPos.y = Math.min(scrollPos.y, maxScrollY);

        onDataGridScroll(scrollPos);
    };

    /**
     * Shows the page of groups or data rows at the given index, from its top.
     */
    const setPageIndex = (pageIndex) => {

        sortFilterGroup.setPageIndex(pageIndex);

        scrollDataGridTo({
            x: dataGridScrollPos.x,
            y: 0
        });
    };

    _dataGrid.setPageIndex = setPageIndex;

    _dataGrid.updateDimensions = () => dimensionManager.updateDimensions();

    Ren.Messages.Requests.qaDataGridScroll.handle((scrollTop) => {

        if (visualisation.isDestroyed) return false;
        containerViewport.scrollTop = scrollTop;

        scrollDataGridTo({
            x: dataGridScrollPos.x,
            y: scrollTop
        });
    });

    // The frozen left section is fixed, so generates no scroll events for the mouse wheel.
    const onFrozenLeftSectionMouseWheel = (e) => {

        const deltaY = e.deltaY;

        const scrollPos = {
            x: dataGridScrollPos.x,
            y: Math.max(dataGridScrollPos.y + deltaY, 0)
        };

        scrollDataGridTo(scrollPos);
    };

    const show = () => {

        dataGridSections.show();

        // Restores the scroll position the grid had when its gridset tab was last viewed.
        containerViewport.scrollLeft = dataGridScrollPos.x;
        containerViewport.scrollTop = dataGridScrollPos.y;
    };

    _dataGrid.show = show;

    Ren.DataGridColumnInitialVisibility.setInitialColumnVisibility(
        tabularData,
        gridState
    );

    // Shared by the two drags that move every cell at once, each turning transitions off meanwhile.
    const transitionSuppression = Ren.DataGridTransitionSuppression(dataGridGuid);

    Ren.CreateDataGridColumnResizeHandles(
        dataGridGuid,
        tabularData.ColumnCount,
        freezePanesCoords,
        dataGridSections,
        gridState,
        dataGridColumnLeftPositions,
        transitionSuppression
    );

    gridState.resetColumnWidths();

    const rowIndexesIncHeadingsRendered = new Set();

    const columnIndexesRendered = new Set();

    const dataGridRenderer = Ren.DataGridCellRenderer(
        tabularData,
        visualisation,
        dataGroupingSettings,
        expandedGroups,
        dataGridSections,
        gridState,
        rowIndexesIncHeadingsRendered,
        columnIndexesRendered,
        dataGridCellSelection,
        dataGridScrollPos,
        freezePanesCoords,
        contextMenu,
        contextMenuItems
    );

    const dataGridColumnDrag = Ren.DataGridColumnDrag(
        gridState,
        dataGridSections.dataGrid,
        transitionSuppression
    );

    // Deferred until the headings are rendered.
    Ren.FnUtils.defer(() => {

        dataGridColumnDrag.initialiseDragListeners();
    });

    const dataGridStyleUpdater = Ren.DataGridStyleUpdater(
        tabularData,
        dataGroupingSettings,
        expandedGroups,
        dimensions,
        dataGridGuid,
        gridState,
        dataGridColumnLeftPositions,
        dataGridRenderer.getRowIndexesIncHeadingsInView
    );

    Ren.DataGridTooltips(
        tabularData,
        dataGroupingSettings,
        gridState,
        dataGridSections.dataGrid
    );

    let lastProcessedColumnRenderSignifier = null;
    let lastProcessedDimensionUpdateSignifier = null;

    Ren.Messages.Events.dataGridColumnFormattingChanged.handle((changedDataGroupingSettings, columnIndex) => {

        if (visualisation.isDestroyed) return false;
        if (changedDataGroupingSettings !== dataGroupingSettings) return;

        if (columnIndexesRendered.has(columnIndex)) dataGridRenderer.renderColumn(columnIndex);
    });

    Ren.Messages.Events.dataGroupingSettingsChanged.handle((changedDataGroupingSettings) => {

        if (visualisation.isDestroyed) return false;

        if (!Ren.ReportContextMatch.isSameDataGroupingSettingsGroup(
            changedDataGroupingSettings,
            dataGroupingSettings
        )) {

            return;
        }

        if (changedDataGroupingSettings.signifier === lastProcessedColumnRenderSignifier) return;
        if (changedDataGroupingSettings.isDestroyedCleanup) return;

        lastProcessedColumnRenderSignifier = changedDataGroupingSettings.signifier;

        // Tooltips are not in the DOM, so a change to them alone renders nothing again.
        if (changedDataGroupingSettings.tooltipsOnlySignifier ===
            changedDataGroupingSettings.signifier) {

                return;
        }

        Ren.FnUtils.defer(() => {

            columnIndexesRendered.forEach((columnIndex) => {

                dataGridRenderer.renderColumn(columnIndex);
            });
        });
    });

    Ren.Messages.Events.dataGridTabChanged.handle((dataGridGuid) => {

        if (visualisation.isDestroyed) return false;
        if (dataGridGuid !== gridState.dataGridGuid) return;

        Ren.FnUtils.defer(() => {

            totalsRowPositioner.positionTotalsRow();
        });
    });

    Ren.Messages.Requests.groupExpandCollapse.handle((guid, rowIndex) => {

        if (visualisation.isDestroyed) return false;
        if (guid !== gridState.dataGridGuid) return;

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

        if (!grouping) return;

        const group = grouping.getGroupWithRowIndex(rowIndex);

        if (!group) return;

        const isGroupExpanded = Ren.DataGrid_ExpandCollapse.isGroupExpanded(
            tabularData,
            expandedGroups,
            grouping,
            group
        );

        if (!isGroupExpanded) {

            dataGroupingSettings.sortFilterGroup.expandGroup(group);
        }
        else {

            dataGroupingSettings.sortFilterGroup.collapseGroup(group);
        }
    });

    Ren.Messages.Requests.collapseAllGroups.handle((dataGridGuid) => {

        if (visualisation.isDestroyed) return false;

        // A null dataGridGuid collapses every datagrid's groups.
        if (dataGridGuid && dataGridGuid !== gridState.dataGridGuid) return;

        dataGroupingSettings.sortFilterGroup.collapseAllGroups();
        dataGridRenderer.renderNewlyVisibleRows();
        Ren.Messages.Requests.repaint.notify();
    });

    Ren.Messages.Events.variationsChanged.handle(() => {

        if (visualisation.isDestroyed) return false;

        dataGridRenderer.renderNewlyVisibleRows();
        Ren.Messages.Requests.repaint.notify();
    });

    dataGridSections.frozenLeftSection.addEventListener("wheel", onFrozenLeftSectionMouseWheel);

    sortFilterGroup.onChanged(() => {

        dataGridRenderer.clearCache();
        dataGroupingSettings.updateRowYIndexes();

        dataGridRenderer.removeRenderedGroupRows();

        dataGridRenderer.renderNewlyVisibleRows();
        dataGridStyleUpdater.updateDataGridStyles();

        Ren.Messages.Requests.repaint.notify();

        // The rows on screen are the filtered ones as of here, so the grid is undimmed now rather
        // than at the end of the turn.
        Ren.VisualisationFilterDim.undimVisualisation(visualisation);
    });

    Ren.Messages.Requests.dataGridShowHideColumnsWindow.handle((guid, element, scope) => {

        if (visualisation.isDestroyed) return false;

        if (guid === dataGridGuid) {

            Ren.ShowShowHideColumnsWindow(
                tabularData,
                gridState,
                setColumnVisibility,
                element,
                scope
            );

            Ren.VisualisationCollection.setFocus(visualisation);
        }
    });

    contextMenuItems.addDataGridMenuItems(dataGridSections.dataGrid);

    const gridStateApplyer = Ren.GridStateApplyer(
        tabularData,
        gridState,
        visualisation.containingReportGuid,
        gridStateGroup
    );

    _dataGrid.gridStateApplyer = gridStateApplyer;

    // Before applying gridState, so that unhiddenColumnWidths is populated.
    gridState.resetColumnWidths();

    // Transformers change the columns that saved settings are checked against, so with any, the
    // settings are found by key alone rather than checked against the grid set's queries.
    const hasTransformers = tabularDataTransformers && tabularDataTransformers.length > 0;
    const gridStateTabs = hasTransformers ? null : settingsTabs?.gridState;
    const dataGroupingSettingsTabs = hasTransformers ? null : settingsTabs?.dataGroupingSettings;

    if (existingGridState) {

        gridStateApplyer.applyDeserializedGridState(existingGridState, true);
    }
    else {

        // Editor page previews use the static collection, unless transformers have changed the
        // column structure the saved grid state was written for.
        const staticGridState = !hasTransformers ?
            Ren.ReportSettings_GridStateCollection.getClonedGridState(
                gridStateGroup,
                null, // variationName
                gridStateTabs,
                dataTabIndex
            ) :
            null;

        if (staticGridState) {

            gridStateApplyer.applyDeserializedGridState(staticGridState);
        }
        else {

            Ren.GridStateInitialiser.initialiseGridState(
                gridStateGroup,  // The parameter, not visualisation.gridStateGroup.
                gridStateApplyer,
                gridStateTabs,
                dataTabIndex
            );
        }
    }

    // After gridState has been applied, so that column visibility is correct.
    dataGridStyleUpdater.updateDataGridStyles();

    dataGridRenderer.renderHeadingRows();

    const dataGroupingSettingsApplyer = Ren.DataGroupingSettingsApplyer(
        tabularData,
        dataGroupingSettings
    );

    _dataGrid.dataGroupingSettingsApplyer = dataGroupingSettingsApplyer;

    if (existingDataGroupingSettings) {

        dataGroupingSettingsApplyer.applyDataGroupingSettings(existingDataGroupingSettings);
    }
    else {

        const staticDataGroupingSettings =
            Ren.ReportSettings_DataGroupingSettingsCollection.getClonedDataGroupingSettings(
                dataGroupingSettingsGroup,
                null, // variationName
                dataGroupingSettingsTabs,
                dataTabIndex
            );

        if (staticDataGroupingSettings) {

            dataGroupingSettingsApplyer.applyDataGroupingSettings(staticDataGroupingSettings);
        }
        else {

            Ren.DataGroupingSettingsInitialiser.initialiseDataGroupingSettings(
                visualisation,
                dataGroupingSettingsApplyer,
                dataGroupingSettingsGroup,
                dataGroupingSettingsTabs,
                dataTabIndex
            );
        }
    }

    Ren.QueryParameterFilter.applyFiltersToDataGroupingSettings(
        dataGroupingSettings,
        tabularData,
        visualisation
    );

    // A visualisation following this grid's filterGroup (e.g. a date/value chart) may have drawn
    // before these filters were applied, and would otherwise keep showing, and caching under this
    // signifier, the unfiltered data.
    const hasAppliedFilters = dataGroupingSettings.hasFilter() ||
        Ren.DataGroupingSettings_Services_FilterAccessors
            .getRowFilterableGroupingColumnValueFilters(dataGroupingSettings, tabularData).length > 0;

    if (hasAppliedFilters) {

        dataGroupingSettings.signifier = Ren.RandomUtils.generateRandomClassName();
        dataGroupingSettings.notifyFilterGroupChanged();
    }

    dataGridRenderer.initialrepaint();

    Ren.Messages.Events.themeChanged.handle(() => {

        if (visualisation.isDestroyed) return false;
        dataGridStyleUpdater.updateColourScheme();
    });

    Ren.Messages.Events.dataGridDimensionsUpdated.handle((guid) => {

        if (visualisation.isDestroyed) return false;
        if (guid === dataGridGuid) dataGridSections.resizeFrozenSectionsToMatchViewport();
    });

    // Shown behind initialrepaint's deferred first rows, and sized to them, as the first repaint
    // can come before them.  Not by notifying a repaint: the other repaint listeners are sensitive
    // to when one comes.
    Ren.Messages.Requests.repaint.handle(() => {

        if (visualisation.isDestroyed) return false;

        Ren.FnUtils.defer(() => {

            if (visualisation.isDestroyed) return;

            dimensionManager.updateDimensions();
            dataGridStyleUpdater.updateDataGridStyles();
            container.classList.add("ren-grid-set--shown");
        });
    }, true);

    Ren.Messages.Events.popupResized.handle(() => {

        if (visualisation.isDestroyed) return false;
        dimensionManager.updateDimensions();
        dataGridStyleUpdater.updateDataGridStyles();
    });

    Ren.Messages.Requests.repaint.handle(() => {

        if (visualisation.isDestroyed) return false;

        dimensionManager.updateDimensions();
        dataGridStyleUpdater.updateDataGridStyles();

        Ren.FnUtils.defer(() => {

            if (visualisation.isDestroyed) return;

            dimensionManager.updateDimensions();
            dataGridStyleUpdater.updateDataGridStyles();
            totalsRowPositioner.positionTotalsRow();
        }, 50, 500);
    });

    Ren.Messages.Events.columnResized.handle(() => {

        if (visualisation.isDestroyed) return false;
        dimensionManager.updateDimensions();
        dataGridStyleUpdater.updateDataGridColumnStyles();
    });

    Ren.Messages.Events.columnVisibilityChanged.handle(() => {

        if (visualisation.isDestroyed) return false;
        dimensionManager.updateDimensions();
        dataGridStyleUpdater.updateDataGridColumnStyles();

        // Avoids truncation of the frozen top section after a column is made visible.
        Ren.FnUtils.defer(() => { dimensionManager.updateDimensions(); }, 20);
    });

    Ren.Messages.Events.dataGroupingSettingsChanged.handle((changedDataGroupingSettings) => {

        if (visualisation.isDestroyed) return false;

        const isSameReportContext = Ren.ReportContextMatch.isSameReportContext(
            changedDataGroupingSettings.containingReportGuid,
            dataGroupingSettings.containingReportGuid
        );

        // Any settings group in this grid's own report instance, not another instance's.
        if (!isSameReportContext) return;

        if (changedDataGroupingSettings.signifier === lastProcessedDimensionUpdateSignifier) return;
        if (changedDataGroupingSettings.isDestroyedCleanup) return;

        lastProcessedDimensionUpdateSignifier = changedDataGroupingSettings.signifier;

        Ren.FnUtils.defer(() => {

            if (visualisation.isDestroyed) return;

            dimensionManager.updateDimensions();
            dataGridStyleUpdater.updateDataGridColumnStyles();
        });
    });

    Ren.Messages.Events.tabbedModuleTabChanged.handle(() => {

        if (visualisation.isDestroyed) return false;
        dimensionManager.updateDimensions(); // Necessary to keep stat bar position updated.
        Ren.Messages.Requests.repaint.notify();
    });

    Ren.Messages.Events.gridStateChanged.handle((newGridState) => {

        if (visualisation.isDestroyed) return false;
        if (!newGridState) return;
        if (newGridState.gridStateGroup !== gridStateGroup) return;

        dataGridStyleUpdater.updateDataGridStyles();
    });

    const getSelectedCellsTsv = () => dataGridCellSelection.getSelectedCellsTsv();

    _dataGrid.getSelectedCellsTsv = getSelectedCellsTsv;

    _dataGrid.cellSelection = dataGridCellSelection;

    /**
     * Scrolls the datagrid by the least amount that brings the given cell fully into view, clear of
     * the frozen rows and columns.
     */
    const scrollCellIntoView = (cell) => {

        const rowHeight = Ren.DataGridConstants.rowHeight;
        const columnHeadingHeight = visualisation.showRowAndColumnHeadings ? rowHeight : 0;

        const cellTop = Math.round(rowHeight * cell.y + columnHeadingHeight);

        let scrollY = dataGridScrollPos.y;

        if (cellTop - scrollY < dimensions.frozenHeight) {

            scrollY = cellTop - dimensions.frozenHeight;
        }
        else if (cellTop + rowHeight - scrollY > containerViewport.clientHeight) {

            scrollY = cellTop + rowHeight - containerViewport.clientHeight;
        }

        const columnIndex = dataGroupingSettings.getColIndex(cell.x);
        const cellLeft = dataGridColumnLeftPositions.columnLeftPositions[columnIndex];
        const cellWidth = gridState.columnWidths[columnIndex];

        let scrollX = dataGridScrollPos.x;

        if (cellLeft - scrollX < dimensions.frozenWidth) {

            scrollX = cellLeft - dimensions.frozenWidth;
        }
        else if (cellLeft + cellWidth - scrollX > containerViewport.clientWidth) {

            scrollX = cellLeft + cellWidth - containerViewport.clientWidth;
        }

        scrollDataGridTo({
            x: Math.max(scrollX, 0),
            y: Math.max(scrollY, 0)
        });
    };

    Ren.Messages.Requests.dataGridFindNext.handle((
        searchText,
        columnIndexes,
        matchCase,
        matchWholeCell,
        fromTop) => {

        if (visualisation.isDestroyed) return false;

        if (!Ren.ActiveDataGrid.isActive(gridState.dataGridGuid)) return;

        const foundCell = dataGridCellSelection.findNext(
            searchText,
            columnIndexes,
            matchCase,
            matchWholeCell,
            fromTop
        );

        if (foundCell) scrollCellIntoView(foundCell);

        Ren.Messages.Events.dataGridFindCompleted.notify(gridState.dataGridGuid, !!foundCell);
    });

    Ren.Messages.Requests.dataGridSelectRowsWithText.handle((
        searchText,
        columnIndexes,
        matchCase,
        matchWholeCell,
        copyRows) => {

        if (visualisation.isDestroyed) return false;

        if (!Ren.ActiveDataGrid.isActive(gridState.dataGridGuid)) return;

        const result = dataGridCellSelection.selectMatchingRows(
            searchText,
            columnIndexes,
            matchCase,
            matchWholeCell
        );

        // Matching rows may not be rendered, so the first is scrolled to, to show what happened.
        if (result.firstCell) scrollCellIntoView(result.firstCell);

        const wasCopied = !!copyRows && result.rowCount > 0;

        if (wasCopied) {

            navigator.clipboard.writeText(dataGridCellSelection.getSelectedCellsTsv());
        }

        Ren.Messages.Events.dataGridSelectRowsCompleted.notify(
            gridState.dataGridGuid,
            result.rowCount,
            wasCopied
        );
    });

    Ren.Messages.Requests.dataGridFilterRowsWithText.handle((
        searchText,
        columnIndexes,
        matchCase,
        matchWholeCell) => {

        if (visualisation.isDestroyed) return false;

        if (!Ren.ActiveDataGrid.isActive(gridState.dataGridGuid)) return;

        const rowCount = dataGridCellSelection.filterMatchingRows(
            searchText,
            columnIndexes,
            matchCase,
            matchWholeCell
        );

        Ren.Messages.Events.dataGridFilterRowsCompleted.notify(
            gridState.dataGridGuid,
            rowCount
        );
    });

    Ren.Messages.Requests.dataGridClearFilterRows.handle(() => {

        if (visualisation.isDestroyed) return false;

        if (!Ren.ActiveDataGrid.isActive(gridState.dataGridGuid)) return;

        dataGridCellSelection.clearFilterRows();

        Ren.Messages.Events.dataGridClearFilterRowsCompleted.notify(gridState.dataGridGuid);
    });

    Ren.DataGridUpdater.bindDataGroupingSettingsChangedMessages(
        tabularData,
        dataGroupingSettings,
        dataGroupingSettingsApplyer
    );

    if (!Ren.UrlContext.onEditorPage()) {

        Ren.AddDataGridVariations(
            dataGridSections,
            dataGridGuid,
            visualisation
        );
    }

    Ren.AddDataGridQuickLinks(
        gridSetGuid,
        dataGridGuid,
        dataGridSections,
        dimensions,
        container,
        visualisation,
        dataGridCellSelection
    );

    Ren.QA.init(dataGroupingSettings, dataGridCellSelection);

    const getRowValue = (rowModel, columnIndex) => {

        return tabularData.CompressionDictionary.decompressValue(
            rowModel.CV[columnIndex],
            columnIndex
        );
    };

    _dataGrid.getRowValue = getRowValue;

    Ren.Messages.Requests.applyDeserialisedGridState.handle((
        settings,
        containingReportGuid) => {

        if (visualisation.isDestroyed) return false;

        const isSameGroup = Ren.ReportContextMatch.isSameGroup(
            settings.gridStateGroup,
            containingReportGuid,
            gridStateGroup,
            visualisation.containingReportGuid
        );

        if (!isSameGroup) return;

        gridStateApplyer.applyDeserializedGridState(settings);
        dataGridRenderer.renderNewlyVisibleRows();
        Ren.Messages.Requests.repaint.notify();
    });

    Ren.Messages.Requests.reapplyQueryParameterFilters.handle((
        dataGroupingSettingsGroup,
        containingReportGuid) => {

        if (visualisation.isDestroyed) return false;

        const isSameGroup = Ren.ReportContextMatch.isSameGroup(
            dataGroupingSettingsGroup,
            containingReportGuid,
            visualisation.dataGroupingSettingsGroup,
            visualisation.containingReportGuid
        );

        if (!isSameGroup) return;

        // A cached popup reopen re-applies default settings, which may reinstate a default column
        // filter, so the URL query parameter filter is re-asserted over it.
        Ren.QueryParameterFilter.reapplyFiltersToDataGroupingSettings(
            dataGroupingSettings,
            tabularData,
            visualisation
        );

        dataGridRenderer.renderNewlyVisibleRows();
        Ren.Messages.Requests.repaint.notify();
    });

    Ren.Messages.Requests.applyDeserialisedDataGroupingSettings.handle((
        settings,
        containingReportGuid) => {

        if (visualisation.isDestroyed) return false;

        const isSameGroup = Ren.ReportContextMatch.isSameGroup(
            settings.dataGroupingSettingsGroup,
            containingReportGuid,
            dataGroupingSettingsGroup,
            visualisation.containingReportGuid
        );

        if (!isSameGroup) return;

        dataGroupingSettingsApplyer.applyDataGroupingSettings(settings);

        // Open settings editors rebuild only when this fires, and it re-renders rendered columns,
        // whose aggregated values renderNewlyVisibleRows would not update.
        dataGroupingSettings.fireChangedEvent();

        // Whether or not the settings changed the filters, as they may have removed them.
        dataGroupingSettings.notifyFilterGroupChanged();

        dataGridRenderer.renderNewlyVisibleRows();
        Ren.Messages.Requests.repaint.notify();
    });

    // The paging bar is only added once the grid is paged, which it may become later on.
    const addPagingBarIfPaged = () => {

        if (_dataGrid.pagingBarVisualisation) return;
        if (dataGroupingSettings.paging.pageSize === null) return;

        Ren.DataGrid_PagingBar(_dataGrid, gridStateGroup, visualisation.element, visualisation);
    };

    const removePagingBarIfNotPaged = () => {

        if (!_dataGrid.pagingBarVisualisation) return;
        if (dataGroupingSettings.paging.pageSize !== null) return;

        const pagingBarVisualisation = _dataGrid.pagingBarVisualisation;

        _dataGrid.pagingBarVisualisation = null;

        if (visualisation.pagingBarVisualisationGuid === pagingBarVisualisation.visualisationGuid) {
            visualisation.pagingBarVisualisationGuid = null;
        }

        Ren.VisualisationCollection.destroyVisualisation(pagingBarVisualisation, true);
    };

    // The stat bar is in a settings group of its own, so hears nothing of the grid set's paging.
    const repositionStatBar = () => {

        const statBarVisualisation = Ren.VisualisationCollection.getVisualisationByVisualisationGuid(
            visualisation.statBarVisualisationGuid
        );

        if (!statBarVisualisation) return;

        Ren.Messages.Events.visualisationSettingsChanged.notify(statBarVisualisation);
    };

    Ren.Messages.Events.visualisationSettingsChanged.handle((changedVisualisation) => {

        if (visualisation.isDestroyed) return false;

        if (changedVisualisation.visualisationSettingsGroup !==
            visualisation.visualisationSettingsGroup) return;

        const pageSize = Ren.DataGridPaging.getPageSize(visualisation);

        if (pageSize === dataGroupingSettings.paging.pageSize) return;

        sortFilterGroup.setPageSize(pageSize);

        scrollDataGridTo({
            x: dataGridScrollPos.x,
            y: 0
        });

        addPagingBarIfPaged();
        removePagingBarIfNotPaged();
        repositionStatBar();
    });

    Ren.FnUtils.defer(() => {

        // Before the stat bar, which is positioned according to whether the paging bar is there.
        addPagingBarIfPaged();

        Ren.DataGrid_StatBar(_dataGrid, gridStateGroup, visualisation.element, visualisation);
    });

    return _dataGrid;
};
