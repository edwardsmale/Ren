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
            const getCalcFunctionsValueFormat = Ren.FunctionTags.getCalcFunctionsValueFormat;
            const dataRowsColumns = dataGroupingSettings.dataRows?.columns;
            const isArithmetic = Ren.SpreadsheetColumnFormatEnum.IsArithmetic;

            // The columns whose calc function the grouping's aggregation applies to each value,
            // mapped to the format of the values before it: the one it reads, and the one the
            // next grouping's aggregation follows on from.
            const calculatedPerValueInputFormats = new Map();

            /**
             * Gets the format of the numbers a calc function gives where the grouping's
             * aggregation of a column applies it to each value (see Ren.Aggregation's
             * getPerValueCalcFunctions), and otherwise null.
             */
            const getPerValueCalcValueFormat = (columnIndex, columnIdOrHeading, aggregationType) => {

                if (!Ren.AggregationTypeFormatConverter.isNumericAggregation(aggregationType)) {
                    return null;
                }

                if (groupByColumnIndexes?.includes(columnIndex)) return null;

                const calcFunction = Ren.FunctionTags.getPerValueCalcFunction(
                    dataGroupingSettings.groupings?.entries,
                    newGroupingColumns,
                    columnIndex,
                    columnIdOrHeading
                );

                if (!calcFunction) return null;

                const valueFormat =
                    getCalcFunctionsValueFormat(calcFunction, colModels[columnIndex].ColumnFormat);

                return valueFormat !== null && isArithmetic(valueFormat) ? valueFormat : null;
            };

            /**
             * Gets the format of the values a column's aggregation reads.  Every grouping
             * aggregates the data rows, so the first grouping's are those the data rows' calc
             * function gives (string lengths, say, rather than the strings), and each later one
             * follows on from the one before's aggregated values - before that grouping's own calc
             * function changed them, as those are not what is aggregated.
             */
            const getAggregationInputValueFormat = (columnIndex, columnIdOrHeading) => {

                if (prevColumns) {

                    const previousColumn = prevColumns[columnIdOrHeading];

                    return previousColumn.aggregatedValueFormat ?? previousColumn.valueFormat;
                }

                const columnFormat = colModels[columnIndex].ColumnFormat;
                const dataRowsCalcFunction = dataRowsColumns?.[columnIdOrHeading]?.calcFunction;

                return dataRowsCalcFunction
                    ? getCalcFunctionsValueFormat(dataRowsCalcFunction, columnFormat) ?? columnFormat
                    : columnFormat;
            };

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
                const previousValueFormat =
                    getAggregationInputValueFormat(columnIndex, columnIdOrHeading);
                const aggregationType = newGroupingColumn.aggregationType;

                const perValueCalcValueFormat =
                    getPerValueCalcValueFormat(columnIndex, columnIdOrHeading, aggregationType);

                if (perValueCalcValueFormat !== null) {

                    // Aggregates the calc function's numbers, which are what it shows.
                    newGroupingColumn.valueFormat =
                        getAggregatedValueFormat(perValueCalcValueFormat, aggregationType);

                    calculatedPerValueInputFormats.set(columnIdOrHeading, previousValueFormat);
                }
                else if (aggregationType !== undefined) {

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

            // A calc function on the grouping replaces its aggregated values with its own, so the
            // values shown - and sorted, formatted and offered menus by - have the format it gives
            // them.  The format before it is kept as the one its calc function reads, and the one
            // the next grouping's aggregation follows on from.  Neither is saved with the settings.
            for (const columnIdOrHeading in newGroupingColumns) {

                const newGroupingColumn = newGroupingColumns[columnIdOrHeading];

                delete newGroupingColumn.aggregatedValueFormat;

                // Its calc function has already been allowed for, applied to each value.
                if (calculatedPerValueInputFormats.has(columnIdOrHeading)) {

                    newGroupingColumn.aggregatedValueFormat =
                        calculatedPerValueInputFormats.get(columnIdOrHeading);

                    continue;
                }

                if (!newGroupingColumn.calcFunction || newGroupingColumn.valueFormat === undefined) {
                    continue;
                }

                const calcValueFormat = getCalcFunctionsValueFormat(
                    newGroupingColumn.calcFunction,
                    newGroupingColumn.valueFormat
                );

                if (calcValueFormat === null) continue;

                newGroupingColumn.aggregatedValueFormat = newGroupingColumn.valueFormat;
                newGroupingColumn.valueFormat = calcValueFormat;
            }
        };
    };
