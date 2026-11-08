Ren.CreateWordCloudCreator = (() => {

    /**
     * Creates a word cloud based on the selected columns in a data grid.  The selected
     * columns should include one string column (words) and one numeric column (counts).
     *
     * In contrast to an ad hoc word cloud, this chart will update as the grid is filtered.
     */
    const createColumnBasedWordCloud = (
        sourceDataGridVisualisation,
        dataGridCellSelection
    ) => {

        const columns = dataGridCellSelection.getSelectedColumnIdsOrHeadings();

        // The grid set creates per-tab settings groups (e.g. "group[0]", "group[1]"), so use the
        // active DataGrid's actual group so the filterChanged event handler matches correctly.
        const source = Ren.DataGroupingSettingsSource.fromVisualisation(sourceDataGridVisualisation);

        const dataTabIndex = source.dataTabIndex;
        const dataTabGroup = source.dataTabGroup;
        const dataGroupingSettingsGroup = source.dataGroupingSettingsGroup;

        Ren.VisualisationCreator.createVisualisation({
            dataSourceUri: sourceDataGridVisualisation.dataSourceUri,
            sqlFilename: sourceDataGridVisualisation.sqlFilename,
            dataGroupingSettingsGroup,
            visualisationTypeName: "WordCloud",
            isPopup: true,
            selectedColumns: columns,
            sourceVisualisation: sourceDataGridVisualisation,
            dataTabIndex,
            dataTabGroup
        });
    };

    return {
        createColumnBasedWordCloud
    };
})();
