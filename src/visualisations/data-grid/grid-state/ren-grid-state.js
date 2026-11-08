/**
 * Data grid state that may be synchronised across multiple datagrids via gridStateGroup.  Includes
 * column visibility and widths.  Does not include grid settings that are not synced.
 *
 * Structure:
 * - columns array: Stored in SQL query order (index 0 = first SQL column, index 1 = second, etc.)
 *
 *   Each column object contains:
 *
 *   - columnIndex: The SQL query position
 *   - column: Column ID or heading
 *   - visible: Whether the column is visible
 *   - width: (optional) Custom column width, if different to the automatic width
 *   - displayHeadingOverride: (optional) Text to render in place of the column's actual heading
 *
 * - columnOrder array: Display order of columns (array of columnIndex values)
 *
 *   Example: [2, 0, 1] means "show column at SQL index 2 first, then 0, then 1".
 *   This allows columns to be reordered while still remembering their original query position.
 *
 * This architecture ensures:
 *
 * - Column CSS classes (e.g., ren-c-0, ren-c-1) always refer to the same SQL column
 * - Column indices are stable across reordering operations
 * - Display order is flexible, and is persisted as the order of the serialised columns array
 */
Ren.GridState = (
    tabularData,
    visualisation,
    dataGroupingSettings,
    gridStateGroup,
    dataGridGuid) => {

    // Primary column state: array stored in data source order.
    // Array index = data source position, columnIndex property = data source order identifier.
    const columns = [];

    // Display order of columns - stores column indices in the order they should be displayed.
    // Maintains positions for both visible and hidden columns.
    let columnOrder = [];

    // Build initial columns array from tabularData.
    for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

        const columnModel = tabularData.ColumnModels[columnIndex];
        columns.push({
            columnIndex: columnIndex,  // Data source order position (stable identifier).
            column: columnModel.ColumnId || columnModel.Heading,
            visible: true
        });

        // Initialize columnOrder with data source order.
        columnOrder.push(columnIndex);
    }

    /**
     * Helper: Get column visibility state for a given column index.
     */
    const isColumnVisible = (columnIndex) => {

        const colState = columns[columnIndex];
        return colState && colState.visible;
    };

    /**
     * Gets a cached boolean array of column visibility, built on demand.
     */
    let visibleColumnsBoolArrayCache = null;

    const getVisibleColumnsBoolArray = () => {

        if (!visibleColumnsBoolArrayCache) {

            visibleColumnsBoolArrayCache = [];

            for (let i = 0; i < columns.length; i++) {
                visibleColumnsBoolArrayCache[i] = columns[i].visible;
            }
        }

        return visibleColumnsBoolArrayCache;
    };

    /**
     * Gets the cached array of visible column indices, built on demand.
     */
    let visibleColumnIndicesCache = null;

    const getVisibleColumnIndices = () => {

        if (!visibleColumnIndicesCache) {

            visibleColumnIndicesCache = [];

            for (let i = 0; i < columns.length; i++) {

                if (columns[i].visible) {
                    visibleColumnIndicesCache.push(i);
                }
            }
        }

        return visibleColumnIndicesCache;
    };

    /**
     * Clear the cached arrays when visibility changes.
     */
    const invalidateVisibilityCache = () => {

        visibleColumnsBoolArrayCache = null;
        visibleColumnIndicesCache = null;
    };

    /**
     * Sets the visibility of a single column.
     */
    const setColumnVisibility = (columnIndex, visible, doNotNotify) => {

        if (columnIndex < 0 || columnIndex >= columns.length) return;

        columns[columnIndex].visible = visible;
        invalidateVisibilityCache();

        if (visible) {

            // When showing a column, restore its width.  If unhiddenColumnWidths hasn't been set
            // yet, use the default width.
            const width = unhiddenColumnWidths[columnIndex] || 100;
            setColumnWidth(columnIndex, width, doNotNotify);
        }
        else {

            // When hiding a column, set its width to 0.
            setColumnWidth(columnIndex, 0, doNotNotify);
        }
    };

    /**
     * Sets the visibility of all columns at once.
     *
     * @param {Array} visibleColumnsList An array of column IDs or headings that should be visible.
     * @param {Array} originalColumns Optional array of columns that existed when the settings were
     *        saved.  Used for similarity matching to determine which new columns to show.
     */
    const setAllColumnsVisibility = (visibleColumnsList, originalColumns) => {

        // Build a map of which columns should be visible.
        const shouldBeVisible = new Map();

        // Mark all explicitly listed columns as visible.
        for (let i = 0; i < visibleColumnsList.length; i++) {

            shouldBeVisible.set(visibleColumnsList[i], true);
        }

        // Check for new columns that should be auto-visible.
        if (originalColumns) {

            for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

                const columnModel = tabularData.ColumnModels[columnIndex];
                const columnIdOrHeading = columnModel.ColumnId || columnModel.Heading;

                // If not explicitly in the list, check if it's new and should be auto-shown.
                if (!shouldBeVisible.has(columnIdOrHeading)) {

                    const wasInOriginal =
                        originalColumns.includes(columnModel.ColumnId) ||
                        originalColumns.includes(columnModel.Heading);

                    // New column: show if ColumnModel.Visible is true.
                    if (!wasInOriginal && columnModel.Visible === true) {
                        shouldBeVisible.set(columnIdOrHeading, true);
                    }
                }
            }
        }

        // Apply visibility based on the map.
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {

            const colState = columns[columnIndex];
            const visible = shouldBeVisible.has(colState.column);
            setColumnVisibility(columnIndex, visible, true);
        }

        invalidateVisibilityCache();
        Ren.Messages.Events.columnsMoved.notify();
    };

    /**
     * Gets the display heading override for a column, if one has been set.
     */
    const getDisplayHeadingOverride = (columnIndex) => {

        const colState = columns[columnIndex];
        return colState ? colState.displayHeadingOverride : undefined;
    };

    /**
     * Sets (or clears) the text that should be rendered in place of a column's actual heading.
     * An empty string sets the heading to blank.  Null, undefined, or whitespace-only values
     * clear the override entirely.  Unless doNotNotify is set, fires the gridStateChanged event
     * so the change is synced across grids in the group and the heading is re-rendered.
     */
    const setDisplayHeadingOverride = (columnIndex, override, doNotNotify) => {

        if (columnIndex < 0 || columnIndex >= columns.length) return;

        if (override === null || override === undefined) {

            delete columns[columnIndex].displayHeadingOverride;
        }
        else {

            const trimmedOverride = override.trim();

            if (trimmedOverride === "") {

                // Empty string after trim: set heading to blank.
                columns[columnIndex].displayHeadingOverride = "";
            }
            else {

                // Non-empty: use the trimmed value.
                columns[columnIndex].displayHeadingOverride = trimmedOverride;
            }
        }

        if (!doNotNotify) {
            notifyColumnWidthChanged();
        }
    };

    /**
     * Returns the indexes of the non-hidden columns in display order.
     */
    const visibleColumnIndexes = () => {

        const result = [];

        for (let i = 0; i < columnOrder.length; i++) {

            const columnIndex = columnOrder[i];

            if (columnIndex >= 0 && columnIndex < columns.length && columns[columnIndex].visible) {
                result.push(columnIndex);
            }
        }
        return result;
    };

    /**
     * Reorders columns for display purposes.
     * @param {Array} newOrder Array of column indices in the desired display order
     */
    const setColumnOrder = (newOrder) => {

        columnOrder = newOrder;
    };

    /**
     * Gets the index of the last non-hidden column in display order.
     */
    const getLastVisibleColumnIndex = () => {

        for (let i = columnOrder.length - 1; i >= 0; i--) {

            const columnIndex = columnOrder[i];

            if (columnIndex >= 0 && columnIndex < columns.length && columns[columnIndex].visible) {
                return columnIndex;
            }
        }

        return -1;
    };

    // Column widths
    const unhiddenColumnWidths = []; // Width of each column before hidden columns were set to zero.
    const fullColumnWidths = []; // Width of each column if text is not truncated.

    const columnWidths = []; // Width of each column (px).

    /**
     * Fires the gridStateChanged event which will update the column widths and left positions.
     */
    const notifyColumnWidthChanged = () => {

        Ren.Messages.Events.gridStateChanged.notify(_settings);
    };

    const getColumnWidth = (columnIndex) => columnWidths[columnIndex];
    const setColumnWidth = (columnIndex, width, doNotNotify) => {

        const newWidth = Math.round(width);
        if (columnWidths[columnIndex] === newWidth) return;

        columnWidths[columnIndex] = newWidth;

        if (!doNotNotify) {
            notifyColumnWidthChanged();
        }
    };

    /**
     * Sets the widths of multiple columns at once, only firing change events after all widths have
     * been set, and only if any widths have changed.
     */
    const setColumnWidths = (columnIndexWidths) => {

        let anyChanged = false;

        for (const [columnIndex, width] of columnIndexWidths) {

            const newWidth = Math.round(width);

            if (columnWidths[columnIndex] === newWidth) continue;

            columnWidths[columnIndex] = newWidth;
            anyChanged = true;
        }

        if (anyChanged) {
            notifyColumnWidthChanged();
        }
    };

    /**
     * Makes the column wide enough for its contents.
     */
    const makeColumnFullWidth = (columnIndex) => {

        setColumnWidth(columnIndex, fullColumnWidths[columnIndex]);
    };

    /**
     * Sets the column widths for all columns.
     */
    const resetColumnWidths = () => {

        const lastVisibleColumnIndex = getLastVisibleColumnIndex();

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const columnWidth = Ren.TextMeasurement.calculateColumnWidth(
                tabularData,
                dataGroupingSettings,
                columnIndex,
                visualisation.showColumnHeaderDownArrows
            );

            setColumnWidth(columnIndex, columnWidth);

            // Set width each column would have if the text were not truncated.
            fullColumnWidths[columnIndex] = columnWidths[columnIndex];

            // Limit initial width to 200px; allow the last column to be wider.
            const maxWidth = columnIndex < lastVisibleColumnIndex ? 200 : 800;
            columnWidths[columnIndex] = Math.min(columnWidths[columnIndex], maxWidth);

            // Set unhidden column width before hiding the column.
            unhiddenColumnWidths[columnIndex] = columnWidths[columnIndex];

            if (!isColumnVisible(columnIndex)) setColumnWidth(columnIndex, 0);
        }
    };

    /**
     * Measures the column widths of all columns and updates the fullColumnWidths array.
     */
    const measureColumns = () => {

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const columnWidth = Ren.TextMeasurement.calculateColumnWidth(
                tabularData,
                dataGroupingSettings,
                columnIndex,
                visualisation.showColumnHeaderDownArrows
            );

            fullColumnWidths[columnIndex] = columnWidth;
        }
    };

    const hasColumnWidthChanged = (columnIndex) => columnWidths[columnIndex] !== unhiddenColumnWidths[columnIndex];

    const showRowAndColumnHeadings = visualisation.showRowAndColumnHeadings ? 1 : 0;

    // The width of the row headings on the left.  Has to be wide enough to accommodate the row
    // numbers, and therefore wider as the number of rows increases.
    const rowHeadingWidth = showRowAndColumnHeadings ?
        Math.max(30, tabularData.ActualRowCount.toString().length * 8 + 4) :
        0;

    const visualisationGuid = visualisation.visualisationGuid;
    const dataSourceUri = visualisation.dataSourceUri;
    const tabularDataGuid = tabularData.tabularDataGuid;

    const _settings = {
        visualisationGuid,
        dataSourceUri,
        tabularDataGuid,
        resetColumnWidths,
        measureColumns,
        hasColumnWidthChanged,
        columnWidths,
        getColumnWidth,
        setColumnWidth,
        setColumnWidths,
        makeColumnFullWidth,
        columns,
        isColumnVisible,
        setColumnVisibility,
        setAllColumnsVisibility,
        getDisplayHeadingOverride,
        setDisplayHeadingOverride,
        setColumnOrder,
        visibleColumnIndexes,
        getLastVisibleColumnIndex,
        getVisibleColumnIndices,
        containingReportGuid: visualisation.containingReportGuid,
        dataGridGuid,
        rowHeadingWidth,
        showRowAndColumnHeadings,
        gridStateGroup,
        notifyColumnWidthChanged,
        // Legacy properties for backward compatibility - computed on demand
        get visibleColumns() {

            return getVisibleColumnsBoolArray();
        },
        get columnOrder() {

            // Return the display order of all columns (including hidden)
            return columnOrder;
        }
    };

    Ren.GridStateCollection.addGridState(_settings);

    return _settings;
};
