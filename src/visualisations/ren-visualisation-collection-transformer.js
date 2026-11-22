/**
 * Transforms the visualisation collection for the visualisation collection debug window.
 */
Ren.VisualisationCollectionTransformer = (() => {

    const transform = (settings) => {

        let transformedSettings = Ren.ObjectUtils.clone(settings);

        // Remove the instance property because it contains all of the data in the visualisation.
        Ren.ObjectUtils.recursivelyRemoveProperty(transformedSettings, "instance");

        // Find (recursively) all dataGroupingSettings keys, and transform their values.

        const dataGroupingSettingsParents =
            Ren.ObjectUtils.recursivelyFindProperties(transformedSettings, "dataGroupingSettings");

        for (let i = 0; i < dataGroupingSettingsParents.length; i++) {

            const parent = dataGroupingSettingsParents[i];

            const tabularData = Ren.DataSources.getTabularDataByTabularDataGuid(
                parent.dataGroupingSettings.tabularDataGuid
            );

            // Visualisations whose data has gone (an ad-hoc one built from a grid that has since
            // been re-rendered, say) have no tabular data to name their columns from.  Show the
            // untransformed clone rather than failing the whole window.
            if (!tabularData) continue;

            parent.dataGroupingSettings = Ren.DataGroupingSettingsTransformer.transform(
                tabularData,
                parent.dataGroupingSettings
            );
        }

        // Find (recursively) all gridState keys, and transform their values.

        const gridStateParents =
            Ren.ObjectUtils.recursivelyFindProperties(transformedSettings, "gridState");

        for (let i = 0; i < gridStateParents.length; i++) {

            const parent = gridStateParents[i];

            parent.gridState = Ren.GridStateTransformer.transform(
                parent.tabularData,
                parent.gridState
            );
        }

        // Remove the tabularData property because it contains all of the data in the visualisation.
        Ren.ObjectUtils.recursivelyRemoveProperty(transformedSettings, "tabularData");

        return transformedSettings;
    };

    return {
        transform
    };
})();
