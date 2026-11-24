/**
 * Handles cell selection in a datagrid.  This includes selecting cells, rows, and columns, and
 * copying the selected cells to the clipboard.
 */
Ren.DataGridCellSelection = (tabularData, dataGroupingSettings, dataGridGuid, gridState, visualisation) => {

    const cellParser = Ren.DataGridCellSelection_CellParser(
        dataGroupingSettings
    );

    const cellValueReader = Ren.DataGridCellSelection_CellValueReader(
        tabularData,
        dataGroupingSettings
    );

    const selectedCellsCalculator = Ren.DataGridCellSelection_SelectedCellsCalculator(
        tabularData,
        dataGroupingSettings,
        gridState
    );

    const tsvGenerator = Ren.DataGridCellSelection_TsvGenerator(
        tabularData,
        dataGroupingSettings,
        gridState
    );

    const firstLastCell = Ren.DataGridCellSelection_FirstLastCell(
        tabularData,
        dataGroupingSettings,
        gridState
    );

    const selection = Ren.DataGridCellSelection_State(
        dataGroupingSettings,
        firstLastCell
    );

    const cellSelectionStatBar = Ren.DataGridCellSelection_StatBar(
        tabularData,
        dataGroupingSettings,
        selectedCellsCalculator,
        selection,
        cellValueReader
    );

    const selectionStateReader = Ren.DataGridCellSelection_StateReader(
        tabularData,
        dataGroupingSettings,
        selection
    );

    let contextMenuItems = null;

    /**
     * Sets the context menu items handler for row headings.  This is called after the context
     * menu items are created.
     */
    const setRowHeadingContextMenuItems = (contextMenuItemsHandler) => {

        contextMenuItems = contextMenuItemsHandler;
    };

    /**
     * Adds context menu items to a row heading element.
     */
    const addContextMenuItemsToRowHeading = (rowIndex, rowHeadingElement) => {

        if (contextMenuItems) {
            contextMenuItems.addRowHeadingMenuItems(rowIndex, rowHeadingElement);
        }
    };

    const adHocVisualisationCreator = Ren.DataGridCellSelection_AdHocVisualisationCreator(
        tabularData,
        dataGroupingSettings,
        dataGridGuid,
        gridState,
        selection
    );

    const rawValueReader = Ren.DataGridCellSelection_RawValueReader(
        tabularData,
        dataGroupingSettings
    );

    const doubleClickVisualisationCreator =
        Ren.DataGridCellSelection_DoubleClickVisualisationCreator(
            tabularData,
            dataGroupingSettings,
            adHocVisualisationCreator,
            rawValueReader
        );

    const filterChangedHandler = Ren.DataGridCellSelection_FilterChangedHandler(
        dataGroupingSettings,
        selection
    );

    Ren.DataGridCellSelection_StyleUpdater(
        dataGroupingSettings,
        dataGridGuid,
        selection,
        gridState,
        firstLastCell
    );

    Ren.Messages.Events.filterChanged.handle((
        _tabularDataGuid, dataGroupingSettingsGroup, containingReportGuid) => {

        if (visualisation.isDestroyed) return false;

        if (!Ren.ReportContextMatch.isSameGroup(
            dataGroupingSettingsGroup,
            containingReportGuid,
            dataGroupingSettings.dataGroupingSettingsGroup,
            dataGroupingSettings.containingReportGuid
        )) return;

        filterChangedHandler.handleFilterChanged(updateUI, getSelectedColumnIndexes);
    });

    Ren.Messages.Requests.createAdHocVisualisation.handle((requestedDataGridGuid, visualisationTypeName, popupReuseId, options) => {

        if (visualisation.isDestroyed) return false;
        if (requestedDataGridGuid !== dataGridGuid) return;

        adHocVisualisationCreator.createAdHocVisualisation(visualisationTypeName, popupReuseId, options);
    });

    // --- Sub-modules ------------------------------------------------------------------------

    // Reading the selection, reacting to the mouse, and wiring the mouse up to the grid are three
    // separate jobs, and each is a body of code in its own right, so each lives in its own module
    // (see the -queries, -pointer-handlers and -event-delegation modules).  They all work on the
    // same collaborators built above, so those are gathered once here and handed over whole.
    const parts = {
        visualisation,
        tabularData,
        dataGroupingSettings,
        dataGridGuid,
        gridState,
        cellParser,
        cellValueReader,
        selectedCellsCalculator,
        tsvGenerator,
        firstLastCell,
        selection,
        cellSelectionStatBar,
        selectionStateReader,
        adHocVisualisationCreator,
        doubleClickVisualisationCreator,
        rawValueReader
    };

    const {
        getSelectedColumnIndexes,
        getSelectedColumnIdsOrHeadings,
        getSelectedCellsTsv,
        areMultipleCellsSelected,
        areSelectedCellsAllInSameColumn,
        areSelectedCellValuesValidForFiltering,
        getCompressedValuesOfSelectedCells,
        getExportSelection,
        getStatBarValues,
        getSelectedCells,
        getSelectedRowIndexesInDisplayOrder,
        getSelectedDataRowIndexes,
        getSelectedRawValuesInColumn
    } = Ren.DataGridCellSelection_Queries(parts);

    const { hasSelectedDates, getSelectedDates } = Ren.DataGridCellSelection_DateReader(parts);

    const { getColumnsText } = Ren.DataGridCellSelection_QA(parts, getSelectedCellsTsv);

    const updateUI = () => {

        Ren.Messages.Events.selectedValuesChanged.notify(dataGridGuid, getStatBarValues);
    };

    Ren.Messages.Events.reportAddedToDom.handle(() => {

        Ren.FnUtils.defer(updateUI);
    });

    // The repaint handler below runs once only, so settings applied after it (as when a report is
    // reloaded for new parameters) would otherwise leave the stat bar's row count stale.
    dataGroupingSettings.sortFilterGroup.onChanged(() => {

        if (visualisation.isDestroyed) return;

        updateUI();
    });

    // The handlers change the selection and then ask for the UI to be brought up to date, which is
    // this module's business rather than theirs, so updateUI is passed in.
    const handlers = Ren.DataGridCellSelection_PointerHandlers(parts, updateUI);

    // Find works on the same collaborators, and reports the UI change in the same way.
    const { findNext, selectMatchingRows, filterMatchingRows, clearFilterRows, hasFilterRows } =
        Ren.DataGridCellSelection_Find(parts, updateUI);

    const { setupDelegatedEvents } = Ren.DataGridCellSelection_EventDelegation(parts, handlers);

    /**
     * Gets the index (including headings) of the one row the selection lies in, where that row can
     * be opened in a row visualiser, or else null.
     */
    const getSelectedVisualisableRowIndex = () => {

        const rowIndexes = getSelectedRowIndexesInDisplayOrder();

        if (rowIndexes.length !== 1) return null;

        const rowIndex = rowIndexes[0] + tabularData.HeadingCount;

        return doubleClickVisualisationCreator.isVisualisableRow(rowIndex) ? rowIndex : null;
    };

    /**
     * Selects the whole of the one row the selection lies in and opens the named row visualiser
     * for it, always in a new popup.
     */
    const createRowVisualisation = (visualisationTypeName) => {

        const rowIndex = getSelectedVisualisableRowIndex();

        if (rowIndex === null) return;

        handlers.selectRow(rowIndex);

        doubleClickVisualisationCreator.createRowVisualisation(
            visualisationTypeName,
            rowIndex,
            null
        );
    };

    const initialise = () => {

        selection.clearSelectedRects();

        const dataGridContainer = document.querySelector("." + dataGridGuid);

        if (!dataGridContainer) return; // Can happen when reloading report after parameter change.

        // When the top-left corner is clicked, select all cells.  Unless any cells are already
        // selected, in which case de-select all cells.
        const headingCorner = dataGridContainer.querySelector(".js-ren-heading-corner");

        if (headingCorner && !headingCorner.selectAllClickHandlerAttached) {

            headingCorner.selectAllClickHandlerAttached = true;

            headingCorner.addEventListener("click", (e) => {

                if (e.button !== 0) return; // Left mouse button only.
                e.preventDefault();

                if (selection.selectionType() === "all") {
                    selection.clearSelection();
                }
                else {

                    selection.selectAll();
                }

                selection.clearDragRect();
                selection.isFoundCell(false);
                updateUI();
            });
        }

        setupDelegatedEvents(dataGridContainer);

        updateUI();

        Ren.Messages.Events.selectedValuesChanged.notify(dataGridGuid, getStatBarValues);
    };

    /**
     * Adds the right-click context-menu items to the row headings of the given rows.  Mouse
     * selection handlers are attached once via event delegation (see setupDelegatedEvents), so this
     * only needs to wire up the per-row-heading context menus as new rows are rendered.
     */
    const addRowHeadingContextMenus = function (rowIndexesIncHeadings) {

        rowIndexesIncHeadings.forEach(r => {

            const rowHeading = document.querySelector(
                `.${gridState.dataGridGuid} .ren-data-grid__row-heading.ren-r-${r}`
            );

            if (rowHeading && !rowHeading.contextMenuItemsAdded) {

                rowHeading.contextMenuItemsAdded = true;
                addContextMenuItemsToRowHeading(r, rowHeading);
            }
        });
    };

    Ren.Messages.Requests.repaint.handle(() => {

        if (visualisation.isDestroyed) return false;
        initialise();
    }, true);

    Ren.Messages.Events.reportGenerating.handle(() => {

        if (visualisation.isDestroyed) return false;
        selection.clearSelection();
        updateUI();
    });

    /**
     * Gets what the grid shows each selected column as where its heading has been overridden,
     * keyed by column ID or heading, or null where none has.
     */
    const getSelectedColumnDisplayHeadings = () => {

        let displayHeadings = null;
        const columnIndexes = getSelectedColumnIndexes();

        for (let i = 0; i < columnIndexes.length; i++) {

            const override = gridState?.getDisplayHeadingOverride(columnIndexes[i]);

            if (!override) continue;

            displayHeadings ??= {};
            displayHeadings[tabularData.columnResolver.getColumnIdOrHeading(columnIndexes[i])] =
                override;
        }

        return displayHeadings;
    };

    return {
        findNext,
        selectMatchingRows,
        filterMatchingRows,
        clearFilterRows,
        hasFilterRows,
        getSelectedCellsTsv,
        getColumnsText,
        addRowHeadingContextMenus,
        getSelectedColumnIndexes,
        getSelectedColumnIdsOrHeadings,
        getSelectedColumnDisplayHeadings,
        getSelectedCells,
        areMultipleCellsSelected,
        areSelectedCellsAllInSameColumn,
        getCompressedValuesOfSelectedCells,
        areSelectedCellValuesValidForFiltering,
        getExportSelection,
        getSelectedDataRowIndexes,
        getSelectedRawValuesInColumn,
        hasSelectedDates,
        getSelectedDates,
        selectionType: selection.selectionType,
        getSelectedVisualisableRowIndex,
        getRowVisualisers: doubleClickVisualisationCreator.getRowVisualisers,
        getDefaultRowVisualiser: doubleClickVisualisationCreator.getDefaultRowVisualiser,
        setDefaultRowVisualiser: doubleClickVisualisationCreator.setDefaultRowVisualiser,
        createRowVisualisation,
        setRowHeadingContextMenuItems,
        addContextMenuItemsToRowHeading
    };
};
