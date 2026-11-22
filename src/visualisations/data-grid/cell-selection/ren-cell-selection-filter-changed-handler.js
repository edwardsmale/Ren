Ren.DataGridCellSelection_FilterChangedHandler = (dataGroupingSettings, selection) => {

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(
        dataGroupingSettings
    );

    let previousActiveRowCount;

    const handleFilterChanged = (updateUI, getSelectedColumnIndexes) => {

        if (selection.selectionType() === "all") {

            // Reapply the selection to all cells.
            selection.clearSelection();
            selection.selectAll();
        }
        else if (selection.selectionType() === "column") {

            // Re-select the columns that were selected before the filter changed.
            const selectedColumnIndexes = getSelectedColumnIndexes();
            selection.clearSelection();
            selectedColumnIndexes.forEach((sqlIndex) => {

                selection.selectColumn(dataGroupingSettings.getColX(sqlIndex));
            });
        }
        else if (selection.selectionType() === "column-v") {

            // Re-select the columns that were selected before the filter changed.
            const selectedColumnIndexes = getSelectedColumnIndexes();

            const selectionExtent = rectCalculator.getRectExtent(selection.selectedRects());
            const activeRowCount = dataGroupingSettings.getActiveRowCountExcludingTotalsRowAndHeaderRows();

            const minY = selectionExtent.minY;
            let maxY = activeRowCount;

            if (dataGroupingSettings.totalsRow.position === Ren.DataGridTotalsRowPositionEnum.Top ||
                dataGroupingSettings.totalsRow.position === Ren.DataGridTotalsRowPositionEnum.TopFixed) {

                maxY = activeRowCount + 1;
            }

            selection.clearSelection();
            selectedColumnIndexes.forEach((sqlIndex) => {

                selection.selectColumnV(dataGroupingSettings.getColX(sqlIndex), minY, maxY);
            });
        }
        else if (dataGroupingSettings.getExposedRowCount() !== previousActiveRowCount) {

            // If the row count has changed, clear the selection, as it would be difficult to
            // update the selection correctly when arbitrary cells are selected, due to grouping.
            selection.clearSelection();
        }

        previousActiveRowCount = dataGroupingSettings.getExposedRowCount();

        updateUI();
    };

    return {
        handleFilterChanged
    };
};
