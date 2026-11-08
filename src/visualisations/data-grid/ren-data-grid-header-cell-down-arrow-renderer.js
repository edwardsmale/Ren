/**
 * Creates the elements needed for the down arrow buttons in data grid header cells and their
 * context menus.
 */
Ren.DataGridCellRenderer_HeaderCellDownArrowRenderer = (
    tabularData,
    visualisation,
    dataGroupingSettings) => {

    const columnSortingMenuItems = Ren.ContextMenuItems_ColumnSorting(
        tabularData,
        dataGroupingSettings
    );

    const columnFilterMenuItemsHelper = Ren.ColumnFilterMenuItemsHelper(
        tabularData,
        visualisation,
        dataGroupingSettings,
        dataGroupingSettings.sortFilterGroup
    );

    const groupingSettingsEditorMenuItemHelper = Ren.GroupingSettingsEditorMenuItemHelper(
        visualisation,
        dataGroupingSettings
    );

    const columnStylingMenuItems =
        Ren.ContextMenuItems_ColumnStyling(dataGroupingSettings, tabularData);

    const createHeaderCellDownArrowButton = (columnIndex) => {

        const columnIdOrHeading = tabularData.columnResolver.getColumnIdOrHeading(columnIndex);

        const downArrowButton = Ren.HtmlUtils.create("button")
            ._addClass(
                "ren-data-grid__header-cell-down-arrow-button",
                "qa-ren-down-arrow-button"
            )
            ._text("🢓");

        const downArrowContainer = Ren.HtmlUtils.create("div")
            ._addClass("ren-data-grid__header-cell-down-arrow-button-container")
            ._append(downArrowButton);

        // Items are shown in the order they are written here, within the sections they name, so
        // the column's own sorts lead the "Sort" section and "Multi-level sort..." closes it.
        const menuItems = columnSortingMenuItems.getMenuItems(columnIndex);

        menuItems.push(
            groupingSettingsEditorMenuItemHelper.createMultiLevelSortMenuItem(downArrowButton),
            columnFilterMenuItemsHelper.createFilterMenuItem(columnIdOrHeading, downArrowButton),
            columnFilterMenuItemsHelper.createMoreFilterOptionsMenuItem(
                columnIdOrHeading,
                downArrowButton,
                groupingSettingsEditorMenuItemHelper.createMultiLevelFilterMenuItem(downArrowButton)
            ),
            groupingSettingsEditorMenuItemHelper.createEditAllFiltersMenuItem(downArrowButton),
            columnFilterMenuItemsHelper.createColumnFilterSeparatorMenuItem(),
            columnFilterMenuItemsHelper.createClearColumnFilterMenuItem(columnIdOrHeading),
            columnFilterMenuItemsHelper.createClearAllColumnFiltersMenuItem(),
            columnFilterMenuItemsHelper.createClearAllFiltersMenuItem(),
            groupingSettingsEditorMenuItemHelper.createEditGroupingsMenuItem(downArrowButton),
            columnStylingMenuItems.getMenuItem(columnIndex)
        );

        Ren.AddButtonMenuItems(downArrowButton, menuItems);

        return downArrowContainer;
    };

    return {
        createHeaderCellDownArrowButton
    };
};
