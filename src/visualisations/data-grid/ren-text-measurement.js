Ren.TextMeasurement = (() => {

    const measureText = Ren.TextUtils.measureText;

    /**
     * Gets the room a grouping's aggregation symbol or label takes up beside a column's values.
     */
    const getAggregationIndicatorWidth = (tabularData, dataGroupingSettings, grouping, columnIndex) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        const mode = Ren.AggregationIndicator.resolveMode(
            grouping.columns?.[columnIdOrHeading],
            dataGroupingSettings.columnDefaults?.[columnIdOrHeading],
            dataGroupingSettings.layout
        );

        const indicator = Ren.AggregationIndicator.getIndicator(
            mode,
            grouping.getColumnAggregationType(columnIndex)
        );

        if (!indicator || !indicator.text) return 0;

        // The indicator is drawn smaller than the value text, with a gap between the two.
        return Math.ceil(measureText(indicator.text) * 0.8) + 6;
    };

    const calculateColumnWidth = (
        tabularData,
        dataGroupingSettings,
        columnIndex,
        showColumnHeaderDownArrows) => {

        const columnModel = tabularData.ColumnModels[columnIndex];

        const columnFormat = columnModel.ColumnFormat;

        let columnWidth = measureText(columnModel.Heading);

        if (columnModel.Subheading) {
            columnWidth = Math.max(columnWidth, measureText(columnModel.Subheading));
        }

        const distinctColumnCVs = tabularData.getDistinctColumnCV(columnIndex);

        if (distinctColumnCVs && distinctColumnCVs.length) {

            if (columnFormat === Ren.SpreadsheetColumnFormatEnum.Boolean) {

                const nullFormattedValue = Ren.ValueFormatter.formatValueSimple(null, columnFormat);
                const trueFormattedValue = Ren.ValueFormatter.formatValueSimple(true, columnFormat);
                const falseFormattedValue = Ren.ValueFormatter.formatValueSimple(false, columnFormat);

                columnWidth = Math.max(
                    columnWidth,
                    measureText(nullFormattedValue),
                    measureText(trueFormattedValue),
                    measureText(falseFormattedValue)
                );
            }
            else if (Ren.SpreadsheetColumnFormatEnum.IsNumeric(columnFormat)) {

                // For columns containing numbers, just measure the values with largest magnitude
                // (as the minimum might be negative) and NULL.

                const nullFormattedValue = Ren.ValueFormatter.formatValueSimple(null, columnFormat);

                const maxValue = Ren.ArrayUtils.maxValue(distinctColumnCVs);

                const highestFormattedValue = Ren.ValueFormatter.formatValueSimple(
                    maxValue,
                    columnFormat
                );

                const minValue = Ren.ArrayUtils.minValue(distinctColumnCVs);

                const lowestFormattedValue = Ren.ValueFormatter.formatValueSimple(
                    minValue,
                    columnFormat
                );

                columnWidth = Math.max(
                    columnWidth,
                    measureText(nullFormattedValue),
                    measureText(highestFormattedValue),
                    measureText(lowestFormattedValue)
                );
            }
            else if (Ren.SpreadsheetColumnFormatEnum.IsDate(columnFormat)) {

                // Dates are generally similar in length, so measure a handful of dates plus NULL.

                const nullFormattedValue = Ren.ValueFormatter.formatValueSimple(null, columnFormat);

                const distinctColumnCVsArray = Array.from(distinctColumnCVs);
                const sampleSize = Math.min(10, distinctColumnCVsArray.length);

                let maxSampleDateWidth = measureText(nullFormattedValue);

                for (let i = 0; i < sampleSize; i++) {

                    const decompressedValue = tabularData.CompressionDictionary.decompressValue(
                        distinctColumnCVsArray[i],
                        columnIndex
                    );

                    const formattedDate = Ren.ValueFormatter.formatValueSimple(
                        decompressedValue,
                        columnFormat
                    );

                    const width = measureText(formattedDate);
                    if (width > maxSampleDateWidth) maxSampleDateWidth = width;
                }

                columnWidth = Math.max(columnWidth, maxSampleDateWidth);
            }
            else {

                // Don't measure all the rows.  Measure the first 100, and then sample the rest.
                const distinctColumnCVsArray = Array.from(distinctColumnCVs);
                const totalRows = distinctColumnCVsArray.length;

                // Calculate sampling strategy upfront
                const firstBatch = Math.min(100, totalRows);
                const remainingRows = totalRows - firstBatch;
                const sampleSize = 100;
                const stride = remainingRows > 0 ? Math.ceil(remainingRows / sampleSize) : 1;

                // Process first batch
                for (let rowIndex = 0; rowIndex < firstBatch; rowIndex++) {

                    const cellValue = tabularData.CompressionDictionary.decompressValue(
                        distinctColumnCVsArray[rowIndex],
                        columnIndex
                    );

                    if (!cellValue) continue;

                    const formattedCellValue = Ren.ValueFormatter.formatValueSimple(
                        cellValue,
                        columnFormat
                    );

                    if (!formattedCellValue) continue;

                    let width = measureText(formattedCellValue);

                    // Add extra width for external links, as these have an icon.
                    if (formattedCellValue.startsWith &&
                        formattedCellValue.startsWith('<a') &&
                        formattedCellValue.includes('target="_blank"')) {

                        width += 16;
                    }

                    if (width > columnWidth) columnWidth = width;
                }

                // Process sampled rows.
                for (let rowIndex = firstBatch; rowIndex < totalRows; rowIndex += stride) {

                    const cellValue = tabularData.CompressionDictionary.decompressValue(
                        distinctColumnCVsArray[rowIndex],
                        columnIndex
                    );

                    if (!cellValue) continue;

                    const formattedCellValue = Ren.ValueFormatter.formatValueSimple(
                        cellValue,
                        columnFormat
                    );

                    if (!formattedCellValue) continue;

                    let width = measureText(formattedCellValue);

                    // Add extra width for external links, as these have an icon.
                    if (formattedCellValue.startsWith &&
                        formattedCellValue.startsWith('<a') &&
                        formattedCellValue.includes('target="_blank"')) {

                        width += 16;
                    }

                    if (width > columnWidth) columnWidth = width;
                }
            }
        }

        // Traverse the group rows, since aggregated values can be longer than the leaf rows.
        const groupingsEntries = dataGroupingSettings.groupings.entries;
        const groupingsLength = groupingsEntries.length;

        for (let i = 0; i < groupingsLength; i++) {

            const grouping = groupingsEntries[i];

            const groups = grouping.groups();
            const groupEntries = Array.from(groups.values());

            // This only measures the group rows which have been rendered and therefore have
            // formattedRowValues populated.

            if (groupEntries.length === 0 || !groupEntries[0].formattedRowValues) continue;

            const indicatorWidth = getAggregationIndicatorWidth(
                tabularData,
                dataGroupingSettings,
                grouping,
                columnIndex
            );

            // Calculate sampling strategy upfront
            const totalGroups = groupEntries.length;
            const firstBatch = Math.min(100, totalGroups);
            const remainingGroups = totalGroups - firstBatch;
            const sampleSize = 100;
            const stride = remainingGroups > 0 ? Math.ceil(remainingGroups / sampleSize) : 1;

            // Process first batch
            for (let j = 0; j < firstBatch; j++) {

                const formattedCellValue = groupEntries[j].formattedRowValues[columnIndex];

                if (!formattedCellValue) continue;

                let width = measureText(formattedCellValue) + indicatorWidth;

                // Add extra width for external links, as these have an icon.
                if (formattedCellValue.startsWith &&
                    formattedCellValue.startsWith('<a') &&
                    formattedCellValue.includes('target="_blank"')) {

                    width += 16;
                }

                if (width > columnWidth) columnWidth = width;
            }

            // Process sampled groups.
            for (let j = firstBatch; j < totalGroups; j += stride) {

                const formattedCellValue = groupEntries[j].formattedRowValues[columnIndex];

                if (!formattedCellValue) continue;

                let width = measureText(formattedCellValue) + indicatorWidth;

                // Add extra width for external links, as these have an icon.
                if (formattedCellValue.startsWith &&
                    formattedCellValue.startsWith('<a') &&
                    formattedCellValue.includes('target="_blank"')) {

                    width += 16;
                }

                if (width > columnWidth) columnWidth = width;
            }
        }

        if (columnWidth > 0) {

            columnWidth += Ren.DataGridConstants.cellPadding * 2 + 18;

            if (showColumnHeaderDownArrows) columnWidth += 12;
        }

        return columnWidth;
    };

    return {
        calculateColumnWidth
    };
})();
