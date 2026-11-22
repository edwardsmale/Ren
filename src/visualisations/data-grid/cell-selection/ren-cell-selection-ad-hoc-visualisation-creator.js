Ren.DataGridCellSelection_AdHocVisualisationCreator = (
    tabularData,
    dataGroupingSettings,
    dataGridGuid,
    gridState,
    selection) => {

    const selectedCellsCalculator = Ren.DataGridCellSelection_SelectedCellsCalculator(
        tabularData,
        dataGroupingSettings,
        gridState
    );

    const tsvGenerator = Ren.DataGridCellSelection_TsvGenerator(
        tabularData,
        dataGroupingSettings,
        gridState
    );

    const createAdHocDataSource = (visualisationTypeName) => {

        const dataSourceUri = Ren.RandomUtils.generateRandomClassName(
            "ad-hoc-data-source-" + dataGridGuid
        );

        const tabularDataTitle = visualisationTypeName + " " + dataSourceUri;

        const excludeTotalsRow =
            selection.selectionType() === "column" ||
            selection.selectionType() === "all";

        const selectedCellsExcludingTotalsRowAndHeadings = selectedCellsCalculator.getSelectedCells(
            selection.state,
            true,
            true
        );

        if (!selectedCellsExcludingTotalsRowAndHeadings.length) return null;

        const selectedCells = selectedCellsCalculator.getSelectedCells(
            selection.state,
            excludeTotalsRow
        );

        const tsv = tsvGenerator.getSelectedCellsTsv(
            selection.state,
            selectedCells,
            {
                withHeadings: true,
                excludeTotalsRow,
                escapeNewlines: true
            }
        );

        // A key/value grid lists the row's columns down the page, and a column with no value is
        // part of what the row says - so it keeps the empty columns and decides for itself whether
        // to show them (its "Show columns containing null or undefined" setting).  Every other type
        // plots or tabulates the values, where an entirely empty column is only noise.
        const skipEmptyColumns = visualisationTypeName !== "KeyValueGrid";

        const serialisedTabularData = Ren.DataSourcesAdapter_Tsv.adaptTsv(
            tsv,
            dataSourceUri,
            tabularDataTitle,
            skipEmptyColumns
        );

        const tabularDataSetScript = Ren.DataSourcesAdapter.adaptToScriptElement(
            serialisedTabularData,
            dataSourceUri
        );

        Ren.DataSources.initialiseNewDataSource(tabularDataSetScript);

        return dataSourceUri;
    };

    /**
     * Creates a visualisation based on the ad hoc data source.
     */
    const createSelectedCellsVisualisation = (visualisationTypeName, dataSourceUri, popupReuseId, options) => {

        const visualisationOptions = {
            dataSourceUri,
            visualisationTypeName,
            isPopup: true,
            maxWidth: "100%",
            maxHeight: "calc(100% - 22px)",
            popupTitle: "",
            isAdHoc: true,
            sourceVisualisation: null,
            popupReuseId: popupReuseId ?? null,
            initialChartGroupCalcFunction: options?.dateGroupCalcFunction ?? null
        };

        return Ren.VisualisationCreator.createVisualisation(visualisationOptions);
    };

    const createAdHocVisualisation = (visualisationTypeName, popupReuseId, options) => {

        let dataSourceUri = createAdHocDataSource(visualisationTypeName);

        // The selection holds nothing that can be visualised - it covers only heading rows, or only
        // the totals row for a selection type that excludes it - so there is no ad hoc data source
        // to build the visualisation from. Creating one anyway gives it a null dataSourceUri, which
        // resolves to null tabular data and fails in whichever builder the type uses.
        if (!dataSourceUri) return;

        const visualisation = createSelectedCellsVisualisation(visualisationTypeName, dataSourceUri, popupReuseId, options);

        let lastProcessedAdHocSignifier = null;

        Ren.Messages.Events.dataGroupingSettingsChanged.handle((changedDataGroupingSettings) => {

            // This listener is registered on demand (not during a render), so it is not owned by a
            // render generation; it must remove itself once its ad-hoc visualisation is gone.
            if (visualisation.isDestroyed) return false;

            // The source grid's settings group is shared with the same grid in any other open
            // instance of its report; only the source grid's own changes rebuild this data source.
            if (!Ren.ReportContextMatch.isSameDataGroupingSettingsGroup(
                changedDataGroupingSettings,
                dataGroupingSettings
            )) return;

            if (changedDataGroupingSettings.signifier === lastProcessedAdHocSignifier) return;
            if (changedDataGroupingSettings.isDestroyedCleanup) return;

            lastProcessedAdHocSignifier = changedDataGroupingSettings.signifier;

            if (dataSourceUri) {
                Ren.DataSources.removeDataSource(dataSourceUri);
            }

            dataSourceUri = createAdHocDataSource(visualisationTypeName);

            Ren.Messages.Events.visualisationDataChanged.notify(
                visualisation.visualisationGuid,
                dataSourceUri
            );
        });
    };

    return {
        createAdHocVisualisation
    };
};
