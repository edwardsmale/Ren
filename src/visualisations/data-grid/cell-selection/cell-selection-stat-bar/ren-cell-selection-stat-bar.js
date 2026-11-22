Ren.DataGridCellSelection_StatBar = (
    tabularData,
    dataGroupingSettings,
    selectedCellsCalculator,
    selection,
    cellValueReader) => {

    /**
     * Gets the compressed value of the cell in the given SQL column at the given display Y.
     */
    const getCompressedValueOfColumn = (sqlColIndex, y) => {

        if (dataGroupingSettings.isGapRow(y)) return null;

        const rowIndex = dataGroupingSettings.getRowIndex(y) - tabularData.HeadingCount;

        if (rowIndex < 0) return null; // No compressed value for headings.

        if (rowIndex >= tabularData.DataRowCount) { // Group row

            const group = dataGroupingSettings.groupings.getGroupWithRowIndex(rowIndex);
            return group.groupValues.get(group.position, sqlColIndex);
        }
        else { // Data row

            return tabularData.RowModels[rowIndex].CV[sqlColIndex];
        }
    };

    const getCompressedValue = (displayX, y) =>
        getCompressedValueOfColumn(dataGroupingSettings.getColIndex(displayX), y);

    /**
    * Returns an array of strings to display in the stat bar.
    */
    const getStatBarValues = () => {

        const overallSummaryStats = dataGroupingSettings.getOverallSummaryStats();
        const dataRowsColumnFormats = dataGroupingSettings.getDataRowsColumnFormats();

        const rowCount = dataGroupingSettings.getActiveRowCountExcludingTotalsRowAndHeaderRows();

        const statBarValues = [];

        const excludeTotalsRow = true;
        const excludeHeaderRows = true;

        const rowYs = new Set();
        const lengthExtent = [9999, -9999];
        let count = 0;
        let strCount = 0;
        let sum = 0;
        let numCount = 0;
        const distinctValues = new Map();

        // The value format shared by every number summed, or null once two differ.
        let numFormat;

        // A group row's values take its grouping's formats (a count of a text column is a number),
        // so the formats are looked up per grouping, once each.
        const groupingValueFormats = new Map();

        const getCellValueFormat = (sqlColIndex, y) => {

            const columnFormat = tabularData.ColumnModels[sqlColIndex].ColumnFormat;

            if (dataGroupingSettings.isGapRow(y)) return columnFormat;

            const rowIndex = dataGroupingSettings.getRowIndex(y) - tabularData.HeadingCount;

            if (rowIndex < tabularData.DataRowCount) return columnFormat;

            const grouping = dataGroupingSettings.groupings.getGroupingWithRowIndex(rowIndex);

            if (!grouping) return columnFormat;

            let valueFormats = groupingValueFormats.get(grouping);

            if (!valueFormats) {

                valueFormats = dataGroupingSettings
                    .getColumnValueFormats(grouping.columns)
                    .columnValueFormats;

                groupingValueFormats.set(grouping, valueFormats);
            }

            return valueFormats[sqlColIndex] ?? columnFormat;
        };

        selectedCellsCalculator.forEachSelectedCell(
            selection.state,
            excludeTotalsRow,
            excludeHeaderRows,
            (x, y, sqlColIndex) => {

                const cellValueFormat = getCellValueFormat(sqlColIndex, y);
                const cellIsGeneral = cellValueFormat === Ren.SpreadsheetColumnFormatEnum.General;
                const cellIsNumeric = Ren.SpreadsheetColumnFormatEnum.IsNumeric(cellValueFormat);

                rowYs.add(y);

                const textValue = cellValueReader.getTextualisedCellValue(
                    sqlColIndex,
                    y,
                    overallSummaryStats,
                    dataRowsColumnFormats
                );

                if (cellIsGeneral) {

                    if (textValue.length < lengthExtent[0]) {
                        lengthExtent[0] = textValue.length;
                    }

                    if (textValue.length > lengthExtent[1]) {
                        lengthExtent[1] = textValue.length;
                    }

                    strCount++;
                }

                if (cellIsNumeric) {

                    // A count of a text column is interned in that column's dictionary.
                    const cellValue = tabularData.CompressionDictionary.decompressValue(
                        getCompressedValueOfColumn(sqlColIndex, y),
                        sqlColIndex
                    );

                    const numValue = Ren.TextUtils.parseFloat(cellValue);

                    if (numValue !== null) {

                        sum += numValue;
                        numCount++;

                        if (numFormat === undefined) {
                            numFormat = cellValueFormat;
                        }
                        else if (numFormat !== cellValueFormat) {

                            numFormat = null;
                        }
                    }
                }

                count++;

                const cellTextWithBlank = (!textValue && textValue !== 0) ? "<blank>" : textValue;

                distinctValues.set(
                    cellTextWithBlank,
                    (distinctValues.get(cellTextWithBlank) || 0) + 1
                );
            }
        );

        const format = Ren.TextUtils.formatUpTo2DecimalsWithCommas;

        // Sum and Avg take the numbers' own format where they share one that suits them: "£1.50"
        // or "12.50%".  Integers keep up to two decimal places, as their average needs them.
        const formatAggregate = (value) => {

            if (numFormat === Ren.SpreadsheetColumnFormatEnum.Currency ||
                numFormat === Ren.SpreadsheetColumnFormatEnum.Percentage) {

                return Ren.ValueFormatter.formatValueSimple(value, numFormat);
            }

            return format(value);
        };

        if (count === 0) {

            statBarValues.push(`Rows: ${format(rowCount)}`);
        }
        else {

            const rowPercentage = (rowYs.size / rowCount * 100).toFixed(1);

            statBarValues.push(
                `<span title="${rowPercentage}%">` +
                `Rows: ${format(rowYs.size)} / ${format(rowCount)}</span>`
            );

            if (selection.selectionType() === "cell" || selection.selectionType() === "column-v") {

                statBarValues.push(`Cells: ${format(count)}`);
            }

            if (strCount === count) {

                if (strCount === 1) {

                    statBarValues.push("Length: " + format(lengthExtent[0]));
                }
                else {

                    statBarValues.push(
                        "Length: " + format(lengthExtent[0]) + " to " + format(lengthExtent[1])
                    );
                }
            }

            if (selection.selectionType() !== "row" && selection.selectionType() !== "all") {

                if (numCount > 0) {

                    statBarValues.push(`Num: ${format(numCount)}`);
                    statBarValues.push(`Avg: ${formatAggregate(sum / numCount)}`);
                    statBarValues.push(`Sum: ${formatAggregate(sum)}`);
                }

                let distinctValuesTooltip = Array.from(distinctValues.entries())
                    .sort((a, b) => b[1] - a[1]) // Sort descending by count
                    .map(([key, value]) => `${value} x ${key}`)
                    .join("\n");

                if (distinctValuesTooltip.length > 200) {
                    distinctValuesTooltip = distinctValuesTooltip.substring(0, 200) + "...";
                }

                distinctValuesTooltip = distinctValuesTooltip.replace(/"/g, "&quot;").replace(/'/g, "&#39;");

                statBarValues.push(`<span title="${distinctValuesTooltip}">Distinct: ${format(distinctValues.size)}</span>`);
            }
        }

        return statBarValues;
    };

    return {
        getCompressedValue,
        getStatBarValues
    };
};
