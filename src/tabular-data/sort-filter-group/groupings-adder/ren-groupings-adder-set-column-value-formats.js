(function (Ren) {

    Ren.GroupingsAdder_SetColumnValueFormats = function (tabularData, dataGroupingSettings) {

        return function setColumnValueFormats(previousGrouping, newGrouping) {

            const colModels = tabularData.ColumnModels;
            const columnCount = colModels.length;
            const getColumnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading;
            const prevColumns = previousGrouping ? previousGrouping.columns : null;
            newGrouping.columns ??= {};
            const newGroupingColumns = newGrouping.columns;
            const columnDefaults = dataGroupingSettings.columnDefaults ?? {};
            const aggregationTypeEnum = Ren.AggregationTypeEnum;
            const getEnumValue = Ren.ObjectUtils.getEnumValue;
            const ensureArray = Ren.ArrayUtils.ensureArray;
            const getAggregatedValueFormat = Ren.AggregationTypeFormatConverter.getAggregatedValueFormat;
            const groupByCalcFunctions = newGrouping.groupByCalcFunctions;
            const groupByColumnIndexes = newGrouping.groupByColumnIndexes;

            const isBinningCalcFunction = (calcFunctionName) => {

                return calcFunctionName && calcFunctionName.startsWith("bin-");
            };

            const isDateCalcFunction = (calcFunctionName) => {

                return calcFunctionName === "date-day-start" ||
                       calcFunctionName === "date-week-start" ||
                       calcFunctionName === "date-month-start" ||
                       calcFunctionName === "date-quarter-start" ||
                       calcFunctionName === "date-year-start";
            };

            const isDateTimeCalcFunction = (calcFunctionName) => {

                return calcFunctionName === "date-hour-start" ||
                       calcFunctionName === "date-minute-start" ||
                       calcFunctionName === "date-quarter-hour-start" ||
                       calcFunctionName === "date-second-start";
            };

            const isIndexedStringCalcFunction = (calcFunctionName) => {

                return calcFunctionName === "date-hour-of-day" ||
                       calcFunctionName === "date-day-of-week" ||
                       calcFunctionName === "date-weekday-vs-weekend" ||
                       calcFunctionName === "date-december-vs-ex-dec" ||
                       calcFunctionName === "date-working-hours";
            };

            for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

                const columnIdOrHeading = getColumnIdOrHeading(columnIndex);
                let newGroupingColumn = newGroupingColumns[columnIdOrHeading];

                if (!newGroupingColumn) {
                    newGroupingColumn = newGroupingColumns[columnIdOrHeading] = {};
                }
                const previousValueFormat = prevColumns
                    ? prevColumns[columnIdOrHeading].valueFormat
                    : colModels[columnIndex].ColumnFormat;
                const aggregationType = newGroupingColumn.aggregationType;

                if (aggregationType !== undefined) {

                    newGroupingColumn.valueFormat = getAggregatedValueFormat(previousValueFormat, aggregationType);
                }
                else {

                    newGroupingColumn.valueFormat = previousValueFormat;
                }

                // If this column is a group-by column with a calc function, override the format
                if (groupByColumnIndexes && groupByCalcFunctions) {

                    const columnIndexInGrouping = groupByColumnIndexes.indexOf(columnIndex);

                    if (columnIndexInGrouping !== -1 && groupByCalcFunctions[columnIndexInGrouping]) {

                        const calcFunctionName = groupByCalcFunctions[columnIndexInGrouping].name;

                        if (isDateCalcFunction(calcFunctionName)) {

                            newGroupingColumn.valueFormat = Ren.SpreadsheetColumnFormatEnum.Date;
                        }
                        else if (isDateTimeCalcFunction(calcFunctionName)) {

                            newGroupingColumn.valueFormat =
                                Ren.SpreadsheetColumnFormatEnum.DateTime;
                        }
                        else if (isBinningCalcFunction(calcFunctionName) || isIndexedStringCalcFunction(calcFunctionName)) {

                            newGroupingColumn.valueFormat = Ren.SpreadsheetColumnFormatEnum.IndexedString;
                        }
                        else {

                            newGroupingColumn.valueFormat = Ren.SpreadsheetColumnFormatEnum.General;
                        }
                    }
                }
            }

            for (const columnIdOrHeading in columnDefaults) {

                const columnDefault = columnDefaults[columnIdOrHeading];
                let newGroupingColumn = newGroupingColumns[columnIdOrHeading];

                if (!newGroupingColumn) {
                    newGroupingColumn = newGroupingColumns[columnIdOrHeading] = {};
                }

                if (columnDefault.calcFunction !== undefined && newGroupingColumn.calcFunction === undefined) {

                    newGroupingColumn.calcFunction = columnDefault.calcFunction;
                }

                if (columnDefault.valueFormatFunction !== undefined && newGroupingColumn.valueFormatFunction === undefined) {

                    newGroupingColumn.valueFormatFunction = ensureArray(columnDefault.valueFormatFunction);
                    delete newGroupingColumn.valueFormat;
                }

                if (columnDefault.aggregationType !== undefined && newGroupingColumn.aggregationType === undefined) {
                    newGroupingColumn.aggregationType = getEnumValue(aggregationTypeEnum, columnDefault.aggregationType);
                }

                // Also apply the format function to data rows.
                if (columnDefault.valueFormatFunction !== undefined) {

                    dataGroupingSettings.dataRows.columns[columnIdOrHeading] ??= {};
                    dataGroupingSettings.dataRows.columns[columnIdOrHeading].valueFormatFunction = ensureArray(columnDefault.valueFormatFunction);
                }

                // Also apply the calc function to data rows.
                if (columnDefault.calcFunction !== undefined) {

                    dataGroupingSettings.dataRows.columns[columnIdOrHeading] ??= {};
                    dataGroupingSettings.dataRows.columns[columnIdOrHeading].calcFunction = columnDefault.calcFunction;
                }
            }
        };
    };
})(Ren || (Ren = {}));
