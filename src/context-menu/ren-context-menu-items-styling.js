/**
 * Functions to add the menu items that edit a data grid cell's cell and row style functions (see
 * Ren.DataGridCellStyles), and whether a group row cell mixes its data rows' backgrounds (see
 * Ren.DataGridMergedBackgrounds).
 *
 * @param {Function} getStyleFunction - (propertyName, columnIndex, rowIndex) => code.
 * @param {Function} setStyleFunction - (propertyName, columnIndex, rowIndex, code), where blank
 *     code removes the function.
 * @param {Function} getMergesBackgrounds - (columnIndex, rowIndex) => whether the cell mixes its
 *     data rows' backgrounds, or null for a data row.
 * @param {Function} setMergesBackgrounds - (columnIndex, rowIndex, mergesBackgrounds).
 * @param {Function} hasStyleFunctionInAnyColumn - (propertyName, rowIndex) => whether any column
 *     has the style function at the row's level.
 * @param {Function} removeStyleFunctionFromAllColumns - (propertyName, rowIndex), removing the
 *     style function from every column at the row's level.
 * @param {object} tabularData - The grid's data, whose columns the editor suggests.
 */
Ren.ContextMenuItems_Styling = (
    getStyleFunction,
    setStyleFunction,
    getMergesBackgrounds,
    setMergesBackgrounds,
    hasStyleFunctionInAnyColumn,
    removeStyleFunctionFromAllColumns,
    tabularData
) => {

    const editStyleFunction = (propertyName, title, columnIndex, rowIndex) => {

        const originalFunction = getStyleFunction(propertyName, columnIndex, rowIndex);

        Ren.StyleFunctionEditor.open(
            title,
            originalFunction,
            (code) => setStyleFunction(propertyName, columnIndex, rowIndex, code),
            () => setStyleFunction(propertyName, columnIndex, rowIndex, originalFunction),
            tabularData
        );
    };

    const getMenuItems = (columnIndex, rowIndex) => {

        const hasCellStyle = () => !!getStyleFunction("cellStyleFunction", columnIndex, rowIndex);

        const hasRowStyle = () => !!getStyleFunction("rowStyleFunction", columnIndex, rowIndex);

        const submenu = [
            {
                text: "Cell style...",
                id: "style-cell",
                className: "qa-ren-cell-style-menu-item",
                ticked: hasCellStyle,
                action: () => editStyleFunction(
                    "cellStyleFunction",
                    "Edit Cell Style",
                    columnIndex,
                    rowIndex
                )
            },
            {
                text: "Row style...",
                id: "style-row",
                className: "qa-ren-row-style-menu-item",
                ticked: hasRowStyle,
                action: () => editStyleFunction(
                    "rowStyleFunction",
                    "Edit Row Style",
                    columnIndex,
                    rowIndex
                )
            },
            {
                text: "Mix data rows' backgrounds",
                id: "style-merge-data-row-backgrounds",
                title: "Gives this column's group row cells an even mix of the backgrounds of "
                    + "the data rows in their groups",
                visible: () => getMergesBackgrounds(columnIndex, rowIndex) !== null,
                ticked: () => !!getMergesBackgrounds(columnIndex, rowIndex),
                action: () => setMergesBackgrounds(
                    columnIndex,
                    rowIndex,
                    !getMergesBackgrounds(columnIndex, rowIndex)
                )
            },
            Ren.MENU_SEPARATOR,
            {
                text: "Remove cell style",
                id: "style-cell-remove",
                visible: hasCellStyle,
                action: () => setStyleFunction("cellStyleFunction", columnIndex, rowIndex, "")
            },
            {
                text: "Remove row style",
                id: "style-row-remove",
                visible: hasRowStyle,
                action: () => setStyleFunction("rowStyleFunction", columnIndex, rowIndex, "")
            },
            {

                // The column carrying a row style is not obvious from the row it styles.
                text: "Remove all row styles",
                id: "style-row-remove-all",
                visible: () => hasStyleFunctionInAnyColumn("rowStyleFunction", rowIndex),
                action: () => removeStyleFunctionFromAllColumns("rowStyleFunction", rowIndex)
            }
        ];

        return [
            {
                section: "Functions",
                text: "Style",
                className: "qa-ren-styling-menu-item",
                positionAtEndOfSection: true,
                submenu
            }
        ];
    };

    return {
        getMenuItems
    };
};

/**
 * Opens the function editor on a style function.
 *
 * @param {Function} setFunction - (code), called as the code is saved.
 * @param {Function} restoreFunction - Puts back the original function(s).  Template parameter
 *     changes restyle the grid as they are made, so Cancel calls this.
 * @param {object} tabularData - The grid's data, whose columns the editor suggests.
 */
Ren.StyleFunctionEditor = (() => {

    const NEW_FUNCTION_TEMPLATE = "return {\n    \"color\": value < 0 ? \"Red\" : null\n};";

    const open = (title, originalFunction, setFunction, restoreFunction, tabularData) => {

        Ren.Messages.Requests.functionEditorWindow.notify(
            () => originalFunction || NEW_FUNCTION_TEMPLATE,
            setFunction,
            null,
            null,
            {
                centred: true,
                parameterSet: "style",
                title,
                restoreFunction,
                autoComplete: { tabularData }
            }
        );
    };

    return {
        open
    };
})();

/**
 * The column down-arrow menu's "Column cell style" item, whose style functions are set for the
 * column's cells at every level - the data rows and each grouping - at once.
 */
Ren.ContextMenuItems_ColumnStyling = (dataGroupingSettings, tabularData) => {

    const editColumnStyleFunction = (propertyName, title, columnIndex) => {

        const originalFunctions =
            dataGroupingSettings.getColumnStyleFunctions(propertyName, columnIndex);

        // The levels may differ, so the editor opens on the first one that has a function.
        Ren.StyleFunctionEditor.open(
            title,
            originalFunctions.find(Boolean),
            (code) => dataGroupingSettings.setColumnStyleFunctions(propertyName, columnIndex, code),
            () => dataGroupingSettings.setColumnStyleFunctions(
                propertyName,
                columnIndex,
                originalFunctions
            ),
            tabularData
        );
    };

    const getMenuItem = (columnIndex) => ({
        section: "Functions",
        text: "Column cell style",
        id: "column-cell-style-menu-item",
        className: "qa-ren-column-cell-style-menu-item",
        submenu: [
            {
                text: "Cell style function...",
                id: "column-cell-style-function-menu-item",
                action: () => editColumnStyleFunction(
                    "cellStyleFunction",
                    "Edit Column Cell Style",
                    columnIndex
                )
            },
            {
                text: "Row style function...",
                id: "column-row-style-function-menu-item",
                action: () => editColumnStyleFunction(
                    "rowStyleFunction",
                    "Edit Column Row Style",
                    columnIndex
                )
            }
        ]
    });

    return {
        getMenuItem
    };
};
