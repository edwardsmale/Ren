Ren.DataGridCellSelection_StyleUpdater = (
    dataGroupingSettings,
    dataGridGuid,
    stateUpdater,
    gridState,
    firstLastCell) => {

    const state = stateUpdater.state;

    const selectedCellStyle = "background:#DFDFDF;border-color:#CCCCCC;color:#17213A!important;";

    // A cell that the Find window has just found is picked out in orange, so that the user can see
    // where the search landed without hunting for the usual grey among the rows.
    const foundCellStyle = "background:#FFB24D!important;border-color:#E89B2E;color:#17213A!important;";

    const cellSelectionStylesheet = Ren.DynamicStylesheets
        .setupDynamicStylesheet(dataGridGuid, "cell-selection")
        .getStylesheet();

    const dataGridCellSelector = (c, rowIndexIncHeadings) => `.${dataGridGuid} .ren-data-grid__cell.ren-c-${c}.ren-r-${rowIndexIncHeadings}`;
    const dataGridRowSelector = (rowIndexIncHeadings) => `.${dataGridGuid} .ren-data-grid__cell.ren-r-${rowIndexIncHeadings}`;
    const dataGridColumnSelector = (c) => `.${dataGridGuid} .ren-data-grid__cell.ren-c-${c}`;
    const dataGridAllSelector = "." + dataGridGuid + " .ren-data-grid__cell";

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(dataGroupingSettings);

    const outlineStyles = Ren.DataGridCellSelection_OutlineStyles(
        dataGroupingSettings,
        dataGridGuid,
        gridState,
        firstLastCell
    );

    /**
     * Adds styles to the given array to highlight the cells in the given range.
     */
    const addRectCellStyles = (styles, rect, style) => {

        const rectExtent = rectCalculator.getRectExtent(rect);

        if (rect.selectionType === "cell" || rect.selectionType === "column-v") {

            const rowIndexesIncHeadings = rectCalculator.getRectExtentRowIndexes(rectExtent);

            for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) {

                const c = dataGroupingSettings.getColIndex(x);

                for (let i = 0; i < rowIndexesIncHeadings.length; i++) {

                    const r = rowIndexesIncHeadings[i];

                    styles.push(dataGridCellSelector(c, r) + ` { ${style} }`);
                }
            }
        }
        else if (rect.selectionType === "row") {

            const rowIndexesIncHeadings = rectCalculator.getRectExtentRowIndexes(rectExtent);

            for (let i = 0; i < rowIndexesIncHeadings.length; i++) {

                const r = rowIndexesIncHeadings[i];

                styles.push(dataGridRowSelector(r) + ` { ${style} }`);
            }
        }
        else if (rect.selectionType === "column") {

            for (let x = rectExtent.minX; x <= rectExtent.maxX; x++) {
                styles.push(dataGridColumnSelector(dataGroupingSettings.getColIndex(x)) + ` { ${style} }`);
            }
        }
        else {

            styles.push(dataGridAllSelector + ` { ${style} }`);
        }
    };

    const updateCellSelectionStyles = (state) => {

        const originalStyles = cellSelectionStylesheet.textContent;

        const styles = [];

        const selectionStyle = state.isFoundCell ? foundCellStyle : selectedCellStyle;

        // Skip any malformed rect (missing a start or end cell) so a single bad entry cannot throw
        // and leave the whole selection unrendered.
        const isCompleteRect = (rect) => rect && rect.startCell && rect.endCell;

        const outlinedRects = [];

        state.selectedRects.forEach(rect => {

            if (!isCompleteRect(rect)) return;

            addRectCellStyles(styles, rect, selectionStyle);
            outlinedRects.push(rect);
        });

        if (isCompleteRect(state.dragRect)) {

            addRectCellStyles(styles, state.dragRect, selectedCellStyle);
            outlinedRects.push(state.dragRect);

            if (state.dragRect.startCell.x !== state.dragRect.endCell.x ||
                state.dragRect.startCell.y !== state.dragRect.endCell.y) {

                // While dragging, disable pointer events on elements within the cells, as these
                // interfere with the drag operation.  Such elements include hyperlinks, spans for
                // adding colour, and elements for italic and bold text.

                styles.push(`.ren-data-grid__cell * { pointer-events: none }`);
            }
        }

        outlineStyles.addOutlineStyles(styles, outlinedRects);

        const updatedStyles = styles.join("\n");

        if (originalStyles === updatedStyles) return;

        cellSelectionStylesheet.textContent = updatedStyles;
    };

    Ren.Messages.Events.selectedValuesChanged.handle((changedDataGridGuid) => {

        if (changedDataGridGuid !== dataGridGuid) return;

        updateCellSelectionStyles(state);
    });
};
