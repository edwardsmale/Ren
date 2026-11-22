Ren.DataGridCellSelection_FirstLastCell = (tabularData, dataGroupingSettings, gridState) => {

    /**
     * Gets the co-ordinates of the top-left cell, as an object with `x` and `y` properties.
     * x is the display X position of the first visible column.
     */
    const getFirstCell = () => {

        const columnCount = tabularData.ColumnModels.length;

        for (let displayX = 0; displayX < columnCount; displayX++) {

            const sqlIndex = dataGroupingSettings.getColIndex(displayX);

            if (sqlIndex !== undefined && gridState.isColumnVisible(sqlIndex)) {
                return { x: displayX, y: 0 };
            }
        }

        return { x: 0, y: 0 };
    };

    /**
     * Gets the co-ordinates of the bottom-right cell, as an object with `x` and `y` properties.
     * x is the display X position of the last visible column.
     */
    const getLastCell = () => {

        const columnCount = tabularData.ColumnModels.length;

        for (let displayX = columnCount - 1; displayX >= 0; displayX--) {

            const sqlIndex = dataGroupingSettings.getColIndex(displayX);

            if (sqlIndex !== undefined && gridState.isColumnVisible(sqlIndex)) {
                return { x: displayX, y: dataGroupingSettings.getActiveRowCount() - 1 };
            }
        }

        return { x: 0, y: dataGroupingSettings.getActiveRowCount() - 1 };
    };

    return {
        getFirstCell,
        getLastCell
    };
};
