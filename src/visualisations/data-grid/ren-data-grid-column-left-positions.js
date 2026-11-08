/**
 * The left position of each column of a datagrid.
 */
Ren.DataGridColumnLeftPositions = (dataGroupingSettings, gridState) => {

    const groupingIndentation = Ren.GroupingIndentation(this);
    const columnLeftPositions = [];

    const getStartVal = () =>
        gridState.rowHeadingWidth +
        groupingIndentation.groupCtrlsWidth(
            dataGroupingSettings.groupings,
            dataGroupingSettings.layout.groupCtrlsCountMode
        );

    let cachedStartVal = 0;

    /**
     * Updates the left positions of each column based on the current column widths.
     */
    const updatePositions = () => {

        const startVal = getStartVal();
        cachedStartVal = startVal;

        const columnCount = gridState.columnWidths ? gridState.columnWidths.length : 0;

        let sum = startVal;

        columnLeftPositions.length = 0;

        // Use columnOrder if available (set from saved settings), otherwise build from
        // visibleColumns.  columnOrder contains the indexes of visible columns in the order they
        // should appear.
        let orderedVisibleIndexes = gridState.columnOrder && gridState.columnOrder.length > 0
            ? gridState.columnOrder
            : gridState.visibleColumns
                .map((visible, index) => visible ? index : null)
                .filter((index) => index !== null);

        // Deduplicate orderedVisibleIndexes in case columnOrder contains duplicate entries.  This
        // can happen if the grid state is synchronized multiple times or if deserialized settings
        // contain duplicates.
        if (orderedVisibleIndexes.length > 0) {

            orderedVisibleIndexes = Ren.ArrayUtils.distinct(orderedVisibleIndexes);
        }

        // If no visible columns are defined yet, default to all columns in natural order.
        if (orderedVisibleIndexes.length === 0) {

            orderedVisibleIndexes = [];

            for (let i = 0; i < columnCount; i++) {
                orderedVisibleIndexes.push(i);
            }
        }

        // Initialize columnLeftPositions array with the start value for all columns.  This ensures
        // that any column not explicitly set will have a valid position.
        for (let i = 0; i <= columnCount; i++) {
            columnLeftPositions.push(Math.round(startVal));
        }

        // Calculate positions based on the order in orderedVisibleIndexes.  Each column's left
        // position depends on where it appears in the ordered list.
        for (let orderIndex = 0; orderIndex < orderedVisibleIndexes.length; orderIndex++) {

            const columnIndex = orderedVisibleIndexes[orderIndex];

            // Set the left position for this column based on the cumulative sum.
            columnLeftPositions[columnIndex] = Math.round(sum);

            // Add this column's width to the sum for the next column.
            sum += gridState.columnWidths[columnIndex];
        }

        // Set positions for hidden columns (columns not in orderedVisibleIndexes) to the end.
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

            if (!orderedVisibleIndexes.includes(columnIndex)) {
                columnLeftPositions[columnIndex] = Math.round(sum);
            }
        }

        // Set the final position (for the last resize handle).
        columnLeftPositions[columnCount] = Math.round(sum) + 1;

        // Sync display positions into dataGroupingSettings.colXs so that colXIndexes maps
        // display X position → SQL column index, consistent with rowYs/rowYIndexes.
        const colXs = dataGroupingSettings.colXs;

        for (let i = 0; i < colXs.length; i++) {
            colXs[i] = -1;
        }
        let displayX = 0;

        for (let i = 0; i < orderedVisibleIndexes.length; i++) {

            const columnIndex = orderedVisibleIndexes[i];

            if (gridState.visibleColumns[columnIndex]) {
                colXs[columnIndex] = displayX++;
            }
        }
        dataGroupingSettings.updateColXIndexes();
    };

    /**
     * Returns the width of the frozen column area (row headings + group controls + frozen columns).
     * frozenColumnCount is the number of leading display-order columns that are frozen.  Uses
     * colXIndexes from dataGroupingSettings so that reordered columns are handled correctly.
     */
    const computeFrozenWidth = (frozenColumnCount) => {

        if (frozenColumnCount === 0) return cachedStartVal;

        // The first non-frozen display column sits at the right edge of all frozen columns.  Look
        // up its SQL column index via colXIndexes, then read its left position.
        const firstNonFrozenSqlIndex = dataGroupingSettings.colXIndexes.get(frozenColumnCount);

        if (firstNonFrozenSqlIndex !== undefined) {
            return columnLeftPositions[firstNonFrozenSqlIndex];
        }

        // All visible columns are frozen — return the total grid width.
        return columnLeftPositions[columnLeftPositions.length - 1];
    };

    Ren.Messages.Events.columnsMoved.handle(() => {

        updatePositions();

        Ren.FnUtils.defer(() => {

            updatePositions();
        }, 250);
    });

    Ren.Messages.Events.gridStateChanged.handle(() => {

        updatePositions();
    });

    // Initialize positions on creation.
    updatePositions();

    return {
        columnLeftPositions,
        computeFrozenWidth
    };
};
