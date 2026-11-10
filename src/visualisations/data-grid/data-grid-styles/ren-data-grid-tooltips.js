/**
 * Shows the tooltips set on a datagrid's header cells and cells, from the headingTooltip,
 * headingTooltipFunction, cellTooltip and cellTooltipFunction column settings.
 *
 * A tooltip is worked out as its element is hovered and set as the element's title, so it is
 * never in the rendered grid and is always up to date.
 *
 * A header cell has no title by default, other than its heading where that is truncated.  A cell
 * whose value is truncated shows the value instead of its cellTooltip or cellTooltipFunction.
 *
 * The heading tooltip functions are called with the heading text as their value, and no row.
 */
Ren.DataGridTooltips = (
    tabularData,
    dataGroupingSettings,
    gridState,
    dataGridElement) => {

    /**
     * Gets a tooltip: what the last of the functions that gives one returns, else the text.
     */
    const getTooltip = (text, tooltipFunctions, value, rowVals, compressedRowVals) => {

        let tooltip = null;

        if (tooltipFunctions?.length) {

            for (let index = 0; index < tooltipFunctions.length; index++) {

                let result;

                try {

                    result = tooltipFunctions[index](value, rowVals, null, null, compressedRowVals);
                }
                catch (e) {

                    Ren.GlobalErrorHandler.logError(
                        "[DataGridTooltips] Error executing tooltip function:",
                        e
                    );

                    continue;
                }

                if (result != null && result !== "") tooltip = String(result);
            }
        }

        return tooltip ?? text;
    };

    const applyCalcFunctions = (value, calcFunctions, rowVals, compressedRowVals) => {

        if (!calcFunctions?.length) return value;

        for (let index = 0; index < calcFunctions.length; index++) {

            try {

                value = calcFunctions[index](value, rowVals, null, null, compressedRowVals);
            }
            catch (e) {

                return value;
            }
        }

        return value;
    };

    const getHeadingText = (columnIndex) =>
        gridState.getDisplayHeadingOverride(columnIndex) ??
        tabularData.ColumnModels[columnIndex].Heading;

    /**
     * Gets the tooltip of a column's header cells.
     */
    const getHeadingTooltip = (columnIndex) => {

        const formats = dataGroupingSettings.getDataRowsColumnFormats();

        return getTooltip(
            formats.columnHeadingTooltips[columnIndex],
            formats.columnHeadingTooltipFunctions[columnIndex],
            getHeadingText(columnIndex),
            {},
            {}
        );
    };

    /**
     * Gets the tooltip of a cell, from the settings of its row's level.
     */
    const getCellTooltip = (columnIndex, rowIndex) => {

        if (rowIndex >= 0 && rowIndex < tabularData.DataRowCount) {

            const formats = dataGroupingSettings.getDataRowsColumnFormats();
            const text = formats.columnCellTooltips[columnIndex];
            const tooltipFunctions = formats.columnCellTooltipFunctions[columnIndex];

            if (!tooltipFunctions && !text) return null;

            const compressedValues = tabularData.RowModels[rowIndex].CV;

            const rowVals = Ren.RowValues.getRowValuesForFormatFunction(
                tabularData,
                compressedValues,
                true
            );

            const compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(
                tabularData,
                compressedValues
            );

            const value = applyCalcFunctions(
                tabularData.CompressionDictionary.decompressValue(
                    compressedValues[columnIndex],
                    columnIndex
                ),
                formats.columnCalcFunctions[columnIndex],
                rowVals,
                compressedRowVals
            );

            return getTooltip(text, tooltipFunctions, value, rowVals, compressedRowVals);
        }

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);
        const group = grouping?.getGroupWithRowIndex(rowIndex);

        if (!group) return null;

        const formats = dataGroupingSettings.getColumnValueFormats(grouping.columns);
        const text = formats.columnCellTooltips[columnIndex];
        const tooltipFunctions = formats.columnCellTooltipFunctions[columnIndex];

        if (!tooltipFunctions && !text) return null;

        const groupRow = group.groupValues.getRow(group.position);

        const value = tabularData.CompressionDictionary.decompressValue(
            group.groupValues.get(group.position, columnIndex),
            columnIndex
        );

        return getTooltip(
            text,
            tooltipFunctions,
            value,
            Ren.RowValues.getRowValuesForFormatFunction(tabularData, groupRow, true),
            Ren.RowValues.getCompressedRowValuesForFormatFunction(tabularData, groupRow)
        );
    };

    /**
     * Gets the number in the element's class that starts with the prefix, as 3 for "ren-c-3", or
     * -1.
     */
    const getClassNumber = (element, prefix) => {

        const classList = element.classList;

        for (let index = 0; index < classList.length; index++) {

            const className = classList[index];

            if (className.startsWith(prefix)) {

                return parseInt(className.substring(prefix.length), 10);
            }
        }

        return -1;
    };

    const getElementTooltip = (element) => {

        if (!dataGroupingSettings.groupings.hasGroupings()) return null;

        const columnIndex = getClassNumber(element, "ren-c-");

        if (columnIndex < 0 || columnIndex >= tabularData.ColumnCount) return null;

        if (element.classList.contains("ren-h")) return getHeadingTooltip(columnIndex);

        const rowIndexIncHeadings = getClassNumber(element, "ren-r-");

        if (rowIndexIncHeadings < tabularData.HeadingCount) return null;

        return getCellTooltip(columnIndex, rowIndexIncHeadings - tabularData.HeadingCount);
    };

    // A header cell with no tooltip of its own shows its heading only where that is truncated.
    const getTruncatedHeadingTooltip = (element) => {

        if (!element.classList.contains("ren-h") || element.scrollWidth <= element.clientWidth) {
            return null;
        }

        // The cell's own text would include its down arrow button's.
        return element.querySelector(".ren-data-grid__header-cell-value")?.textContent ?? null;
    };

    // A truncated cell shows its value in place of any tooltip of its own.
    const getTruncatedCellTooltip = (element) => {

        if (element.classList.contains("ren-h") || element.scrollWidth <= element.clientWidth) {
            return null;
        }

        return element.textContent || null;
    };

    const getTooltipToApply = (element) => {

        if (element.classList.contains("ren-h")) {
            return getElementTooltip(element) || getTruncatedHeadingTooltip(element);
        }

        return getTruncatedCellTooltip(element) || getElementTooltip(element);
    };

    // Sets an element's title to its tooltip, or puts back the title it had before.
    const applyTooltip = (element) => {

        const tooltip = getTooltipToApply(element);

        const isShowingTooltip = element.renAppliedTooltip !== undefined &&
            element.title === element.renAppliedTooltip;

        // A title that is not the tooltip we set was set by the grid since, and is the one to go
        // back to.
        const defaultTitle = isShowingTooltip ? element.renDefaultTitle : element.title;

        if (tooltip) {

            element.renDefaultTitle = defaultTitle;
            element.renAppliedTooltip = tooltip;
            element.title = tooltip;
        }
        else if (isShowingTooltip) {

            element.title = defaultTitle;
            element.renAppliedTooltip = undefined;
        }
    };

    dataGridElement.addEventListener("mouseover", (event) => {

        const element = event.target.closest?.(".ren-data-grid__cell");

        if (element && dataGridElement.contains(element)) applyTooltip(element);
    });
};
