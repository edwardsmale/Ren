/**
 * Maintains the datagrid's dynamic stylesheet for cell positions and styles.
 */
Ren.DataGridStyleUpdater = (
    tabularData,
    dataGroupingSettings,
    expandedGroups,
    dimensions,
    dataGridGuid,
    gridState,
    dataGridColumnLeftPositions,
    getRowIndexesIncHeadingsInView,
    getRowTopBase) => { // Taken from a row's top, given its rowY (see Ren.DataGrid's rowTopBase).

    const rowHeight = Ren.DataGridConstants.rowHeight; // The height of a datagrid row.
    const rowHeadingWidth = gridState.rowHeadingWidth; // The width of the row headings on the left.
    const columnHeadingHeight = gridState.showRowAndColumnHeadings ? 22 : 0; // The height of the
                                                                             // column headings at
                                                                             // the top.

    const dataGridStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        dataGridGuid,
        "cellpositions"
    );

    const dataGridColumnPositionStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        dataGridGuid,
        "columnpositions"
    );

    const dataGridMiscStylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(
        dataGridGuid,
        "misc"
    );

    const groupingIndentation = Ren.GroupingIndentation(dataGroupingSettings);
    const borderStyleProvider = Ren.BorderStyleProvider(dataGroupingSettings);
    const groupColourProvider = Ren.GroupColourProvider(dataGroupingSettings);
    const totalsRowStyleProvider = Ren.TotalsRowStyleProvider(dataGroupingSettings);

    /**
     * Updates the datagrid's dynamic stylesheet for cell positions and column styles.
     */
    const updateDataGridStyles = () => {

        const nullCellBackgroundColor =
            Ren.Theme.cssValue("data-grid-null-cell-background", "#FEFFE3");
        const headingRowBackground =
            Ren.Theme.cssValue("data-grid-heading-row-background", "#EEEEEE");
        const headingRowBorderColour =
            Ren.Theme.cssValue("data-grid-heading-row-border-colour", "#CCCCCC");
        const rowYs = dataGroupingSettings.rowYs;
        const styles = [];

        const groupCtrlsWidth = groupingIndentation.groupCtrlsWidth(
            dataGroupingSettings.groupings,
            dataGroupingSettings.getGroupCtrlsCountMode()
        );

        // Cells have a bottom border, which is concealed by setting the height of cells to
        // rowHeight + 2.  This means that when there is a gap row (when grouping with a large
        // depth) the bottom border is visible.
        styles.push(`.ren-data-grid__row { height: ${rowHeight + 2}px; }`);
        styles.push(`.ren-data-grid__cell { height: ${rowHeight + 2}px; }`);
        styles.push(`.ren-data-grid__row-heading { height: ${rowHeight + 2}px; }`);

        styles.push(`.ren-r-0 { top: ${columnHeadingHeight}px; height: ${rowHeight + 1}px; }`);
        if (tabularData.HasSubheadings) styles.push(`.ren-r-1 { top: ${columnHeadingHeight + rowHeight + 2}px; }`);

        styles.push(`.ren-data-grid__row-heading { width: ${rowHeadingWidth}px }`);

        for (let i = 0; i < tabularData.HeadingCount; i++) {

            styles.push(`.ren-data-grid__row-heading.ren-r-${i}::before { content: '${i}'; color: transparent }`);

            if (!gridState.showRowAndColumnHeadings) {
                styles.push(`.ren-data-grid__cell.ren-r-${i} { background-color: ${headingRowBackground}!important; border-color: ${headingRowBorderColour} }`);
            }
        }

        // A copy, as the renderer caches the array it returns and the totals row is added to it.
        const rowIndexesIncHeadings = getRowIndexesIncHeadingsInView().slice();

        if (tabularData.HasTotals || tabularData.HasCounts) {
            rowIndexesIncHeadings.push(tabularData.DataRowCount + 1);
        }

        let lastRowTop = -1;
        let lastR = -1;
        let lastRowY = -1;

        const expandCollapseButtonLeftPos = gridState.showRowAndColumnHeadings ? rowHeadingWidth : 0;

        styles.push(".ren-data-grid__group-ctrls { " +
            `left: ${expandCollapseButtonLeftPos}px; width: ${groupCtrlsWidth}px }`);

        if (gridState.showRowAndColumnHeadings) {

            styles.push(".ren-data-grid__group-ctrls { border-left: none }");
        }
        else {

            styles.push(".ren-data-grid__column-heading { display: none }");
            styles.push(".ren-data-grid__row-heading { display: none }");
            styles.push(".ren-data-grid__group-ctrls-heading { display: none }");
        }

        styles.push(`.ren-data-grid__group-ctrls-heading { left: ${expandCollapseButtonLeftPos}px; width: ${groupCtrlsWidth}px }`);

        const maxGroupLevel = dataGroupingSettings.groupings.numGroupings();
        const groupBackgroundColours = [];
        const groupForegroundColours = [];
        const childRowBackgroundColours = [];
        const childRowForegroundColours = [];
        const groupLevelPadding = [];
        const groupCtrlsPadding = [];

        for (let groupLevel = 0; groupLevel <= maxGroupLevel + 1; groupLevel++) {

            groupBackgroundColours.push(groupColourProvider.getGroupBackground(groupLevel));
            groupForegroundColours.push(groupColourProvider.getGroupForeground(groupLevel));
            childRowBackgroundColours.push(groupColourProvider.childRowBackground());
            childRowForegroundColours.push(groupColourProvider.childRowForeground(groupLevel));
            groupLevelPadding.push(groupingIndentation.groupCellPadding(groupLevel));
            groupCtrlsPadding.push(groupingIndentation.groupCtrlsPadding(groupLevel));
        }

        const lightChildRowForeground = groupColourProvider.lightChildRowForeground();

        let cachedDataRowStyles = null;

        const rowCountIncludingHeadings = rowIndexesIncHeadings.length;

        for (let i = tabularData.HeadingCount; i < rowCountIncludingHeadings; i++) {

            const r = rowIndexesIncHeadings[i]; // Row index including headings.
            const rowIndex = r - tabularData.HeadingCount; // Row index excluding headings.
            const rowY = rowYs[r];

            if (rowY === undefined) continue;

            const top = Math.round(rowHeight * rowY + columnHeadingHeight);

            styles.push(".ren-r-" + r + " {top:" + (top - getRowTopBase(rowY)) + "px;}");
            styles.push(
                ".ren-data-grid__row-heading.ren-r-" + r + "::before{content:'" + rowY + "'}"
            );

            if (top > lastRowTop) {

                lastR = r;
                lastRowTop = top;
            }

            lastRowY = Math.max(lastRowY, rowY);

            if (rowIndex >= tabularData.DataRowCount) { // tabularData.isGroupRow(rowIndex)

                const group = dataGroupingSettings.groupings.getGroupWithRowIndex(rowIndex);
                const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

                if (group) {

                    const isGroupExpanded = Ren.DataGrid_ExpandCollapse.isGroupExpanded(
                        tabularData,
                        expandedGroups,
                        grouping,
                        group
                    );

                    if (isGroupExpanded) {

                        styles.push(
                            ".ren-r-" + r +
                            " .ren-data-grid__group-expand-collapse-button::before{" +
                            "content:'\\2212'}" // Vertically-centred minus symbol.
                        );
                    }

                    // Hidden rather than removed, so the group count keeps its place.
                    if (grouping?.preventExpansion) {

                        styles.push(
                            ".ren-r-" + r + " .ren-data-grid__group-expand-collapse-button{" +
                            "visibility:hidden}"
                        );
                    }

                    styles.push(".ren-r-" + r + ".ren-data-grid__group-ctrls{padding-left:" +
                        groupCtrlsPadding[group.groupLevel] + "px}");

                    if (group.groupLevel > 1) {

                        // Apply styles to rows to indicate they are children of a group.
                        // Exclude group level 0, so that these appear as normal rows.

                        styles.push(
                            ".ren-data-grid__cell.ren-r-" + r + "{" +
                            "padding-left:" + groupLevelPadding[group.groupLevel] + "px;" +
                            "background-color:" + groupBackgroundColours[group.groupLevel] + ";" +
                            "color:" + groupForegroundColours[group.groupLevel] + "}"
                        );
                    }

                    if (group.groupLevel > 0) {

                        styles.push(".ren-data-grid__cell.ren-r-" + r + ".ren-data-grid__cell--null{background-color:" + nullCellBackgroundColor + "}");
                        styles.push(".ren-data-grid__cell.ren-r-" + r + ".ren-data-grid__cell--null::before{content:'NULL';font-style:italic}");
                    }
                }
            }
            else if (rowIndex >= 0 && rowIndex < tabularData.DataRowCount) {

                // tabularData.isDataRow(rowIndex)

                const group = dataGroupingSettings.groupings.getGroupContainingRow(rowIndex);

                if (group && group.groupLevel > 0) {

                    // Apply styles to rows to indicate they are children of a group.
                    // Exclude group level 0, so that these appear as normal rows.

                    if (!cachedDataRowStyles) {

                        cachedDataRowStyles = "{padding-left:" + groupLevelPadding[group.groupLevel + 1] + "px;" +
                            "background-color:" + childRowBackgroundColours[group.groupLevel] + ";" +
                            "color:" + childRowForegroundColours[group.groupLevel];

                        if (group.groupLevel > 1) {

                            // When there is grouping, style data rows differently to increase
                            // readability.
                            cachedDataRowStyles += ";font-family:Calibri;color:" + lightChildRowForeground;
                        }

                        cachedDataRowStyles += "}";
                    }

                    styles.push(".ren-data-grid__cell.ren-r-" + r + cachedDataRowStyles);
                }

                styles.push(".ren-data-grid__cell.ren-r-" + r + ".ren-data-grid__cell--null{background-color:" + nullCellBackgroundColor + "}");
                styles.push(".ren-data-grid__cell.ren-r-" + r + ".ren-data-grid__cell--null::before{content:'NULL';font-style:italic}");
            }
        }

        // Last row.
        const lastRowBorder = borderStyleProvider.lastRowBorder();
        styles.push(`.ren-r-${lastR} { ${lastRowBorder}}`);
        styles.push(`.ren-r-${lastR} .ren-data-grid__cell{height: ${rowHeight}px}`);

        // Totals row.

        // There is an intermediate state during initialisation when the datagrid has no groupings
        // (and therefore no totals row), so skip in that case.
        if (dataGroupingSettings.groupings.hasGroupings()) {

            const totalsRowIndex = dataGroupingSettings.groupings.totalsRowIndex();

            const totalsRowIndexIncHeadings = totalsRowIndex !== -1 ?
                totalsRowIndex + tabularData.HeadingCount :
                -1;

            const totalsRowStyles = totalsRowStyleProvider.getTotalsRowStyles();

            styles.push(".ren-r-" + totalsRowIndexIncHeadings + " {" + totalsRowStyles + "}");

            // Make totals row heading transparent, not blank, because the tests rely on the number.
            styles.push(
                ".ren-data-grid__row-heading.ren-r-" +
                totalsRowIndexIncHeadings + "::before { " +
                "color: transparent }"
            );

            styles.push(
                ".ren-data-grid__row-heading.ren-r-" + totalsRowIndexIncHeadings +
                " { z-index: 999 }"
            );

            // The totals row has no group controls, so the heading's ::after fills their space, to
            // hide the cells scrolled beneath it.  It sits outside the heading's 1px border.
            styles.push(
                ".ren-data-grid__row-heading.ren-r-" + totalsRowIndexIncHeadings + "::after { " +
                "content: ''; position: absolute; box-sizing: border-box; " +
                "top: -1px; left: calc(100% + 1px); height: calc(100% + 2px); " +
                "width: " + groupCtrlsWidth + "px; " +
                totalsRowStyles + " }"
            );
        }

        dataGridStylesheet.updateIfChanged(styles);

        updateDataGridColumnStyles();
        updateMiscStyles();
    };

    /**
     * Updates the datagrid's dynamic stylesheet for column positions and styles.
     */
    const updateDataGridColumnStyles = () => {

        const styles = [];

        // In display order, so it follows the column that is last after a reorder.
        const lastColumnIndex = gridState.getLastVisibleColumnIndex();

        for (let columnIndex = 0; columnIndex <= tabularData.ColumnCount; columnIndex++) {

            // The left position applies to everything with a class of ren-c-<columnIndex>.
            styles.push(".ren-c-" + columnIndex + " {left:" + dataGridColumnLeftPositions.columnLeftPositions[columnIndex] + "px;}");

            let columnStyle = "width:" + gridState.getColumnWidth(columnIndex) + "px;";

            if (gridState.getColumnWidth(columnIndex) === 0) columnStyle += "padding:0;border:0;";

            // Width only applies to cells or column headings, not to resize handles.
            styles.push(".ren-c-" + columnIndex + ":not(.ren-data-grid__column-resize-handle){" + columnStyle + "}");

            if (columnIndex < tabularData.ColumnCount && !gridState.isColumnVisible(columnIndex)) {

                styles.push(".ren-data-grid__cell.ren-c-" + columnIndex + "{display:none}");
                styles.push(".ren-data-grid__column-resize-handle.ren-c-" + (columnIndex + 1) + "{display:none}");
            }
        }

        // Override resize handle left positions: each ren-c-(N+1) handle must sit at the right
        // edge of data column N, not at the left edge of data column N+1 (which differs when
        // reordered).
        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const rightEdge = dataGridColumnLeftPositions.columnLeftPositions[columnIndex] +
                gridState.getColumnWidth(columnIndex);
            styles.push(".ren-data-grid__column-resize-handle.ren-c-" + (columnIndex + 1) + " {left:" + rightEdge + "px;}");
        }

        styles.push(".ren-data-grid__column-resize-handle.ren-c-" + (lastColumnIndex + 1) + "{width:3px}");
        styles.push(".ren-data-grid__column-resize-handle.ren-r-0 {height: " + dimensions.dataGridHeight + "px}");

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            // Right-align number columns.

            const columnFormat = tabularData.ColumnModels[columnIndex].ColumnFormat;

            if (Ren.SpreadsheetColumnFormatEnum.IsArithmetic(columnFormat)) {

                styles.push(".ren-data-grid__cell.ren-c-" + columnIndex + "{text-align:right}");

                // Keeps an aggregation symbol or label clear of the value.
                const cellSelector = ".ren-data-grid__cell.ren-c-" + columnIndex + ".ren-data-grid__cell--agg-";

                styles.push(
                    cellSelector + "symbol::after," +
                    cellSelector + "symbol-on-hover::after," +
                    cellSelector + "label::after," +
                    cellSelector + "label-on-hover::after" +
                    "{right:auto;left:0.25rem}"
                );
            }
        }

        // Last column.
        const lastColumnBorder = borderStyleProvider.lastColumnBorder();
        styles.push(".ren-c-" + lastColumnIndex + "{" + lastColumnBorder + "}");

        dataGridColumnPositionStylesheet.updateIfChanged(styles);
    };

    const updateColourScheme = () => {

        groupColourProvider.invalidateCachedColours();
        updateDataGridStyles();
        updateDataGridColumnStyles();
    };

    const updateMiscStyles = () => {

        const styles = [];

        tabularData.ColumnModels.forEach((columnModel, columnIndex) => {

            const columnIdOrHeading = columnModel.ColumnIdOrHeading;

            const hasColumnFilter = dataGroupingSettings.hasColumnFilter(columnIdOrHeading);

            const colour = hasColumnFilter ? "pink" : "#FCFCFD";

            styles.push(`.ren-data-grid__cell.ren-c-${columnIndex} .ren-data-grid__header-cell-down-arrow-button { background-color: ${colour} }`);
        });

        dataGridMiscStylesheet.updateIfChanged(styles);
    };

    return {
        updateColourScheme,
        updateDataGridStyles,
        updateDataGridColumnStyles
    };
};
