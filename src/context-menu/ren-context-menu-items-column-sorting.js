/**
 * Functions to get context menu items for column sorting.
 */
Ren.ContextMenuItems_ColumnSorting = (tabularData, dataGroupingSettings) => {

    const sortFilterGroup = dataGroupingSettings.sortFilterGroup;

    const getMenuItems = (columnIndex) => {

        return [
            {
                section: "Sort",
                text: () => {

                    const columnFormats = dataGroupingSettings.getDataRowsColumnFormats();
                    const valueFormat = columnFormats.columnValueFormats[columnIndex];
                    const sortDirectionStrings = Ren.SortDirectionStringsProvider.getSortDirectionStrings(valueFormat);
                    return `Sort column ${sortDirectionStrings[0]}`;
                },
                id: () => "sort-all-ascending",
                actionParameters: [columnIndex, -1, false],
                action: sortFilterGroup.sort
            },
            {
                section: "Sort",
                text: () => {

                    const columnFormats = dataGroupingSettings.getDataRowsColumnFormats();
                    const valueFormat = columnFormats.columnValueFormats[columnIndex];
                    const sortDirectionStrings = Ren.SortDirectionStringsProvider.getSortDirectionStrings(valueFormat);
                    return `Sort column ${sortDirectionStrings[1]}`;
                },
                id: () => "sort-all-descending",
                actionParameters: [columnIndex, -1, true],
                action: sortFilterGroup.sort
            },
            {
                section: "Sort",
                text: "Sort by length",
                id: "sort-by-length",
                visible: () => tabularData.ColumnModels[columnIndex].ColumnType === "String",
                submenu: [
                    {
                        text: "Shortest first",
                        id: "sort-by-length-asc",
                        actionParameters: [columnIndex, -1, false, { name: "string-length" }],
                        action: sortFilterGroup.sortWithCalcFunction
                    },
                    {
                        text: "Longest first",
                        id: "sort-by-length-desc",
                        actionParameters: [columnIndex, -1, true, { name: "string-length" }],
                        action: sortFilterGroup.sortWithCalcFunction
                    }
                ]
            }
        ];
    };

    return {
        getMenuItems
    };
};
