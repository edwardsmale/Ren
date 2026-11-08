/**
 * Duplicates a column, inserting the copy immediately after the original with the heading
 * "[Original] Copy".
 */
Ren.TabularDataTransformer_DuplicateColumn = (columnIdOrHeading) => {

    const name = "DuplicateColumn";
    const isFilter = false;

    const execute = (tabularData) => {

        const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);

        if (columnIndex === -1 || columnIndex === null) {

            console.warn(`[DuplicateColumn] Column not found: "${columnIdOrHeading}"`);
            return;
        }

        if (columnIndex >= tabularData.ColumnModels.length) {

            console.warn(`[DuplicateColumn] Column index ${columnIndex} out of range (ColumnCount: ${tabularData.ColumnCount})`);
            return;
        }

        const columnModel = tabularData.ColumnModels[columnIndex];

        if (!columnModel) {

            console.warn(`[DuplicateColumn] Column model undefined at index ${columnIndex}`);
            return;
        }

        const insertBeforeColumnIndex = columnIndex + 1;

        const existingHeadings = new Set(tabularData.ColumnModels.map(c => c.Heading));

        const baseHeading = columnModel.Heading + " Copy";
        let newHeading = baseHeading;

        for (let n = 1; existingHeadings.has(newHeading); n++) {
            newHeading = baseHeading + " " + n;
        }

        const newColumnModel = Ren.TabularDataColumnInserter.createColumnModel(
            newHeading,
            columnModel.ColumnFormat,
            columnModel.ColumnType,
            columnModel.AggregationType
        );

        const newColumnIsCompressed = tabularData.IsColumnCompressed[columnIndex];

        // The values are copied as they are, so they are read the way the source column's are.
        const newColumnValueEncoding = tabularData.ColumnValueEncodings?.[columnIndex];

        Ren.TabularDataColumnInserter.insertColumnIntoTabularData(
            tabularData,
            insertBeforeColumnIndex,
            newColumnModel,
            newColumnIsCompressed,
            newColumnValueEncoding
        );

        // Copy the value from the source column into the new column for every row.
        // The source column is still at columnIndex since we inserted after it.
        for (let rowIndex = 0; rowIndex < tabularData.RowModels.length; rowIndex++) {

            const rowModel = tabularData.RowModels[rowIndex];
            const sourceValue = rowModel.CV[columnIndex];

            rowModel.CV.splice(insertBeforeColumnIndex, 0, sourceValue);
        }
    };

    return {
        name,
        isFilter,
        execute
    };
};

