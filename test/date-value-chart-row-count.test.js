describe("Ren.DateValueChart_RowCount", () => {

    const RowCount = Ren.DateValueChart_RowCount;

    const buildTabularData = (columnModels) => {

        const tabularData = {
            ColumnModels: [{ Heading: "Count", ColumnId: "__Count", ColumnIdOrHeading: "__Count",
                ColumnType: "Number" }].concat(columnModels)
        };

        tabularData.columnResolver = Ren.DataGridColumnResolver(tabularData);

        return tabularData;
    };

    const buildColumnModel = (heading, properties) => Object.assign(
        { Heading: heading, ColumnId: heading, ColumnIdOrHeading: heading },
        properties
    );

    const tabularData = buildTabularData([
        buildColumnModel("Category", { ColumnType: "String" }),
        buildColumnModel("ProductId", {
            ColumnType: "Number",
            ColumnFormat: Ren.SpreadsheetColumnFormatEnum.Id
        }),
        buildColumnModel("Status", { ColumnType: "Number", EnumValues: { 1: "Open", 2: "Closed" } }),
        buildColumnModel("Date", { ColumnType: "Date" }),
        buildColumnModel("Sales", { ColumnType: "Number" })
    ]);

    test("getCountedColumn_StringColumnAlone_StringColumnCounted", () => {

        expect(RowCount.getCountedColumn(tabularData, ["Category"])).toBe("Category");
    });

    test("getCountedColumn_IdColumnAlone_IdColumnCounted", () => {

        expect(RowCount.getCountedColumn(tabularData, ["ProductId"])).toBe("ProductId");
    });

    test("getCountedColumn_EnumColumnAlone_EnumColumnCounted", () => {

        expect(RowCount.getCountedColumn(tabularData, ["Status"])).toBe("Status");
    });

    test("getCountedColumn_DateBeforeStringColumn_StringColumnCounted", () => {

        expect(RowCount.getCountedColumn(tabularData, ["Date", "Category"])).toBe("Category");
    });

    test("getCountedColumn_ValueColumnSelected_NothingCounted", () => {

        expect(RowCount.getCountedColumn(tabularData, ["Category", "Sales"])).toBeNull();
    });

    test("getCountedColumn_DateColumnAlone_NothingCounted", () => {

        expect(RowCount.getCountedColumn(tabularData, ["Date"])).toBeNull();
    });

    test("getCountedColumn_NoRowCountColumn_NothingCounted", () => {

        const withoutCount = { ColumnModels: [buildColumnModel("Category", { ColumnType: "String" })] };
        withoutCount.columnResolver = Ren.DataGridColumnResolver(withoutCount);

        expect(RowCount.getCountedColumn(withoutCount, ["Category"])).toBeNull();
    });
});
