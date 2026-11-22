Ren.DataGridCellSelection_StateReader = (tabularData, dataGroupingSettings, selection) => {

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(dataGroupingSettings);

    /**
    * Gets an array of the indexes of the selected columns.
    */
    const getSelectedColumnIndexes = () => {

        const columnIndexes = new Set();

        selection.selectedRects().forEach((rect) => {

            const rectExtent = rectCalculator.getRectExtent(rect);

            for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) {

                const sqlIndex = dataGroupingSettings.getColIndex(x);

                if (sqlIndex !== undefined) columnIndexes.add(sqlIndex);
            }
        });

        return Array.from(columnIndexes);
    };

    const getSelectedColumnIdsOrHeadings = () => {

        const columnIndexes = getSelectedColumnIndexes();

        return tabularData.columnResolver.getColumnIdsOrHeadings(columnIndexes);
    };

    return {
        getSelectedColumnIndexes,
        getSelectedColumnIdsOrHeadings
    };
};
