Ren.CreateFilterModuleCreator = (() => {

    /**
     * Creates a Filter Module popup driving a source data grid's filter.  It starts empty, showing
     * a checkbox control for each column added to it via its "Add filter" menu.
     */
    const createFilterModule = (sourceDataGridVisualisation) => {

        // For a grid set, the active grid's own group rather than the set's outer one.
        const source = Ren.DataGroupingSettingsSource.fromVisualisation(sourceDataGridVisualisation);

        const dataTabIndex = source.dataTabIndex;
        const dataTabGroup = source.dataTabGroup;

        // Opened where the menu was right-clicked, as the other create-visualisation items are.
        const clickPosition = Ren.LastRightClickPosition;

        Ren.VisualisationCreator.createVisualisation({
            visualisationTypeName: "FilterModule",
            dataSourceUri: sourceDataGridVisualisation.dataSourceUri,
            sqlFilename: sourceDataGridVisualisation.sqlFilename,
            // So that columns the source grid added, such as a duplicated column, are there too.
            tabularDataTransformers: sourceDataGridVisualisation.tabularDataTransformers,
            sourceDataGroupingSettingsGroup: source.dataGroupingSettingsGroup,
            sourceVisualisation: sourceDataGridVisualisation,
            dataTabIndex,
            dataTabGroup,
            isPopup: true,
            popupTitle: "Filters",
            fillAvailableSpace: true,
            resizeToFitContentOnLoad: true,
            verticalScrollbar: true,
            // Capped; the user can drag wider afterwards.
            initialMaxWidth: 1000,
            popupLeft: clickPosition ? clickPosition.x : null,
            popupTop: clickPosition ? clickPosition.y : null
        });
    };

    return {
        createFilterModule
    };
})();
