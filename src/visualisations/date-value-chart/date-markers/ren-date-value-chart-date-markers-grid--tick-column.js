/**
 * Turns the first column of a dates grid into its tick column: a column of checkboxes, headed by
 * one of its own (see ren-date-value-chart-date-markers-grid.js).
 */
Ren.DateValueChart_DateMarkersGrid_TickColumn = (() => {

    const tickColumnWidth = 52;

    /**
     * Gets the grid state of the grid just opened, which is where a column's width and its heading
     * are set.  Named by the visualisation as well as by the group, since a grid closed a moment
     * ago can still be in the collection waiting to be collected and is not the one being laid out.
     */
    const getGridState = (gridStateGroup, gridSet) => {

        const entries = Ren.GridStateCollection.entries;

        for (let i = 0; i < entries.length; i++) {

            const gridState = entries[i];

            if (gridState.gridStateGroup !== gridStateGroup) continue;
            if (gridSet && gridState.visualisationGuid !== gridSet.visualisationGuid) continue;

            return gridState;
        }

        return null;
    };

    /**
     * Lays the tick column out as a column of tick boxes rather than as a column of text: as narrow
     * as a box, headed by a box of its own that ticks and unticks every date at once.
     */
    const layOutTickColumn = (gridStateGroup, gridSet, tickColumn, gridId) => {

        const gridState = getGridState(gridStateGroup, gridSet);

        if (!gridState || !tickColumn) return;

        let columnIndex = -1;

        for (let i = 0; i < gridState.columns.length; i++) {

            if (gridState.columns[i].column === tickColumn) columnIndex = i;
        }

        if (columnIndex === -1) return;

        gridState.setColumnWidth(columnIndex, tickColumnWidth);
        gridState.setDisplayHeadingOverride(columnIndex, "");

        const headerCell = document.querySelector(
            "." + gridState.dataGridGuid +
            " .ren-data-grid__cell.ren-h.ren-c-" + columnIndex + ".ren-r-0"
        );

        // Reopened onto the grid it laid out before - the popup was never closed - so the box it
        // added is still there and still in step.
        const headerCheckboxClass =
            Ren.DateValueChart_DateMarkersGrid_Checkboxes.headerCheckboxClass;

        if (!headerCell || headerCell.querySelector("input." + headerCheckboxClass)) {
            return;
        }

        const headerCheckbox = document.createElement("input");

        headerCheckbox.type = "checkbox";
        headerCheckbox.className = headerCheckboxClass + " js-ren-suppress-context-menu";
        headerCheckbox.dataset.dateMarkersGrid = gridId;
        headerCheckbox.title = "Show every date, or none of them";
        headerCheckbox.style.cssText = Ren.DateValueChart_DateMarkersGrid_Checkboxes.checkboxStyle;

        // A heading cell is where a column is taken hold of to be dragged elsewhere, and a click on
        // one sorts it: a click on the box is neither of those.  The change event it also raises
        // does not travel with it, and is what ticks the dates.
        Ren.DomEventUtils.stopMouseDownReachingContainer(headerCheckbox);
        Ren.DomEventUtils.stopClickSelectingContainer(headerCheckbox);

        headerCell.appendChild(headerCheckbox);

        Ren.DateValueChart_DateMarkersGrid_Checkboxes.refreshHeaderCheckbox(gridId);
    };

    /**
     * Draws the grid's tick column with a checkbox in each of its data rows.  Set on the grid's
     * settings as they are registered, which is before its cells are rendered, so the checkboxes
     * are there from the first draw.
     *
     * Data rows only: a group row stands for several dates at once, and a tick against it would say
     * nothing about which of them the chart is annotated with.
     */
    const addCheckboxColumn = (settings, tickColumn, dateColumn, gridId) => {

        if (!tickColumn || !dateColumn) return;

        // The row's date, not the cell's own value: a tick is a value of the date column's filter,
        // so that is what the box has to carry.  A format function is handed the whole row as
        // rowVals (see Ren.ValueFormatter), which is where it is read from.
        settings.setDataRowsFormatFunction(
            tickColumn,
            "Ren.DateValueChart_DateMarkersGrid.renderDateCheckbox(" + gridId + ", " +
                "rowVals[" + JSON.stringify(dateColumn) + "])"
        );
    };

    return {
        layOutTickColumn,
        addCheckboxColumn
    };
})();
