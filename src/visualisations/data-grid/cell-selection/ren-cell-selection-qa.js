/**
 * Reads a column's text as selecting it and copying would, for the integration tests.  A test that
 * clicks a column heading instead has to ask the page for each heading's text in turn to find the
 * one it wants, which is a round trip per column of the grid before anything is read; this finds
 * the column and reads it in one.
 *
 * The selection is put back as it was afterwards, so that reading a column is only a read: nothing
 * here repaints the grid or moves the user's own selection.
 */
Ren.DataGridCellSelection_QA = (parts, getSelectedCellsTsv) => {

    const { dataGroupingSettings, gridState, cellValueReader, selection } = parts;

    /**
     * Gets the heading a column is shown under, textualised the same way the copied text is, so
     * that a heading matches here exactly where it would match in what a test compares against.
     */
    const getColumnHeadingText = (sqlColumnIndex) => {

        return cellValueReader.getTextualisedCellValue(
            sqlColumnIndex,
            0,
            dataGroupingSettings.getOverallSummaryStats(),
            dataGroupingSettings.getDataRowsColumnFormats()
        );
    };

    /**
     * Gets the display position of the column with the given heading, which is what the selection
     * works in, or -1 when no column on show has that heading.
     */
    const findColumnX = (columnHeading) => {

        for (let x = 0; x < dataGroupingSettings.colXs.length; x++) {

            const sqlColumnIndex = dataGroupingSettings.getColIndex(x);

            if (!gridState.isColumnVisible(sqlColumnIndex)) continue;

            if (getColumnHeadingText(sqlColumnIndex) === columnHeading) return x;
        }

        return -1;
    };

    const backUpSelectionState = () => {

        return {
            selectedRects: selection.state.selectedRects,
            isMouseDown: selection.state.isMouseDown,
            selectionType: selection.state.selectionType,
            dragRect: selection.state.dragRect,
            focussedCell: selection.state.focussedCell,
            isFoundCell: selection.state.isFoundCell
        };
    };

    const restoreSelectionState = (backUp) => {

        selection.state.selectedRects = backUp.selectedRects;
        selection.state.isMouseDown = backUp.isMouseDown;
        selection.state.selectionType = backUp.selectionType;
        selection.state.dragRect = backUp.dragRect;
        selection.state.focussedCell = backUp.focussedCell;
        selection.state.isFoundCell = backUp.isFoundCell;
    };

    /**
     * Gets the text of the given columns, headings included, in the tab-separated form copying a
     * column selection gives.
     */
    const getColumnsText = (columnHeadings) => {

        const backUp = backUpSelectionState();

        try {

            // clearSelection replaces the selected rectangles with a new array rather than emptying
            // the one backed up above, so selecting below leaves that one as it was.
            selection.clearSelection();

            for (let i = 0; i < columnHeadings.length; i++) {

                const x = findColumnX(columnHeadings[i]);

                if (x === -1) {
                    throw new Error("No column is shown under the heading: " + columnHeadings[i]);
                }

                selection.selectColumn(x);
            }

            return getSelectedCellsTsv();
        }
        finally {

            restoreSelectionState(backUp);
        }
    };

    return {
        getColumnsText
    };
};
