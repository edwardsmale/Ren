Ren.TabularDataTransformer_CopyColumn = (insertBeforeColumn, newColumnName, value_or_value_function_spec) => {

    const name = "CopyColumn";
    const isFilter = false;

    const getExecuteFunction = () => execute;

    const execute = (tabularData) => {

        const insertBeforeColumnIndex = tabularData.columnResolver.resolveColumn(insertBeforeColumn);

        const columnModel = tabularData.ColumnModels[insertBeforeColumnIndex];

        const newColumnModel = Ren.TabularDataColumnInserter.createColumnModel(
            newColumnName,
            columnModel.ColumnFormat,
            columnModel.ColumnType,
            Ren.AggregationTypeEnum.SingleValueOrPlaceholder
        );

        const newColumnIsCompressed = tabularData.IsColumnCompressed[insertBeforeColumnIndex];

        Ren.TabularDataColumnInserter.insertColumnIntoTabularData(
            tabularData,
            insertBeforeColumnIndex,
            newColumnModel,
            newColumnIsCompressed
        );

        // A chain of specifications is seeded with the copied column's own value, which is what
        // makes this a copy rather than an addition: the first specification transforms it.
        Ren.TabularDataColumnInserter.populateInsertedColumnFromValueOrSpec(
            tabularData,
            insertBeforeColumnIndex,
            value_or_value_function_spec,
            insertBeforeColumn
        );
    };

    return {
        name,
        isFilter,
        execute,
        getExecuteFunction
    };
};
