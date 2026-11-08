Ren.DataGridVariationsWindow_Data = (() => {

    const createDataGridVariationsDataSource = (
        dataGroupingSettingsGroup, gridStateGroup, sourceVisualisationGuid, containingReportGuid) => {

        // The report context is part of the URI because a settings group is the same literal in
        // every open instance of a report, so two instances would otherwise share one data source
        // and the second window would overwrite the first window's rows.
        const dataSourceUri =
            "data-grid-variations-" + dataGroupingSettingsGroup + "-" + gridStateGroup +
            "-" + (containingReportGuid ?? "");

        const variationData = Ren.ReportSettings_Variations.getVariations(
            dataGroupingSettingsGroup,
            gridStateGroup
        );

        const variations = [];

        let index = 0;

        variationData.forEach((v) => {

            const variation = {
                Index: index,
                HasDataGroupingSettings: !!v.dataGroupingSettings,
                HasGridState: !!v.gridState,
                "Variation Name": v.variationName,
                Label: v.variationLabel,
                Tooltip: v.variationTooltip,
                Apply: v.variationName,
                Update: v.variationName,
                Remove: v.variationName,
                dataGroupingSettingsGroup,
                gridStateGroup,
                sourceVisualisationGuid,
                containingReportGuid
            };

            variations.push(variation);

            index++;
        });

        const result = Ren.DataSources_ProduceDataSource.produceDataSourceFromArrayOfObjects(
            variations,
            dataSourceUri,
            "Variations"
        );

        return result ? dataSourceUri : null; // Returns null if there are no data.
    };

    return {
        createDataGridVariationsDataSource
    };
})();
