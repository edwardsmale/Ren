Ren.ColumnFilterSelectorWindow = (() => {

    /**
     * Shows a Filter Module popup beside a column heading, holding the single item for that column
     * and driving the source grid's filter named by filterTarget.
     */
    const showFilterModuleWindow = (
        sourceVisualisation,
        columnIdOrHeading,
        anchorElement,
        filterTarget
    ) => {

        // For a grid set, the settings group is the active grid's own, not the set's outer group.
        const source = Ren.DataGroupingSettingsSource.fromVisualisation(sourceVisualisation);

        const rect = anchorElement.getBoundingClientRect();

        Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "FilterModule",
            popupIcon: "filter-icon.png",
            // The module's own item names the column, so the title bar just reads "Filter".
            popupTitle: "Filter",
            dataSourceUri: sourceVisualisation.dataSourceUri,
            sqlFilename: sourceVisualisation.sqlFilename,
            // So that columns the source grid added, such as a duplicated column, are there too.
            tabularDataTransformers: sourceVisualisation.tabularDataTransformers,
            // Resolved live each render, as a data reload replaces the settings the menu was opened
            // against.
            sourceDataGroupingSettingsGroup: source.dataGroupingSettingsGroup,
            sourceVisualisation,
            dataTabIndex: source.dataTabIndex,
            dataTabGroup: source.dataTabGroup,

            // Omitted for the data rows, which is the module's default.
            filterTarget,

            // The popup is where a single column is filtered in earnest, so its compare-filter
            // strip and binning function link start out shown.
            columnOverrides: {

                [columnIdOrHeading]: {
                    included: true,
                    showCompareFilter: true,
                    showBinningFunctionLink: true
                }
            },

            // The item's labels start out formatted as the data rows or targeted grouping level
            // format the column.
            initLabelFunctionsFromSource: true,

            // Opened for one column, so it doesn't advertise adding further columns.
            showRightClickHint: false,
            isPopup: true,
            fillAvailableSpace: true,
            resizeToFitContentOnLoad: true,
            verticalScrollbar: true,
            // Cap the popup's initial width; the user can drag wider afterwards.
            initialMaxWidth: 1000,
            maxHeight: "calc(100% - 22px)",
            popupLeft: Math.round(rect.right + 4), // 4px gap to the right.
            popupTop: Math.round(rect.top)
        });
    };

    /**
     * Shows the "Column Filter..." popup for a data grid column: a filter module filtering the data
     * rows, which removes rows before anything is aggregated.
     */
    const showColumnFilterDataRowsWindow = (
        sourceVisualisation,
        _sourceDataGroupingSettings,
        columnIdOrHeading,
        anchorElement
    ) => {

        showFilterModuleWindow(sourceVisualisation, columnIdOrHeading, anchorElement, undefined);
    };

    /**
     * Gets the columns a grouping level adds over its parent, which name it in a filter target.
     * groupByColumnIndexes are cumulative, so these are the difference from the next entry out's.
     */
    const getOwnGroupByColumns = (tabularData, entries, entryIndex) => {

        const columnIndexes = entries[entryIndex].groupByColumnIndexes ?? [];
        const parentColumnIndexes = entries[entryIndex + 1]?.groupByColumnIndexes ?? [];
        const parentColumnIndexSet = new Set(parentColumnIndexes);
        const columns = [];

        for (let i = 0; i < columnIndexes.length; i++) {

            if (parentColumnIndexSet.has(columnIndexes[i])) continue;

            const column = tabularData.columnResolver.getColumnIdOrHeading(columnIndexes[i]);

            if (column != null) columns.push(column);
        }

        return columns;
    };

    /**
     * Shows the "Filter groups..." popup for a data grid column: the filter module pointed at the
     * outermost grouping beneath the totals row, deciding which of its groups are shown.
     */
    const showColumnFilterGroupsWindow = (
        tabularData,
        sourceVisualisation,
        sourceDataGroupingSettings,
        columnIdOrHeading,
        anchorElement
    ) => {

        // Entries run innermost first, so the one before the totals row is the level wanted.  The
        // settings may have lost that level since the menu item was shown.
        const entries = sourceDataGroupingSettings?.groupings?.entries ?? [];
        const entryIndex = entries.length - 2;

        if (entryIndex < 0) return;

        // An empty list would name the totals row, so a level with no columns of its own isn't
        // opened.
        const groupByColumns = getOwnGroupByColumns(tabularData, entries, entryIndex);

        if (groupByColumns.length === 0) return;

        const filterTarget = {
            level: "grouping",
            groupByColumns
        };

        showFilterModuleWindow(sourceVisualisation, columnIdOrHeading, anchorElement, filterTarget);
    };

    Ren.Messages.Requests.columnFilterSelectorWindow.handle((
        visualisation,
        dataGroupingSettings,
        columnIdOrHeading,
        anchorElement
    ) => {

        showColumnFilterDataRowsWindow(
            visualisation,
            dataGroupingSettings,
            columnIdOrHeading,
            anchorElement
        );
    });

    return {
        showColumnFilterDataRowsWindow,
        showColumnFilterGroupsWindow
    };
})();
