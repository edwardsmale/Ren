Ren.TabularDataTransformer_SimpleFilter = (columnName, values) => {

    const name = "SimpleFilter";
    const isFilter = true;

    const getExecuteFunction = () => execute;

    const execute = (tabularData) => {

        for (let rowIndex = tabularData.RowModels.length - 1; rowIndex >= 0; rowIndex--) {

            const rowModel = tabularData.RowModels[rowIndex];

            const rowVals = Ren.RowValues.getRowValuesForFormatFunction(
                tabularData,
                rowModel.CV,
                true
            );

            if (!values.includes(rowVals[columnName])) {

                tabularData.RowModels.splice(rowIndex, 1);
                tabularData.ActualRowCount--;
                tabularData.DataRowCount--;
            }
        }

        Ren.TabularData_Services.onRowCountChanged(tabularData);
    };

    return {
        name,
        isFilter,
        execute,
        getExecuteFunction
    };
};
