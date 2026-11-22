/**
 * Gives a popup grid of rows (see Ren.DateValueChart_DataPointGrid.showRowsGrid) its default
 * format for numbers that aren't whole: two decimal places, in place of the Number format's "up
 * to two", so a column's values line up, and a percentage for a Boolean's share true.  Columns
 * already given a format keep it.
 */
Ren.DateValueChart_DataPointGrid_NumberFormats = (() => {

    const DEFAULT_FORMAT_FUNCTION_NAME = "number-2-dp";
    const SHARE_FORMAT_FUNCTION_NAME = "percentage-1-dp";

    const hasFunction = (functionSpecification) => Array.isArray(functionSpecification)
        ? functionSpecification.length > 0
        : !!functionSpecification;

    /**
     * Gives a serialised column a format, unless it has a format or calc function.
     */
    const setFormat = (columns, columnKey, formatFunctionName) => {

        const column = columns[columnKey] ??= {};

        if (hasFunction(column.valueFormatFunction) || hasFunction(column.calcFunction)) return;

        column.valueFormatFunction = [{ name: formatFunctionName }];
    };

    /**
     * Gets the format function for a grouping's values of a column that aren't whole: a
     * percentage for a Boolean's average or median (the share true), or the default for values
     * aggregated to a Number, such as an Integer's average.  Null for any other column.  The
     * aggregation falls back to the column default's, then to the column model's.
     */
    const getGroupValueFormatFunctionName = (columnModel, groupingColumn, columnDefault) => {

        const aggregationTypeEnum = Ren.AggregationTypeEnum;
        const aggregationType = Ren.ObjectUtils.getEnumValue(
            aggregationTypeEnum,
            groupingColumn?.aggregationType ??
                columnDefault?.aggregationType ??
                columnModel.AggregationType,
            null
        );

        const formatEnum = Ren.SpreadsheetColumnFormatEnum;
        const columnFormat = columnModel.ColumnFormat;

        if (aggregationType === null) {
            return columnFormat === formatEnum.Number ? DEFAULT_FORMAT_FUNCTION_NAME : null;
        }

        if (columnFormat === formatEnum.Boolean) {

            const isShare = aggregationType === aggregationTypeEnum.Average ||
                aggregationType === aggregationTypeEnum.Median;

            return isShare ? SHARE_FORMAT_FUNCTION_NAME : null;
        }

        const aggregatedFormat = Ren.AggregationTypeFormatConverter
            .getAggregatedValueFormat(columnFormat, aggregationType);

        return aggregatedFormat === formatEnum.Number ? DEFAULT_FORMAT_FUNCTION_NAME : null;
    };

    /**
     * Gives serialised settings' data rows the default format for each Number column, and their
     * groupings it for each column whose values they aggregate to fractions.
     */
    const applyDefaultFormats = (settings, tabularData) => {

        const columnModels = tabularData.ColumnModels;
        const entries = settings.groupings?.entries ?? [];
        const columnDefaults = settings.columns ?? {};

        settings.dataRows ??= {};
        settings.dataRows.columns ??= {};

        for (let columnIndex = 0; columnIndex < columnModels.length; columnIndex++) {

            const columnModel = columnModels[columnIndex];
            const columnKey = columnModel.ColumnIdOrHeading;
            const columnDefault = columnDefaults[columnKey];

            // A column default's format function is given to every level as groupings are added.
            if (hasFunction(columnDefault?.valueFormatFunction)) continue;

            if (columnModel.ColumnFormat === Ren.SpreadsheetColumnFormatEnum.Number) {
                setFormat(settings.dataRows.columns, columnKey, DEFAULT_FORMAT_FUNCTION_NAME);
            }

            for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {

                const entry = entries[entryIndex];

                if (entry.groupByColumns?.indexOf(columnKey) >= 0) continue;

                const formatFunctionName = getGroupValueFormatFunctionName(
                    columnModel,
                    entry.columns?.[columnKey],
                    columnDefault
                );

                if (!formatFunctionName) continue;

                entry.columns ??= {};
                setFormat(entry.columns, columnKey, formatFunctionName);
            }
        }
    };

    return {
        applyDefaultFormats
    };
})();
