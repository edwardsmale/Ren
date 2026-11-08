/**
 * Functions to get grouping context menu items.
 */
Ren.ContextMenuItems_Grouping = (tabularData, dataGroupingSettings, expandedGroups, visualisation) => {

    const sortFilterGroup = dataGroupingSettings.sortFilterGroup;

    // isReplacedRow means the right-clicked row has gone, and group has taken its place, so the
    // items that would act on a different grouping than the one clicked are left out.
    const getMenuItems = (columnIndex, group, isDataRow, isReplacedRow) => {

        const columnIdOrHeading = tabularData.ColumnModels[columnIndex]?.ColumnIdOrHeading;

        const state = Ren.GroupingMenuState(tabularData, dataGroupingSettings, columnIndex, group);

        const {
            isDateColumn,
            isNumberColumn,
            isTextColumn,
            grouping,
            groupingAlreadyExistsForColumn,
            anyGroupingsExist,
            multipleGroupingsExist,
            canGroupByColumn,
            getGroupingIndex,
            getGroupingColumnNames,
            getColumnCalcFunction,
            hasCalcFunctionApplied
        } = state;

        const isGroupExpanded = () => Ren.DataGrid_ExpandCollapse.isGroupExpanded(
            tabularData,
            expandedGroups,
            grouping,
            group
        );

        const isExpansionPrevented = () => !!grouping?.preventExpansion;

        const dateMenuBuilder = Ren.GroupingMenuDate(
            tabularData,
            dataGroupingSettings,
            sortFilterGroup,
            columnIndex,
            columnIdOrHeading,
            state
        );

        const {
            createIndexedStringColumns,
            buildDateSubmenu: buildDateSubmenuFromModule,
            createDateInsteadItems: createDateInsteadItemsFromModule
        } = dateMenuBuilder;

        const buildBinningSubmenu = (idSuffix, actionFn) => Ren.BinningMenuBuilder.buildSubmenu({
            isNumberColumn,
            isTextColumn,
            idSuffix,
            onChoose: (specification) => actionFn(
                [columnIndex],
                [specification],
                createIndexedStringColumns()
            )
        });

        // The kinds of column a binning menu is offered for, each with the part of the menu item's
        // ID naming it.
        const binnableColumnKinds = [
            {
                idPart: "data",
                matchesColumn: () => isNumberColumn
            },
            {
                idPart: "universal",
                matchesColumn: () => !isNumberColumn && !isDateColumn && !isTextColumn
            },
            {
                idPart: "string",
                matchesColumn: () => isTextColumn
            }
        ];

        /**
         * Builds a separator and a binning item for each kind of column that can be binned.
         * config.idPrefix keeps the IDs of the sets built for different grouping menus distinct.
         */
        const buildBinningItemsPerColumnKind = (config) => {

            const items = [];

            for (let i = 0; i < binnableColumnKinds.length; i++) {

                const kind = binnableColumnKinds[i];

                items.push({
                    text: "-",
                    visible: () => config.isSeparatorVisible(kind)
                });

                items.push({
                    id: `${config.idPrefix}group-by-column-${kind.idPart}-binning`,
                    text: config.text,
                    visible: () => config.isItemVisible(kind),
                    submenu: config.buildSubmenu(kind)
                });
            }

            return items;
        };

        // Builds the binning sub-items for the Add Grouping and Replace Grouping submenus.
        const buildGroupingBinningItems = (idPrefix, binningSuffix, actionFn) =>
            buildBinningItemsPerColumnKind({
                idPrefix: `${idPrefix}-`,
                text: "Data Binning",
                isSeparatorVisible: (kind) => kind.matchesColumn(),
                isItemVisible: (kind) => kind.matchesColumn() && canGroupByColumn(),
                buildSubmenu: () => buildBinningSubmenu(binningSuffix, actionFn)
            });

        /**
         * Groups by the column with its own calc function where it has one, so the groups are of
         * the calculated values the cells show rather than the raw ones.
         */
        const groupByColumnWithItsCalcFunction = (
            groupWithCalcFunctions,
            groupWithoutCalcFunctions) => {

            const columnCalcFunc = getColumnCalcFunction();

            const groupByCalcFunctions = columnCalcFunc
                ? Ren.ArrayUtils.firstAsArrayOrNull(columnCalcFunc)
                : null;

            if (groupByCalcFunctions) {

                groupWithCalcFunctions([columnIndex], groupByCalcFunctions);
            }
            else {

                groupWithoutCalcFunctions([columnIndex]);
            }
        };

        /**
         * Finds the grouping which groups by the given column, and the column's place within it.
         */
        const findGroupingForColumn = (targetColumnIndex) => {

            const entries = dataGroupingSettings.groupings.entries;

            for (let i = 0; i < entries.length; i++) {

                const indexInGrouping = entries[i].groupByColumnIndexes.indexOf(targetColumnIndex);

                if (indexInGrouping !== -1) {

                    return { grouping: entries[i], indexInGrouping: indexInGrouping };
                }
            }

            return null;
        };

        /**
         * Applies binning to the grouping which groups by the given column.
         */
        const applyBinningToGrouping = (targetColumnIndex, newCalcFunc) => {

            const found = findGroupingForColumn(targetColumnIndex);

            if (!found) return;

            const targetGrouping = found.grouping;
            const indexInGrouping = found.indexInGrouping;

            const newCalcFunctions = (targetGrouping.groupByCalcFunctions || []).slice();

            while (newCalcFunctions.length <= indexInGrouping) {

                newCalcFunctions.push(null);
            }

            newCalcFunctions[indexInGrouping] = newCalcFunc;

            sortFilterGroup.changeBinningFunction(
                targetGrouping.groupByColumnIndexes,
                newCalcFunctions,
                createIndexedStringColumns()
            );
        };

        /**
         * Gets the source of the column's custom binning function, for the "Custom..." editor.
         */
        const getCurrentCustomBinningCode = () => {

            const found = findGroupingForColumn(columnIndex);

            if (!found) return "";

            const calcFunctions = found.grouping.groupByCalcFunctions;
            const calcFunction = calcFunctions ? calcFunctions[found.indexInGrouping] : null;

            return typeof calcFunction === "string" ? calcFunction : "";
        };

        /**
         * Builds the submenu for modifying the binning on an existing grouping.
         */
        const buildModifyBinningSubmenu = () => Ren.BinningMenuBuilder.buildSubmenu({
            isNumberColumn,
            isTextColumn,
            idSuffix: "-modify",
            onNone: () => applyBinningToGrouping(columnIndex, { name: "value-raw" }),
            getCurrentCustomCode: getCurrentCustomBinningCode,
            onChoose: (specification) => applyBinningToGrouping(columnIndex, specification)
        });

        const isGroupingLevelVisible = () => !!(group && grouping && !grouping.isOutermostGrouping);

        const GroupingMutations = Ren.DataGroupingSettingsEditorColumnMutations;

        // Edits the groupings as Edit Groupings does: on transformed settings, then re-applied.
        const changeTransformedGroupings = (mutate) => {

            const transformedSettings = Ren.DataGroupingSettingsTransformer.transform(
                tabularData,
                dataGroupingSettings,
                false
            );

            delete transformedSettings.signifier;

            mutate(transformedSettings.groupings, transformedSettings.dataRows);

            Ren.DataGroupingSettingsApplyer(tabularData, dataGroupingSettings)
                .applyDataGroupingSettings(transformedSettings);

            dataGroupingSettings.fireChangedEvent();
        };

        const disableGroupingLevel = () => {

            const groupingIndex = getGroupingIndex();
            if (groupingIndex < 0) return;

            changeTransformedGroupings((groupings, dataRows) =>
                GroupingMutations.disableGroupingEntry(groupings, groupingIndex, dataRows));
        };

        const getDisabledGroupings = () => dataGroupingSettings.groupings.disabledGroupings || [];

        // Data rows sit directly inside the innermost grouping, so are the level below it.
        const getRowLevelIndex = () => isDataRow ? -1 : getGroupingIndex();

        // A disabled grouping is offered on a row when re-enabling it would place it directly
        // inside or directly around the row's level.
        const isDisabledGroupingForRow = (disabledEntry) => {

            const rowLevelIndex = getRowLevelIndex();
            if (rowLevelIndex < 0 && !isDataRow) return false;

            const restoreIndex =
                GroupingMutations.getRestoreIndex(dataGroupingSettings.groupings, disabledEntry);

            return restoreIndex === rowLevelIndex || restoreIndex === rowLevelIndex + 1;
        };

        const getDisabledGroupingColumnNames = (disabledEntry) => {

            const groupByColumns = disabledEntry.grouping.groupByColumns || [];
            const columnNames = [];

            for (let i = 0; i < groupByColumns.length; i++) {

                const columnModel = tabularData.ColumnModels.find(
                    model => model.ColumnIdOrHeading === groupByColumns[i]
                );

                columnNames.push(columnModel?.Heading || groupByColumns[i]);
            }

            return columnNames.join(", ");
        };

        // The transformed settings hold a clone of the disabled groupings, in the same order.
        const enableDisabledGrouping = (disabledEntry) => {

            const position = getDisabledGroupings().indexOf(disabledEntry);
            if (position < 0) return;

            changeTransformedGroupings(groupings => GroupingMutations.enableDisabledGroupingEntry(
                groupings,
                groupings.disabledGroupings[position]
            ));
        };

        // Built as the menu opens, as the disabled groupings change after the menu is attached.
        const buildEnableDisabledGroupingItems = () => {

            const disabledGroupings = getDisabledGroupings();
            const items = [];

            for (let i = 0; i < disabledGroupings.length; i++) {

                const disabledEntry = disabledGroupings[i];

                if (!isDisabledGroupingForRow(disabledEntry)) continue;

                items.push({
                    text: `Enable '${getDisabledGroupingColumnNames(disabledEntry)}' grouping`,
                    id: `enable-grouping-${i}`,
                    actionParameters: [disabledEntry],
                    action: enableDisabledGrouping
                });
            }

            return items;
        };

        const groupingSubmenu = [];

        // --- Group by column (no groupings exist) ---
        const groupByColumnItem = {
            id: "group-by-column",
            text: "Group by " + columnIdOrHeading,
            visible: () => !anyGroupingsExist() && canGroupByColumn(),
            actionParameters: [[columnIndex]],
            action: sortFilterGroup.replaceGrouping
        };

        if (isDateColumn) groupByColumnItem.submenu = buildDateSubmenuFromModule(null);
        groupingSubmenu.push(groupByColumnItem);

        // --- Group with binning (no groupings exist) ---
        Ren.ArrayUtils.pushAll(groupingSubmenu, buildBinningItemsPerColumnKind({
            idPrefix: "",
            text: "Group with binning",
            isSeparatorVisible: (kind) => !anyGroupingsExist() && kind.matchesColumn(),
            isItemVisible: (kind) =>
                !anyGroupingsExist() && kind.matchesColumn() && canGroupByColumn(),
            buildSubmenu: () => buildBinningSubmenu(
                "",
                sortFilterGroup.replaceGroupingWithCalcFunctionsAndColumns
            )
        }));

        // --- Add Grouping (groupings exist) ---
        const addGroupingSubmenu = [];

        const addGroupByColumnItem = {
            id: "group-by-column",
            text: columnIdOrHeading,
            visible: () => canGroupByColumn(),
            action: () => groupByColumnWithItsCalcFunction(
                (columnIndexes, calcFunctions) =>
                    sortFilterGroup.addGroupingWithCalcFunctions(columnIndexes, calcFunctions),
                (columnIndexes) => sortFilterGroup.addGrouping(columnIndexes)
            )
        };

        if (isDateColumn) addGroupByColumnItem.submenu = buildDateSubmenuFromModule("add");

        addGroupingSubmenu.push(addGroupByColumnItem);

        Ren.ArrayUtils.pushAll(addGroupingSubmenu, buildGroupingBinningItems(
            "add",
            "-as-well",
            sortFilterGroup.addGroupingWithCalcFunctionsAndColumns
        ));

        groupingSubmenu.push({
            id: "add-grouping-submenu",
            text: "Add Grouping",
            visible: () => anyGroupingsExist() && canGroupByColumn(),
            submenu: addGroupingSubmenu
        });

        // --- Replace Grouping(s) (groupings exist) ---
        const replaceGroupingSubmenu = [];
        const replaceGroupByColumnItem = {
            id: "replace-group-by-column",
            text: columnIdOrHeading,
            visible: () => canGroupByColumn()
        };

        if (isDateColumn) {

            replaceGroupByColumnItem.submenu = buildDateSubmenuFromModule("replace");
        }
        else {

            replaceGroupByColumnItem.action = () => groupByColumnWithItsCalcFunction(
                (columnIndexes, calcFunctions) =>
                    sortFilterGroup.replaceGroupingWithCalcFunctions(columnIndexes, calcFunctions),
                (columnIndexes) => sortFilterGroup.replaceGrouping(columnIndexes)
            );
        }

        replaceGroupingSubmenu.push(replaceGroupByColumnItem);

        Ren.ArrayUtils.pushAll(replaceGroupingSubmenu, buildGroupingBinningItems(
            "replace",
            "-only",
            sortFilterGroup.replaceGroupingWithCalcFunctionsAndColumns
        ));

        groupingSubmenu.push({
            id: "replace-group-by-submenu",
            text: () => "Replace Grouping" + (multipleGroupingsExist() ? "s" : ""),
            visible: () => anyGroupingsExist() && canGroupByColumn(),
            submenu: replaceGroupingSubmenu
        });

        // --- Modify existing grouping (column is already grouped) ---
        Ren.ArrayUtils.pushAll(groupingSubmenu, buildBinningItemsPerColumnKind({
            idPrefix: "modify-",
            text: "Group with binning",
            isSeparatorVisible: (kind) => groupingAlreadyExistsForColumn()
                && kind.matchesColumn() && hasCalcFunctionApplied(),
            isItemVisible: (kind) => groupingAlreadyExistsForColumn()
                && kind.matchesColumn() && columnIndex !== null,
            buildSubmenu: () => buildModifyBinningSubmenu()
        }));

        if (isDateColumn && hasCalcFunctionApplied()) {

            Ren.ArrayUtils.pushAll(groupingSubmenu, createDateInsteadItemsFromModule());
        }

        groupingSubmenu.push({
            text: "-",
            visible: () => !groupingAlreadyExistsForColumn()
        });

        groupingSubmenu.push(Ren.MENU_SEPARATOR);

        groupingSubmenu.push({
            text: () => {

                const columnNames = getGroupingColumnNames();
                return `Remove '${columnNames}' grouping`;
            },
            id: "remove-grouping",
            visible: () => {

                const groupingIndex = getGroupingIndex();
                const entries = dataGroupingSettings.groupings.entries;

                return !isReplacedRow &&
                    group &&
                    groupingIndex >= 0 &&
                    groupingIndex < entries.length - 1;
            },
            action: () => {

                const groupingIndex = getGroupingIndex();

                if (groupingIndex >= 0) {
                    sortFilterGroup.removeGroupingAtIndex(groupingIndex);
                }
            }
        });

        groupingSubmenu.push({
            text: () => {

                const columnNames = getGroupingColumnNames();
                return `Disable '${columnNames}' grouping`;
            },
            id: "disable-grouping",
            visible: () => !isReplacedRow && isGroupingLevelVisible(),
            action: disableGroupingLevel
        });

        const enableItemsPosition = groupingSubmenu.length;

        groupingSubmenu.push(Ren.MENU_SEPARATOR);

        groupingSubmenu.push({
            text: "Ungroup",
            id: "remove-all-groupings",
            action: sortFilterGroup.removeAllGroupingsExceptOutermost
        });

        groupingSubmenu.push(Ren.MENU_SEPARATOR);

        groupingSubmenu.push({
            text: "Edit Groupings...",
            action: () => Ren.GroupingSettingsEditorMenuItemHelper(
                visualisation,
                dataGroupingSettings
            ).openGroupingSettingsEditor(Ren.LastRightClickTarget)
        });

        groupingSubmenu.push(Ren.MENU_SEPARATOR);

        groupingSubmenu.push({
            text: "Expand initially",
            id: "expand-initially",
            ticked: () => !!(grouping?.expandInitially),
            visible: () => !!(grouping && !grouping.isOutermostGrouping),
            action: () => {

                grouping.expandInitially = !grouping.expandInitially;
                dataGroupingSettings.fireChangedEvent();
            }
        });

        groupingSubmenu.push({
            text: "Prevent expansion",
            id: "prevent-expansion",
            ticked: isExpansionPrevented,
            visible: () => !!(grouping && !grouping.isOutermostGrouping),
            action: () => sortFilterGroup.setGroupingExpansionPrevented(
                grouping,
                !isExpansionPrevented()
            )
        });

        groupingSubmenu.push(Ren.MENU_SEPARATOR);

        groupingSubmenu.push({
            text: "Collapse group",
            id: () => "collapse-group",
            visible: () => group && isGroupExpanded(),
            actionParameters: [group],
            action: sortFilterGroup.collapseGroup
        });

        groupingSubmenu.push({
            text: "Collapse all children",
            visible: () => group && isGroupExpanded(),
            actionParameters: [group],
            action: sortFilterGroup.collapseGroupFully
        });

        groupingSubmenu.push({
            text: "Expand group",
            id: "expand-group",
            visible: () => !isGroupExpanded() && !isExpansionPrevented(),
            actionParameters: [group],
            action: sortFilterGroup.expandGroup
        });

        groupingSubmenu.push({
            text: "Expand group fully",
            visible: () => group && !isGroupExpanded() && !isExpansionPrevented(),
            actionParameters: [group],
            action: sortFilterGroup.expandGroupFully
        });

        groupingSubmenu.push(Ren.MENU_SEPARATOR);

        groupingSubmenu.push({
            text: "Expand all groups at this level",
            id: "expand-grouping-level",
            visible: () => isGroupingLevelVisible() && !isExpansionPrevented(),
            actionParameters: [group],
            action: sortFilterGroup.expandGroupingLevel
        });

        groupingSubmenu.push({
            text: "Collapse all groups at this level",
            id: "collapse-grouping-level",
            visible: isGroupingLevelVisible,
            actionParameters: [group],
            action: sortFilterGroup.collapseGroupingLevel
        });

        return [
            {
                section: "Data",
                text: "-"
            },
            {
                section: "Data",
                text: "Grouping",
                id: "grouping-menu",
                get submenu() {

                    return groupingSubmenu.slice(0, enableItemsPosition).concat(
                        buildEnableDisabledGroupingItems(),
                        groupingSubmenu.slice(enableItemsPosition)
                    );
                }
            }
        ];
    };

    return {
        getMenuItems
    };
};
