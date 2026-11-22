Ren.TabularDataColumnInserter = (() => {

    /**
     * Creates a new column model with the standard null defaults for Subheading and ColumnId.
     */
    const createColumnModel = (heading, columnFormat, columnType, aggregationType) => ({
        Heading: heading,
        Subheading: null,
        ColumnId: null,
        ColumnIdOrHeading: heading,
        ColumnFormat: columnFormat,
        ColumnType: columnType,
        AggregationType: aggregationType,
        Visible: true
    });

    /**
     * Inserts a column in the tabular data object.
     *
     * @param {number} [newColumnValueEncoding] - The column's TabularData.ColumnValueEncodings
     *     entry, which is dictionary encoding where not given.
     */
    const insertColumnIntoTabularData = (
        tabularData,
        insertBeforeColumnIndex,
        newColumnModel,
        newColumnIsCompressed,
        newColumnValueEncoding) => {

        // Insert the new column.
        tabularData.ColumnModels.splice(insertBeforeColumnIndex, 0, newColumnModel);
        tabularData.IsColumnCompressed.splice(insertBeforeColumnIndex, 0, newColumnIsCompressed);

        if (tabularData.ColumnValueEncodings) {

            tabularData.ColumnValueEncodings.splice(
                insertBeforeColumnIndex,
                0,
                newColumnValueEncoding || 0
            );
        }

        tabularData.ColumnCount++;

        // Update CompressionDictionary's tabularData based on the modified tabularData.
        tabularData.CompressionDictionary = tabularData.CompressionDictionary.updateTabularData(tabularData);
    };

    /**
     * Populates the values of a newly-inserted column for every row in `tabularData`. The column at
     * `columnIndex` must already have been inserted (via `insertColumnIntoTabularData`) before this
     * function is called.  Each row's CV array must NOT yet have had the placeholder spliced in —
     * this function performs that splice and then sets the final value.
     *
     * @param {object}   tabularData   - The tabular data object.
     * @param {number}   columnIndex   - The index of the newly-inserted column.
     * @param {Function} valueResolver - Called with `(tabularData, rowModel, rowIndex)` and must
     *                                   return the value to write into the new column.
     */
    const populateInsertedColumnValues = (tabularData, columnIndex, valueResolver) => {

        for (let rowIndex = 0; rowIndex < tabularData.RowModels.length; rowIndex++) {

            const rowModel = tabularData.RowModels[rowIndex];

            // Insert a placeholder so that getRowValuesForFormatFunction sees the correct column
            // layout before the value is resolved.
            rowModel.CV.splice(columnIndex, 0, null);

            rowModel.CV[columnIndex] = valueResolver(tabularData, rowModel, rowIndex);
        }
    };

    /**
     * Populates a newly-inserted column from what the transformer was given for its values: either
     * a literal value, or one or more format function specifications run per row.  Every
     * column-adding transformer needs this, and the row-values plumbing it involves - decompressing
     * the row, building both the plain and the compressed row values - is the same wherever it is
     * needed, so it lives here rather than being written out per transformer.
     *
     * @param {object} tabularData - The tabular data object.
     * @param {number} columnIndex - The index of the newly-inserted column.
     * @param {*} valueOrSpec - A literal value to write into every row, a format function
     *     specification to calculate one, or an array of specifications applied in turn, each given
     *     the previous one's result as its value.
     * @param {string|number} [seedColumn] - With an array of specifications, the column whose value
     *     seeds the chain, so that the first specification transforms an existing value rather than
     *     starting from nothing.
     */
    const populateInsertedColumnFromValueOrSpec = (
        tabularData,
        columnIndex,
        valueOrSpec,
        seedColumn) => {

        const isSpec = Ren.ObjectUtils.isObject(valueOrSpec);

        if (!isSpec) {

            populateInsertedColumnValues(tabularData, columnIndex, () => valueOrSpec);
            return;
        }

        const isChain = Array.isArray(valueOrSpec);
        const specs = isChain ? valueOrSpec : [valueOrSpec];

        // Transformed clones are pooled across visualisations, so no one report's parameters apply.
        const paras = Ren.ReportInputParameters.getPageInputParameters();

        const formatFunctions = [];

        for (let i = 0; i < specs.length; i++) {
            formatFunctions.push(Ren.FormatFunctions.createFunction(specs[i], paras));
        }

        populateInsertedColumnValues(
            tabularData,
            columnIndex,
            (tabularData, rowModel, rowIndex) => {

                const rowValuesAreCompressed = tabularData.isDataRow(rowIndex);

                const rowVals = Ren.RowValues.getRowValuesForFormatFunction(
                    tabularData,
                    rowModel.CV,
                    rowValuesAreCompressed
                );

                const compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(
                    tabularData,
                    rowModel.CV
                );

                let value = isChain ? rowVals[seedColumn] : null;

                for (let i = 0; i < formatFunctions.length; i++) {

                    const formatFunction = formatFunctions[i];

                    if (formatFunction) {
                        value = formatFunction(value, rowVals, null, null, compressedRowVals);
                    }
                }

                return value;
            }
        );
    };

    return {
        createColumnModel,
        insertColumnIntoTabularData,
        populateInsertedColumnValues,
        populateInsertedColumnFromValueOrSpec
    };
})();
