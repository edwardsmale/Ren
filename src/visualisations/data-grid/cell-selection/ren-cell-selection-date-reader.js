/**
 * Reads the dates the selected cells hold, whether as a day ("2026-05-04", "04/05/2026"), a month
 * ("May 2026") or a quarter ("Q2 2026"), for showing on a calendar.
 */
Ren.DataGridCellSelection_DateReader = (parts) => {

    const {
        tabularData,
        dataGroupingSettings,
        dataGridGuid,
        cellParser,
        cellValueReader,
        selectedCellsCalculator,
        selection
    } = parts;

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(dataGroupingSettings);

    // How many of a column's selected cells are looked at in deciding whether the selection holds
    // any dates, so that a menu opened on a large selection of something else opens promptly.
    const MAX_CELLS_CHECKED_PER_COLUMN = 50;

    /**
     * Gets a cell's text where it names a date, or null where it names none.  The text as shown is
     * tried before the value as held, since a value grouped by month or quarter can be held as its
     * first day but shown as the month or quarter it stands for.
     */
    const getCellDateText = (sqlColIndex, y, overallSummaryStats, dataRowsColumnFormats) => {

        const shownValue = cellValueReader.getTextualisedCellValue(
            sqlColIndex,
            y,
            overallSummaryStats,
            dataRowsColumnFormats
        );

        const shownText = String(shownValue ?? "").trim();

        if (Ren.DateUtils.parseDateRange(shownText)) return shownText;

        const heldText = String(cellValueReader.getCellValue(sqlColIndex, y, false) ?? "").trim();

        if (Ren.DateUtils.parseDateRange(heldText)) return heldText;

        return null;
    };

    /**
     * Gets the cell of this grid the context menu was opened on, or null where it was opened on
     * something else.
     */
    const getRightClickedCell = () => {

        const target = Ren.LastRightClickTarget;
        const cellElement = target && target.closest ? target.closest(".ren-data-grid__cell") : null;

        if (!cellElement || !cellElement.closest("." + dataGridGuid)) return null;

        return cellParser.toCell(cellElement);
    };

    /**
     * Gets a value indicating whether a cell is within the selection.
     */
    const isCellSelected = (cell) => {

        const state = selection.state;
        const rects = state.dragRect ? [state.dragRect] : [];

        for (let index = 0; index < state.selectedRects.length; index++) {
            rects.push(state.selectedRects[index]);
        }

        for (let index = 0; index < rects.length; index++) {

            const rect = rects[index];

            if (!rect || !rect.startCell || !rect.endCell) continue;

            const extent = rectCalculator.getRectExtent(rect);

            if (cell.x >= extent.minX && cell.x <= extent.maxX &&
                cell.y >= extent.minY && cell.y <= extent.maxY) {

                return true;
            }
        }

        return false;
    };

    /**
     * Visits the cells the menu acts on, leaving out the headings and the totals row.  The menu is
     * built before the grid selects a right-clicked cell outside the selection, so such a cell is
     * taken to be the selection it is about to become.
     */
    const forEachMenuCell = (callback) => {

        const clickedCell = getRightClickedCell();

        if (clickedCell && !isCellSelected(clickedCell)) {

            if (clickedCell.y >= tabularData.HeadingCount &&
                clickedCell.y !== dataGroupingSettings.totalsRowY()) {

                const sqlColIndex = dataGroupingSettings.getColIndex(clickedCell.x);

                callback(clickedCell.x, clickedCell.y, sqlColIndex);
            }

            return;
        }

        selectedCellsCalculator.forEachSelectedCell(selection.state, true, true, callback);
    };

    /**
     * Visits the text of each cell the menu acts on that names a date, until the callback returns
     * false.
     */
    const forEachSelectedDateText = (maxCellsCheckedPerColumn, callback) => {

        const overallSummaryStats = dataGroupingSettings.getOverallSummaryStats();
        const dataRowsColumnFormats = dataGroupingSettings.getDataRowsColumnFormats();
        const cellsCheckedByColumn = new Map();

        let isStopped = false;

        forEachMenuCell(
            (_x, y, sqlColIndex) => {

                if (isStopped) return;

                const cellsChecked = cellsCheckedByColumn.get(sqlColIndex) ?? 0;

                if (cellsChecked >= maxCellsCheckedPerColumn) return;

                cellsCheckedByColumn.set(sqlColIndex, cellsChecked + 1);

                const dateText = getCellDateText(
                    sqlColIndex,
                    y,
                    overallSummaryStats,
                    dataRowsColumnFormats
                );

                if (dateText === null) return;

                if (callback(dateText) === false) isStopped = true;
            }
        );
    };

    /**
     * Gets a value indicating whether any of the selected cells names a date.
     */
    const hasSelectedDates = () => {

        let hasDates = false;

        forEachSelectedDateText(MAX_CELLS_CHECKED_PER_COLUMN, () => {

            hasDates = true;

            return false;
        });

        return hasDates;
    };

    /**
     * Gets the distinct texts of the selected cells that name dates.
     */
    const getSelectedDates = () => {

        const dateTexts = new Set();

        forEachSelectedDateText(Infinity, (dateText) => {

            dateTexts.add(dateText);
        });

        return Array.from(dateTexts);
    };

    return {
        hasSelectedDates,
        getSelectedDates
    };
};
