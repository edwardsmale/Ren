/**
 * Helpers for a grid state's visible columns, using its cached visible column indices where it has
 * them.
 */
Ren.GridStateColumnIterator = (() => {

    /**
     * Calls callback(columnIndex, columnModel) for each visible column in data source order.
     */
    const forEachVisibleColumn = (gridState, tabularData, callback) => {

        if (!gridState || !tabularData) return;

        const visibleIndices = gridState.getVisibleColumnIndices?.() ?? null;

        if (visibleIndices) {

            visibleIndices.forEach(columnIndex => {

                callback(columnIndex, tabularData.ColumnModels[columnIndex]);
            });
        }
        else {

            for (let i = 0; i < tabularData.ColumnCount; i++) {

                if (gridState.isColumnVisible(i)) {
                    callback(i, tabularData.ColumnModels[i]);
                }
            }
        }
    };

    /**
     * Calls callback(columnIndex, columnModel) for each column in data source order.
     */
    const forEachColumn = (tabularData, callback) => {

        if (!tabularData) return;

        for (let i = 0; i < tabularData.ColumnCount; i++) {
            callback(i, tabularData.ColumnModels[i]);
        }
    };

    /**
     * Gets the visible column models in data source order.
     */
    const getVisibleColumnModels = (gridState, tabularData) => {

        if (!gridState || !tabularData) return [];

        const visibleIndices = gridState.getVisibleColumnIndices?.() ?? null;

        if (visibleIndices) {

            return visibleIndices.map(index => tabularData.ColumnModels[index]);
        }
        else {

            return tabularData.ColumnModels.filter((_, index) => gridState.isColumnVisible(index));
        }
    };

    /**
     * Gets the visible column IDs/headings in data source order.
     */
    const getVisibleColumnHeadings = (gridState, tabularData) => {

        if (!gridState || !tabularData) return [];

        const visibleIndices = gridState.getVisibleColumnIndices?.() ?? null;

        if (visibleIndices) {

            return visibleIndices.map(index =>
                tabularData.ColumnModels[index].ColumnId || tabularData.ColumnModels[index].Heading
            );

        }
        else {

            return tabularData.ColumnModels
                .filter((_, index) => gridState.isColumnVisible(index))
                .map(col => col.ColumnId || col.Heading);
        }
    };

    /**
     * Gets the number of visible columns.
     */
    const getVisibleColumnCount = (gridState, tabularData) => {

        if (!gridState || !tabularData) return 0;

        const visibleIndices = gridState.getVisibleColumnIndices?.() ?? null;

        if (visibleIndices) {

            return visibleIndices.length;
        }
        else {

            let count = 0;

            for (let i = 0; i < tabularData.ColumnCount; i++) {
                if (gridState.isColumnVisible(i)) count++;
            }
            return count;
        }
    };

    /**
     * Gets a value indicating whether any columns are visible.
     */
    const hasVisibleColumns = (gridState, tabularData) => {

        if (!gridState || !tabularData) return false;

        const visibleIndices = gridState.getVisibleColumnIndices?.() ?? null;

        if (visibleIndices) {

            return visibleIndices.length > 0;
        }
        else {

            for (let i = 0; i < tabularData.ColumnCount; i++) {
                if (gridState.isColumnVisible(i)) return true;
            }
            return false;
        }
    };

    /**
     * Creates a map of column ID/heading to column index for the visible columns.
     */
    const createVisibleColumnIndexMap = (gridState, tabularData) => {

        const map = new Map();

        if (!gridState || !tabularData) return map;

        const visibleIndices = gridState.getVisibleColumnIndices?.() ?? null;

        if (visibleIndices) {

            visibleIndices.forEach(index => {

                const col = tabularData.ColumnModels[index];
                const key = col.ColumnId || col.Heading;
                map.set(key, index);
            });
        }
        else {

            for (let i = 0; i < tabularData.ColumnCount; i++) {

                if (gridState.isColumnVisible(i)) {

                    const col = tabularData.ColumnModels[i];
                    const key = col.ColumnId || col.Heading;
                    map.set(key, i);
                }
            }
        }

        return map;
    };

    return {
        forEachVisibleColumn,
        forEachColumn,
        getVisibleColumnModels,
        getVisibleColumnHeadings,
        getVisibleColumnCount,
        hasVisibleColumns,
        createVisibleColumnIndexMap
    };
})();
