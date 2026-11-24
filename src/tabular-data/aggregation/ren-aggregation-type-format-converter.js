Ren.AggregationTypeFormatConverter = (() => {

    /**
     * Returns the value format the aggregated values will have, based on the input value format
     * and the aggregation type.
     */
    const getAggregatedValueFormat = (valueFormat, aggregationType) => {

        switch (aggregationType) {

            case Ren.AggregationTypeEnum.Sum:
                return valueFormat;

            case Ren.AggregationTypeEnum.Average:

                // If 'NoDP' format, convert to the equivalent format with DP.
                if (valueFormat === Ren.SpreadsheetColumnFormatEnum.Integer) return Ren.SpreadsheetColumnFormatEnum.Number;
                return valueFormat;

            case Ren.AggregationTypeEnum.Count:
                return Ren.SpreadsheetColumnFormatEnum.Integer;

            case Ren.AggregationTypeEnum.CountDistinct:
                return Ren.SpreadsheetColumnFormatEnum.Integer;

            case Ren.AggregationTypeEnum.Min:
                return valueFormat;

            case Ren.AggregationTypeEnum.Max:
                return valueFormat;

            // First, Last and Median pick one of the column's own values (or average two numbers),
            // so they keep the column's format.
            case Ren.AggregationTypeEnum.First:
                return valueFormat;

            case Ren.AggregationTypeEnum.Last:
                return valueFormat;

            // The two middle values of an even count are averaged, so may land on a .5.
            case Ren.AggregationTypeEnum.Median:
                if (valueFormat === Ren.SpreadsheetColumnFormatEnum.Integer) return Ren.SpreadsheetColumnFormatEnum.Number;
                return valueFormat;

            case Ren.AggregationTypeEnum.Concatenate:
                return Ren.SpreadsheetColumnFormatEnum.General;

            case Ren.AggregationTypeEnum.MostCommon:
                return valueFormat;

            case Ren.AggregationTypeEnum.DistinctValues:
                return Ren.SpreadsheetColumnFormatEnum.General;

            case Ren.AggregationTypeEnum.DistinctValuesWithCounts:
                return Ren.SpreadsheetColumnFormatEnum.General;

            case Ren.AggregationTypeEnum.NoTotal:
                return valueFormat;

            case Ren.AggregationTypeEnum.SingleValuesOnly:
                return valueFormat;

            case Ren.AggregationTypeEnum.SingleValueOrPlaceholder:
                return valueFormat;

            case Ren.AggregationTypeEnum.ExpandIcon:
            case Ren.AggregationTypeEnum.ExpandIconAlways:
                return valueFormat;
        }

        return valueFormat;
    };

    /**
     * Gets a value indicating whether an aggregation reads its values as numbers - adding them up,
     * averaging them or ordering them by size - rather than as the values they are.
     */
    const isNumericAggregation = (aggregationType) => {

        return aggregationType === Ren.AggregationTypeEnum.Sum
            || aggregationType === Ren.AggregationTypeEnum.Average
            || aggregationType === Ren.AggregationTypeEnum.Min
            || aggregationType === Ren.AggregationTypeEnum.Max
            || aggregationType === Ren.AggregationTypeEnum.Median;
    };

    /**
     * Gets a value indicating whether a grouping's aggregation of a column leaves out the
     * grouping's calc function on it.  A calc function giving numbers from the column's values
     * (string-length, say) is about those values, so a sum or average applies it to each of them
     * (see Ren.Aggregation's getPerValueCalcFunctions), but a count is not one of them, so is
     * shown as it is rather than having the function applied to it.
     *
     * @param {*} calcFunction The grouping's calc function on the column.
     * @param {number} columnValueFormat The format of the column's values.
     */
    const ignoresCalcFunction = (aggregationType, calcFunction, columnValueFormat) => {

        if (aggregationType !== Ren.AggregationTypeEnum.Count &&
            aggregationType !== Ren.AggregationTypeEnum.CountDistinct) {

            return false;
        }

        if (!calcFunction) return false;

        const valueFormat =
            Ren.FunctionTags.getCalcFunctionsValueFormat(calcFunction, columnValueFormat);

        return valueFormat !== null && Ren.SpreadsheetColumnFormatEnum.IsArithmetic(valueFormat);
    };

    return {
        getAggregatedValueFormat,
        ignoresCalcFunction,
        isNumericAggregation
    };
})();
