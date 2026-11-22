/**
 * Functions to add calculation menu items to the context menu.
 *
 * Which functions the menu offers is settled by the functions themselves: an item naming a
 * function whose header does not tag it "calculation" is dropped before the menu is shown (see
 * Ren.FunctionTags and Ren.FunctionMenuFilter), so a function stops being offered here by losing
 * the tag rather than by being taken out of the list below.
 *
 * The menu needs nothing of its host but somewhere to read and write the calc function, so it asks
 * for those two functions rather than for a whole dataGroupingSettings.  Hosts calculating
 * something other than a data grid cell - the filter module's checkbox labels - then have no
 * settings object to imitate: they hand over functions that read and write wherever they keep the
 * choice, and ignore the columnIndex and rowIndex naming the cell it came from.
 *
 * tabularData, where given, supplies the columns the custom function editor suggests.
 */
Ren.ContextMenuItems_Calculation = (getCalcFunction, setCalcFunction, tabularData) => {

    const getCurrentFunctionName = (columnIndex, rowIndex) =>
        Ren.FormatFunctionUtils.getFunctionName(getCalcFunction(columnIndex, rowIndex));

    /**
     * Builds the binning entries, from the shared builder the filter module item header's
     * "+ binning function" menu is built from (see Ren.BinningMenuBuilder), so the same functions
     * are offered in the same order wherever a value is binned.  A binning function is a calc
     * function, so the chosen one is set on the cell exactly as "None" is, and the entries sit on
     * this menu itself rather than in a submenu of their own: binning is most of what calculating a
     * column is for, so putting them a further hover away only hid them.  The builder's own
     * "Custom..." entry is left out, since the menu ends with a Custom of its own that opens the
     * same editor on the same function.
     *
     * Unlike the Format menu's copy of this submenu, nothing here takes the sort key off a bin that
     * carries one ("4¬Oak"): a calc function replaces the value the cell is sorted and grouped by,
     * so keeping the sortable form is what puts the bins in the order the function meant them to
     * read in, and the display path strips the key off when the cell is shown (see
     * Ren.TextUtils.stripSortPrefix).
     *
     * @param {number} columnIndex - The index of the column the menu was opened on.
     * @param {number} rowIndex - The index of the row the menu was opened on.
     * @param {number} valueFormat - The cell's SpreadsheetColumnFormatEnum value, which decides
     *     which binning functions are offered.
     * @returns {Array} The binning menu items, to be put on the Calculation menu as they stand.
     */
    const createBinningItems = (columnIndex, rowIndex, valueFormat) => {

        const { isNumberColumn, isTextColumn } =
            Ren.BinningMenuBuilder.getColumnKindForValueFormat(valueFormat);

        return Ren.BinningMenuBuilder.buildSubmenu({
            isNumberColumn,
            isTextColumn,
            idSuffix: "-calc",
            includeCustom: false,
            getCurrentFunctionName: () => getCurrentFunctionName(columnIndex, rowIndex),
            onChoose: (specification) => setCalcFunction(columnIndex, rowIndex, specification)
        });
    };

    const getMenuItems = (columnIndex, rowIndex, _grouping, valueFormat) => {

        const submenu = [
            {
                text: "None",
                id: "calc-normal",
                ticked: () => getCurrentFunctionName(columnIndex, rowIndex) === "default",
                actionParameters: [columnIndex, rowIndex, { "name": "default" }],
                action: setCalcFunction
            },
            Ren.MENU_SEPARATOR
        ];

        const binningItems = createBinningItems(columnIndex, rowIndex, valueFormat);

        Ren.ArrayUtils.pushAll(submenu, binningItems);

        submenu.push(Ren.MENU_SEPARATOR);

        submenu.push({
            text: "Custom...",
            id: "calc-custom",
            ticked: () => !!Ren.FormatFunctionUtils.getCustomCode(
                getCalcFunction(columnIndex, rowIndex)
            ),
            actionParameters: [columnIndex, rowIndex],
            action: (columnIndex, rowIndex) => {

                Ren.Messages.Requests.functionEditorWindow.notify(
                    () => getCalcFunction(columnIndex, rowIndex),
                    (newFunction) => setCalcFunction(columnIndex, rowIndex, newFunction),
                    null,
                    null,
                    { centred: true, parameterSet: "calc", autoComplete: { tabularData } }
                );
            }
        });

        return [
            {
                section: "Functions",
                text: "Calculation",
                className: "qa-ren-calculating-menu-item",
                submenu: Ren.FunctionMenuFilter.filterMenuItems(submenu, "calculation")
            }
        ];
    };

    return {
        getMenuItems
    };
};
