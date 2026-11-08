/**
 * Handles cell selection in a datagrid.  This includes selecting cells, rows, and columns, and
 * copying the selected cells to the clipboard.
 */
Ren.DataGridCellSelection_RowHoverStyles = (dataGridGuid, gridState, visualisation) => {

    const rowHoverStylesheet = Ren.DynamicStylesheets
        .setupDynamicStylesheet(dataGridGuid, "rowhover")
        .getStylesheet();

    // Cells whose style functions set a background or colour keep it, being marked by
    // Ren.DataGridCellStyles.
    const getRowHoverRules = (r) => {

        const rowSelector = `.${gridState.dataGridGuid} .ren-r-${r}`;

        return `${rowSelector}:not(.ren-data-grid__cell--styled-background)` +
            `{ background-color:#FFEFFE!important }\n` +
            `${rowSelector}:not(.ren-data-grid__cell--styled-colour) { color:black!important }`;
    };

    let hoverRowIndexIncludingHeadings = -1;

    /**
     * Highlights the row when the mouse is over it.
     */
    const rowHoverMouseOver = (r) => {

        if (Ren.QA.isIvt()) return;

        // Read on every move, so that turning it off clears a highlight left from before.
        if (visualisation.highlightHoveredRow === false) {

            if (hoverRowIndexIncludingHeadings === -1) return;

            hoverRowIndexIncludingHeadings = -1;
            rowHoverStylesheet.textContent = "";
            return;
        }

        if (hoverRowIndexIncludingHeadings !== r) {

            hoverRowIndexIncludingHeadings = r;
            rowHoverStylesheet.textContent = getRowHoverRules(r);
        }
    };

    /**
     * Removes the row highlight when the mouse leaves the row.
     */
    const rowHoverMouseLeave = (r) => {

        if (Ren.QA.isIvt()) return;

        if (hoverRowIndexIncludingHeadings === r) {

            hoverRowIndexIncludingHeadings = -1;
            rowHoverStylesheet.textContent = "";
        }
    };

    return {
        rowHoverMouseOver,
        rowHoverMouseLeave
    };
};
