/**
 * Adds a column to the tabular data with the specified name, format, type, and value or value
 * function.
 *
 * @param {string|number} insertBeforeColumn - The column ID/heading or column index before which to
 *   insert the new column.
 * @param {string} newColumnName - The name of the new column.
 * @param {string} newColumnFormat - The format string for the new column.
 * @param {string} newColumnType - The data type for the new column ("Number", "Date", "Date/Time",
 *   "String").
 * @param {any|object} value_or_value_function_spec - The value to set for the new column, or a
 *   format function specification to calculate the value.
 */
Ren.TabularDataTransformer_AddColumn = (
    insertBeforeColumn,
    newColumnName,
    newColumnFormat,
    newColumnType,
    newColumnIsCompressed,
    value_or_value_function_spec) => {

    const name = "AddColumn";
    const isFilter = false;

    const getExecuteFunction = () => execute;

    const execute = (tabularData) => {

        const insertBeforeColumnIndex = tabularData.columnResolver.resolveColumn(insertBeforeColumn);

        const newColumnModel = Ren.TabularDataColumnInserter.createColumnModel(
            newColumnName,
            newColumnFormat,
            newColumnType,
            Ren.AggregationTypeEnum.SingleValueOrPlaceholder
        );

        Ren.TabularDataColumnInserter.insertColumnIntoTabularData(
            tabularData,
            insertBeforeColumnIndex,
            newColumnModel,
            newColumnIsCompressed
        );

        Ren.TabularDataColumnInserter.populateInsertedColumnFromValueOrSpec(
            tabularData,
            insertBeforeColumnIndex,
            value_or_value_function_spec
        );
    };

    return {
        name,
        isFilter,
        execute,
        getExecuteFunction
    };
};
