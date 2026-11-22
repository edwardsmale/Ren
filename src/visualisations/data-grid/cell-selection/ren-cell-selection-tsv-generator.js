Ren.DataGridCellSelection_TsvGenerator = (tabularData, dataGroupingSettings, gridState) => {

    const cellValueReader = Ren.DataGridCellSelection_CellValueReader(
        tabularData,
        dataGroupingSettings
    );

    /**
     * Sorts cells by row then column.
     */
    const sortCells = (cells) => {

        cells.sort((a, b) => a.y - b.y || a.x - b.x);
    };

    /**
     * Finds the min/max X and min Y.
     */
    const getCellExtents = (cells) => {

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;

        for (let i = 0; i < cells.length; i++) {

            const cell = cells[i];
            if (cell.x < minX) minX = cell.x;
            if (cell.x > maxX) maxX = cell.x;
            if (cell.y < minY) minY = cell.y;
        }

        return { minX, maxX, minY };
    };

    /**
     * Generates the TSV body (excluding headings).
     */
    const generateTsvBody = (cells, minX, maxX, minY, gridState, cellValueReader,
        overallSummaryStats, dataRowsColumnFormats, options) => {

        let x = minX;
        let y = minY;
        let tsv = "";

        for (let i = 0; i < cells.length; i++) {

            const cell = cells[i];
            if (i > 0 && cell.x === x && cell.y === y) continue;

            while (x !== cell.x || y !== cell.y) {

                if (x === maxX) {

                    x = minX;
                    y++;
                    tsv += "\n";
                }
                else {

                    x++;

                    if (gridState.isColumnVisible(dataGroupingSettings.getColIndex(x - 1))) {
                        tsv += "\t";
                    }
                }
            }

            if (gridState.isColumnVisible(dataGroupingSettings.getColIndex(x))) {

                tsv += cellValueReader.getTextualisedCellValue(
                    dataGroupingSettings.getColIndex(x),
                    y,
                    overallSummaryStats,
                    dataRowsColumnFormats,
                    options
                );
            }
        }

        return tsv;
    };

    const removeBlankLines = (tsv) => {

        const lines = tsv.split("\n");
        const nonWhitespaceLines = lines.filter(line => line.trim() !== "");
        return nonWhitespaceLines.join("\n");
    };

    const prependHeadings = (tsv, minX, maxX, gridState, cellValueReader, overallSummaryStats,
        dataRowsColumnFormats, options) => {

        const headings = [];

        for (let _x = minX; _x <= maxX; _x++) {

            const sqlIndex = dataGroupingSettings.getColIndex(_x);

            if (gridState.isColumnVisible(sqlIndex)) {

                headings.push(cellValueReader.getTextualisedCellValue(
                    sqlIndex,
                    0,
                    overallSummaryStats,
                    dataRowsColumnFormats,
                    options
                ));
            }
        }

        return headings.join("\t") + "\n" + tsv;
    };

    /**
     * Gets the text of all the selected cells as a TSV string.
     * @param {Object} state - The selection state
     * @param {Array} cells - The selected cells
     * @param {Object} options - Options object
     * @param {boolean} options.withHeadings - If true, include headings
     * @param {boolean} options.escapeNewlines - If true, preserve newline characters in cell values
     */
    const getSelectedCellsTsv = (state, cells, options) => {

        sortCells(cells);

        const overallSummaryStats = dataGroupingSettings.getOverallSummaryStats();
        const dataRowsColumnFormats = dataGroupingSettings.getDataRowsColumnFormats();

        const { minX, maxX, minY } = getCellExtents(cells);

        let tsv = generateTsvBody(
            cells,
            minX,
            maxX,
            minY,
            gridState,
            cellValueReader,
            overallSummaryStats,
            dataRowsColumnFormats,
            options
        );

        tsv = Ren.TextUtils.removeTrailing(tsv, "\n");

        if (state.selectionType === "row") {
            tsv = removeBlankLines(tsv);
        }

        if (options?.withHeadings && minY >= 1) {

            tsv = prependHeadings(
                tsv,
                minX,
                maxX,
                gridState,
                cellValueReader,
                overallSummaryStats,
                dataRowsColumnFormats,
                options
            );
        }

        tsv = tsv.replace(/，/g, ", "); // Replace full-width commas with normal commas.

        return tsv;
    };

    return {
        getSelectedCellsTsv
    };
};
