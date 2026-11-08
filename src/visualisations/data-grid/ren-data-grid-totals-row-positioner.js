/**
 * Positions the totals row when it is set to be fixed at the top or bottom of the datagrid.
 */
Ren.DataGridTotalsRowPositioner = (
    tabularData,
    dataGroupingSettings,
    dataGridSections,
    dataGridScrollPos,
    gridState) => {

    const totalsRowPositionStylesheet = Ren.DynamicStylesheets
        .setupDynamicStylesheet(gridState.dataGridGuid, "totals-row-position")
        .getStylesheet();

    /**
     * If the totals row position is TopFixed or BottomFixed, position the totals row so that it
     * stays still.  This is done here, rather than in the style updater, to avoid lagging.
     */
    const positionTotalsRow = () => {

        const totalsRowPosition = dataGroupingSettings.totalsRow.position;

        if (totalsRowPosition !== Ren.DataGridTotalsRowPositionEnum.TopFixed &&
            totalsRowPosition !== Ren.DataGridTotalsRowPositionEnum.BottomFixed) {

            totalsRowPositionStylesheet.textContent = "";
            return;
        }

        let totalsRowTop = null;

        if (totalsRowPosition === Ren.DataGridTotalsRowPositionEnum.TopFixed) {

            totalsRowTop = Ren.DataGridConstants.rowHeight * tabularData.HeadingCount + dataGridScrollPos.y;

            if (gridState.showRowAndColumnHeadings) {
                totalsRowTop += Ren.DataGridConstants.rowHeight;
            }
        }
        else if (totalsRowPosition === Ren.DataGridTotalsRowPositionEnum.BottomFixed) {

            const viewportHeight = dataGridSections.frozenLeftSection_Viewport.clientHeight;

            const rowCount = dataGroupingSettings.getActiveRowCount() + tabularData.HeadingCount;
            const gridHeight = Ren.DataGridConstants.rowHeight * rowCount;

            if (gridHeight >= viewportHeight) {

                // We only need to act to position the totals row if the grid is taller than the
                // viewport.
                totalsRowTop = dataGridScrollPos.y + viewportHeight;

                // Position totals row as the last visible row.  Subtract 2 for thicker border.
                totalsRowTop -= Ren.DataGridConstants.rowHeight + 2;
            }
        }

        if (tabularData.DataRowCount > 0) {

            const totalsRowIndex = dataGroupingSettings.groupings.totalsRowIndex() + tabularData.HeadingCount;

            const totalsRowStyles = [];

            totalsRowStyles.push(".ren-r-" + totalsRowIndex + " { top: " + totalsRowTop + "px!important; z-index: 999 }");

            // Still output the styles, even if they are empty, otherwise styles get left behind in
            // the stylesheet when the groupings are changed, messing up the layout.
            const stylesheetScope = "." + gridState.dataGridGuid; // Scope styles to this datagrid
                                                                  // only.

            totalsRowPositionStylesheet.textContent = totalsRowStyles
                .map(style => stylesheetScope + " " + style)
                .join("\n");
        }
    };

    return {
        positionTotalsRow
    };
};
