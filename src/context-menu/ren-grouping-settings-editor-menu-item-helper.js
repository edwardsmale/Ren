/**
 * Functions for opening the groupings settings editor from a menu item.  Used by both the grouping
 * submenu and the header cell down arrow renderer.
 */
Ren.GroupingSettingsEditorMenuItemHelper = (visualisation, dataGroupingSettings) => {

    /**
     * Opens the groupings editor.
     */
    const openGroupingSettingsEditor = (triggeringElement, editorOptions) => {

        // Used to derive a concrete data source / tab for the editor.
        const runtimeDataGroupingSettings = dataGroupingSettings || null;

        // Try to get tabularData for the runtimeDataGroupingSettings so we can infer dataSourceUri
        // and tab index/group.  Fall back to visualisation values if not available.
        let dataSourceUri = visualisation.dataSourceUri;
        let sqlFilename = visualisation.sqlFilename;
        let dataTabIndexes = visualisation.dataTabIndexes ?? visualisation.dataTabIndex;

        try {

            if (runtimeDataGroupingSettings?.tabularDataGuid) {

                const tabularData = Ren.TabularDataPool.getByTabularDataGuid(
                    runtimeDataGroupingSettings.tabularDataGuid
                );

                if (tabularData) {

                    dataSourceUri = tabularData.DataSourceUri || tabularData.dataSourceUri || dataSourceUri;
                    sqlFilename = tabularData.SqlFilename || tabularData.sqlFilename || sqlFilename;
                    dataTabIndexes = [tabularData.dataTabIndex ?? tabularData.DataTabIndex ?? 1];
                }
            }
        }
        catch (e) {

            // The visualisation's values are used instead.
        }

        const dataGroupingSettingsGroup = runtimeDataGroupingSettings?.dataGroupingSettingsGroup ??
            visualisation.dataGroupingSettingsGroup;

        const rect = triggeringElement.getBoundingClientRect();
        const popupLeft = Math.round(rect.left + 40);
        const popupTop = Math.round(rect.top + 20);

        const options = {
            dataSourceUri,
            sqlFilename,
            visualisationTypeName: "DataGroupingSettingsEditor",
            sourceVisualisation: visualisation,
            dataGroupingSettingsGroup: dataGroupingSettingsGroup,
            dataTabIndexes: dataTabIndexes ? Ren.ArrayUtils.ensureArray(dataTabIndexes) : undefined,
            tabularDataTransformers: visualisation.tabularDataTransformers,
            popupTitle: "Edit Groupings",
            tilesExpandedInitially: true,
            isPopup: true,
            popupWidth: 640,
            popupLeft,
            popupTop
        };

        Object.assign(options, editorOptions);

        Ren.VisualisationCreator.createVisualisation(options);
    };

    const createEditGroupingsMenuItem = (anchorElement) => ({
        section: "Group",
        text: "Edit groupings...",
        id: "edit-groupings-menu-item",
        action: () => openGroupingSettingsEditor(anchorElement)
    });

    const openMultiLevelSortEditor = (anchorElement) => {

        openGroupingSettingsEditor(anchorElement, {
            popupTitle: "Multi-level sort",
            editorSections: ["sort"],
            tilesExpandedInitially: true,
            sectionsExpandedInitially: true,
            editControlsRevealedInitially: true
        });
    };

    const createMultiLevelSortMenuItem = (anchorElement) => ({
        section: "Sort",
        text: "Multi-level sort...",
        id: "multi-level-sort-menu-item",
        action: () => openMultiLevelSortEditor(anchorElement)
    });

    // With an expandedTileKey (an entry index, or "dataRows"), only that level's tile starts open,
    // its filter module showing includedColumnKey's item whether or not it is filtered there.
    const openMultiLevelFilterEditor = (anchorElement, expandedTileKey, includedColumnKey) => {

        openGroupingSettingsEditor(anchorElement, {
            popupTitle: "Multi-level filter",
            editorSections: ["groupFilters"],
            tilesExpandedInitially: true,
            sectionsExpandedInitially: true,
            expandedTileKey: expandedTileKey == null ? undefined : String(expandedTileKey),
            includedColumnKey: expandedTileKey == null ? undefined : includedColumnKey
        });
    };

    const createMultiLevelFilterMenuItem = (anchorElement) => ({
        section: "Filter",
        text: "Multi-level filter...",
        id: "multi-level-filter-menu-item",
        action: () => openMultiLevelFilterEditor(anchorElement)
    });

    const createEditAllFiltersMenuItem = (anchorElement) => ({
        section: "Filter",
        text: "Edit all filters",
        id: "edit-all-filters-menu-item",
        action: () => openMultiLevelFilterEditor(anchorElement)
    });

    return {
        openGroupingSettingsEditor,
        openMultiLevelSortEditor,
        openMultiLevelFilterEditor,
        createEditGroupingsMenuItem,
        createMultiLevelSortMenuItem,
        createMultiLevelFilterMenuItem,
        createEditAllFiltersMenuItem
    };
};
