/**
 * Helper functions for creating column filter-related menu items.
 * Used by both context menu and header cell down arrow renderer.
 */
Ren.ColumnFilterMenuItemsHelper = (
    tabularData, visualisation, dataGroupingSettings, sortFilterGroup
) => {

    const showFilterDataRowsWindow = (columnIdOrHeading, anchorElement) =>
        Ren.ColumnFilterSelectorWindow.showColumnFilterDataRowsWindow(
            visualisation,
            dataGroupingSettings,
            columnIdOrHeading,
            anchorElement
        );

    const showFilterGroupsWindow = (columnIdOrHeading, anchorElement) =>
        Ren.ColumnFilterSelectorWindow.showColumnFilterGroupsWindow(
            tabularData,
            visualisation,
            dataGroupingSettings,
            columnIdOrHeading,
            anchorElement
        );

    const hasGroupings = () => dataGroupingSettings.groupings.numGroupings() > 0;

    const getDefaultFilterType = (columnIdOrHeading) =>
        Ren.DataGroupingSettingsColumnMenus.getDefaultFilterType(
            tabularData,
            dataGroupingSettings.columnMenus,
            columnIdOrHeading
        );

    // Without groupings there are no groups to filter, so data rows are filtered instead.
    const showDefaultFilterWindow = (columnIdOrHeading, anchorElement) => {

        if (getDefaultFilterType(columnIdOrHeading) === Ren.DefaultFilterTypeEnum.Groups &&
            hasGroupings()) {

            showFilterGroupsWindow(columnIdOrHeading, anchorElement);
        }
        else {

            showFilterDataRowsWindow(columnIdOrHeading, anchorElement);
        }
    };

    const createFilterDataRowsMenuItem = (columnIdOrHeading, anchorElement) => ({
        section: "Filter",
        text: "Filter data rows...",
        id: "show-column-filter-data-rows-window-menu-item",
        action: () => showFilterDataRowsWindow(columnIdOrHeading, anchorElement)
    });

    const createFilterGroupsMenuItem = (columnIdOrHeading, anchorElement) => ({
        section: "Filter",
        text: "Filter groups...",
        id: "show-column-filter-groups-window-menu-item",
        visible: hasGroupings,
        action: () => showFilterGroupsWindow(columnIdOrHeading, anchorElement)
    });

    const createFilterMenuItem = (columnIdOrHeading, anchorElement) => ({
        section: "Filter",
        text: "Filter...",
        id: "show-column-default-filter-window-menu-item",
        action: () => showDefaultFilterWindow(columnIdOrHeading, anchorElement)
    });

    const createSetDefaultFilterTypeMenuItem = (columnIdOrHeading, text, id, defaultFilterType) => ({
        text,
        id,
        ticked: () => getDefaultFilterType(columnIdOrHeading) === defaultFilterType,
        action: () => Ren.DataGroupingSettingsColumnMenus.setDefaultFilterType(
            dataGroupingSettings.columnMenus,
            columnIdOrHeading,
            defaultFilterType
        )
    });

    const createMoreFilterOptionsMenuItem = (
        columnIdOrHeading, anchorElement, multiLevelFilterMenuItem
    ) => ({
        section: "Filter",
        text: "Advanced filter",
        id: "more-filter-options-menu-item",
        submenu: [
            {
                text: "Filter data rows",
                id: "more-filter-options-filter-data-rows-menu-item",
                action: () => showFilterDataRowsWindow(columnIdOrHeading, anchorElement)
            },
            {
                text: "Filter groups",
                id: "more-filter-options-filter-groups-menu-item",
                visible: hasGroupings,
                action: () => showFilterGroupsWindow(columnIdOrHeading, anchorElement)
            },
            Ren.MENU_SEPARATOR,
            // Unsectioned, as a section of its own would give the submenu section headings.
            Object.assign({}, multiLevelFilterMenuItem, { section: undefined }),
            Ren.MENU_SEPARATOR,
            {
                text: "Default filter",
                id: "set-default-filter-type-menu-item",
                submenu: [
                    createSetDefaultFilterTypeMenuItem(
                        columnIdOrHeading,
                        "Data rows",
                        "set-default-filter-type-data-rows-menu-item",
                        Ren.DefaultFilterTypeEnum.DataRows
                    ),
                    createSetDefaultFilterTypeMenuItem(
                        columnIdOrHeading,
                        "Groups",
                        "set-default-filter-type-groups-menu-item",
                        Ren.DefaultFilterTypeEnum.Groups
                    )
                ]
            }
        ]
    });

    /**
     * Creates the "Clear column filter" item.  Given a grouping, it clears that level's filter on
     * the column alone, as on a group row's cell; otherwise the column's filters at every level.
     */
    const createClearColumnFilterMenuItem = (columnIdOrHeading, grouping) => {

        if (!grouping) {

            return {
                section: "Filter",
                text: "Clear column filter",
                id: "clear-column-filter-menu-item",
                visible: () => dataGroupingSettings.hasColumnFilter(columnIdOrHeading),
                className: "qa-ren-clear-column-filter-menu-item",
                actionParameters: [columnIdOrHeading],
                action: sortFilterGroup.removeColumnFilter
            };
        }

        return {
            section: "Filter",
            text: "Clear column filter",
            id: "clear-column-filter-menu-item",
            visible: () => Ren.DataGroupingSettings_Services_HasFilter.hasGroupingColumnFilter(
                tabularData,
                grouping,
                columnIdOrHeading
            ),
            className: "qa-ren-clear-column-filter-menu-item",
            action: () => sortFilterGroup.clearGroupingColumnFilter(grouping, columnIdOrHeading)
        };
    };

    const createClearAllFiltersMenuItem = () => ({
        section: "Filter",
        text: "Clear all filters",
        id: "remove-all-column-filters",
        action: sortFilterGroup.unfilter
    });

    const createClearAllColumnFiltersMenuItem = () => ({
        section: "Filter",
        text: "Clear all column filters",
        id: "clear-all-column-filters-menu-item",
        action: sortFilterGroup.removeAllColumnFilters
    });

    // Sectioned so that a sorted root menu keeps it among the filter items rather than sorting it
    // to the top, where it would be dropped.
    const createColumnFilterSeparatorMenuItem = () => ({
        section: "Filter",
        text: "-"
    });

    return {
        createFilterDataRowsMenuItem,
        createFilterGroupsMenuItem,
        createFilterMenuItem,
        createMoreFilterOptionsMenuItem,
        createColumnFilterSeparatorMenuItem,
        createClearColumnFilterMenuItem,
        createClearAllColumnFiltersMenuItem,
        createClearAllFiltersMenuItem
    };
};
