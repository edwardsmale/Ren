/**
 * Filter Module: the context menus shared by every part of an item, and the label and heading
 * edit popups.
 */
Ren.FilterModule_Menu = (s) => {

    const {
        columnOverrides,
        COUNT_COLUMN_HEADING,
        SORT_AGGREGATION_TYPES,
        AGGREGATION_MENU_LABELS,
        AGGREGATION_TITLE_LABELS
    } = s;

    // Held as whole facets because a facet is only filled in once its module is wired in.
    const {
        columnInfo,
        counts,
        filtering,
        filterTarget,
        grouping,
        includeWhenSaving,
        itemSettings,
        view
    } = s;

    // A label is a raw value with no stats for "Show as" formats to read, and neither menu formats
    // a grid cell, so neither offers the cell-only formats.
    const NO_SUMMARY_STATS = { summaryStatsAvailable: false, gridContext: false };

    const NOT_A_GRID = { gridContext: false };

    // Clearing the text, or matching the default, removes the override.  config.getHolder picks
    // the object within the column's override that holds it, by default the override itself.
    const openOverrideTextEditor = (config) => {

        Ren.CreateOkCancelTextEditorPopupWindow(
            config.title,
            (text) => {

                const trimmed = text.trim();
                const entry = itemSettings.getOrCreateColumnOverride(config.columnIdOrHeading);
                const holder = config.getHolder ? config.getHolder(entry) : entry;

                if (trimmed && trimmed !== config.defaultText) {
                    holder[config.propertyName] = trimmed;
                }
                else {

                    delete holder[config.propertyName];
                }

                itemSettings.pruneColumnOverride(config.columnIdOrHeading);
                config.onChanged();
            },
            {
                label: config.label,
                initialText: config.initialText,
                multiline: false,
                width: 360,
                height: 150
            }
        );
    };

    const openColumnHeadingEditor = (item, headingElement) => {

        openOverrideTextEditor({
            title: "Edit Heading",
            label: "Heading",
            columnIdOrHeading: item.columnIdOrHeading,
            propertyName: "HeadingOverride",
            defaultText: item.fallbackHeading,
            initialText: columnInfo.resolveHeading(item),
            onChanged: () => headingElement._textContent(columnInfo.resolveHeading(item))
        });
    };

    // Keyed on a hierarchy's leaf, as the rest of the item's appearance is.
    const openFilterHeadingTooltipEditor = (columnIdOrHeading) => {

        openOverrideTextEditor({
            title: "Filter heading tooltip",
            label: "Tooltip shown on hovering the heading",
            columnIdOrHeading,
            propertyName: "filterHeadingTooltip",
            defaultText: "",
            initialText: itemSettings.getFilterHeadingTooltip(columnIdOrHeading),
            onChanged: () => view.render()
        });
    };

    const openAllLabelEditor = (item, allTextElement, optionCount) => {

        const defaultLabel = columnInfo.getDefaultAllLabel(optionCount);

        const resolveAllLabel = () =>
            columnInfo.resolveAllLabel(item.columnIdOrHeading, optionCount);

        openOverrideTextEditor({
            title: "Edit Label",
            label: `"${defaultLabel}" label`,
            columnIdOrHeading: item.columnIdOrHeading,
            propertyName: "AllLabelOverride",
            defaultText: defaultLabel,
            initialText: resolveAllLabel(),
            onChanged: () => allTextElement._textContent(resolveAllLabel())
        });
    };

    const openValueLabelEditor = (columnIdOrHeading, columnIndex, option, optionTextElement) => {

        const resolveOptionText = () =>
            columnInfo.resolveOptionText(columnIdOrHeading, columnIndex, option);

        openOverrideTextEditor({
            title: "Edit Label",
            label: "Checkbox label",
            columnIdOrHeading,
            getHolder: (entry) => entry.ValueOverrides ?? (entry.ValueOverrides = {}),
            propertyName: option.value,
            defaultText: option.baseText,
            initialText: resolveOptionText(),
            onChanged: () => columnInfo.setFormattedText(optionTextElement, resolveOptionText())
        });
    };

    const editOptionText = (item, option, optionTextElement) =>
        openValueLabelEditor(item.columnIdOrHeading, item.columnIndex, option, optionTextElement);

    const editNodeText = (node, optionTextElement) =>
        openValueLabelEditor(
            node.columnIdOrHeading,
            node.columnIndex,
            {
                value: node.valueString,
                baseText: columnInfo.resolveBaseText(node.columnIdOrHeading, node.value)
            },
            optionTextElement
        );

    // Where the module lists the filters in effect (as Edit Groupings does), an item hidden with
    // its filter still applied would only be listed again, so removing it clears the filter too.
    const removingItemClearsFilter = () => s.visualisation.removingItemClearsFilter === true;

    // Also used by the cross button on each item's heading row.  Elsewhere the filter can be left
    // in effect without its item, so the user is asked whether it should go too.
    const removeFilterModuleItem = (item) => {

        const column = columnInfo.findEligibleColumn(item.columnIdOrHeading);
        if (!column) return;

        const filterClearer = filtering.createItemFilterClearer(item);

        if (removingItemClearsFilter()) filterClearer.clear();

        itemSettings.setColumnIncluded(column, false);

        if (!filterClearer.isFiltering()) return;

        Ren.PopupConfirm(
            "Filter module removed from page.  Clear the filter as well?",
            "Remove filter",
            filterClearer.clear
        );
    };

    // Gets a menu item that removes the item's own column from the module.
    const getRemoveColumnMenuItem = (item) => ({
        section: "Columns",
        text: removingItemClearsFilter() ? "Clear filter" : "Remove filter",
        id: "filter-module-remove-column",
        action: () => removeFilterModuleItem(item)
    });

    // Gets a menu item flipping the filter to name the values left out, so a value the data gains
    // later shows.  Offered while editing, as it is a statement about the report.
    const getExcludeFilterMenuItem = (item) => ({
        section: "Filter",
        text: "Filter excludes unticked values",
        id: "filter-module-exclude-filter",
        visible: () => includeWhenSaving.isReportBeingEdited()
            && filtering.canNegateFilter(item.columnIdOrHeading),
        ticked: () => filtering.isFilterNegated(item.columnIdOrHeading),
        action: () => filtering.toggleFilterNegated(item.columnIdOrHeading)
    });

    // Ticks are functions, as the submenu is built once.  Captions are the grid's headings, as an
    // item's own heading can name something else (a hierarchy parent's names the hierarchy).
    const buildAddColumnSubmenuItems = () =>
        s.eligibleColumns.map((column) => ({
            text: column.fallbackHeading,
            ticked: () => itemSettings.isColumnIncluded(column),
            id: "filter-module-add-column-" + column.columnIndex,
            action: () => itemSettings.toggleColumnInclusion(column)
        }));

    const getAddColumnMenuItem = () => ({
        section: "Columns",
        text: "Add filter",
        id: "filter-module-add-column",
        submenu: buildAddColumnSubmenuItems()
    });

    // Gets the hint link's toggle, offered in every "View settings" submenu, including the panel
    // menu's that a right-click on the hint opens.
    const getShowRightClickHintMenuItem = () => ({
        text: "Show right-click to add filters hint",
        id: "filter-module-show-right-click-hint",
        visible: () => !itemSettings.isRightClickHintAlwaysShown(),
        ticked: () => itemSettings.showRightClickHint(),
        action: () => itemSettings.toggleShowRightClickHint()
    });

    const getStackInColumnsMenuItem = () => ({
        section: "Other",
        text: "Stack filters in columns",
        id: "filter-module-stack-in-columns",
        ticked: () => itemSettings.isColumnFlow(),
        action: () => itemSettings.toggleColumnFlow()
    });

    // Builds a submenu ticking whichever of the options is set.  The first option, the default,
    // is set apart from the rest.
    const buildOptionSubmenu = (options, idPrefix, getValue, setValue) => {

        const submenu = options.map((option) => ({
            text: option.text,
            title: option.title,
            id: idPrefix + option.value,
            ticked: () => getValue() === option.value,
            action: () => setValue(option.value)
        }));

        submenu.splice(1, 0, Ren.MENU_SEPARATOR);

        return submenu;
    };

    // Offered on a hierarchy only, keyed on its leaf as the rest of its tree's state is.
    const getInitialExpansionMenuItem = (leafColumnIdOrHeading) => ({
        text: "Initial expansion",
        id: "filter-module-initial-expansion",
        title: "How the tree's options are expanded when the report is opened",
        submenu: buildOptionSubmenu(
            s.INITIAL_EXPANSION_OPTIONS,
            "filter-module-initial-expansion-",
            () => itemSettings.getInitialExpansion(leafColumnIdOrHeading),
            (value) => itemSettings.setInitialExpansion(leafColumnIdOrHeading, value)
        )
    });

    // Offered on a Boolean column's item only.
    const getShowAsCheckboxMenuItem = (columnIdOrHeading) => ({
        text: "Show as checkbox",
        id: "filter-module-show-as-checkbox",
        title: "Shows the item as a single checkbox beside its heading",
        submenu: buildOptionSubmenu(
            s.SHOW_AS_CHECKBOX_OPTIONS,
            "filter-module-show-as-checkbox-",
            () => itemSettings.getShowAsCheckbox(columnIdOrHeading),
            (value) => itemSettings.setShowAsCheckbox(columnIdOrHeading, value)
        )
    });
    // No sections, as submenus keep the order they are given.
    const buildViewSubmenuItems = (item) => {

        const columnIdOrHeading = item.columnIdOrHeading;

        // The value checkboxes and totals row of a hierarchy are read from its leaf.
        const leafColumnIdOrHeading = columnInfo.getLeafColumnIdOrHeading(item);

        // A hierarchy's menu item carries its tree's flag, a lone item's options theirs.
        const sortToggleChangesOrder = item.sortToggleChangesOrder === true
            || item.options?.sortToggleChangesOrder === true;

        const items = [
            {
                text: "Show single toggle",
                id: "filter-module-show-single-select-toggle",
                ticked: () => itemSettings.showSingleSelectToggle(columnIdOrHeading),
                action: () => itemSettings.toggleShowSingleSelectToggle(columnIdOrHeading)
            },
            {

                // Offered only where toggling it would reorder the options.
                text: "Show sort toggle",
                id: "filter-module-show-sort-toggle",
                visible: () => sortToggleChangesOrder,
                ticked: () => itemSettings.showSortToggle(leafColumnIdOrHeading),
                action: () => itemSettings.toggleShowSortToggle(leafColumnIdOrHeading)
            },
            {

                // Lets single-select be used without the toggle above being shown.
                text: "Single select mode",
                id: "filter-module-single-select-mode",
                ticked: () => itemSettings.isSingleSelect(columnIdOrHeading),
                action: () => itemSettings.toggleSingleSelect(columnIdOrHeading)
            },
            {
                text: "Show compare filter",
                id: "filter-module-show-compare-filter",

                // Offered only while compare filters are switched on centrally.
                visible: () =>
                    Ren.CompareFilterControl.isEnabled() && filterTarget.supportsCompareFilters,
                ticked: () => itemSettings.showCompareFilter(columnIdOrHeading),
                action: () => itemSettings.toggleShowCompareFilter(columnIdOrHeading)
            },
            {

                // Hidden by default, so binning is only offered where asked for.
                text: "Show \"+binning function\"",
                id: "filter-module-show-binning-function-link",
                ticked: () => itemSettings.showBinningFunctionLink(columnIdOrHeading),
                action: () => itemSettings.toggleShowBinningFunctionLink(columnIdOrHeading)
            },
            Ren.MENU_SEPARATOR,
            {
                text: "Show value checkboxes",
                id: "filter-module-show-value-checkboxes",
                ticked: () => itemSettings.showValueCheckboxes(leafColumnIdOrHeading),
                action: () => itemSettings.toggleShowValueCheckboxes(leafColumnIdOrHeading)
            },
            {
                text: "Show \"All\" checkbox",
                id: "filter-module-show-all-checkbox",
                ticked: () => itemSettings.showAllCheckbox(columnIdOrHeading),
                action: () => itemSettings.toggleShowAllCheckbox(columnIdOrHeading)
            },
            {
                text: "Show option totals",
                id: "filter-module-show-option-totals",
                ticked: () => itemSettings.showOptionTotals(columnIdOrHeading),
                action: () => itemSettings.toggleShowOptionTotals(columnIdOrHeading)
            },
            {
                text: "Show total",
                id: "filter-module-show-total",
                ticked: () => itemSettings.showTotal(leafColumnIdOrHeading),
                action: () => itemSettings.toggleShowTotal(leafColumnIdOrHeading)
            },
            {
                text: "Show border",
                id: "filter-module-show-border",
                title: "Shows the border around the item.  Hidden, it still takes up its room, so "
                    + "the item stays where it is.",
                ticked: () => itemSettings.showBorder(leafColumnIdOrHeading),
                action: () => itemSettings.toggleShowBorder(leafColumnIdOrHeading)
            },
            {
                text: "Show heading in bold",
                id: "filter-module-show-heading-in-bold",
                ticked: () => itemSettings.showHeadingInBold(leafColumnIdOrHeading),
                action: () => itemSettings.toggleShowHeadingInBold(leafColumnIdOrHeading)
            },
            Ren.MENU_SEPARATOR,
            {
                text: "Filter heading tooltip...",
                id: "filter-module-filter-heading-tooltip",
                title: "Sets the tooltip shown on hovering the item's heading",
                ticked: () => itemSettings.getFilterHeadingTooltip(leafColumnIdOrHeading) !== "",
                action: () => openFilterHeadingTooltipEditor(leafColumnIdOrHeading)
            }
        ];

        // Added with its separator only on a hierarchy, so a flat item has no empty group.
        if (item.groupByLeafColumnIdOrHeading != null) {

            items.push(Ren.MENU_SEPARATOR);
            items.push(getInitialExpansionMenuItem(leafColumnIdOrHeading));
        }

        if (item.isBoolean === true) {

            items.push(Ren.MENU_SEPARATOR);
            items.push(getShowAsCheckboxMenuItem(columnIdOrHeading));
        }

        // The hint belongs to the module rather than the item, so is set apart from the rest.
        items.push(Ren.MENU_SEPARATOR);
        items.push(getShowRightClickHintMenuItem());

        return items;
    };

    // Gets the "View settings" menu item, whose section is sorted to the top of the menu.  It
    // replaces the panel menu's, which shares its ID.
    const getViewMenuItem = (item) => ({
        section: "View settings",
        text: "View settings",
        id: "filter-module-view",
        submenu: buildViewSubmenuItems(item)
    });

    // Gets the panel menu's "View settings" menu item, where there is no item to set.
    const getPanelViewMenuItem = () => ({
        section: "View settings",
        text: "View settings",
        id: "filter-module-view",
        submenu: [getShowRightClickHintMenuItem()]
    });

    // Gets a value indicating whether an aggregation orders by its "with respect to" column rather
    // than deduplicating by it, as only First, Last and Median do.
    const usesWithRespectToAsOrdering = (aggregationType) =>
        aggregationType === "First" || aggregationType === "Last" || aggregationType === "Median";

    // Gets the "with respect to" text, which says so where the column is an ordering.
    const getWithRespectToText = (aggregationType) =>
        usesWithRespectToAsOrdering(aggregationType)
            ? "with respect to (ordered by)"
            : "with respect to";

    // Row Count is left out, as it is the module's helper column with nothing to deduplicate or
    // order by.  The aggregation is read on each render, so "None" states which meaning applies.
    const buildWithRespectToSubmenuItems = (getAggregationType, isTicked, setColumn) => {

        const items = [
            {
                text: () => usesWithRespectToAsOrdering(getAggregationType())
                    ? "None (row order)"
                    : "None",
                ticked: () => isTicked(null),
                action: () => setColumn(null)
            },
            Ren.MENU_SEPARATOR
        ];

        const sortableColumns = s.sortableColumns;

        for (let i = 0; i < sortableColumns.length; i++) {

            const withRespectToColumn = sortableColumns[i];

            if (withRespectToColumn.columnIdOrHeading === COUNT_COLUMN_HEADING) continue;

            items.push({
                text: withRespectToColumn.heading,
                ticked: () => isTicked(withRespectToColumn.columnIdOrHeading),
                action: () => setColumn(withRespectToColumn.columnIdOrHeading)
            });
        }

        return items;
    };

    // A grouping-level module also offers "Group Count", its default, so it can be picked again.
    const buildValueColumnSubmenuItems = (item) => {

        const items = [];
        const sortableColumns = s.sortableColumns;

        if (filterTarget.isGroupingTarget) {

            items.push({
                text: "Group Count",
                id: "filter-module-value-group-count",
                ticked: () => itemSettings.isValueGroupCount(item.columnIdOrHeading),
                action: () => itemSettings.setValueToGroupCount(item.columnIdOrHeading)
            });
        }

        for (let i = 0; i < sortableColumns.length; i++) {

            const valueColumn = sortableColumns[i];

            items.push({
                text: valueColumn.heading,
                id: "filter-module-value-column-" + valueColumn.columnIndex,
                ticked: () =>
                    itemSettings.isValueColumn(
                        item.columnIdOrHeading,
                        valueColumn.columnIdOrHeading
                    ),
                action: () =>
                    itemSettings.setValueColumn(
                        item.columnIdOrHeading,
                        valueColumn.columnIdOrHeading
                    )
            });
        }

        return items;
    };

    const getValueColumnMenuItem = (item) => ({
        section: "Values",
        text: "Value column",
        id: "filter-module-value-column",
        submenu: buildValueColumnSubmenuItems(item)
    });

    // Gets the value aggregation menu item, which takes effect once a value column is chosen, as
    // the row count fallback is always a count.
    const getValueAggregationMenuItem = (item) => ({
        section: "Values",
        text: "Value aggregation",
        id: "filter-module-value-aggregation",
        submenu: SORT_AGGREGATION_TYPES.map((aggregationType) => ({
            text: AGGREGATION_MENU_LABELS[aggregationType] ?? aggregationType,
            ticked: () =>
                itemSettings.isValueAggregationType(item.columnIdOrHeading, aggregationType),
            action: () =>
                itemSettings.setValueAggregationType(item.columnIdOrHeading, aggregationType)
        }))
    });

    const getValueWithRespectToMenuItem = (item) => ({
        section: "Values",
        text: () => getWithRespectToText(
            itemSettings.getValueAggregationType(item.columnIdOrHeading)
        ),
        id: "filter-module-value-with-respect-to",
        submenu: buildWithRespectToSubmenuItems(
            () => itemSettings.getValueAggregationType(item.columnIdOrHeading),
            (withRespectToColumn) => itemSettings.isValueAggregateWithRespectToColumn(
                item.columnIdOrHeading,
                withRespectToColumn
            ),
            (withRespectToColumn) => itemSettings.setValueAggregateWithRespectToColumn(
                item.columnIdOrHeading,
                withRespectToColumn
            )
        )
    });

    // Gets the totals-row aggregation menu item, independent of the value aggregation so options
    // can average while the total sums.  Keyed on a hierarchy's leaf, so any node can configure it.
    const getTotalAggregationMenuItem = (item) => {

        const columnIdOrHeading = columnInfo.getLeafColumnIdOrHeading(item);
        const aggregationTypes = ["None"].concat(SORT_AGGREGATION_TYPES);

        return {
            section: "Total value",
            text: "Total aggregation",
            id: "filter-module-total-aggregation",
            submenu: aggregationTypes.map((aggregationType) => ({
                text: aggregationType === "None"
                    ? "None"
                    : AGGREGATION_TITLE_LABELS[aggregationType] ?? aggregationType,
                ticked: () => itemSettings.isTotalAggregationType(columnIdOrHeading, aggregationType),
                action: () => itemSettings.setTotalAggregationType(columnIdOrHeading, aggregationType)
            }))
        };
    };

    // Gets the totals-row "with respect to" menu item, keyed on the same column as the total
    // aggregation so the two are read and written together.
    const getTotalWithRespectToMenuItem = (item) => {

        const columnIdOrHeading = columnInfo.getLeafColumnIdOrHeading(item);

        return {
            section: "Total value",
            text: () => getWithRespectToText(
                itemSettings.getTotalAggregationType(columnIdOrHeading)
            ),
            id: "filter-module-total-with-respect-to",
            submenu: buildWithRespectToSubmenuItems(
                () => itemSettings.getTotalAggregationType(columnIdOrHeading),
                (withRespectToColumn) => itemSettings.isTotalAggregateWithRespectToColumn(
                    columnIdOrHeading,
                    withRespectToColumn
                ),
                (withRespectToColumn) => itemSettings.setTotalAggregateWithRespectToColumn(
                    columnIdOrHeading,
                    withRespectToColumn
                )
            )
        };
    };

    // Gets a column's own format, so only the menu items suiting its values are offered.
    const getColumnFormat = (columnIdOrHeading) =>
        columnInfo.findEligibleColumn(columnIdOrHeading)?.columnModel?.ColumnFormat
            ?? Ren.SpreadsheetColumnFormatEnum.General;

    // Gets any hand-written (raw string) spec, to prefill the "Custom" function editor.
    const getCustomSpec = (columnIdOrHeading, overrideField) => {

        const specs = columnOverrides[columnIdOrHeading]?.[overrideField];
        const firstSpec = Array.isArray(specs) ? specs[0] : null;

        return typeof firstSpec === "string" ? firstSpec : "";
    };

    // The module keeps a format per column, so the menu's columnIndex and rowIndex are ignored.
    const setColumnOverrideFormatFunction = (
        columnIdOrHeading, overrideField, formatFunctionSpec
    ) => {

        const entry = itemSettings.getOrCreateColumnOverride(columnIdOrHeading);

        entry[overrideField] = Ren.ArrayUtils.ensureArray(formatFunctionSpec);

        view.render();
    };

    const openCustomFormatEditor = (columnIdOrHeading, overrideField) => {

        Ren.Messages.Requests.functionEditorWindow.notify(
            () => getCustomSpec(columnIdOrHeading, overrideField),
            (customCode) =>
                setColumnOverrideFormatFunction(columnIdOrHeading, overrideField, customCode),
            null,
            null,
            { centred: true, autoComplete: { tabularData: s.tabularData, paras: s.paras } }
        );
    };

    // Builds a format menu item for one of a column's format functions, with "Custom..." added.
    // getFormatSpecs reads the format in force, so its item is ticked.  The properties given
    // override those of the shared formatting menu's item.
    const buildFormatMenuItem = (
        item,
        overrideField,
        getFormatSpecs,
        columnFormat,
        formattingOptions,
        customItemId,
        properties
    ) => {

        const formatMenuItems = Ren.ContextMenuItems_Formatting(
            (_columnIndex, _rowIndex, formatFunctionSpec) =>
                setColumnOverrideFormatFunction(
                    item.columnIdOrHeading,
                    overrideField,
                    formatFunctionSpec
                ),
            Object.assign({}, formattingOptions, {
                getFormatFunction: () => getFormatSpecs(item.columnIdOrHeading)
            })
        ).getMenuItems(item.columnIndex, null, null, columnFormat);

        const customItem = {
            text: "Custom...",
            id: customItemId,
            ticked: () => !!getCustomSpec(item.columnIdOrHeading, overrideField),
            action: () => openCustomFormatEditor(item.columnIdOrHeading, overrideField)
        };

        return Object.assign({}, formatMenuItems[0], properties, {
            submenu: formatMenuItems[0].submenu.concat([Ren.MENU_SEPARATOR, customItem])
        });
    };

    // Gets the "Value format" menu item, offered against the Number format as the value is numeric.
    const getFormatMenuItem = (item) => buildFormatMenuItem(
        item,
        "valueFormatFunction",
        (columnIdOrHeading) => columnInfo.getValueFormatFunctionSpecs(columnIdOrHeading),
        Ren.SpreadsheetColumnFormatEnum.Number,
        NOT_A_GRID,
        "filter-module-value-format-custom",
        { section: "Values", text: "Value format" }
    );

    // Gets the "Label format" menu item for the right-clicked level rather than the leaf, as each
    // level has its own labels.
    const getLabelFormatMenuItem = (item) => buildFormatMenuItem(
        item,
        "labelFormatFunction",
        (columnIdOrHeading) => columnInfo.getLabelFormatFunctionSpecs(columnIdOrHeading),
        getColumnFormat(item.columnIdOrHeading),
        NO_SUMMARY_STATS,
        "filter-module-label-format-custom",
        { section: "Labels", text: "Label format", id: "filter-module-label-format" }
    );

    // "None" is stored as an explicit null, so re-adding the column doesn't copy it from the grid.
    const setLabelCalcFunction = (columnIdOrHeading, calcFunctionSpec) => {

        const entry = itemSettings.getOrCreateColumnOverride(columnIdOrHeading);

        const specs = Ren.ArrayUtils.ensureArray(calcFunctionSpec)
            .filter((spec) => spec?.name !== "default");

        entry.labelCalcFunction = specs.length ? specs : null;

        view.render();
    };

    const getLabelCalculationMenuItem = (item) => {

        const calculationMenuItems = Ren.ContextMenuItems_Calculation(
            () =>
                columnOverrides[item.columnIdOrHeading]?.labelCalcFunction ?? null,
            (_columnIndex, _rowIndex, calcFunctionSpec) =>
                setLabelCalcFunction(item.columnIdOrHeading, calcFunctionSpec),
            s.tabularData
        ).getMenuItems(item.columnIndex, null, null, getColumnFormat(item.columnIdOrHeading));

        return Object.assign({}, calculationMenuItems[0], {
            section: "Labels",
            text: "Label calculation",
            id: "filter-module-label-calculation"
        });
    };

    // Gets the value's column and aggregation as a "Sort by" choice, by default Row Count summed.
    // A group-counting item names no column, leaving the options ordered by their count.
    const getValueSortChoice = (columnIdOrHeading) => {

        if (itemSettings.isValueGroupCount(columnIdOrHeading)) return {
            column: null,
            aggregationType: null
        };

        const valueConfig = itemSettings.getValueConfig(columnIdOrHeading);

        return {
            column: valueConfig.column ?? COUNT_COLUMN_HEADING,
            aggregationType: valueConfig.aggregationType ?? "Sum"
        };
    };

    // Independent of the "Default" value sort, which sorts by the raw values instead.
    const sortByCurrentValueConfig = (columnIdOrHeading, descending) => {

        const sortChoice = getValueSortChoice(columnIdOrHeading);

        itemSettings.setSortBy(
            columnIdOrHeading,
            sortChoice.column,
            sortChoice.aggregationType,
            descending
        );
    };

    // Gets a value indicating whether the options are sorted by their value in the given direction.
    const isSortedByCurrentValueConfig = (columnIdOrHeading, descending) => {

        const sortChoice = getValueSortChoice(columnIdOrHeading);

        return itemSettings.isSortedBy(
            columnIdOrHeading,
            sortChoice.column,
            sortChoice.aggregationType,
            descending
        );
    };

    // Forces ascending, whatever "Flip sort order" left behind.
    const setSortByLabelAscending = (columnIdOrHeading) => {

        const entry = itemSettings.getOrCreateColumnOverride(columnIdOrHeading);

        entry.sortByValue = true;
        delete entry.sortValueDescending;

        counts.invalidateCountsForColumn(columnIdOrHeading);
        view.render();
    };

    const getSortByLabelMenuItem = (item) => ({
        section: "Sort",
        text: "Sort by label",
        id: "filter-module-sort-by-label",
        ticked: () => itemSettings.isSortedByValue(item.columnIdOrHeading)
            && !itemSettings.getSortConfig(item.columnIdOrHeading).descending,
        action: () => setSortByLabelAscending(item.columnIdOrHeading)
    });

    const getSortByValueMenuItem = (item) => ({
        section: "Sort",
        text: "Sort by value",
        id: "filter-module-sort-by-value",
        ticked: () => isSortedByCurrentValueConfig(item.columnIdOrHeading, true),
        action: () => sortByCurrentValueConfig(item.columnIdOrHeading, true)
    });

    const getFlipSortOrderSeparator = () => ({
        section: "Sort",
        text: "-"
    });

    // Gets the "Flip sort order" item, a one-shot action rather than a tickable setting.
    const getFlipSortOrderMenuItem = (item) => ({
        section: "Sort",
        text: "Flip sort order",
        id: "filter-module-flip-sort-order",
        action: () => itemSettings.flipSortOrder(item.columnIdOrHeading)
    });

    // The "Values" items are always included, as a hidden value would leave them unreachable from
    // a right-click on it.  Sections supply the dividers, bar the one within "Sort".
    const buildColumnActionMenuItems = (
        item, includeAddColumn, includeLabelsItems, includeTotalValueItems
    ) => {

        const items = [
            getViewMenuItem(item),
            getValueColumnMenuItem(item),
            getValueAggregationMenuItem(item),
            getValueWithRespectToMenuItem(item),
            getFormatMenuItem(item)
        ];

        if (includeTotalValueItems) {

            items.push(getTotalAggregationMenuItem(item), getTotalWithRespectToMenuItem(item));
        }

        if (includeLabelsItems) {

            items.push(getLabelFormatMenuItem(item), getLabelCalculationMenuItem(item));
        }

        items.push(
            getSortByLabelMenuItem(item),
            getSortByValueMenuItem(item),
            getFlipSortOrderSeparator(),
            getFlipSortOrderMenuItem(item)
        );

        if (includeAddColumn) items.push(getAddColumnMenuItem());

        items.push(
            includeWhenSaving.getMenuItem(item),
            getExcludeFilterMenuItem(item),
            getRemoveColumnMenuItem(item)
        );

        if (includeAddColumn) items.push(getStackInColumnsMenuItem());

        return items.concat(grouping.getGroupingMenuItems(item));
    };

    return {
        openColumnHeadingEditor,
        openAllLabelEditor,
        editOptionText,
        editNodeText,
        getAddColumnMenuItem,
        getPanelViewMenuItem,
        getStackInColumnsMenuItem,
        buildColumnActionMenuItems,
        removingItemClearsFilter,
        removeFilterModuleItem
    };
};
