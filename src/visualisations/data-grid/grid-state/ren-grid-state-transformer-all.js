/**
 * Transforms for serialization the gridstate of all datagrids and gridsets.
 */
Ren.GridStateTransformer_All = (() => {

    const transform = (visualisations) => {

        const result = {};

        visualisations.forEach(visualisation => {

            if (visualisation.visualisationTypeName !== "GridSet") return;
            if (Ren.DefaultSettingsGroupGenerator.isAdHocSettingsGroup(visualisation.gridStateGroup)) return;
            if (visualisation.excludeFromSerialization) return;

            // Not built yet, so its saved grid state, merged in by the caller, is kept as it was.
            if (!visualisation.instance) return;

            const gridStates = visualisation.instance.gridState;

            for (let i = 0; i < gridStates.length; i++) {

                const gridState = gridStates[i];

                // Get the correct tabularData for this specific grid using its tabularDataGuid.
                // Check TabularDataPool first (for grids with transformers), then DataSources
                // (for grids without transformers that use the original tabularData).
                let tabularData = Ren.TabularDataPool.getByTabularDataGuid(gridState.tabularDataGuid);

                if (!tabularData) {
                    tabularData = Ren.DataSources.getTabularDataByTabularDataGuid(gridState.tabularDataGuid);
                }

                if (!tabularData) {

                    console.warn(
                        `[GridStateTransformer_All] Could not find tabularData for guid '${gridState.tabularDataGuid}' ` +
                        `(grid state group '${gridState.gridStateGroup}') in TabularDataPool or DataSources`
                    );

                    continue;
                }

                const transformedSettings = Ren.GridStateTransformer.transform(tabularData, gridState);

                if (transformedSettings === null) {

                    console.warn(
                        "Could not transform grid state for visualisation with guid " +
                        visualisation.visualisationGuid +
                        " and grid state group " + gridState.gridStateGroup + ". " +
                        "This grid state will not be included in the transformed output."
                    );

                    continue;
                }

                const gridStateGroup = gridState.gridStateGroup;

                result[gridStateGroup] = transformedSettings;
            }
        });

        return result;
    };

    return {
        transform
    };
})();
