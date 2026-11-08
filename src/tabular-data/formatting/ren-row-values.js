/**
 * Functions for creating row value collections for use in format functions.
 */
Ren.RowValues = (() => {

    const getRowValuesPrevious = {
        tabularData: null,
        rowValues: null,
        valuesAreCompressed: false,
        result: null
    };

    /**
     * Creates a collection of row values, formatted for format functions, as an object with access
     * via column heading or column ID.
     */
    const getRowValuesForFormatFunction = (tabularData, rowValues, valuesAreCompressed) => {

        if (getRowValuesPrevious.tabularData === tabularData &&
            getRowValuesPrevious.rowValues === rowValues &&
            getRowValuesPrevious.valuesAreCompressed === valuesAreCompressed
        ) {

            return getRowValuesPrevious.result;
        }

        const rowVals = {};
        const columnModels = tabularData.ColumnModels;
        const decompress = valuesAreCompressed ? tabularData.CompressionDictionary.decompressValue : null;
        const extractText = Ren.TextUtils.extractTextFromHtml;

        for (let i = 0, len = rowValues.length; i < len; i++) {

            let val = valuesAreCompressed ? decompress(rowValues[i], i) : rowValues[i];
            if (typeof val === "string" && val.charAt(0) === "<") val = extractText(val);
            const colModel = columnModels[i];
            const heading = colModel.Heading;
            const colId = colModel.ColumnId;
            rowVals[heading] = val;
            rowVals[colId] = val;
        }
        getRowValuesPrevious.tabularData = tabularData;
        getRowValuesPrevious.rowValues = rowValues;
        getRowValuesPrevious.valuesAreCompressed = valuesAreCompressed;
        getRowValuesPrevious.result = rowVals;
        return rowVals;
    };

    const getCompressedRowValuesPrevious = {
        tabularData: null,
        CV: null,
        result: null
    };

    /**
     * Creates a collection of compressed, unformatted row values, in an object format that allows
     * access via column heading or column ID.
     */
    const getCompressedRowValuesForFormatFunction = (tabularData, CV) => {

        if (getCompressedRowValuesPrevious.tabularData === tabularData &&
            getCompressedRowValuesPrevious.CV === CV
        ) {

            return getCompressedRowValuesPrevious.result;
        }

        const compressedRowVals = {};
        const columnModels = tabularData.ColumnModels;

        for (let i = 0, len = CV.length; i < len; i++) {

            const colModel = columnModels[i];
            compressedRowVals[colModel.Heading] = CV[i];
            compressedRowVals[colModel.ColumnId] = CV[i];
        }

        getCompressedRowValuesPrevious.tabularData = tabularData;
        getCompressedRowValuesPrevious.CV = CV;
        getCompressedRowValuesPrevious.result = compressedRowVals;

        return compressedRowVals;
    };

    return {
        getRowValuesForFormatFunction,
        getCompressedRowValuesForFormatFunction
    };
})();
