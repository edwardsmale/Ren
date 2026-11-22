Ren.DataGridColumnInitialVisibility = (() => {

    /**
     * Sets the initial visibility of columns in a data grid based on the Visible property of the
     * ColumnModels of the passed tabular data.
     */
    const setInitialColumnVisibility = (tabularData, gridState) => {

        for (let columnIndex = 0; columnIndex < tabularData.ColumnCount; columnIndex++) {

            const initiallyVisible = tabularData.ColumnModels[columnIndex].Visible;

            const doNotNotify = true; // Don't fire change events until all columns widths are set.

            gridState.setColumnVisibility(columnIndex, initiallyVisible, doNotNotify);
        }

        gridState.notifyColumnWidthChanged();
    };

    return {
        setInitialColumnVisibility
    };
})();
