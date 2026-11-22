/**
 * Writes a reference to a clicked cell into the function editor that has the focus, where the
 * editor was opened from one of this grid's cells (see Ren.FunctionEditorCellPicking).  A cell at
 * the editor's cell's level (the data rows, or one grouping's group rows) is read as value or
 * through rowVals, one in the group rows containing that level through groupSummaryStats, and one
 * in the totals row through overallSummaryStats.
 */
Ren.DataGridCellSelection_FunctionEditorCellPicker = (parts) => {

    const { tabularData, dataGroupingSettings, cellParser } = parts;

    const DATA_ROWS_LEVEL = -1;

    // The aggregation types giving one value, which the summary statistics are read by.
    const STATS_AGGREGATION_TYPES = new Set([
        Ren.AggregationTypeEnum.Sum,
        Ren.AggregationTypeEnum.Average,
        Ren.AggregationTypeEnum.Count,
        Ren.AggregationTypeEnum.CountDistinct,
        Ren.AggregationTypeEnum.Min,
        Ren.AggregationTypeEnum.Max,
        Ren.AggregationTypeEnum.MostCommon,
        Ren.AggregationTypeEnum.First,
        Ren.AggregationTypeEnum.Last,
        Ren.AggregationTypeEnum.Median
    ]);

    /**
     * Gets the row index (excluding headings) of a cell element.
     */
    const getRowIndex = (cellElement) =>
        cellParser.getRowIndex(cellElement) - tabularData.HeadingCount;

    /**
     * Gets the level of a row: DATA_ROWS_LEVEL for a data row, otherwise the index of its grouping
     * among the groupings (innermost first), or null where it is neither.
     */
    const getLevel = (rowIndex) => {

        if (tabularData.isDataRow(rowIndex)) return DATA_ROWS_LEVEL;

        if (!tabularData.isGroupRow(rowIndex)) return null;

        const groupings = dataGroupingSettings.groupings;
        const groupingIndex =
            groupings.entries.indexOf(groupings.getGroupingWithRowIndex(rowIndex));

        return groupingIndex === -1 ? null : groupingIndex;
    };

    /**
     * Gets the parameter a function at the source level reads a cell at the clicked level
     * through, or null where it reads it through none.
     */
    const getParameterName = (sourceLevel, clickedLevel) => {

        if (clickedLevel === sourceLevel) return "rowVals";

        // The totals row is the outermost grouping, which is the last.
        if (clickedLevel === dataGroupingSettings.groupings.entries.length - 1) {
            return "overallSummaryStats";
        }

        if (clickedLevel === sourceLevel + 1) return "groupSummaryStats";

        return null;
    };

    const getColumnKey = (columnIndex) => {

        const columnModel = tabularData.ColumnModels[columnIndex];

        return String(columnModel.ColumnIdOrHeading ?? columnModel.ColumnId ?? columnModel.Heading);
    };

    /**
     * Gets the key of the statistic a group row's cell shows, or null where it shows none, as in a
     * column its grouping groups by.
     */
    const getAggregationKey = (rowIndex, columnIndex) => {

        const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

        if (grouping.groupByColumnIndexes.indexOf(columnIndex) !== -1) return null;

        const aggregationType = grouping.getColumnAggregationType(columnIndex);

        if (!STATS_AGGREGATION_TYPES.has(aggregationType)) return null;

        return Ren.TextUtils.makeFirstCharLowerCase(
            Ren.AggregationTypeEnum.AsString(aggregationType)
        );
    };

    /**
     * Writes a reference to the cell mouse-downed on into the focused function editor, returning
     * a value indicating whether it did, in which case the grid leaves the click alone.
     */
    const pick = (e, cellElement, containerElement) => {

        if (e.button !== 0 || cellElement.classList.contains("ren-h")) return false;

        const editor = Ren.FunctionEditorCellPicking.getFocusedEditor();

        if (!editor || !editor.isOpenedFrom(containerElement)) return false;

        const sourceLevel = getLevel(getRowIndex(editor.sourceCellElement));
        const rowIndex = getRowIndex(cellElement);
        const clickedLevel = getLevel(rowIndex);

        if (sourceLevel === null || clickedLevel === null) return false;

        const parameterName = getParameterName(sourceLevel, clickedLevel);

        if (!parameterName) return false;

        const columnIndex = cellParser.getColumnIndex(cellElement);

        const isInserted = editor.insertReference({
            parameterName,
            columnKey: getColumnKey(columnIndex),
            isSourceColumn: columnIndex === cellParser.getColumnIndex(editor.sourceCellElement),
            aggregationKey: parameterName === "rowVals"
                ? null
                : getAggregationKey(rowIndex, columnIndex)
        });

        if (!isInserted) return false;

        // Keeps the focus, and so the caret, in the editor's code box.  Focusing the grid's
        // visualisation would clear the page's selection, which takes the focus from it.
        e.preventDefault();
        e.stopPropagation();

        return true;
    };

    return {
        pick
    };
};
