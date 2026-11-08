/**
 * Shows a window with a summary of the data in a column of a tabular data model.
 * @param {object} tabularData
 * @param {number} columnIndex
 * @param {HTMLElement} [anchorElement] - Anchor element used to position the popup.
 */
Ren.ShowTabularDataColumnSummaryWindow = (tabularData, columnIndex, anchorElement) => {

    const roundTo2DP = (value) => Math.round(value * 100) / 100;

    const formatAsPercentage2DP = (value) => roundTo2DP(value * 100) + "%";

    const getPercentageNonBlank = (summaryData) => {

        if (summaryData.totalRows === 0) return "-";

        const percentage = roundTo2DP((summaryData.valueCount / summaryData.totalRows) * 100);

        // A column with a blank in it isn't shown as wholly populated, however few the blanks.
        return (summaryData.blankCount > 0 ? Math.min(percentage, 99.99) : percentage) + "%";
    };

    const populateForCompressedColumn = (summaryData, tabularData, columnIndex) => {

        const _rowValues = tabularData.RowModels.map(rv => rv.CV[columnIndex]);

        const compressedNullOrEmptyValues =
            tabularData.CompressionDictionary.compressedValuesThatAreNullOrWhitespace(columnIndex);

        summaryData.totalRows = _rowValues.length;
        summaryData.valueCount = 0;

        // Count the values etc without decompressing everything (the value count and distinct
        // count are the same whether or not the values are compressed).

        const distinctCompressedValues = new Set();

        for (let i = 0; i < _rowValues.length; i++) {

            const compressedValue = _rowValues[i];

            if (compressedValue === null) continue;

            if (!compressedNullOrEmptyValues.includes(compressedValue)) {

                summaryData.valueCount++;

                distinctCompressedValues.add(compressedValue);
            }
        }

        summaryData.distinctValueCount = distinctCompressedValues.size;
        summaryData.blankCount = summaryData.totalRows - summaryData.valueCount;
        summaryData.percentageNonBlank = getPercentageNonBlank(summaryData);
    };

    const populateForUncompressedColumn = (summaryData, tabularData, columnIndex) => {

        const _rowValues = tabularData.RowModels.map(rv => rv.CV[columnIndex]);

        summaryData.totalRows = _rowValues.length;
        summaryData.valueCount = 0;

        const distinctValues = new Set();

        summaryData.sum = null;
        summaryData.min = null;
        summaryData.max = null;
        summaryData.mean = null;

        for (let i = 0; i < _rowValues.length; i++) {

            const value = _rowValues[i];

            if (value != null) {

                summaryData.valueCount++;

                distinctValues.add(value);

                if (typeof value === "number") {

                    if (summaryData.sum === null) summaryData.sum = 0;
                    summaryData.sum += value;

                    if (value < summaryData.min || summaryData.min === null) summaryData.min = value;
                    if (value > summaryData.max || summaryData.max === null) summaryData.max = value;
                }
            }
        }

        if (summaryData.sum !== null) {

            const mean = summaryData.sum / summaryData.valueCount;

            if (distinctValues.size === 2 && summaryData.min === 0 && summaryData.max === 1) {

                summaryData.mean = formatAsPercentage2DP(mean);
            }
            else {

                // An average of whole numbers needn't be a whole number.
                const meanFormat =
                    columnModel.ColumnFormat === Ren.SpreadsheetColumnFormatEnum.Integer
                        ? Ren.SpreadsheetColumnFormatEnum.Number
                        : columnModel.ColumnFormat;

                summaryData.mean = Ren.ValueFormatter.formatValueSimple(mean, meanFormat);
            }
        }

        summaryData.distinctValueCount = distinctValues.size;
        summaryData.blankCount = summaryData.totalRows - summaryData.valueCount;
        summaryData.percentageNonBlank = getPercentageNonBlank(summaryData);
    };

    const width = "380px";
    const height = "240px";

    const columnModel = tabularData.ColumnModels[columnIndex];

    const summaryData = {
        totalRows: 0,
        valueCount: 0,
        blankCount: 0,
        percentageNonBlank: 0,
        distinctValueCount: 0
    };

    const hasSumData = (summaryData) => summaryData.sum != null;
    const hasRangeData = (summaryData) => summaryData.min != null;

    const formatStatistic = (value) => value == null
        ? value
        : Ren.ValueFormatter.formatValueSimple(value, columnModel.ColumnFormat);

    // Strings and dates are compressed.
    const isColumnCompressed = tabularData.IsColumnCompressed[columnIndex];

    if (isColumnCompressed) {

        populateForCompressedColumn(summaryData, tabularData, columnIndex);
    }
    else {

        populateForUncompressedColumn(summaryData, tabularData, columnIndex);
    }

    const title = "🛈 " + columnModel.Heading;

    const renderContent = (contentContainer) => {

        const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("ColumnSummaryTemplate", {
            columnType: columnModel.ColumnType,
            columnIndex: columnIndex,
            totalRows: summaryData.totalRows,
            valueCount: summaryData.valueCount,
            blankCount: summaryData.blankCount,
            distinctValueCount: summaryData.distinctValueCount,
            percentageNonBlank: summaryData.percentageNonBlank,
            sum: formatStatistic(summaryData.sum),
            mean: summaryData.mean,
            min: formatStatistic(summaryData.min),
            max: formatStatistic(summaryData.max),
            hasSummaryData: hasSumData(summaryData),
            hasRangeData: hasRangeData(summaryData)
        });

        contentContainer.innerHTML = "";
        contentContainer.appendChild(content);
    };

    // Position popup based on anchorElement if provided
    let leftPos, topPos;

    if (anchorElement) {

        const rect = anchorElement.getBoundingClientRect();
        leftPos = rect.right + 4 + window.scrollX; // 4px gap to the right
        topPos = rect.top + window.scrollY;
    }

    Ren.PopupWindow(
        "ren-column-summary-window",
        renderContent,
        title,
        {
            width,
            height,
            verticalScrollbar: false,
            horizontalScrollbar: false,
            leftPos,
            topPos
        }
    );
};
