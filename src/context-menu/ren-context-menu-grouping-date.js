/**
 * Date-specific menu building for grouping context menus.
 */
Ren.GroupingMenuDate = (
    _tabularData,
    _dataGroupingSettings,
    sortFilterGroup,
    columnIndex,
    columnIdOrHeading,
    groupingState) => {

    const { dateGroupingOptions } = Ren.GroupingMenuConstants;
    const { isDateTimeColumn, isCalcFunctionApplied, canGroupByColumn } = groupingState;

    const createIndexedStringColumns = () => {

        const columns = {};
        columns[columnIdOrHeading] = {
            valueFormat: Ren.SpreadsheetColumnFormatEnum.IndexedString
        };
        return columns;
    };

    /**
     * Helper to create a date grouping menu item.
     */
    const createDateMenuItem = (option, mode) => {

        const prefix = mode === "add" ? "add-" : mode === "replace" ? "replace-" : "";

        const menuItem = {
            id: `${prefix}group-by-column-${option.id}`,
            text: option.text,
            visible: () => canGroupByColumn()
        };

        if (option.requiresColumns) {

            menuItem.action = () => {

                const actionFn = mode === "add"
                    ? sortFilterGroup.addGroupingWithCalcFunctionsAndColumns
                    : sortFilterGroup.replaceGroupingWithCalcFunctionsAndColumns;

                actionFn(
                    [columnIndex],
                    [{ name: option.calcFunction }],
                    createIndexedStringColumns()
                );
            };
        }
        else if (option.calcFunction) {

            const actionFn = mode === "add"
                ? sortFilterGroup.addGroupingWithCalcFunctions
                : sortFilterGroup.replaceGroupingWithCalcFunctions;

            menuItem.actionParameters = [[columnIndex], [{ name: option.calcFunction }]];
            menuItem.action = actionFn;
        }
        else {

            const actionFn = mode === "add"
                ? sortFilterGroup.addGrouping
                : sortFilterGroup.replaceGrouping;

            menuItem.actionParameters = [[columnIndex]];
            menuItem.action = actionFn;
        }

        return menuItem;
    };

    /**
     * Builds the items for the date grouping options the column can be offered, with the separators
     * the options ask for put between them.
     *
     * @param {function} isOptionOffered - Takes an option, and returns whether it is offered at
     *     all.  An option that is not offered takes no separator with it.
     * @param {function} createItem - Takes an offered option, and returns its menu item, or null
     *     where the option earns its separator but no item of its own.
     * @returns {object[]} The items and separators, in the order the options are stated in.
     */
    const buildDateOptionItems = (isOptionOffered, createItem) => {

        const items = [];
        let lastSeparator = false;

        dateGroupingOptions.forEach(option => {

            // Skip DateTime-only options if not a DateTime column.
            if (option.dateTimeOnly && !isDateTimeColumn) return;

            if (!isOptionOffered(option)) return;

            if (option.separator === "before" && !lastSeparator) {

                items.push(Ren.MENU_SEPARATOR);
                lastSeparator = true;
            }
            else {

                lastSeparator = false;
            }

            const item = createItem(option);

            if (item) items.push(item);
        });

        return items;
    };

    /**
     * Helper to build a date submenu for a specific mode.
     */
    const buildDateSubmenu = (mode) => buildDateOptionItems(
        () => true,
        (option) => createDateMenuItem(option, mode)
    );

    /**
     * Helper to create "instead" menu items for date columns.
     */
    const createDateInsteadItems = () => {

        // "By Date" comes out of the options below like every other period, on a Date column as
        // well as a Date/Time one.
        return buildDateOptionItems(
            // Skip if this option is already applied.
            (option) => !(option.calcFunction && isCalcFunctionApplied(option.calcFunction)),
            (option) => {

                // Skip the "By Date/Time" option as it doesn't have a calc function.
                if (!option.calcFunction) return null;

                const item = {
                    id: `group-by-${option.id}-instead`,
                    text: option.text,
                    visible: () => columnIndex !== null
                };

                if (option.requiresColumns) {

                    item.action = () => sortFilterGroup.changeGroupingCalcFunctionsAndColumns(
                        [columnIndex],
                        [{ name: option.calcFunction }],
                        createIndexedStringColumns()
                    );
                }
                else {

                    item.actionParameters = [[columnIndex], [{ name: option.calcFunction }]];
                    item.action = sortFilterGroup.changeGroupingCalcFunctions;
                }

                return item;
            }
        );
    };

    return {
        buildDateSubmenu,
        createDateInsteadItems,
        createIndexedStringColumns
    };
};
