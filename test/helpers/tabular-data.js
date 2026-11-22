/**
 * Builds a compressed tabular data, with its services, from column names and rows, as a columns
 * and rows data source would.  Its column 0 is the Count column Ren adds, so the given columns
 * start at index 1.
 */
const createTabularData = (columns, rows) => {

    const collection = Ren.DataSourcesAdapter_ColumnsAndRows.adaptColumnsAndRows(
        { columns, rows },
        "test://data",
        "Test"
    );

    Ren.TabularData_Services.addServicesToTabularDatas(collection);

    return collection.TabularDataSets[0].TabularDatas[0];
};

/**
 * Gets the sales rows most of the tests share: a region, a product, a sales figure (one of them
 * missing) and an order date.
 */
const createSalesTabularData = () => createTabularData(
    ["Region", "Product", "Sales", "OrderDate"],
    [
        ["North", "Pens", 10, "2024-01-15"],
        ["South", "Pens", 5, "2024-02-01"],
        ["North", "Paper", 7, "2024-01-20"],
        ["East", "Paper", null, "2024-03-01"],
        ["South", "Ink", 20, "2024-03-05"]
    ]
);

module.exports = { createTabularData, createSalesTabularData };
