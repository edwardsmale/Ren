/**
 * Builds the "Data Binning" submenu. Offered wherever a column's values can be binned: the grouping
 * context menu (which bins a grouping's group-by value) and the filter module item header's "+
 * binning function" link (which bins the values an item's checkboxes and compare filters are
 * evaluated against).
 * A binning function is stated in exactly the same way as a grouping's groupByCalcFunctions: either
 * a format function spec ({ name: "bin-10" }) or, for the "Custom..." option, the function's own
 * source as a bare string.
 *
 * The menu items contain all the functions which have the BINNING: tag in their header comment.
 */
Ren.BinningMenuBuilder = (() => {

    const constants = () => Ren.GroupingMenuConstants;

    const getTextSubmenuGroups = () => [
        { text: "URLs", idSuffix: "urls", functions: constants().urlBinningFunctions },
        {
            text: "User Agents",
            idSuffix: "user-agents",
            functions: constants().userAgentBinningFunctions
        }
    ];

    // Gets the binning functions for a date column: the periods its dates fall in and the ways they
    // read (day of week, December / non-December), with the time-of-day ones a Date/Time column's
    // values are fine enough for offered first, exactly as the grid's "Group by" menu orders them.
    const getDateFunctions = (isDateTimeColumn) => {

        const dateFunctions = constants().dateBinningFunctions;

        if (!isDateTimeColumn) return dateFunctions;

        return constants().dateTimeBinningFunctions.concat(dateFunctions);
    };

    // Gets the binning functions for a particular kind of column, and whether the universal ones
    // (blank / non-blank) and the text submenu groups are offered alongside them.  A column of no
    // kind that has binning functions of its own is left with the universal functions alone.
    const getFunctionsForColumnKind = (config) => {

        if (config.isNumberColumn) {

            return {
                primary: constants().numberBinningFunctions,
                appendUniversal: true,
                subMenuGroups: null
            };
        }

        if (config.isTextColumn) {

            return {
                primary: constants().stringBinningFunctions,
                appendUniversal: true,
                subMenuGroups: getTextSubmenuGroups()
            };
        }

        if (config.isDateColumn) {

            return {
                primary: getDateFunctions(config.isDateTimeColumn),
                appendUniversal: true,
                subMenuGroups: null
            };
        }

        return {
            primary: constants().universalBinningFunctions,
            appendUniversal: false,
            subMenuGroups: null
        };
    };

    /**
     * Gets the column kind for a given value format.
     *
     * @param {number} valueFormat - The cell's SpreadsheetColumnFormatEnum value.
     * @returns {object} isNumberColumn and isTextColumn, as buildSubmenu takes them.
     */
    const getColumnKindForValueFormat = (valueFormat) => {

        const formats = Ren.SpreadsheetColumnFormatEnum;

        return {
            isNumberColumn: formats.IsNumeric(valueFormat) && valueFormat !== formats.Boolean,
            isTextColumn: valueFormat === formats.General
                || valueFormat === formats.IndexedString
                || valueFormat === formats.Enum
        };
    };

    /**
     * Builds the binning submenu items.
     *
     * @param {object} config
     * @param {boolean} config.isNumberColumn - Whether the column holds numbers.
     * @param {boolean} config.isTextColumn - Whether the column holds text.
     * @param {boolean} [config.isDateColumn] - Whether the column holds dates.  Only a host that
     *     bins dates rather than grouping them by period (the filter module) passes this; the
     *     grid's own menus leave a date column with the universal functions, its date periods
     *     being offered on the "Group by" menu instead.
     * @param {boolean} [config.isDateTimeColumn] - Whether a date column's values carry a time of
     *     day, so that the functions reading one (the hour, working hours) are worth offering.
     * @param {function} config.onChoose - Called with the chosen binning function: a spec object
     *     ({ name }) for a listed function, or the function's source for a custom one.
     * @param {function} [config.onNone] - Called when "None" is chosen.  Omit for no "None" item.
     * @param {string} [config.noneText] - The "None" item's caption (default "None").
     * @param {function} [config.getCurrentCustomCode] - Returns the source the "Custom..." editor
     *     opens on, so an existing custom function is edited rather than replaced blind.
     * @param {function} [config.getCurrentFunctionName] - Returns the name of the listed function
     *     currently chosen (see Ren.FormatFunctionUtils.getFunctionName), so its item is ticked.
     *     Omit for no ticks on the listed functions.
     * @param {string} [config.idSuffix] - Appended to each item's id, so submenus built for
     *     different purposes on the same menu keep distinct ids.
     * @param {boolean} [config.includeCustom] - Whether to offer the "Custom..." entry, which
     *     defaults to true.  Pass false where the menu these items are put on offers a custom
     *     function of its own, so that a custom function is not offered twice.
     * @param {string} [config.customParameterSet] - The Ren.FunctionEditorWidget.parameterSets
     *     entry the "Custom..." editor lists.  Defaults to "valueOnly", as binning functions are
     *     given only the value; pass "format" where the function is applied as a format function.
     * @returns {object[]} The submenu items.
     */
    const buildSubmenu = (config) => {

        const idSuffix = config.idSuffix ?? "";
        const submenu = [];

        const buildItem = (binFunc) => {

            const item = {
                id: `group-by-column-binning-${binFunc.idSuffix}${idSuffix}`,
                text: binFunc.text,
                action: () => config.onChoose({ name: binFunc.name })
            };

            if (config.getCurrentFunctionName) {
                item.ticked = () => config.getCurrentFunctionName() === binFunc.name;
            }

            return item;
        };

        if (config.onNone) {

            submenu.push({
                id: `group-by-column-binning-none${idSuffix}`,
                text: config.noneText ?? "None",
                action: () => config.onNone()
            });

            submenu.push(Ren.MENU_SEPARATOR);
        }

        const {
            primary,
            appendUniversal,
            subMenuGroups
        } = getFunctionsForColumnKind(config);

        for (let i = 0; i < primary.length; i++) submenu.push(buildItem(primary[i]));

        if (subMenuGroups) {

            for (let g = 0; g < subMenuGroups.length; g++) {

                const group = subMenuGroups[g];
                const groupSubmenu = [];

                for (let f = 0; f < group.functions.length; f++) {
                    groupSubmenu.push(buildItem(group.functions[f]));
                }

                submenu.push({
                    id: `group-by-column-binning-${group.idSuffix}${idSuffix}`,
                    text: group.text,
                    submenu: groupSubmenu
                });
            }
        }

        if (appendUniversal) {

            submenu.push(Ren.MENU_SEPARATOR);

            const universalFunctions = constants().universalBinningFunctions;

            for (let i = 0; i < universalFunctions.length; i++) {
                submenu.push(buildItem(universalFunctions[i]));
            }
        }

        if (config.includeCustom === false) return submenu;

        submenu.push(Ren.MENU_SEPARATOR);

        submenu.push({
            id: `group-by-column-binning-custom${idSuffix}`,
            text: "Custom...",
            ticked: () => !!config.getCurrentCustomCode?.(),
            action: () => {

                Ren.Messages.Requests.functionEditorWindow.notify(
                    config.getCurrentCustomCode ?? (() => ""),
                    (customCode) => config.onChoose(customCode),
                    null,
                    null,
                    {
                        centred: true,
                        parameterSet: config.customParameterSet ?? "valueOnly",
                        functionTag: "binning"
                    }
                );
            }
        });

        return submenu;
    };

    // Gets the caption describing a binning function.
    const describe = (specification) => {

        if (!specification) return "";

        const name = typeof specification === "string" ? null : specification.name;

        if (!name) return "Custom";

        return Ren.FunctionTags.getBinningText(name);
    };

    return {
        buildSubmenu,
        describe,
        getColumnKindForValueFormat
    };
})();
