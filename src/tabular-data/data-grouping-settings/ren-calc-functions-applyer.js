/**
 * Applies calcFunction specs to the values of groups at a given grouping level.
 *
 * calcFunction is specified per-column inside a grouping entry's columns object, in the same
 * position as valueFormatFunction, e.g.:
 *
 *   "columns": {
 *       "Conversion Rate %": {
 *           "calcFunction": [
 *               "return Ren.ValueFormatter.formatPercentage2DP(@rowVals.AnyOrderLines /
 *               @rowVals.UserGuid)"
 *           ]
 *       }
 *   }
 *
 * Specs follow the same format as valueFormatFunction.  Multiple specs are chained, and @rowVals.X
 * references other columns' aggregated values in the same group row.
 *
 * calcFunction runs after every group's aggregated values are computed, so the transformed values
 * feed into sorting, the next grouping level and display.  Only grouping-local group objects are
 * changed, so this is re-runnable when settings change.
 */
Ren.CalcFunctionsApplyer = (() => {

    const compileCalcFunctions = (specs, columnIdOrHeading, errorPrefix, paras) => {

        const compiledFunctions = [];

        for (let i = 0; i < specs.length; i++) {

            try {

                const fn = Ren.FormatFunctions.createFunction(specs[i], paras);
                if (fn) compiledFunctions.push(fn);
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError(
                    "[CalcFunctionsApplyer] Error creating " + errorPrefix + "calcFunction for column '" +
                    columnIdOrHeading + "':",
                    e
                );
            }
        }

        return compiledFunctions;
    };

    // Gets a value indicating whether any of the compiled functions reads the named argument.
    const anyFunctionReadsArgument = (compiledFunctions, argumentName) => {

        for (let k = 0; k < compiledFunctions.length; k++) {

            if (Ren.FormatFunctions.functionReadsArgument(compiledFunctions[k], argumentName)) {
                return true;
            }
        }

        return false;
    };

    /**
     * For each column in `columns` that has a `calcFunction` property, applies the compiled
     * function chain to each group's value for that column, for every group in the Map.
     * No-ops if columns is absent or no column has calcFunction.
     *
     * @param {Map} groupsMap - Map of group ID to group objects (as produced by GroupingFactory).
     * @param {Object} columns - The grouping-entry columns settings object.
     * @param {Object} tabularData - The tabular data (used for column resolution only).
     * @param {Array} appendedColumns - The grouping's columnsWithAppendedValues, marked for each
     *   column a result had to be appended to the compression dictionary for.
     * @param {Object} paras - The containing report's parameters, which the functions read as
     *   paras.
     */
    const applyCalcFunctionsToGroups = (groupsMap, columns, tabularData, appendedColumns, paras) => {

        if (!columns || typeof columns !== "object") return;

        const columnResolver = tabularData.columnResolver;
        const columnModels = tabularData.ColumnModels;
        const columnCount = columnModels.length;

        for (const columnIdOrHeading in columns) {

            const columnSettings = columns[columnIdOrHeading];
            if (!columnSettings || !columnSettings.calcFunction) continue;

            const specs = Ren.ArrayUtils.ensureArray(columnSettings.calcFunction);
            if (!specs || !specs.length) continue;

            const columnIndex = columnResolver.getColumnIndex(columnIdOrHeading);
            if (columnIndex === null) continue;

            const compiledFunctions = compileCalcFunctions(specs, columnIdOrHeading, "", paras);

            if (!compiledFunctions.length) continue;

            // Calc functions operate on decompressed display values, so decompress the inputs and
            // compress (interning where needed) the result again.
            const decompressValue = tabularData.CompressionDictionary.decompressValue;
            const internDerivedValue = tabularData.CompressionDictionary.internDerivedValue;

            const readsCompressedRowVals =
                anyFunctionReadsArgument(compiledFunctions, "compressedRowVals");

            groupsMap.forEach(group => {

                const groupValues = group.groupValues;
                const position = group.position;

                // Build a columnIdOrHeading-keyed object so @rowVals.X expressions in the
                // function body can reference other columns' aggregated values by name.
                const rowVals = {};

                for (let i = 0; i < columnCount; i++) {

                    rowVals[columnModels[i].ColumnIdOrHeading] =
                        decompressValue(groupValues.get(position, i), i);
                }

                // Built only where a function reads it.  getRow returns a fresh array once a result
                // has been set on the group, so the cached lookup never goes stale.
                const compressedRowVals = readsCompressedRowVals
                    ? Ren.RowValues.getCompressedRowValuesForFormatFunction(
                        tabularData,
                        groupValues.getRow(position)
                    )
                    : null;

                let value = decompressValue(groupValues.get(position, columnIndex), columnIndex);

                for (let k = 0; k < compiledFunctions.length; k++) {

                    try {

                        value = compiledFunctions[k](value, rowVals, null, null, compressedRowVals);
                    }
                    catch (e) {

                        Ren.GlobalErrorHandler.logError(
                            "[CalcFunctionsApplyer] Error applying calcFunction for column '" + columnIdOrHeading + "':",
                            e
                        );
                    }
                }

                groupValues.set(
                    position,
                    columnIndex,
                    internDerivedValue(value, columnIndex, appendedColumns)
                );
            });
        }
    };

    /**
     * Promotes a transformed column being built as a dense Int32Array to a plain array, carrying
     * over the values written into it so far, and returns the plain array.
     */
    const promoteTransformedColumn = (column, rowCount, writtenCount) => {

        const promoted = new Array(rowCount);

        for (let rowIndex = 0; rowIndex < writtenCount; rowIndex++) {
            promoted[rowIndex] = column[rowIndex];
        }

        return promoted;
    };

    /**
     * Applies calcFunction specs to data rows in tabularData.
     *
     * The result is stored column-major and sparse: only the columns that have a calc function get
     * an array, keyed by columnIndex, read as result[columnIndex][rowIndex].
     *
     * The transformed values are compressed, as a data row's own values are.  The columns holding a
     * value appended to the dictionary out of its sorted order are recorded on the returned object
     * as the non-enumerable columnsWithAppendedValues.
     *
     * A compressed column's results are held in a dense Int32Array, promoted to a plain array if a
     * result turns up that it cannot hold exactly, so read either as an indexed sequence.
     *
     * @param {Object} tabularData - The tabular data object.
     * @param {Object} dataRowsColumns - The dataRows.columns settings from dataGroupingSettings.
     * @returns {Object|null} Object mapping columnIndex to an array (length rowCount) of the
     *   transformed values for that column, or null if no column has a calc function.
     */
    const applyCalcFunctionsToDataRows = (tabularData, dataRowsColumns, paras) => {

        if (!dataRowsColumns || typeof dataRowsColumns !== "object") return null;

        const columnResolver = tabularData.columnResolver;
        const columnModels = tabularData.ColumnModels;
        const columnCount = columnModels.length;
        const rowModels = tabularData.RowModels;
        const rowCount = rowModels.length;

        const columnsWithCalcFunctions = [];
        let readsCompressedRowVals = false;

        for (const columnIdOrHeading in dataRowsColumns) {

            const columnSettings = dataRowsColumns[columnIdOrHeading];
            if (!columnSettings || !columnSettings.calcFunction) continue;

            const specs = Ren.ArrayUtils.ensureArray(columnSettings.calcFunction);
            if (!specs || !specs.length) continue;

            const columnIndex = columnResolver.getColumnIndex(columnIdOrHeading);
            if (columnIndex === null) continue;

            const compiledFunctions = compileCalcFunctions(
                specs,
                columnIdOrHeading,
                "data row ",
                paras
            );

            if (compiledFunctions.length) {

                columnsWithCalcFunctions.push({
                    columnIndex,
                    columnIdOrHeading,
                    compiledFunctions
                });

                if (anyFunctionReadsArgument(compiledFunctions, "compressedRowVals")) {
                    readsCompressedRowVals = true;
                }
            }
        }

        if (!columnsWithCalcFunctions.length) return null;

        // One array per calc'd column (column-major, sparse), keyed by columnIndex.  A compressed
        // column starts dense and is promoted to a plain array if a result turns up that a dense
        // one cannot hold; a column that is not compressed holds arbitrary values from the outset.
        const transformedDataColumns = {};
        const isColumnCompressed = tabularData.IsColumnCompressed;

        for (let ci = 0; ci < columnsWithCalcFunctions.length; ci++) {

            const calcColumnIndex = columnsWithCalcFunctions[ci].columnIndex;

            transformedDataColumns[calcColumnIndex] = isColumnCompressed?.[calcColumnIndex]
                ? new Int32Array(rowCount)
                : new Array(rowCount);
        }

        const columnsWithAppendedValues = new Array(columnCount);

        Object.defineProperty(transformedDataColumns, "columnsWithAppendedValues", {
            value: columnsWithAppendedValues
        });

        const internDerivedValue = tabularData.CompressionDictionary.internDerivedValue;

        /**
         * Stores one calc function result in its column, promoting the column away from its dense
         * form where the value is not one a dense column can hold.
         */
        const storeTransformedValue = (columnIndex, rowIndex, value) => {

            let column = transformedDataColumns[columnIndex];

            if (column instanceof Int32Array) {

                // (value | 0) === value is true only for integers within the Int32 range, which
                // every dictionary index is.  It rejects the results that have to be kept exactly
                // as they are: the nulls standing for NULL, and a literal left uninterned because
                // the dictionary is full (see CompressionDictionary.internDerivedValue).
                if (typeof value === "number" && (value | 0) === value) {

                    column[rowIndex] = value;
                    return;
                }

                column = promoteTransformedColumn(column, rowCount, rowIndex);
                transformedDataColumns[columnIndex] = column;
            }

            column[rowIndex] = value;
        };

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

            // Read straight from the shared CV row; we never mutate it (results go into the
            // column-major arrays), so no per-row copy is needed.
            const originalRowValues = rowModels[rowIndex].CV;
            const rowVals = {};

            // Built only where a function reads it, and not taken from Ren.RowValues' cached
            // lookup, as it is updated with each calc column's result in turn.
            const compressedRowVals = readsCompressedRowVals ? {} : null;

            // Key rowVals by both Heading and ColumnId, matching getRowValuesForFormatFunction,
            // since calc functions may refer to a column by its Heading.
            for (let i = 0; i < columnCount; i++) {

                const cv = originalRowValues[i];
                const decompressed = tabularData.CompressionDictionary.decompressValue(cv, i);
                const colModel = columnModels[i];
                if (colModel.Heading != null) rowVals[colModel.Heading] = decompressed;
                if (colModel.ColumnId != null) rowVals[colModel.ColumnId] = decompressed;

                if (compressedRowVals !== null) {

                    if (colModel.Heading != null) compressedRowVals[colModel.Heading] = cv;
                    if (colModel.ColumnId != null) compressedRowVals[colModel.ColumnId] = cv;
                }
            }

            for (let ci = 0; ci < columnsWithCalcFunctions.length; ci++) {

                const {
                    columnIndex,
                    columnIdOrHeading,
                    compiledFunctions
                } = columnsWithCalcFunctions[ci];
                let value = rowVals[columnIdOrHeading];

                for (let k = 0; k < compiledFunctions.length; k++) {

                    try {

                        value = compiledFunctions[k](value, rowVals, null, null, compressedRowVals);
                    }
                    catch (e) {

                        Ren.GlobalErrorHandler.logError(
                            "[CalcFunctionsApplyer] Error applying data row calcFunction for column '" + columnIdOrHeading +
                            "' on row " + rowIndex + ":",
                            e
                        );
                    }
                }

                // Stored compressed, but carried on to later columns as the display value, which is
                // what a calc function's @rowVals.X expression expects.
                const compressedValue =
                    internDerivedValue(value, columnIndex, columnsWithAppendedValues);

                storeTransformedValue(columnIndex, rowIndex, compressedValue);

                const colModel = columnModels[columnIndex];
                if (colModel.Heading != null) rowVals[colModel.Heading] = value;
                if (colModel.ColumnId != null) rowVals[colModel.ColumnId] = value;

                if (compressedRowVals !== null) {

                    const heading = colModel.Heading;
                    const columnId = colModel.ColumnId;
                    if (heading != null) compressedRowVals[heading] = compressedValue;
                    if (columnId != null) compressedRowVals[columnId] = compressedValue;
                }
            }
        }

        return transformedDataColumns;
    };

    return {
        applyCalcFunctionsToGroups,
        applyCalcFunctionsToDataRows
    };
})();
