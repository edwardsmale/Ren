/**
 * Modifies values in an existing column by performing a regex replacement.
 *
 * @param {string|number} targetColumn - The column ID/heading or column index to modify.
 * @param {string|RegExp} regexPattern - The regex pattern to search for.
 * @param {string} replacement - The replacement string.
 * @param {string} replacementType - The new type for the column after replacement.
 */
Ren.TabularDataTransformer_RegexReplaceColumn = (
    targetColumn,
    regexPattern,
    replacement,
    replacementFormat,
    replacementType
) => {

    const name = "RegexReplaceColumn";
    const isFilter = false;

    replacementType = replacementType ?? "String";

    replacementFormat = Ren.EnumUtils.parseEnumString(
        Ren.SpreadsheetColumnFormatEnum,
        replacementFormat,
        Ren.SpreadsheetColumnFormatEnum.General
    );

    const getExecuteFunction = () => execute;

    const execute = (tabularData) => {

        const targetColumnIndex = typeof targetColumn === "number"
            ? targetColumn
            : tabularData.columnResolver.getColumnIndex(targetColumn);

        const regex = new RegExp(regexPattern, "g");

        for (let rowIndex = 0; rowIndex < tabularData.RowModels.length; rowIndex++) {

            const rowModel = tabularData.RowModels[rowIndex];
            let value = rowModel.CV[targetColumnIndex];

            value = tabularData.CompressionDictionary.decompressValue(value, targetColumnIndex);

            rowModel.CV[targetColumnIndex] = value.replace(regex, replacement);
        }

        tabularData.IsColumnCompressed[targetColumnIndex] = false;

        if (tabularData.ColumnValueEncodings) {
            tabularData.ColumnValueEncodings[targetColumnIndex] = 0;
        }
        tabularData.ColumnModels[targetColumnIndex].ColumnType = replacementType;
        tabularData.ColumnModels[targetColumnIndex].ColumnFormat = replacementFormat;
    };

    return {
        name,
        isFilter,
        execute,
        getExecuteFunction
    };
};
