Ren.DataGridCellRenderer = (
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
    contextMenuItems) => {

    let cachedRowIndexesInView = null;

    const cellStyles = Ren.DataGridCellStyles(gridState.dataGridGuid);

    const mergedBackgrounds = Ren.DataGridMergedBackgrounds(tabularData, dataGroupingSettings);

    const columnAutoMenuNames = [];

    const rawValueReader = Ren.DataGridCellSelection_RawValueReader(
        tabularData,
        dataGroupingSettings
    );

    /**
     * Gets the name of the auto menu (e.g. "product-code") the column's cells are given, or null.
     */
    const getColumnAutoMenuName = (columnIndex) => {

        let menuName = columnAutoMenuNames[columnIndex];

        if (menuName === undefined) {

            menuName = Ren.AutoMenu.getMenuNameForColumn(tabularData.ColumnModels[columnIndex]);

            columnAutoMenuNames[columnIndex] = menuName;
        }

        return menuName;
    };

    /**
     * Gets a value indicating whether the grouping's group rows show the column's raw value, which
     * is only so of a column it groups by without a calc function.
     */
    const isGroupedByRawValue = (grouping, columnIndex) => {

        const indexInGrouping = grouping.groupByColumnIndexes.indexOf(columnIndex);

        return indexInGrouping !== -1 && !grouping.groupByCalcFunctions?.[indexInGrouping];
    };

    const clearCache = () => {

        cachedRowIndexesInView = null;
        mergedBackgrounds.clear();
    };

    const getRowClassName = (r) => `ren-data-grid__row-heading ren-r-${r}`;
    const getColumnClassName = (c) => `ren-data-grid__column-heading ren-c-${c}`;
    const getCellClassName = (c, r) => `ren-data-grid__cell ren-c-${c} ren-r-${r}`;
    const getHeaderCellClassName = (c, r) => `ren-data-grid__cell ren-h ren-c-${c} ren-r-${r}`;

    /**
     * Renders the row headings for the heading row(s).
     */
    const renderRowHeadingsForHeadingRows = () => {

        const fragment = document.createDocumentFragment();

        const rowHeading0 = document.createElement("div");
        rowHeading0.className = "ren-data-grid__row-heading ren-r-0";
        fragment.appendChild(rowHeading0);

        if (tabularData.HasSubheadings) {

            const rowHeading1 = document.createElement("div");
            rowHeading1.className = "ren-data-grid__row-heading ren-r-1";
            fragment.appendChild(rowHeading1);
        }

        dataGridSections.frozenTopLeftSection.appendChild(fragment);
    };

    const rowHeadingsRendered = new Set();

    /**
     * Renders the row headings for all rows except the heading rows.
     */
    const renderRowHeadings = (rowIndexes) => {

        if (rowIndexes.length === 0) return;

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < rowIndexes.length; i++) {

            const r = rowIndexes[i];
            if (rowHeadingsRendered.has(r)) continue;

            const rowHeading = document.createElement("div");
            rowHeading.className = getRowClassName(r);
            fragment.appendChild(rowHeading);

            rowHeadingsRendered.add(r);
        }

        if (fragment.childNodes.length > 0) {
            dataGridSections.frozenLeftSection.appendChild(fragment);
        }
    };

    const renderColumnHeadings = () => {

        const groupCtrlsFragment = document.createDocumentFragment();
        const topLeftFragment = document.createDocumentFragment();
        const topFragment = document.createDocumentFragment();

        const groupCtrlsHeading = document.createElement("div");
        groupCtrlsHeading.className = "ren-data-grid__group-ctrls-heading";
        groupCtrlsFragment.appendChild(groupCtrlsHeading);

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const columnHeading = document.createElement("div");
            columnHeading.className = getColumnClassName(columnIndex);
            columnHeading.title = getColumnHeadingTooltip(columnIndex);

            // Column headings are always frozen vertically.

            if (columnIndex < freezePanesCoords.x) {

                topLeftFragment.appendChild(columnHeading);
            }
            else {

                topFragment.appendChild(columnHeading);
            }

            contextMenuItems.addColumnMenuItems(columnIndex, columnHeading);
        }

        dataGridSections.frozenTopLeftSection.appendChild(groupCtrlsFragment);
        dataGridSections.frozenTopLeftSection.appendChild(topLeftFragment);
        dataGridSections.frozenTopSection.appendChild(topFragment);
    };

    const headerCellDownArrowRenderer = Ren.DataGridCellRenderer_HeaderCellDownArrowRenderer(
        tabularData,
        visualisation,
        dataGroupingSettings
    );

    /**
     * Applies the display transforms used for header cell text: __Zero yields an empty header, and
     * __ is replaced with a right arrow (for auto-added columns).
     */
    const applyHeaderValueTransforms = (cellValue) => {

        if (cellValue === "__Zero") cellValue = "";

        return cellValue?.replace("__", " ► ");
    };

    /**
     * Gets the text to display for a column's main heading, honouring any heading override.  An
     * empty-string override is a heading deliberately blanked (e.g. a tick column's), so is
     * honoured.
     */
    const getColumnHeadingText = (columnIndex) => {

        const override = gridState.getDisplayHeadingOverride(columnIndex);
        return override ?? tabularData.ColumnModels[columnIndex].Heading;
    };

    /**
     * Gets the tooltip text for a column's heading cell, which is blank other than the tooltip.
     */
    const getColumnHeadingTooltip = (columnIndex) => {

        return applyHeaderValueTransforms(getColumnHeadingText(columnIndex)) || "";
    };

    /**
     * Adds a header cell to the datagrid.
     */
    const addHeaderCell = (columnIndex, rowIndex, cellValue) => {

        cellValue = applyHeaderValueTransforms(cellValue);

        const wrappedCellValue = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-grid__header-cell-value")
            ._html(cellValue);

        const section = columnIndex < freezePanesCoords.x ?
            dataGridSections.frozenTopLeftSection :
            dataGridSections.frozenTopSection;

        const downArrowButton =
            headerCellDownArrowRenderer.createHeaderCellDownArrowButton(columnIndex);

        const cell = Ren.HtmlUtils.create("div")
            ._addClass(getHeaderCellClassName(columnIndex, rowIndex))
            ._append(wrappedCellValue)
            ._append(downArrowButton);

        section.appendChild(cell);

        return cell;
    };

    /**
     * Gets the row indexes (inc.  headings) of the rows currently in view, based on the datagrid's
     * scroll position.
     */
    const getRowIndexesIncHeadingsInView = () => {

        const startRowY = Math.floor(dataGridScrollPos.y / Ren.DataGridConstants.rowHeight);
        const stopRowY = Math.ceil((dataGridScrollPos.y + 1600) / Ren.DataGridConstants.rowHeight);

        if (cachedRowIndexesInView &&
            cachedRowIndexesInView.startRowY === startRowY &&
            cachedRowIndexesInView.stopRowY === stopRowY) {

            return cachedRowIndexesInView.rowIndexesIncHeadings;
        }

        const rowYs = dataGroupingSettings.rowYs;

        const rowIndexesIncHeadings = tabularData.HasSubheadings ? [0, 1] : [0];

        for (let r = tabularData.HeadingCount; r < rowYs.length; r++) {

            if (rowYs[r] >= startRowY && rowYs[r] < stopRowY) rowIndexesIncHeadings.push(r);
        }

        if (dataGroupingSettings.totalsRow.position === Ren.DataGridTotalsRowPositionEnum.BottomFixed) {

            // Always rendered in Bottom - Fixed mode, rather than once scrolled to the bottom.

            const totalsRowIndexIncHeadings =
                dataGroupingSettings.groupings.totalsRowIndex() + tabularData.HeadingCount;

            if (totalsRowIndexIncHeadings !== -1) {
                rowIndexesIncHeadings.push(totalsRowIndexIncHeadings);
            }
        }

        cachedRowIndexesInView = { startRowY, stopRowY, rowIndexesIncHeadings };

        return rowIndexesIncHeadings;
    };

    /**
     * Renders any rows that are currently in view and have not been rendered yet.
     */
    const renderNewlyVisibleRows = () => {

        const rowIndexesIncHeadingsInView = getRowIndexesIncHeadingsInView();

        const rowIndexesIncHeadingsToRender = rowIndexesIncHeadingsInView
            .filter(r => !rowIndexesIncHeadingsRendered.has(r));

        if (rowIndexesIncHeadingsToRender.length === 0) return;

        renderRowHeadings(rowIndexesIncHeadingsToRender);

        renderCells(
            rowIndexesIncHeadingsToRender,
            gridState.visibleColumnIndexes()
        );

        Ren.GroupCtrls.renderGroupCtrls(
            rowIndexesIncHeadingsToRender,
            dataGridSections.frozenLeftSection,
            tabularData,
            dataGroupingSettings,
            expandedGroups,
            contextMenu,
            gridState
        );

        dataGridCellSelection.addRowHeadingContextMenus(rowIndexesIncHeadingsToRender);

        Ren.Messages.Requests.repaint.handle(() => {

            if (visualisation.isDestroyed) return false;

            for (let i = 0; i < rowIndexesIncHeadingsToRender.length; i++) {
                rowIndexesIncHeadingsRendered.add(rowIndexesIncHeadingsToRender[i]);
            }
        }, true);
    };

    /**
     * Gets the aggregation indicator for each of a grouping's columns, in columnIndexes order.
     */
    const getAggregationIndicators = (grouping, columnIndexes) => {

        const indicators = new Array(columnIndexes.length);
        const columnDefaults = dataGroupingSettings.columnDefaults;

        for (let i = 0; i < columnIndexes.length; i++) {

            const columnIndex = columnIndexes[i];
            const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

            const mode = Ren.AggregationIndicator.resolveMode(
                grouping.columns?.[columnIdOrHeading],
                columnDefaults?.[columnIdOrHeading],
                dataGroupingSettings.layout
            );

            indicators[i] = Ren.AggregationIndicator.getIndicator(
                mode,
                grouping.getColumnAggregationType(columnIndex)
            );
        }

        return indicators;
    };

    /**
     * Gets the alignment class each of a grouping's columns needs, in columnIndexes order: null
     * where its aggregated values align the same way as the column's own (see the style updater).
     */
    const getGroupCellAlignmentClassNames = (groupingColumnValueFormats, columnIndexes) => {

        const isArithmetic = Ren.SpreadsheetColumnFormatEnum.IsArithmetic;
        const classNames = new Array(columnIndexes.length);

        for (let i = 0; i < columnIndexes.length; i++) {

            const columnIndex = columnIndexes[i];
            const groupRightAligned = isArithmetic(groupingColumnValueFormats[columnIndex]);
            const columnFormat = tabularData.ColumnModels[columnIndex].ColumnFormat;
            const columnRightAligned = isArithmetic(columnFormat);

            if (groupRightAligned === columnRightAligned) {
                classNames[i] = null;
            }
            else {

                classNames[i] = groupRightAligned
                    ? "ren-data-grid__cell--align-right"
                    : "ren-data-grid__cell--align-left";
            }
        }

        return classNames;
    };

    const populateStatsUsedByStyleFunctions = (columnStyleFunctions, grouping,
        groupRowStatsTarget) => {

        for (let columnIndex = 0; columnIndex < columnStyleFunctions.length; columnIndex++) {

            if (!columnStyleFunctions[columnIndex]) continue;

            dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
                columnStyleFunctions[columnIndex],
                columnIndex,
                grouping,
                groupRowStatsTarget
            );
        }
    };

    /**
     * Renders the cells of the specified rows and columns.
     */
    const renderCells =(rowIndexesIncHeadingsToRender, columnIndexes) => {

        if (rowIndexesIncHeadingsToRender.length === 0 || columnIndexes.length === 0) return;

        let childGrouping = null;

        const overallSummaryStats = dataGroupingSettings.groupings.firstGroupOfOutermostGrouping()?.summaryStats;
        const columnFormats = dataGroupingSettings.getDataRowsColumnFormats();
        const columnValueFormats = columnFormats.columnValueFormats;
        const columnFormatFunctions = columnFormats.columnFormatFunctions;
        const columnCalcFunctions = columnFormats.columnCalcFunctions;
        const anyColumnHasFormatFunction = columnFormatFunctions.some(Boolean);
        const anyColumnHasCalcFunction = columnCalcFunctions.some(Boolean);
        const columnCellStyleFunctions = columnFormats.columnCellStyleFunctions;
        const columnRowStyleFunctions = columnFormats.columnRowStyleFunctions;

        /**
         * Gets the merged style of a data row's row style functions, which is worked out from
         * every column, and not just those being rendered, then cached with the row's data.
         */
        const getDataRowStyle = (rowData, grouping) => {

            if (rowData.rowStyle !== undefined) return rowData.rowStyle;

            if (!columnRowStyleFunctions) {

                rowData.rowStyle = null;
                return null;
            }

            const groupSummaryStats = rowData.group.summaryStats;

            const getValue = (columnIndex) => {

                dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
                    columnCalcFunctions[columnIndex],
                    columnIndex,
                    grouping
                );

                return applyCalcFunctions(
                    tabularData.CompressionDictionary.decompressValue(
                        rowData.rowModel.CV[columnIndex],
                        columnIndex
                    ),
                    columnCalcFunctions[columnIndex],
                    rowData.rowVals,
                    columnIndex,
                    groupSummaryStats,
                    overallSummaryStats,
                    rowData.compressedRowVals
                );
            };

            populateStatsUsedByStyleFunctions(columnRowStyleFunctions, grouping);

            rowData.rowStyle = cellStyles.getRowStyle(
                columnRowStyleFunctions,
                getValue,
                rowData.rowVals,
                groupSummaryStats,
                overallSummaryStats,
                rowData.compressedRowVals
            );

            return rowData.rowStyle;
        };

        const createRowData = (rowIndex) => {

            const isDataRow = rowIndex >= 0 && tabularData.isDataRow(rowIndex);

            const rowData = {
                isDataRow,
                rowIndex,
                rowModel: null,
                group: null,
                rowVals: null,
                compressedRowVals: null,
                rowStyle: undefined
            };

            if (isDataRow) {

                rowData.rowModel = tabularData.RowModels[rowIndex];
                rowData.group = dataGroupingSettings.groupings.getGroupContainingRow(rowIndex);

                rowData.rowVals = Ren.RowValues.getRowValuesForFormatFunction(
                    tabularData,
                    rowData.rowModel.CV,
                    true
                );

                rowData.compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(
                    tabularData,
                    rowData.rowModel.CV
                );
            }

            return rowData;
        };

        const rowDataCache = new Map();

        for (let ri = 0; ri < rowIndexesIncHeadingsToRender.length; ri++) {

            const r = rowIndexesIncHeadingsToRender[ri];

            rowDataCache.set(r, createRowData(r - tabularData.HeadingCount));
        }

        const dataRowsGrouping = dataGroupingSettings.groupings.entries[0];

        /**
         * Gets the background colour a data row's cell is styled with, or null where it has none.
         */
        const getDataRowBackground = (rowIndex, columnIndex) => {

            const cellStyleFunctions = columnCellStyleFunctions[columnIndex];

            if (!cellStyleFunctions && !columnRowStyleFunctions) return null;

            const rowData = createRowData(rowIndex);
            const rowStyle = getDataRowStyle(rowData, dataRowsGrouping);

            if (!cellStyleFunctions) return cellStyles.getBackgroundColour(rowStyle);

            dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
                cellStyleFunctions,
                columnIndex,
                dataRowsGrouping
            );

            const calculatedValue = applyCalcFunctions(
                tabularData.CompressionDictionary.decompressValue(
                    rowData.rowModel.CV[columnIndex],
                    columnIndex
                ),
                columnCalcFunctions[columnIndex],
                rowData.rowVals,
                columnIndex,
                rowData.group.summaryStats,
                overallSummaryStats,
                rowData.compressedRowVals
            );

            return cellStyles.getBackgroundColour(
                cellStyles.getCellStyle(
                    rowStyle,
                    cellStyleFunctions,
                    columnIndex,
                    calculatedValue,
                    rowData.rowVals,
                    rowData.group.summaryStats,
                    overallSummaryStats,
                    rowData.compressedRowVals
                )
            );
        };

        const groupingsEntriesLength = dataGroupingSettings.groupings.entries.length;

        const fragments = {
            frozenTopLeftSection: document.createDocumentFragment(),
            frozenLeftSection: document.createDocumentFragment(),
            frozenTopSection: document.createDocumentFragment(),
            dataGridMainSection: document.createDocumentFragment()
        };

        for (let i = 0; i < groupingsEntriesLength; i++) {

            const grouping = dataGroupingSettings.groupings.entries[i];
            const groupingColumnFormats = dataGroupingSettings.getColumnValueFormats(grouping.columns);
            const groupingColumnValueFormats = groupingColumnFormats.columnValueFormats;
            const groupingColumnFormatFunctions = groupingColumnFormats.columnFormatFunctions;
            const anyGroupingColumnHasFormatFunction = groupingColumnFormatFunctions.some(Boolean);
            const groupingColumnCellStyleFunctions = groupingColumnFormats.columnCellStyleFunctions;
            const groupingColumnRowStyleFunctions = groupingColumnFormats.columnRowStyleFunctions;
            const groupingColumnMergesDataRowBackgrounds =
                groupingColumnFormats.columnMergesDataRowBackgrounds;
            const anyGroupingColumnHasCellStyleFunction =
                groupingColumnCellStyleFunctions.some(Boolean);
            const groups = grouping.groups();
            const aggregationIndicators = groups ? getAggregationIndicators(grouping, columnIndexes) : null;

            const alignmentClassNames = groups
                ? getGroupCellAlignmentClassNames(groupingColumnValueFormats, columnIndexes)
                : null;

            let parentGrouping = null;

            if (grouping.parentGroupingIndex || grouping.parentGroupingIndex === 0) {

                parentGrouping = dataGroupingSettings.groupings.entries[grouping.parentGroupingIndex];
            }

            for (let ri = 0; ri < rowIndexesIncHeadingsToRender.length; ri++) {

                const r = rowIndexesIncHeadingsToRender[ri];
                const rowData = rowDataCache.get(r);
                const rowIndex = rowData.rowIndex;

                if (rowIndex < 0) continue;

                if (rowData.isDataRow) {

                    const group = rowData.group;
                    if (!group) continue;

                    const rowModel = rowData.rowModel;
                    const rowVals = rowData.rowVals;

                    for (let ci = 0; ci < columnIndexes.length; ci++) {

                        const columnIndex = columnIndexes[ci];

                        if (anyColumnHasFormatFunction) {

                            dataGroupingSettings.summaryStats.lazyPopulateSummaryStats(
                                columnFormats,
                                columnIndex,
                                grouping
                            );
                        }

                        // setCellValue passes the stats to data-row calc functions too.
                        if (anyColumnHasCalcFunction) {

                            dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
                                columnCalcFunctions[columnIndex],
                                columnIndex,
                                grouping
                            );
                        }

                        const cell = addCellToFragment(columnIndex, r, fragments);

                        const compressedValue = rowModel.CV[columnIndex];

                        const cellValue = tabularData.CompressionDictionary.decompressValue(
                            compressedValue,
                            columnIndex
                        );

                        const calculatedValue = applyCalcFunctions(
                            cellValue,
                            columnCalcFunctions[columnIndex],
                            rowVals,
                            columnIndex,
                            group.summaryStats,
                            overallSummaryStats,
                            rowData.compressedRowVals
                        );

                        setCellValue(
                            cell,
                            calculatedValue,
                            columnValueFormats[columnIndex],
                            columnFormatFunctions[columnIndex],
                            rowVals,
                            columnIndex,
                            group.summaryStats,
                            overallSummaryStats,
                            rowData.compressedRowVals
                        );

                        const autoMenuName = getColumnAutoMenuName(columnIndex);

                        if (autoMenuName) {
                            Ren.AutoMenu.applyMenu(cell, autoMenuName, cellValue);
                        }

                        const cellStyleFunctions = columnCellStyleFunctions[columnIndex];

                        if (cellStyleFunctions) {

                            dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
                                cellStyleFunctions,
                                columnIndex,
                                grouping
                            );
                        }

                        cellStyles.applyStyle(
                            cell,
                            cellStyles.getCellStyle(
                                getDataRowStyle(rowData, grouping),
                                cellStyleFunctions,
                                columnIndex,
                                calculatedValue,
                                rowVals,
                                group.summaryStats,
                                overallSummaryStats,
                                rowData.compressedRowVals
                            )
                        );

                        const menuState = cell.dataRowMenuState;

                        if (menuState) {

                            menuState.rowIndex = rowIndex;
                            menuState.grouping = childGrouping;
                            menuState.cellValue = cellValue;
                            menuState.rowVals = rowVals;
                        }
                        else {

                            cell.dataRowMenuState = {
                                rowIndex,
                                grouping: childGrouping,
                                cellValue,
                                rowVals
                            };

                            contextMenuItems.addCellMenuItems(columnIndex, cell);
                        }
                    }
                }
                else if (groups && r >= tabularData.DataRowCount) { // group row

                    const groupIndex = rowIndex - tabularData.DataRowCount;
                    const group = groups.get(groupIndex);

                    if (!group) continue;

                    // The outermost grouping has no parent, and its one group spans the whole grid.
                    let groupSummaryStats = overallSummaryStats;
                    let parentGroup = null;

                    if (parentGrouping) {

                        parentGroup = parentGrouping.getGroupContainingGroup(groupIndex);
                        groupSummaryStats = parentGroup?.summaryStats;
                    }

                    const styleStatsTarget =
                        groupingColumnRowStyleFunctions || anyGroupingColumnHasCellStyleFunction
                            ? dataGroupingSettings.summaryStats.getGroupRowStatsTarget(
                                grouping,
                                group,
                                parentGroup
                            )
                            : null;

                    const groupValues = group.groupValues;
                    const groupPosition = group.position;
                    const groupRow = groupValues.getRow(groupPosition);

                    const rowVals = Ren.RowValues.getRowValuesForFormatFunction(
                        tabularData,
                        groupRow,
                        true
                    );

                    // The group row's values are already compressed.
                    const compressedGroupRowValues =
                        Ren.RowValues.getCompressedRowValuesForFormatFunction(
                            tabularData,
                            groupRow
                        );

                    let rowStyle = null;

                    if (groupingColumnRowStyleFunctions) {

                        populateStatsUsedByStyleFunctions(
                            groupingColumnRowStyleFunctions,
                            parentGrouping,
                            styleStatsTarget
                        );

                        rowStyle = cellStyles.getRowStyle(
                            groupingColumnRowStyleFunctions,
                            (c) => tabularData.CompressionDictionary.decompressValue(
                                groupValues.get(groupPosition, c),
                                c
                            ),
                            rowVals,
                            dataGroupingSettings.summaryStats.getGroupRowStats(styleStatsTarget),
                            overallSummaryStats,
                            compressedGroupRowValues
                        );
                    }

                    for (let ci = 0; ci < columnIndexes.length; ci++) {

                        const columnIndex = columnIndexes[ci];

                        if (anyGroupingColumnHasFormatFunction) {

                            dataGroupingSettings.summaryStats.lazyPopulateSummaryStats(
                                groupingColumnFormats,
                                columnIndex,
                                parentGrouping
                            );
                        }

                        const cell = addCellToFragment(columnIndex, r, fragments);

                        // Group values are compressed where possible, so decompress for display.
                        const cellValue = tabularData.CompressionDictionary.decompressValue(
                            groupValues.get(groupPosition, columnIndex),
                            columnIndex
                        );

                        const formattedValue = setCellValue(
                            cell,
                            cellValue,
                            groupingColumnValueFormats[columnIndex],
                            groupingColumnFormatFunctions[columnIndex],
                            rowVals,
                            columnIndex,
                            groupSummaryStats,
                            overallSummaryStats,
                            compressedGroupRowValues
                        );

                        // formattedRowValues is only used for the purpose of text measurement.
                        group.formattedRowValues[columnIndex] = formattedValue;

                        const autoMenuName = getColumnAutoMenuName(columnIndex);

                        if (autoMenuName) {

                            Ren.AutoMenu.applyMenu(
                                cell,
                                autoMenuName,
                                isGroupedByRawValue(grouping, columnIndex)
                                    ? cellValue
                                    : rawValueReader.getSharedAggregateValue(
                                        grouping,
                                        columnIndex,
                                        cellValue
                                    )
                            );
                        }

                        const cellStyleFunctions = groupingColumnCellStyleFunctions[columnIndex];

                        if (cellStyleFunctions) {

                            dataGroupingSettings.summaryStats.populateStatsUsedByFunctions(
                                cellStyleFunctions,
                                columnIndex,
                                parentGrouping,
                                styleStatsTarget
                            );
                        }

                        const mergesBackground =
                            groupingColumnMergesDataRowBackgrounds?.[columnIndex];

                        const mergedBackground = mergesBackground
                            ? mergedBackgrounds.getMergedBackground(
                                grouping,
                                group,
                                columnIndex,
                                getDataRowBackground
                            )
                            : null;

                        // The group row's own style functions are given the last word.
                        const baseStyle = mergedBackground
                            ? Object.assign({ "background-color": mergedBackground }, rowStyle)
                            : rowStyle;

                        cellStyles.applyStyle(
                            cell,
                            cellStyles.getCellStyle(
                                baseStyle,
                                cellStyleFunctions,
                                columnIndex,
                                cellValue,
                                rowVals,
                                styleStatsTarget
                                    ? dataGroupingSettings.summaryStats.getGroupRowStats(
                                        styleStatsTarget
                                    )
                                    : null,
                                overallSummaryStats,
                                compressedGroupRowValues
                            )
                        );

                        Ren.AggregationIndicator.applyToCell(
                            cell,
                            aggregationIndicators[ci],
                            formattedValue === "" || formattedValue == null ||
                                cell.classList.contains("ren-data-grid__cell--null")
                        );

                        const alignmentClassName = alignmentClassNames[ci];

                        cell.classList.toggle(
                            "ren-data-grid__cell--align-right",
                            alignmentClassName === "ren-data-grid__cell--align-right"
                        );

                        cell.classList.toggle(
                            "ren-data-grid__cell--align-left",
                            alignmentClassName === "ren-data-grid__cell--align-left"
                        );

                        if (!cell.alreadyExisted) {

                            cell.classList.add("ren-data-grid__cell--group");

                            tabularData.CompressionDictionary.compressValue(
                                cellValue,
                                columnIndex
                            );

                            contextMenuItems.addGroupRowCellMenuItems(
                                columnIndex,
                                rowIndex,
                                cell,
                                group,
                                grouping,
                                cellValue,
                                rowVals
                            );
                        }
                    }
                }
            }

            childGrouping = grouping;
        }

        if (fragments.frozenTopLeftSection.childNodes.length > 0) {
            dataGridSections.frozenTopLeftSection.appendChild(fragments.frozenTopLeftSection);
        }

        if (fragments.frozenLeftSection.childNodes.length > 0) {
            dataGridSections.frozenLeftSection.appendChild(fragments.frozenLeftSection);
        }

        if (fragments.frozenTopSection.childNodes.length > 0) {
            dataGridSections.frozenTopSection.appendChild(fragments.frozenTopSection);
        }

        if (fragments.dataGridMainSection.childNodes.length > 0) {
            dataGridSections.dataGridMainSection.appendChild(fragments.dataGridMainSection);
        }

        cellStyles.writeRules();

        Ren.PopupReports.setupPopupReports();
    };

    const renderedCellsCache = Ren.DataGridRenderedCellsCache(tabularData);

    /**
     * Adds a cell DOM element to the appropriate fragment if it doesn't exist already.
     */
    const addCellToFragment = (columnIndex, rowIndexIncHeadings, fragments) => {

        const existingCell = renderedCellsCache.get(rowIndexIncHeadings, columnIndex);

        if (existingCell) {

            existingCell.alreadyExisted = true;
            return existingCell;
        }

        const cell = document.createElement("div");
        cell.className = getCellClassName(columnIndex, rowIndexIncHeadings);

        let fragmentKey = 'dataGridMainSection';

        if (columnIndex < freezePanesCoords.x && rowIndexIncHeadings - 1 < freezePanesCoords.y) {
            fragmentKey = 'frozenTopLeftSection';
        }
        else if (columnIndex < freezePanesCoords.x) {

            fragmentKey = 'frozenLeftSection';
        }

        fragments[fragmentKey].appendChild(cell);

        renderedCellsCache.add(rowIndexIncHeadings, columnIndex, cell);

        return cell;
    };

    /**
     * Removes existing group rows from the DOM and from rowIndexesIncHeadingsRendered.
     */
    const removeRenderedGroupRows = () => {

        const rowIndexesIncHeadingsToRemove = Array.from(rowIndexesIncHeadingsRendered)
            .filter(r => r - tabularData.HeadingCount >= tabularData.DataRowCount);

        for (let i = 0; i < rowIndexesIncHeadingsToRemove.length; i++) {

            rowIndexesIncHeadingsRendered.delete(rowIndexesIncHeadingsToRemove[i]);
        }

        renderedCellsCache.removeGroupRows();

        const groupCells = dataGridSections.dataGrid.querySelectorAll(".ren-data-grid__cell--group");
        groupCells.forEach(cell => cell.remove());

        const groupCtrls = dataGridSections.dataGrid.querySelectorAll(".ren-data-grid__group-ctrls");
        groupCtrls.forEach(ctrl => ctrl.remove());
    };

    const applyCalcFunctions = (cellValue, calcFunction, rowDecompressedValues, columnIndex,
        groupSummaryStats, overallSummaryStats, compressedValues) => {

        if (!calcFunction?.length) return cellValue;

        for (let i = 0; i < calcFunction.length; i++) {

            try {

                cellValue = calcFunction[i](
                    cellValue,
                    rowDecompressedValues,
                    (groupSummaryStats && groupSummaryStats[columnIndex]) || null,
                    (overallSummaryStats && overallSummaryStats[columnIndex]) || null,
                    compressedValues
                );
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[DataGridCellRenderer] Error applying calc function:",
                    e
                );

                cellValue = `<span title="Error executing calc function: ${e}">Error</span>`;
                break;
            }
        }

        return cellValue;
    };

    const setCellValue = (cell, cellValue, columnFormat, formatFunction, rowDecompressedValues,
        columnIndex, groupSummaryStats, overallSummaryStats, compressedValues) => {

        // Clear any null styling from a prior render so it is only re-applied if the current
        // value (after calc function) is still null.
        cell.classList.remove("ren-data-grid__cell--null");

        // SQL NULL is the sentinel string in compressed columns, and null in numeric ones.
        const isNullSentinel = cellValue == null || cellValue === Ren.NullSentinel;

        // Numeric NULLs reach the format functions as the sentinel too, so that the "Show NULL
        // as" functions can recognise them.
        if (isNullSentinel) {
            cellValue = Ren.NullSentinel;
        }

        // Null sentinels embedded in a longer string (e.g. "\x01 ᵡ 3，val ᵡ 2") are shown as
        // "NULL".
        if (!isNullSentinel && typeof cellValue === "string" && cellValue.includes(Ren.NullSentinel)) {
            cellValue = cellValue.replaceAll(Ren.NullSentinel, Ren.NullSentinelDisplayLabel);
        }

        if (isNullSentinel && !formatFunction) {

            cell.classList.add("ren-data-grid__cell--null");
            cell.textContent = "";
            return "";
        }

        if (columnFormat === null && !formatFunction) {

            cell.textContent = isNullSentinel ? "" : cellValue;

            if (isNullSentinel) {
                cell.classList.add("ren-data-grid__cell--null");
            }
            return cellValue;
        }

        const formattedValue = Ren.ValueFormatter.formatValue(
            cellValue,
            columnIndex,
            columnFormat,
            formatFunction,
            rowDecompressedValues,
            groupSummaryStats,
            overallSummaryStats,
            compressedValues
        );

        // A null the format functions left as it was still reads as NULL, but one they turned into
        // an empty string was blanked on purpose (Show NULL as blank, Format as blank).
        if (isNullSentinel) {

            if (formattedValue == null || formattedValue === cellValue) {
                cell.classList.add("ren-data-grid__cell--null");
            }
        }

        if (typeof formattedValue === "string" && formattedValue.includes("<")) {
            cell.innerHTML = formattedValue;
        }
        else if (formattedValue === "" || formattedValue === null || formattedValue === undefined) {

            cell.textContent = "";
        }
        else if (formattedValue === Ren.NullSentinel) {

            cell.textContent = "";

            if (!cell.classList.contains("ren-data-grid__cell--null")) {
                cell.classList.add("ren-data-grid__cell--null");
            }
        }
        else {

            cell.textContent = formattedValue.toString();
        }

        return formattedValue;
    };

    /**
     * Adds context menu items to a row heading element.
     */
    const addRowHeadingContextMenu = (rowIndex, rowHeadingElement) => {

        contextMenuItems.addRowHeadingMenuItems(rowIndex, rowHeadingElement);
    };

    /**
     * Adds context menu items to all rendered row headings (for group rows).
     */
    const addContextMenuItemsToRowHeadings = () => {

        rowHeadingsRendered.forEach(rowIndex => {

            if (tabularData.isGroupRow(rowIndex)) {

                const rowHeading = document.querySelector(`.${gridState.dataGridGuid} .ren-data-grid__row-heading.ren-r-${rowIndex}`);

                if (rowHeading) {
                    addRowHeadingContextMenu(rowIndex, rowHeading);
                }
            }
        });
    };

    /**
     * Renders the cells of any visible columns which have not been rendered yet, and forgets any
     * columns that have just been hidden so that they are rendered afresh if shown again.
     */
    const renderAnyNewlyVisibleColumns = () => {

        const newlyVisibleColumnIndexes = [];

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const isVisible = gridState.isColumnVisible(columnIndex);
            const isRendered = columnIndexesRendered.has(columnIndex);

            if (isVisible && !isRendered) {

                newlyVisibleColumnIndexes.push(columnIndex);
                columnIndexesRendered.add(columnIndex);
            }
            else if (!isVisible && isRendered) {

                // Dropped so that re-showing it re-creates its cells for every rendered row, as
                // rows scrolled into view while it was hidden have none.
                columnIndexesRendered.delete(columnIndex);
            }
        }

        if (newlyVisibleColumnIndexes.length === 0) return;

        // In-view rows are included as rowIndexesIncHeadingsRendered is filled on a deferred
        // repaint, so may not yet record a row whose cells are already on screen.
        const rowIndexesIncHeadingsToRender = Array.from(rowIndexesIncHeadingsRendered);
        const rowIndexesIncHeadingsInView = getRowIndexesIncHeadingsInView();

        for (let i = 0; i < rowIndexesIncHeadingsInView.length; i++) {

            if (!rowIndexesIncHeadingsRendered.has(rowIndexesIncHeadingsInView[i])) {

                rowIndexesIncHeadingsToRender.push(rowIndexesIncHeadingsInView[i]);
            }
        }

        renderCells(rowIndexesIncHeadingsToRender, newlyVisibleColumnIndexes);
    };

    Ren.Messages.Events.columnVisibilityChanged.handle(renderAnyNewlyVisibleColumns);
    Ren.Messages.Events.columnResized.handle(renderAnyNewlyVisibleColumns);

    /**
     * Renders the cells of the specified column.
     */
    const renderColumn = (columnIndex) => {

        renderCells(
            Array.from(rowIndexesIncHeadingsRendered),
            [columnIndex]
        );
    };

    /**
     * Renders the heading row, and the subheading row where there is one.
     */
    const renderHeadingRows = () => {

        for (let columnIndex = 0; columnIndex < tabularData.ColumnModels.length; columnIndex++) {

            const headingCell = addHeaderCell(columnIndex, 0, getColumnHeadingText(columnIndex));

            contextMenuItems.addColumnMenuItems(columnIndex, headingCell);
        }

        if (tabularData.HasSubheadings) {

            for (let columnIndex = 0; columnIndex < tabularData.ColumnModels.length; columnIndex++) {

                const columnModel = tabularData.ColumnModels[columnIndex];
                const subheadingCell = addHeaderCell(columnIndex, 1, columnModel.Subheading);

                contextMenuItems.addColumnMenuItems(columnIndex, subheadingCell);
            }
        }
    };

    /**
     * Updates the rendered text of a column's main heading to match the current grid state.
     */
    const updateColumnHeading = (columnIndex) => {

        const columnHeading = dataGridSections.dataGrid.querySelector(
            `.ren-data-grid__column-heading.ren-c-${columnIndex}`
        );

        if (columnHeading) {
            columnHeading.title = getColumnHeadingTooltip(columnIndex);
        }

        const headerCell = dataGridSections.dataGrid.querySelector(
            `.ren-data-grid__cell.ren-h.ren-c-${columnIndex}.ren-r-0`
        );

        if (!headerCell) return;

        const valueElement = headerCell.querySelector(".ren-data-grid__header-cell-value");

        if (!valueElement) return;

        const headingText = applyHeaderValueTransforms(getColumnHeadingText(columnIndex)) || "";

        // Skip if unchanged to avoid needless reflow when this fires on unrelated grid state
        // changes such as column resizes.
        if (valueElement.innerHTML === headingText) return;

        Ren.HtmlUtils.setHTML(valueElement, headingText);
    };

    // Deferred so that, where the change came from another grid in the same group, the
    // GridStateApplyer has synced the columns array into this grid's state first.
    Ren.Messages.Events.gridStateChanged.handle((changedGridState) => {

        if (visualisation.isDestroyed) return false;
        if (!changedGridState || changedGridState.gridStateGroup !== gridState.gridStateGroup) return;

        Ren.FnUtils.defer(() => {

            for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

                updateColumnHeading(columnIndex);
            }
        });
    });

    const initialrepaint = () => {

        renderColumnHeadings();
        renderRowHeadingsForHeadingRows();

        Ren.FnUtils.defer(() => {

            renderNewlyVisibleRows();
        });
    };

    return {
        clearCache,
        getRowIndexesIncHeadingsInView,
        initialrepaint,
        removeRenderedGroupRows,
        renderAnyNewlyVisibleColumns,
        renderColumn,
        renderColumnHeadings,
        renderHeadingRows,
        renderNewlyVisibleRows,
        addRowHeadingContextMenu,
        addContextMenuItemsToRowHeadings
    };
};
