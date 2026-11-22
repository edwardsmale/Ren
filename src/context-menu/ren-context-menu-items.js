/**
 * Functions to add items to the context menu.
 */
Ren.ContextMenuItems = (
    tabularData,
    dataGroupingSettings,
    expandedGroups,
    setColumnVisibility,
    contextMenu,
    gridSetGuid,
    dataGridGuid,
    dataGridCellSelection,
    gridState,
    visualisation) => {

    const semanticColumnMenuItems = Ren.ContextMenuItems_SemanticColumns(tabularData);

    const columnHasNulls = (columnIndex) => {

        const distinctColumnCVs = tabularData.getDistinctColumnCV?.(columnIndex);
        const compressionDictionary = tabularData.CompressionDictionary;

        if (!distinctColumnCVs || !compressionDictionary) return true;

        for (let i = 0; i < distinctColumnCVs.length; i++) {

            const value = compressionDictionary.decompressValue(distinctColumnCVs[i], columnIndex);

            if (Ren.IsNullOrEmpty(value)) return true;
        }

        return false;
    };

    const formattingMenuItems = Ren.ContextMenuItems_Formatting(
        (columnIndex, rowIndex, valueFormatFunction) =>
            dataGroupingSettings.setFormatFunction(columnIndex, rowIndex, valueFormatFunction),
        {
            columnHasNulls: (columnIndex) => columnHasNulls(columnIndex),
            getFormatFunction: (columnIndex, rowIndex) =>
                dataGroupingSettings.getFormatFunction(columnIndex, rowIndex)
        }
    );

    const calculationMenuItems = Ren.ContextMenuItems_Calculation(
        (columnIndex, rowIndex) => dataGroupingSettings.getCalcFunction(columnIndex, rowIndex),
        (columnIndex, rowIndex, calcFunction) =>
            dataGroupingSettings.setCalcFunction(columnIndex, rowIndex, calcFunction),
        tabularData
    );

    const tooltipMenuItems = Ren.ContextMenuItems_Tooltips(dataGroupingSettings, tabularData);

    const stylingMenuItems = Ren.ContextMenuItems_Styling(
        (propertyName, columnIndex, rowIndex) =>
            dataGroupingSettings.getStyleFunction(propertyName, columnIndex, rowIndex),
        (propertyName, columnIndex, rowIndex, code) =>
            dataGroupingSettings.setStyleFunction(propertyName, columnIndex, rowIndex, code),
        (columnIndex, rowIndex) =>
            dataGroupingSettings.getMergesDataRowBackgrounds(columnIndex, rowIndex),
        (columnIndex, rowIndex, mergesBackgrounds) =>
            dataGroupingSettings.setMergesDataRowBackgrounds(
                columnIndex,
                rowIndex,
                mergesBackgrounds
            ),
        (propertyName, rowIndex) =>
            dataGroupingSettings.hasStyleFunctionInAnyColumn(propertyName, rowIndex),
        (propertyName, rowIndex) =>
            dataGroupingSettings.removeStyleFunctionFromAllColumns(propertyName, rowIndex),
        tabularData
    );

    const aggregationMenuItems = Ren.ContextMenuItems_Aggregation(tabularData, dataGroupingSettings);
    const totalsRowMenuItems = Ren.ContextMenuItems_TotalsRow(dataGroupingSettings);
    const dataGridStatBarMenuItems = Ren.ContextMenuItems_DataGridStatBar(visualisation);
    const dataGridPagingMenuItems = Ren.ContextMenuItems_DataGridPaging(visualisation);
    const dataGridColumnHeaderDownArrowsMenuItems = Ren.ContextMenuItems_DataGridColumnHeaderDownArrows(visualisation);
    const dataGridHighlightHoveredRowMenuItems =
        Ren.ContextMenuItems_DataGridHighlightHoveredRow(visualisation);
    const dataGridAutoPreviewMenuItems = Ren.ContextMenuItems_DataGridAutoPreview(visualisation);
    const dataGridQuickLinksMenuItems = Ren.ContextMenuItems_DataGridQuickLinks(visualisation);
    const dataGridRowVisualiserMenuItems =
        Ren.ContextMenuItems_DataGridRowVisualiser(dataGridCellSelection);
    const dataGridVariationsMenuItems = Ren.ContextMenuItems_DataGridVariations(visualisation);
    const windowsMenuItems = Ren.ContextMenuItems_Windows(visualisation, tabularData.tabularDataGuid, gridSetGuid, dataGridGuid);
    const groupingMenuItems = Ren.ContextMenuItems_Grouping(tabularData, dataGroupingSettings, expandedGroups, visualisation);
    const columnSortingMenuItems = Ren.ContextMenuItems_ColumnSorting(tabularData, dataGroupingSettings);
    const dataGridCreateVisualisationMenuItems =
        Ren.ContextMenuItems_DataGridCreateVisualisationMenuItems(
            contextMenu,
            dataGridGuid,
            dataGridCellSelection,
            visualisation,
            tabularData
        );

    const dataGridDatesMenuItems = Ren.ContextMenuItems_Dates(
        dataGridCellSelection.hasSelectedDates,
        dataGridCellSelection.getSelectedDates
    );

    const groupingSettingsEditorMenuItemHelper = Ren.GroupingSettingsEditorMenuItemHelper(
        visualisation,
        dataGroupingSettings
    );

    const sortFilterGroup = dataGroupingSettings.sortFilterGroup;

    // Set while a data-row cell's menu is being built as it opens, to gather the items instead.
    let collectedMenuItems = null;

    const addMenuItems = (element, menuItems) => {

        if (collectedMenuItems) {

            Ren.ArrayUtils.pushAll(collectedMenuItems, menuItems);
            return;
        }

        contextMenu.addMenuItems(element, menuItems);
    };

    const addSeparatorMenuItem = (section, element) => {

        addMenuItems(element, [{
            section: section,
            text: "-"
        }]);
    };

    /**
     * Adds the 'group by' menu items.
     */
    const addGroupByMenuItems = (columnIndex, element, group, isDataRow, isReplacedRow) => {

        addMenuItems(
            element,
            groupingMenuItems.getMenuItems(columnIndex, group, !!isDataRow, !!isReplacedRow)
        );
    };

    // Gets the sort order of the data rows (row index -1), or of the grouping holding the row.
    const getSortOrder = (rowIndex) => rowIndex === -1
        ? dataGroupingSettings.dataRows.sortOrder
        : dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex)?.sortOrder;

    const getSortCalcFunction = (columnIndex, rowIndex) =>
        getSortOrder(rowIndex)?.sortCalcFunction ?? "";

    // Keeps the current sort direction.
    const setSortCalcFunction = (columnIndex, rowIndex, sortCalcFunction) => {

        dataGroupingSettings.sortFilterGroup.sortWithCalcFunction(
            columnIndex,
            rowIndex,
            getSortOrder(rowIndex)?.isDescending ?? false,
            sortCalcFunction
        );
    };

    // Sorts by each value's position in the column's enum rather than by its label.
    const sortByEnumOrder = (columnIndex, rowIndex, descending) => {

        const enumValues = tabularData.ColumnModels[columnIndex].EnumValues;
        const enumOrder = {};

        for (const key in enumValues) enumOrder[enumValues[key]] = parseInt(key);

        sortFilterGroup.sortWithCalcFunction(
            columnIndex,
            rowIndex,
            descending,
            { name: "enum-order", parameters: { enumOrder: JSON.stringify(enumOrder) } }
        );
    };

    /**
     * Adds menu items that sort groupings.
     */
    const addSortGroupingMenuItems = (columnIndex, rowIndex, element, grouping) => {

        /**
         * Gets the sort direction label for the column's value format, at the given direction
         * index (0 = ascending label, 1 = descending label).
         */
        const getSortDirectionText = (directionIndex) => {

            const valueFormat = getColumnValueFormat(columnIndex, grouping);

            const sortDirectionStrings = Ren.SortDirectionStringsProvider.getSortDirectionStrings(valueFormat);
            return `Sort ${sortDirectionStrings[directionIndex]}`;
        };

        addMenuItems(element, [
            {
                section: "Data",
                text: () => getSortDirectionText(0),
                id: () => "sort-ascending",
                actionParameters: [columnIndex, rowIndex, false],
                action: sortFilterGroup.sort
            },
            {
                section: "Data",
                text: () => getSortDirectionText(1),
                id: () => "sort-descending",
                actionParameters: [columnIndex, rowIndex, true],
                action: sortFilterGroup.sort
            },
            {
                section: "Data",
                text: "Advanced sort",
                id: "advanced-sort",
                submenu: [
                    {
                        text: "Sort by length",
                        id: "sort-by-length",
                        visible: () => tabularData.ColumnModels[columnIndex].ColumnType === "String",
                        submenu: [
                            {
                                text: "Shortest first",
                                id: "sort-by-length-asc",
                                actionParameters: [columnIndex, rowIndex, false, {
                                    name: "string-length"
                                }],
                                action: sortFilterGroup.sortWithCalcFunction
                            },
                            {
                                text: "Longest first",
                                id: "sort-by-length-desc",
                                actionParameters: [columnIndex, rowIndex, true, {
                                    name: "string-length"
                                }],
                                action: sortFilterGroup.sortWithCalcFunction
                            }]
                    },
                    {
                        text: "Enum order",
                        id: "sort-by-enum-order",
                        visible: () => !!tabularData.ColumnModels[columnIndex].EnumValues,
                        submenu: [
                            {
                                text: "Lowest value first",
                                id: "sort-by-enum-order-asc",
                                action: () => sortByEnumOrder(columnIndex, rowIndex, false)
                            },
                            {
                                text: "Highest value first",
                                id: "sort-by-enum-order-desc",
                                action: () => sortByEnumOrder(columnIndex, rowIndex, true)
                            }]
                    },
                    Ren.MENU_SEPARATOR,
                    {
                        text: "Custom...",
                        id: "sort-by-function-custom",
                        ticked: () => !!Ren.FormatFunctionUtils.getCustomCode(
                            getSortCalcFunction(columnIndex, rowIndex)
                        ),
                        action: () => {

                            Ren.Messages.Requests.functionEditorWindow.notify(
                                () => getSortCalcFunction(columnIndex, rowIndex),
                                (newFunction) => setSortCalcFunction(columnIndex, rowIndex, newFunction),
                                null,
                                null,
                                { centred: true, parameterSet: "valueOnly", functionTag: "sort" }
                            );
                        }
                    },
                    {
                        text: "Multi-level sort...",
                        id: "multi-level-sort",
                        action: () => groupingSettingsEditorMenuItemHelper
                            .openMultiLevelSortEditor(element)
                    }
                ]
            }
        ]);
    };

    /**
     * Adds column-level sorting menu items.
     */
    const addColumnSortMenuItems = (columnIndex, element) => {

        addMenuItems(element, columnSortingMenuItems.getMenuItems(columnIndex));
    };

    /**
     * Gets the value format for all groupings, if their column value formats are all the same.  If
     * there are multiple value formats, returns null.
     */
    const getAllGroupingsColumnValueFormat = (columnIndex) => {

        const valueFormats = new Set();

        for (let i = 0; i < dataGroupingSettings.groupings.entries.length; i++) {

            valueFormats.add(getColumnValueFormat(columnIndex, dataGroupingSettings.groupings.entries[i]));
        }

        valueFormats.add(getColumnValueFormat(columnIndex, null)); // Add the leaf grouping.

        if (valueFormats.size === 1) {

            return valueFormats.values().next().value;
        }
        else {

            return null;
        }
    };

    // Gets a value indicating whether a grouping is the leaf grouping, which groups by no columns.
    const isLeafGrouping = (grouping) => grouping?.groupByColumnIndexes?.length === 0;

    /**
     * Gets the value format for a column in a grouping.  If the passed grouping is null, returns
     * the data row value format.  If the grouping is the leaf grouping (no group-by columns), also
     * returns the data row value format to account for calc functions.
     */
    const getColumnValueFormat = (columnIndex, grouping) => {

        const columnModel = tabularData.ColumnModels[columnIndex];

        if (columnModel === undefined) return Ren.SpreadsheetColumnFormatEnum.General;

        if (!grouping || isLeafGrouping(grouping)) {

            const columnFormats = dataGroupingSettings.getDataRowsColumnFormats();
            return columnFormats.columnValueFormats[columnIndex];
        }

        return grouping.columns[columnModel.ColumnIdOrHeading]?.valueFormat ??
               tabularData.ColumnModels[columnIndex].ColumnFormat;
    };

    const columnFilterMenuItemsHelper = Ren.ColumnFilterMenuItemsHelper(
        tabularData,
        visualisation,
        dataGroupingSettings,
        sortFilterGroup
    );

    /**
     * Gets the index of the automatically-added 'Count' column.
     */
    const countColumnIndex = () => tabularData.findColumnIndex("__Count");

    /**
     * Shows the automatically-added 'Count' column.
     */
    const showCountColumn = () => setColumnVisibility(countColumnIndex(), true);

    /**
     * Adds the "Open group in new grid" menu item for a group row of a grouping between the leaf
     * and outermost ones, which opens a popup grid of only the group's rows.
     */
    const addExtractDataMenuItem = (columnIndex, rowIndex, element, group, grouping) => {

        if (rowIndex < tabularData.DataRowCount) return;

        if (!Ren.DataGrid_ExtractGroup.canExtractGroup(dataGroupingSettings, group, grouping)) {
            return;
        }

        addMenuItems(element, [{
            section: "Other",
            text: "Open group in new grid",
            id: "extract-group-data",
            action: () => Ren.DataGrid_ExtractGroup.extractGroup(
                visualisation,
                tabularData,
                dataGroupingSettings,
                gridState,
                group,
                grouping,
                columnIndex
            )
        }]);
    };

    /**
     * Adds menu items that apply to a grouping.  isReplacedRow means the right-clicked row has gone
     * and the given group has taken its place.
     */
    const addGroupingMenuItems = (
        columnIndex,
        rowIndex,
        element,
        group,
        grouping,
        cellValue,
        rowVals,
        isReplacedRow) => {

        const columnValueFormat = getColumnValueFormat(columnIndex, grouping);

        addShowHideColumnsMenuItems(columnIndex, element);
        addExtractDataMenuItem(columnIndex, rowIndex, element, group, grouping);

        const isLeaf = isLeafGrouping(grouping);

        if (!grouping?.isOutermostGrouping || isLeaf) {

            addSeparatorMenuItem("Data", element);
            addSortGroupingMenuItems(columnIndex, rowIndex, element, isLeaf ? null : grouping, group);
            addGroupByMenuItems(
                columnIndex,
                element,
                group,
                rowIndex >= 0 && rowIndex < tabularData.DataRowCount,
                isReplacedRow
            );
        }
        else if (isReplacedRow) {

            // Still offered in place of the gone row, so its disabled grouping can be enabled.
            addGroupByMenuItems(columnIndex, element, group, false, true);
        }

        addColumnSummaryMenuItems(columnIndex, element);
        addFilteringMenuItems(
            columnIndex,
            element,
            cellValue,
            getFilterLevelTileKey(rowIndex, grouping)
        );

        addFormattingMenuItems(columnIndex, rowIndex, columnValueFormat, element);
        addMenuItems(element, stylingMenuItems.getMenuItems(columnIndex, rowIndex));
        addMenuItems(element, tooltipMenuItems.getCellMenuItems(columnIndex, rowIndex));
        addCalculationMenuItems(columnIndex, rowIndex, columnValueFormat, element);
        addAggregationMenuItems(columnIndex, rowIndex, grouping, element);
        addSemanticMenuItems(columnIndex, element, cellValue, rowVals);
    };

    const addLayoutMenu = (element) => {

        const layoutMenuItems = [
        dataGridVariationsMenuItems.getMenuItem(),
        dataGridQuickLinksMenuItems.getMenuItem(),
        dataGridStatBarMenuItems.getMenuItem(),
        dataGridPagingMenuItems.getMenuItem(),
        dataGridColumnHeaderDownArrowsMenuItems.getMenuItem(),
        dataGridHighlightHoveredRowMenuItems.getMenuItem(),
        dataGridAutoPreviewMenuItems.getMenuItem(),
        {
            text: "Totals row",
            id: "layout-totals-row",
            submenu: totalsRowMenuItems.getMenuItems()
        }];

        addMenuItems(element, [{
            section: "Layout",
            text: "Layout",
            id: "layout-menu",
            submenu: layoutMenuItems
        }]);
    };

    /**
     * Gets the menu item that writes an INSERT statement for the selected rows.  Whole rows have to
     * be selected for it, since a statement built from part of a row would insert a different row.
     *
     * The selection is read when the item is clicked rather than when the menu is built, since the
     * menu is built before a right-click on a row heading has selected that row.
     */
    const getInsertStatementMenuItem = (visible) => ({
        section: "Tech",
        text: "Generate INSERT statement",
        id: "generate-insert-statement",
        techOnly: true,
        visible,
        action: () => Ren.DataGridInsertStatement.show(
            tabularData,
            gridState.visibleColumnIndexes(),
            dataGridCellSelection.getSelectedDataRowIndexes()
        )
    });

    /**
     * Gets the menu item that writes an IN predicate for the selected cells, ready to be pasted
     * into a WHERE clause. The cells have to stand in one column for it. The selection is read when
     * the item is clicked, as for the INSERT statement item above.
     */
    const getInPredicateMenuItem = (visible) => ({
        section: "Tech",
        text: "Generate IN predicate",
        id: "generate-in-predicate",
        techOnly: true,
        visible,
        action: () => {

            const columnIndexes = dataGridCellSelection.getSelectedColumnIndexes();

            if (!columnIndexes.length) return;

            const columnIndex = columnIndexes[0];

            Ren.DataGridInPredicate.show(
                tabularData,
                columnIndex,
                dataGridCellSelection.getSelectedRawValuesInColumn(columnIndex)
            );
        }
    });

    /**
     * Gets a value indicating whether what is selected is one column's worth of cells, however the
     * selection was made.
     */
    const isSingleColumnSelected = () =>
        dataGridCellSelection.getSelectedColumnIndexes().length === 1;

    const addDataGridMenuItems = (element) => {

        addShowWindowsMenuItems(element);
        addLayoutMenu(element);

        addMenuItems(element, [getInsertStatementMenuItem(
            () => dataGridCellSelection.selectionType() === "row"
        )]);

        addMenuItems(element, [getInPredicateMenuItem(isSingleColumnSelected)]);

        dataGridCreateVisualisationMenuItems.addCreateVisualisationMenuItems(element);

        addMenuItems(element, [dataGridRowVisualiserMenuItems.getMenuItem()]);

        addMenuItems(element, dataGridDatesMenuItems.getMenuItems());

        // Otherwise only on column headings, of which none are left once every column is hidden.
        addMenuItems(element, [getShowColumnsMenuItem(
            element,
            () => gridState.visibleColumnIndexes().length === 0
        )]);
    };

    /**
     * Adds menu items that show/hide columns.
     */
    const addShowHideColumnsMenuItems = (columnIndex, element) => {

        addMenuItems(element, [{
            section: "Columns",
            text: "Hide column",
            id: "hide-column",
            action: () => {

                const selectedColumnIndexes = dataGridCellSelection.getSelectedColumnIndexes();

                for (let i = 0; i < selectedColumnIndexes.length; i++) {
                    setColumnVisibility(selectedColumnIndexes[i], false);
                }
            }
        }]);

        addMenuItems(element, [getShowColumnsMenuItem(element)]);
    };

    /**
     * Gets the menu item whose submenu shows hidden columns.
     */
    const getShowColumnsMenuItem = (element, visible) => ({
        section: "Columns",
        text: "Show columns",
        id: "show-columns-menu",
        visible,
        submenu: [
            {
                text: "Count column",
                id: "show-count-column",
                action: showCountColumn
            },
            {
                text: "Show/hide columns...",
                id: "show-hide-column",
                action: () => Ren.Messages.Requests.dataGridShowHideColumnsWindow.notify(
                    dataGridGuid,
                    element,
                    null
                )
            }
        ]
    });

    /**
     * Adds a menu item that shows a window summarising the data in a column.
     */
    const addColumnSummaryMenuItems = (columnIndex, element) => {

        addMenuItems(element, [{
            section: "Columns",
            text: "Column summary",
            id: "show-column-summary-window",
            action: () => Ren.Messages.Requests.tabularDataColumnSummary.notify(tabularData.tabularDataGuid, columnIndex, element)
        }]);

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        addMenuItems(element, [{
            section: "Columns",
            text: "Duplicate column",
            id: "duplicate-column",
            action: () => {

                visualisation.tabularDataTransformers.push({
                    tabularDataTransformerName: "DuplicateColumn",
                    parameters: { columnIdOrHeading }
                });

                visualisation.recreate();
            }
        }]);
    };

    const addDataGroupingSettingsTransformerMenuItems = (columnIndex, element) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        // Laid out as a data cell's Filter submenu, with the filter windows in place of the
        // cell-value items.
        addMenuItems(element, [{
            section: "Data",
            text: "Filter",
            id: "filter-menu-option",
            submenu: [
                columnFilterMenuItemsHelper.createFilterDataRowsMenuItem(columnIdOrHeading, element),
                columnFilterMenuItemsHelper.createFilterGroupsMenuItem(columnIdOrHeading, element),
                columnFilterMenuItemsHelper.createColumnFilterSeparatorMenuItem(),
                columnFilterMenuItemsHelper.createClearColumnFilterMenuItem(columnIdOrHeading),
                columnFilterMenuItemsHelper.createClearAllColumnFiltersMenuItem(),
                columnFilterMenuItemsHelper.createClearAllFiltersMenuItem(),
                columnFilterMenuItemsHelper.createColumnFilterSeparatorMenuItem(),
                // Unsectioned as in a data cell's submenu.
                Object.assign(
                    groupingSettingsEditorMenuItemHelper.createEditAllFiltersMenuItem(element),
                    { section: undefined }
                )
            ]
        }]);
    };

    /**
     * Adds a menu item that lets the user change the text displayed for a column's heading.  The
     * override is stored on the grid state and re-rendered when the grid state changes.
     */
    const addChangeHeadingMenuItem = (columnIndex, element) => {

        addMenuItems(element, [{
            section: "Columns",
            text: "Change heading...",
            id: "change-heading",
            action: () => {

                const gridState = Ren.GridStateCollection.getGridStateByDataGridGuid(dataGridGuid);

                if (!gridState) return;

                const actualHeading = tabularData.ColumnModels[columnIndex].Heading;
                const currentOverride = gridState.getDisplayHeadingOverride(columnIndex);

                Ren.CreateOkCancelTextEditorPopupWindow(
                    "Change heading",
                    // Emptied means "back to the column's own heading", not a blank heading, since
                    // clearing the box is the only way back from a rename.
                    newHeading =>
                        gridState.setDisplayHeadingOverride(columnIndex, newHeading?.trim() || null),
                    {
                        label: "Column heading",
                        initialText: currentOverride || actualHeading,
                        multiline: false,
                        width: 320,
                        height: 130
                    }
                );
            }
        }]);
    };

    /**
     * Adds menu items that apply to a column.
     */
    const addColumnMenuItems = (columnIndex, element) => {

        addShowHideColumnsMenuItems(columnIndex, element);
        addColumnSortMenuItems(columnIndex, element);
        addGroupByMenuItems(columnIndex, element, null);
        addColumnSummaryMenuItems(columnIndex, element);
        addChangeHeadingMenuItem(columnIndex, element);
        addMenuItems(element, tooltipMenuItems.getHeadingMenuItems(columnIndex));
        addDataGroupingSettingsTransformerMenuItems(columnIndex, element, visualisation);

        const columnValueFormat = getAllGroupingsColumnValueFormat(columnIndex);

        if (columnValueFormat) {
            addFormattingMenuItems(columnIndex, null, columnValueFormat, element);
        }

        // A right-click on a column's heading selects that column, so the IN predicate item is
        // offered there, with the same ID as the grid's own so that it supersedes that one.
        addMenuItems(element, [getInPredicateMenuItem()]);
    };

    // Gets the Multi-level filter tile for a cell's level: "dataRows" for a data row, the
    // grouping's entry index for a group row, or null for the Totals row, which has no filters of
    // its own.
    const getFilterLevelTileKey = (rowIndex, grouping) => {

        if (rowIndex >= 0 && rowIndex < tabularData.DataRowCount) return "dataRows";

        if (!grouping || grouping.isOutermostGrouping) return null;

        const entryIndex = dataGroupingSettings.groupings.entries.indexOf(grouping);

        return entryIndex < 0 ? null : entryIndex;
    };

    /**
     * Adds filtering menu items.  filterLevelTileKey names the cell's level for "Edit filters at
     * this level", which is left out when it is null.
     */
    const addFilteringMenuItems = (columnIndex, cell, cellValue, filterLevelTileKey) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        const filterLevelGrouping = typeof filterLevelTileKey === "number"
            ? dataGroupingSettings.groupings.entries[filterLevelTileKey]
            : null;

        // Filtered at the cell's own level, where "Edit filters at this level" shows it: a group
        // row's grouping, or else the data rows.
        const filterValuesAtLevel = (filterValues) => {

            if (filterLevelGrouping) {

                sortFilterGroup.filterGrouping(
                    filterLevelGrouping,
                    columnIdOrHeading,
                    filterValues
                );
            }
            else {

                sortFilterGroup.filter(columnIdOrHeading, filterValues);
            }
        };

        const excludeValuesAtLevel = (excludedValues) => {

            if (filterLevelGrouping) {

                sortFilterGroup.excludeGroupingValues(
                    filterLevelGrouping,
                    columnIdOrHeading,
                    excludedValues
                );
            }
            else {

                sortFilterGroup.excludeValues(columnIdOrHeading, excludedValues);
            }
        };

        addMenuItems(cell, [
            {
                section: "Data",
                text: "Filter",
                id: "filter-menu-option",
                submenu: [
                    {
                        section: "Filter",
                        text: "Filter to this value only",
                        id: "filter-this-value-only",
                        visible: () =>
                            !dataGridCellSelection.areMultipleCellsSelected() &&
                            dataGridCellSelection.areSelectedCellValuesValidForFiltering(columnIndex),
                        actionParameters: [cellValue],
                        action: filterValuesAtLevel
                    },
                    {
                        section: "Filter",
                        text: "Exclude this value",
                        id: "filter-exclude-this-value",
                        visible: () =>
                            !dataGridCellSelection.areMultipleCellsSelected() &&
                            dataGridCellSelection.areSelectedCellValuesValidForFiltering(columnIndex),
                        actionParameters: [cellValue],
                        action: excludeValuesAtLevel
                    },
                    {
                        section: "Filter",
                        text: "Selected values only",
                        id: "filter-selected-values-only",
                        visible: () =>
                            dataGridCellSelection.areMultipleCellsSelected() &&
                            dataGridCellSelection.areSelectedCellsAllInSameColumn() &&
                            dataGridCellSelection.areSelectedCellValuesValidForFiltering(columnIndex),
                        action: () => {

                            filterValuesAtLevel(
                                dataGridCellSelection.getCompressedValuesOfSelectedCells()
                            );
                        }
                    },
                    {
                        section: "Filter",
                        text: "Exclude selected values",
                        id: "filter-exclude-selected-values",
                        visible: () =>
                            dataGridCellSelection.areMultipleCellsSelected() &&
                            dataGridCellSelection.areSelectedCellsAllInSameColumn() &&
                            dataGridCellSelection.areSelectedCellValuesValidForFiltering(columnIndex),
                        action: () => {

                            excludeValuesAtLevel(
                                dataGridCellSelection.getCompressedValuesOfSelectedCells()
                            );
                        }
                    },
                    columnFilterMenuItemsHelper.createColumnFilterSeparatorMenuItem(),
                    columnFilterMenuItemsHelper.createClearColumnFilterMenuItem(
                        columnIdOrHeading,
                        filterLevelGrouping
                    ),
                    columnFilterMenuItemsHelper.createClearAllColumnFiltersMenuItem(),
                    columnFilterMenuItemsHelper.createClearAllFiltersMenuItem(),
                    columnFilterMenuItemsHelper.createColumnFilterSeparatorMenuItem(),
                    {
                        text: "Edit filters at this level",
                        id: "edit-filters-at-this-level",
                        visible: () => filterLevelTileKey != null,
                        action: () => groupingSettingsEditorMenuItemHelper
                            .openMultiLevelFilterEditor(
                                cell,
                                filterLevelTileKey,
                                columnIdOrHeading
                            )
                    },
                    // Unsectioned like the item above, so the submenu gets no section headings.
                    Object.assign(
                        groupingSettingsEditorMenuItemHelper.createEditAllFiltersMenuItem(cell),
                        { section: undefined }
                    )]
            }]);
    };

    /**
     * Adds menu items that depend on the specific type of data in a column, e.g. account refs or
     * order IDs.
     */
    const addSemanticMenuItems = (columnIndex, cell, cellValue, rowVals) => {

        addMenuItems(
            cell,
            semanticColumnMenuItems.getMenuItems(cellValue, columnIndex, rowVals)
        );
    };

    /**
     * Recursively calls transform on all leaf menu items — those with an action and
     * actionParameters.
     */
    const applyToAllLeafMenuItems = (items, transform) => {

        for (let i = 0; i < items.length; i++) {

            const item = items[i];

            if (item.submenu) {

                applyToAllLeafMenuItems(item.submenu, transform);
            }
            else if (item.action && item.actionParameters) {

                transform(item);
            }
        }
    };

    /**
     * Converts selected cells from display coordinates to SQL column indexes and data row indexes.
     */
    const getSelectedCellColumnRowIndexes = () => {

        const cells = dataGridCellSelection.getSelectedCells();
        const result = [];

        for (let i = 0; i < cells.length; i++) {

            const cell = cells[i];

            result.push({
                columnIndex: dataGroupingSettings.getColIndex(cell.x),
                rowIndex: dataGroupingSettings.getRowIndex(cell.y) - tabularData.HeadingCount
            });
        }

        return result;
    };

    /**
     * Wraps menu item actions so that, while multiple cells are selected, applyToSelectedCells is
     * called with the selected cells, the item's action and its value instead.
     */
    const wrapForMultiSelect = (items, applyToSelectedCells) => {

        applyToAllLeafMenuItems(items, (item) => {

            const originalAction = item.action;
            const originalParameters = item.actionParameters;

            item.action = () => {

                if (dataGridCellSelection.areMultipleCellsSelected() &&
                    dataGridCellSelection.selectionType() === "cell") {

                    applyToSelectedCells(
                        getSelectedCellColumnRowIndexes(),
                        originalAction,
                        originalParameters[2]
                    );
                }
                else {

                    originalAction.apply(null, originalParameters);
                }
            };

            item.actionParameters = null;
        });
    };

    /**
     * Changes for the same grouping are batched into a single settings update, to avoid the
     * dataGroupingSettingsChanged dedup key dropping intermediate changes.
     */
    const setAggregationForSelectedCells = (cellColumnRowIndexes, originalAction, value) => {

        let propertyName;

        if (originalAction === dataGroupingSettings.setAggregationType) {
            propertyName = "aggregationType";
        }
        else if (originalAction === dataGroupingSettings.setAggregationIndicator) {

            propertyName = "aggregationIndicator";
        }
        else if (originalAction === dataGroupingSettings.setAggregateWithRespectToColumn) {

            propertyName = "aggregateWithRespectToColumn";
        }
        else {

            // A grid-wide setting, which the selection makes no difference to.
            originalAction(null, null, value);
            return;
        }

        const groupingKeys = [];
        const groupingKeyMap = new Map();

        for (let i = 0; i < cellColumnRowIndexes.length; i++) {

            const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(
                cellColumnRowIndexes[i].rowIndex
            );

            if (!grouping) continue;

            const key = grouping.groupByColumnIndexes.join(",");

            if (!groupingKeyMap.has(key)) {

                groupingKeyMap.set(key, groupingKeys.length);
                groupingKeys.push({ grouping, columnIndexes: [] });
            }

            groupingKeys[groupingKeyMap.get(key)].columnIndexes.push(
                cellColumnRowIndexes[i].columnIndex
            );
        }

        for (let i = 0; i < groupingKeys.length; i++) {

            dataGroupingSettings.setGroupingColumnPropertyBatch(
                groupingKeys[i].grouping,
                groupingKeys[i].columnIndexes,
                propertyName,
                value
            );
        }
    };

    const setFormatForSelectedCells = (cellColumnRowIndexes, originalAction, value) => {

        for (let i = 0; i < cellColumnRowIndexes.length; i++) {

            originalAction(
                cellColumnRowIndexes[i].columnIndex,
                cellColumnRowIndexes[i].rowIndex,
                value
            );
        }
    };

    /**
     * Adds menu items for specifying the type of formatting for a column in a grouping.
     */
    const addFormattingMenuItems = (columnIndex, rowIndex, valueFormat, element) => {

        const items = formattingMenuItems.getMenuItems(
            columnIndex,
            rowIndex,
            null,
            valueFormat,
            tabularData.ColumnModels[columnIndex]
        );

        wrapForMultiSelect(items, setFormatForSelectedCells);

        // Added after the wrapping, as the editor is opened on the clicked cell's function alone.
        items[0].submenu.push(Ren.MENU_SEPARATOR, {
            text: "Custom...",
            id: "format-custom",
            ticked: () => !!Ren.FormatFunctionUtils.getCustomCode(
                dataGroupingSettings.getFormatFunction(columnIndex, rowIndex)
            ),
            action: () => {

                Ren.Messages.Requests.functionEditorWindow.notify(
                    () => dataGroupingSettings.getFormatFunction(columnIndex, rowIndex),
                    (newFunction) =>
                        dataGroupingSettings.setFormatFunction(columnIndex, rowIndex, newFunction),
                    null,
                    null,
                    { centred: true, autoComplete: { tabularData } }
                );
            }
        });

        addMenuItems(element, items);
    };

    /**
     * Adds menu items for specifying the type of calculation for a column in a grouping.
     */
    const addCalculationMenuItems = (columnIndex, rowIndex, valueFormat, element) => {

        addMenuItems(element, calculationMenuItems.getMenuItems(
            columnIndex,
            rowIndex,
            null,
            valueFormat
        ));
    };

    /**
     * Adds menu items for specifying the type of aggregation for a column in a grouping.
     */
    const addAggregationMenuItems = (columnIndex, rowIndex, grouping, element) => {

        const items = aggregationMenuItems.getMenuItems(columnIndex, rowIndex, grouping);
        wrapForMultiSelect(items, setAggregationForSelectedCells);
        addMenuItems(element, items);
    };

    const addShowWindowsMenuItems = (element) => {

        addMenuItems(element, windowsMenuItems.getMenuItems());
    };

    /**
     * Adds menu items that apply to data-row cells.  Cached cells are reused for whichever row is
     * later drawn in their place, so the menu is built as it opens from the row the renderer last
     * recorded in cell.dataRowMenuState.
     */
    const addCellMenuItems = (columnIndex, cell) => {

        const buildMenuItems = () => {

            const state = cell.dataRowMenuState;
            if (!state) return [];

            // Looked up afresh, as a regroup the menu itself made may not have redrawn the cell.
            const groupings = dataGroupingSettings.groupings;
            const group = groupings.getGroupContainingRow(state.rowIndex);
            const grouping = groupings.entries.indexOf(state.grouping) !== -1
                ? state.grouping
                : null;

            return collectGroupingMenuItems(
                columnIndex,
                state.rowIndex,
                cell,
                group,
                grouping,
                state.cellValue,
                state.rowVals
            );
        };

        contextMenu.addMenuItems(cell, buildMenuItems);
    };

    /**
     * Adds menu items that apply to group-row cells, built as the menu opens.  A regroup the menu
     * itself made leaves the cell's group gone, so the menu then stands for the group that has
     * taken its level for the same rows.
     */
    const addGroupRowCellMenuItems = (
        columnIndex,
        rowIndex,
        cell,
        group,
        grouping,
        cellValue,
        rowVals) => {

        const groupingIndex = dataGroupingSettings.groupings.entries.indexOf(grouping);

        const buildMenuItems = () => {

            const entries = dataGroupingSettings.groupings.entries;

            if (entries.indexOf(grouping) !== -1) {

                return collectGroupingMenuItems(
                    columnIndex,
                    rowIndex,
                    cell,
                    group,
                    grouping,
                    cellValue,
                    rowVals
                );
            }

            const levelIndex = Math.min(groupingIndex, entries.length - 1);
            const levelGroup = getGroupAtLevelContainingGroup(group, levelIndex);

            if (!levelGroup) return [];

            return collectGroupingMenuItems(
                columnIndex,
                levelGroup.groupRowIndex,
                cell,
                levelGroup,
                entries[levelIndex],
                cellValue,
                rowVals,
                true
            );
        };

        contextMenu.addMenuItems(cell, buildMenuItems);
    };

    /**
     * Gets the current group, in the grouping at the given level, holding a (possibly no longer
     * current) group's first data row, or null.
     */
    const getGroupAtLevelContainingGroup = (group, levelIndex) => {

        if (levelIndex < 0 || !group.containedRowIndexCount) return null;

        const groupings = dataGroupingSettings.groupings;
        const entries = groupings.entries;
        const dataRowIndex = group.containedRowIndexBuffer[group.containedRowIndexStart];

        let levelGroup = groupings.getGroupContainingRow(dataRowIndex);
        let index = entries.indexOf(groupings.getGroupingForGroup(levelGroup));

        if (index < 0) return null;

        // A grouping keys its groups, and their parents, by group row index less the data rows.
        while (levelGroup && index < levelIndex) {

            index++;
            levelGroup = entries[index].getGroupContainingGroup(
                levelGroup.groupRowIndex - tabularData.DataRowCount
            );
        }

        return levelGroup || null;
    };

    // Builds a cell's grouping menu items as the menu opens, gathering what they would add.
    const collectGroupingMenuItems = (
        columnIndex,
        rowIndex,
        element,
        group,
        grouping,
        cellValue,
        rowVals,
        isReplacedRow) => {

        collectedMenuItems = [];

        try {

            addGroupingMenuItems(
                columnIndex,
                rowIndex,
                element,
                group,
                grouping,
                cellValue,
                rowVals,
                isReplacedRow
            );

            return collectedMenuItems;
        }
        finally {

            collectedMenuItems = null;
        }
    };

    /**
     * Adds menu items that apply to row headings.
     */
    const addRowHeadingMenuItems = (rowY, rowHeadingElement) => {

        // Add group control items if there are any groupings.
        if (dataGroupingSettings.groupings?.entries?.length) {

            const groupCtrlsMenuItems = Ren.ContextMenuItems_GroupCtrls(tabularData, dataGroupingSettings).getMenuItems();
            addMenuItems(rowHeadingElement, groupCtrlsMenuItems);
        }

        // A right-click on a data row's heading selects that row, so the INSERT statement item is
        // offered there, with the same ID as the grid's own so that it supersedes that one.
        if (!dataGroupingSettings.isGapRow(rowY)) {

            const rowIndex = dataGroupingSettings.getRowIndex(rowY) - tabularData.HeadingCount;

            if (tabularData.isDataRow(rowIndex)) {

                addMenuItems(rowHeadingElement, [getInsertStatementMenuItem()]);
            }
        }
    };

    return {
        addCellMenuItems,
        addColumnMenuItems,
        addFilteringMenuItems,
        addGroupingMenuItems,
        addGroupRowCellMenuItems,
        addDataGridMenuItems,
        addGroupByMenuItems,
        addColumnSortMenuItems,
        addRowHeadingMenuItems
    };
};
