/**
 * Functions to add the menu items that edit the tooltips of a column's heading and of a data grid
 * cell, each as fixed text or as a tooltip function (see Ren.DataGridTooltips).
 *
 * A heading's tooltip is set at the data rows level, with a null row index.  tabularData supplies
 * the columns the function editor suggests.
 */
Ren.ContextMenuItems_Tooltips = (dataGroupingSettings, tabularData) => {

    /**
     * Gets the accessors for one tooltip: a cell's or a heading's, which is either fixed text or a
     * function.  Setting either one clears the other, so the tooltip is never both.
     */
    const createTooltip = (textPropertyName, functionPropertyName, columnIndex, rowIndex) => {

        const getText = () =>
            dataGroupingSettings.getTooltipText(textPropertyName, columnIndex, rowIndex);

        const getFunction = () =>
            dataGroupingSettings.getStyleFunction(functionPropertyName, columnIndex, rowIndex);

        const setText = (text) => dataGroupingSettings.setTooltipText(
            textPropertyName,
            columnIndex,
            rowIndex,
            text
        );

        const setFunction = (code) => dataGroupingSettings.setTooltipFunction(
            functionPropertyName,
            columnIndex,
            rowIndex,
            code
        );

        const setTextOnly = (text) => {

            if (text && text.trim()) setFunction("");

            setText(text);
        };

        const setFunctionOnly = (code) => {

            if (code && code.trim()) setText("");

            setFunction(code);
        };

        const isSet = () => !!getText() || !!getFunction();

        const remove = () => {

            setText("");
            setFunction("");
        };

        return {
            getText,
            getFunction,
            setText,
            setFunction,
            setTextOnly,
            setFunctionOnly,
            isSet,
            remove
        };
    };

    const editTooltipText = (tooltip, title) => {

        Ren.CreateOkCancelTextEditorPopupWindow(
            title,
            (text) => tooltip.setTextOnly(text),
            {
                label: "Tooltip",
                initialText: tooltip.getText(),
                multiline: true,
                width: 360,
                height: 220
            }
        );
    };

    // Template parameter changes save the function as they are made, which clears the text, so
    // Cancel puts back the text as well as the function.
    const editTooltipFunction = (tooltip, title) => {

        const originalText = tooltip.getText();
        const originalFunction = tooltip.getFunction();

        Ren.TooltipFunctionEditor.open(
            title,
            originalFunction,
            (code) => tooltip.setFunctionOnly(code),
            () => {

                tooltip.setFunction(originalFunction);
                tooltip.setText(originalText);
            },
            tabularData
        );
    };

    const getSubmenu = (textPropertyName, functionPropertyName, noun, columnIndex, rowIndex) => {

        const tooltip =
            createTooltip(textPropertyName, functionPropertyName, columnIndex, rowIndex);

        return [
            {
                text: noun + " tooltip...",
                id: "tooltip-" + noun.toLowerCase() + "-text",
                ticked: () => !!tooltip.getText(),
                action: () => editTooltipText(tooltip, "Edit " + noun + " Tooltip")
            },
            {
                text: noun + " tooltip function...",
                id: "tooltip-" + noun.toLowerCase() + "-function",
                ticked: () => !!tooltip.getFunction(),
                action: () => editTooltipFunction(tooltip, "Edit " + noun + " Tooltip Function")
            },
            Ren.MENU_SEPARATOR,
            {
                text: "Remove tooltip",
                id: "tooltip-" + noun.toLowerCase() + "-remove",
                visible: () => tooltip.isSet(),
                action: () => tooltip.remove()
            }
        ];
    };

    /**
     * Gets the menu items for a column's heading and header cells.
     */
    const getHeadingMenuItems = (columnIndex) => [
        {
            section: "Columns",
            text: "Heading tooltip",
            id: "heading-tooltip",
            className: "qa-ren-heading-tooltip-menu-item",
            submenu: getSubmenu(
                "headingTooltip",
                "headingTooltipFunction",
                "Heading",
                columnIndex,
                null
            )
        }
    ];

    /**
     * Gets the menu items for a cell, at the level of its row.
     */
    const getCellMenuItems = (columnIndex, rowIndex) => [
        {
            section: "Functions",
            text: "Tooltip",
            className: "qa-ren-cell-tooltip-menu-item",
            positionAtEndOfSection: true,
            submenu: getSubmenu(
                "cellTooltip",
                "cellTooltipFunction",
                "Cell",
                columnIndex,
                rowIndex
            )
        }
    ];

    return {
        getHeadingMenuItems,
        getCellMenuItems
    };
};

/**
 * Opens the function editor on a tooltip function.
 *
 * @param {Function} setFunction - (code), called as the code is saved.
 * @param {Function} restoreFunction - Puts back the original function.  Template parameter changes
 *     change the tooltips as they are made, so Cancel calls this.
 * @param {object} tabularData - The grid's data, whose columns the editor suggests.
 */
Ren.TooltipFunctionEditor = (() => {

    const NEW_FUNCTION_TEMPLATE = "return value;";

    const open = (title, originalFunction, setFunction, restoreFunction, tabularData) => {

        Ren.Messages.Requests.functionEditorWindow.notify(
            () => originalFunction || NEW_FUNCTION_TEMPLATE,
            setFunction,
            null,
            null,
            {
                centred: true,
                parameterSet: "tooltip",
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
