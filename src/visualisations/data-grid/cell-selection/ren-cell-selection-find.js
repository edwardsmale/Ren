/**
 * Finds the next cell in a datagrid whose displayed text contains a search string, and selects it.
 *
 * The scan runs over the grid as the user sees it - by rendered row Y position, left to right along
 * each row and then down - rather than over the underlying data rows.  Rows hidden by grouping or
 * filtering have no row Y, so they are never visited.
 */
Ren.DataGridCellSelection_Find = (parts, updateUI) => {

    const {
        tabularData,
        dataGroupingSettings,
        gridState,
        selection,
        cellValueReader,
        firstLastCell
    } = parts;

    // The row-filter predicate type Filter Rows writes (see Ren.FilterPredicates).
    const ROW_INDEXES_PREDICATE_TYPE = "includeRowIndexes";

    // Where the next Find Next resumes from, when the user has not moved the selection themselves.
    let lastFoundCell = null;

    /**
     * Gets the display X positions of the columns to search, in the order they are shown.
     *
     * @param {number[]} columnIndexes The SQL indexes of the columns to search, or null to search
     * every visible column.
     */
    const getColumnXsToSearch = (columnIndexes) => {

        const columnXs = [];
        const columnCount = tabularData.ColumnModels.length;

        for (let x = 0; x < columnCount; x++) {

            const columnIndex = dataGroupingSettings.getColIndex(x);

            if (columnIndex === undefined) continue;
            if (!gridState.isColumnVisible(columnIndex)) continue;
            if (columnIndexes && columnIndexes.indexOf(columnIndex) === -1) continue;

            columnXs.push(x);
        }

        return columnXs;
    };

    /**
     * Gets the cell the search resumes from: the selected cell if the selection is a cell
     * selection (whether the user made it or the last find did), otherwise the last cell found.
     */
    const getResumeCell = () => {

        if (selection.selectionType() === "cell") {

            const selectedRects = selection.selectedRects();

            for (let i = selectedRects.length - 1; i >= 0; i--) {

                const startCell = selectedRects[i].startCell;

                if (startCell) return startCell;
            }
        }

        return lastFoundCell;
    };

    /**
     * Gets the position in the scan order at which to start searching: the cell just after the
     * resume cell, or the resume cell itself when the user selected it rather than a previous find.
     *
     * Where the resume cell sits in a column that is not being searched, the scan resumes at the
     * first searched column to its right on the same row.
     */
    const getStartScanPosition = (resumeCell, columnXs, firstRowY, includeResumeCell) => {

        if (!resumeCell || resumeCell.y < firstRowY) return 0;

        const columnPosition = columnXs.indexOf(resumeCell.x);

        if (columnPosition !== -1) {

            const offset = includeResumeCell ? 0 : 1;

            return (resumeCell.y - firstRowY) * columnXs.length + columnPosition + offset;
        }

        for (let i = 0; i < columnXs.length; i++) {

            if (columnXs[i] > resumeCell.x) {

                return (resumeCell.y - firstRowY) * columnXs.length + i;
            }
        }

        return (resumeCell.y - firstRowY + 1) * columnXs.length;
    };

    /**
     * Gets the columns and rows the search runs over, or null when there is nothing to search.
     */
    const getSearchExtent = (columnIndexes) => {

        const columnXs = getColumnXsToSearch(columnIndexes);

        if (!columnXs.length) return null;

        // Row 0 is the column headings (and row 1 the subheadings, where there are any), which are
        // not part of the data being searched.
        const firstRowY = tabularData.HeadingCount;
        const rowCount = dataGroupingSettings.getActiveRowCount() - firstRowY;

        if (rowCount <= 0) return null;

        return { columnXs, firstRowY, rowCount };
    };

    /**
     * Creates a function that says whether the cell at the given display position matches the
     * search text.  The cell values are read from the data, so cells not yet scrolled into view are
     * searched too.
     *
     * @param {string} searchText The text to look for.
     * @param {boolean} matchCase Whether the comparison takes the case of the text into account.
     * @param {boolean} matchWholeCell Whether the cell has to hold the search text and nothing
     * else, rather than merely containing it.
     */
    const createCellMatcher = (searchText, matchCase, matchWholeCell) => {

        const overallSummaryStats = dataGroupingSettings.getOverallSummaryStats();
        const dataRowsColumnFormats = dataGroupingSettings.getDataRowsColumnFormats();
        const searchTextToMatch = matchCase ? searchText : searchText.toLowerCase();

        return (x, y) => {

            const cellValue = cellValueReader.getTextualisedCellValue(
                dataGroupingSettings.getColIndex(x),
                y,
                overallSummaryStats,
                dataRowsColumnFormats
            );

            if (cellValue == null) return false;

            const cellText = matchCase
                ? cellValue.toString()
                : cellValue.toString().toLowerCase();

            return matchWholeCell
                ? cellText === searchTextToMatch
                : cellText.includes(searchTextToMatch);
        };
    };

    /**
     * Selects the found cell on its own, as a cell selection, marked as a found cell so that it is
     * shown in the Find colour until the user selects something themselves.
     */
    const selectFoundCell = (x, y) => {

        const cell = { x, y };

        selection.clearSelection();
        selection.setCellSelection(selection.state, [cell]);
        selection.selectionType("cell");
        selection.focussedCell(cell);
        selection.isFoundCell(true);

        lastFoundCell = cell;

        updateUI();

        return cell;
    };

    /**
     * Takes the found-cell mark off the cell a previous find left selected, so that it goes back to
     * the ordinary selection colour, and the next search takes it in.
     */
    const clearFoundCell = () => {

        if (!selection.isFoundCell()) return;

        selection.isFoundCell(false);

        updateUI();
    };

    /**
     * Finds the next cell containing the search text and selects it.
     *
     * @param {string} searchText The text to look for.
     * @param {number[]} columnIndexes The SQL indexes of the columns to search in, or null to
     * search every visible column.
     * @param {boolean} matchCase Whether the comparison takes the case of the text into
     * account.
     * @param {boolean} matchWholeCell Whether the cell has to hold the search text and nothing
     * else, rather than merely containing it.
     * @param {boolean} fromTop Whether the search starts at the first cell of the grid rather than
     * on from the cell it last found or the user last selected.
     * @returns The co-ordinates of the found cell, or null if there was no match.
     */
    const findNext = (searchText, columnIndexes, matchCase, matchWholeCell, fromTop) => {

        if (!searchText) return null;

        const extent = getSearchExtent(columnIndexes);

        if (!extent) {

            clearFoundCell();
            return null;
        }

        const { columnXs, firstRowY, rowCount } = extent;

        const cellCount = rowCount * columnXs.length;

        // A cell the user selected themselves is searched as well, so that a search from a cell
        // that already contains the text finds that cell; one left selected by the last find is
        // not, so that Find Next moves on rather than finding it over and over.
        const includeResumeCell = selection.selectionType() === "cell" && !selection.isFoundCell();

        const startScanPosition = fromTop
            ? 0
            : getStartScanPosition(getResumeCell(), columnXs, firstRowY, includeResumeCell);

        const isMatch = createCellMatcher(searchText, matchCase, matchWholeCell);

        // Wrap around the end of the grid, so that repeatedly clicking Find Next cycles through
        // every match rather than stopping at the last one.
        for (let i = 0; i < cellCount; i++) {

            const scanPosition = (startScanPosition + i) % cellCount;
            const y = firstRowY + Math.floor(scanPosition / columnXs.length);

            if (dataGroupingSettings.isGapRow(y)) continue;

            const x = columnXs[scanPosition % columnXs.length];

            if (!isMatch(x, y)) continue;

            return selectFoundCell(x, y);
        }

        // Nothing matched, so the cell the last find left selected is no longer a found cell.
        clearFoundCell();

        return null;
    };

    /**
     * Scans the whole grid, not just the rendered part, for the rows that have a cell matching the
     * search text, giving back one entry per matching row: the row's display Y position, and the
     * display X of the first cell in it that matched.
     *
     * @param {string} searchText The text to look for.
     * @param {number[]} columnIndexes The SQL indexes of the columns to search in, or null to
     * search every visible column.
     * @param {boolean} matchCase Whether the comparison takes the case of the text into account.
     * @param {boolean} matchWholeCell Whether the cell has to hold the search text and nothing
     * else, rather than merely containing it.
     */
    const scanMatchingRows = (searchText, columnIndexes, matchCase, matchWholeCell) => {

        const matches = [];

        if (!searchText) return matches;

        const extent = getSearchExtent(columnIndexes);

        if (!extent) return matches;

        const { columnXs, firstRowY, rowCount } = extent;

        const isMatch = createCellMatcher(searchText, matchCase, matchWholeCell);

        for (let y = firstRowY; y < firstRowY + rowCount; y++) {

            if (dataGroupingSettings.isGapRow(y)) continue;

            for (let i = 0; i < columnXs.length; i++) {

                if (!isMatch(columnXs[i], y)) continue;

                matches.push({ x: columnXs[i], y });

                break; // One matching cell is enough for the row to count.
            }
        }

        return matches;
    };

    /**
     * Selects every row in the whole grid that has a cell matching the search text, as a row
     * selection.  Rows not yet rendered come up selected as and when they are.
     *
     * @param {string} searchText The text to look for.
     * @param {number[]} columnIndexes The SQL indexes of the columns to search in, or null to
     * search every visible column.
     * @param {boolean} matchCase Whether the comparison takes the case of the text into account.
     * @param {boolean} matchWholeCell Whether the cell has to hold the search text and nothing
     * else, rather than merely containing it.
     * @returns An object holding the number of rows selected, and the first matching cell.
     */
    const selectMatchingRows = (searchText, columnIndexes, matchCase, matchWholeCell) => {

        const noRows = { rowCount: 0, firstCell: null };

        const matches = scanMatchingRows(searchText, columnIndexes, matchCase, matchWholeCell);

        const lastX = firstLastCell.getLastCell().x;
        const rects = [];

        let firstCell = null;

        for (let i = 0; i < matches.length; i++) {

            const match = matches[i];

            rects.push({
                startCell: { x: 0, y: match.y },
                endCell: { x: lastX, y: match.y },
                selectionType: "row"
            });

            if (!firstCell) firstCell = { x: match.x, y: match.y };
        }

        // The row selection replaces whatever was selected before, found cell and all.
        selection.clearSelection();

        if (!rects.length) {

            updateUI();
            return noRows;
        }

        // Find Next has no cell to resume from any more, so it starts again from the top.
        lastFoundCell = null;

        selection.selectedRects(rects);
        selection.selectionType("row");
        selection.focussedCell(firstCell);
        selection.isFoundCell(true);

        updateUI();

        return { rowCount: rects.length, firstCell };
    };

    /**
     * Filters the grid down to the rows that have a cell matching the search text.
     * The rows are named by their data row index, as an "includeRowIndexes" row-filter predicate,
     * since the matching rows have no column value in common to filter on.  The predicate replaces
     * the one a previous Filter Rows left and leaves every other filter in place, so filtering
     * again narrows the grid further.  Group rows are not matched, being aggregates.
     *
     * @param {string} searchText The text to look for.
     * @param {number[]} columnIndexes The SQL indexes of the columns to search in, or null to
     * search every visible column.
     * @param {boolean} matchCase Whether the comparison takes the case of the text into account.
     * @param {boolean} matchWholeCell Whether the cell has to hold the search text and nothing
     * else, rather than merely containing it.
     * @returns The number of rows the grid has been filtered down to, which is zero - and the
     * filter left as it was - when nothing matched.
     */
    const filterMatchingRows = (searchText, columnIndexes, matchCase, matchWholeCell) => {

        const matches = scanMatchingRows(searchText, columnIndexes, matchCase, matchWholeCell);
        const rowIndexes = [];

        for (let i = 0; i < matches.length; i++) {

            const rowIndex =
                dataGroupingSettings.getRowIndex(matches[i].y) - tabularData.HeadingCount;

            if (rowIndex >= 0 && rowIndex < tabularData.DataRowCount) rowIndexes.push(rowIndex);
        }

        // Filtering the grid down to nothing tells the user no more than the message that nothing
        // matched does, and loses them what they were looking at, so the filter is left alone.
        if (!rowIndexes.length) return 0;

        const predicates = dataGroupingSettings.getRowFilterPredicates()
            .filter(predicate => predicate?.type !== ROW_INDEXES_PREDICATE_TYPE);

        predicates.push({ type: ROW_INDEXES_PREDICATE_TYPE, rowIndexes });

        // The rows are about to move, so whatever was selected - the cell a previous find left, or
        // the rows Select Rows left - no longer stands for what it did.
        selection.clearSelection();
        lastFoundCell = null;

        updateUI();

        dataGroupingSettings.sortFilterGroup.setRowFilterPredicates(predicates);

        return rowIndexes.length;
    };

    /**
     * Says whether a Filter Rows filter from a previous filterMatchingRows call is currently
     * active.
     */
    const hasFilterRows = () => {

        return dataGroupingSettings.getRowFilterPredicates()
            .some(predicate => predicate?.type === ROW_INDEXES_PREDICATE_TYPE);
    };

    /**
     * Clears the Filter Rows filter left by a previous filterMatchingRows call, leaving any other
     * filters in place.
     *
     * @returns True if a filter was cleared, false if there was none to clear.
     */
    const clearFilterRows = () => {

        const predicates = dataGroupingSettings.getRowFilterPredicates()
            .filter(predicate => predicate?.type !== ROW_INDEXES_PREDICATE_TYPE);

        if (predicates.length === dataGroupingSettings.getRowFilterPredicates().length) return false;

        dataGroupingSettings.sortFilterGroup.setRowFilterPredicates(predicates);

        return true;
    };

    return {
        findNext,
        selectMatchingRows,
        filterMatchingRows,
        clearFilterRows,
        hasFilterRows
    };
};
