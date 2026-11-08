/**
 * Transforms for serialization the data grouping settings of multiple visualisations.
 */
Ren.DataGroupingSettingsTransformer_All = (() => {

    /**
     * Gets the settings with the query they were saved against in front of them: its embedding and
     * its columns, which are what the settings are checked against, and remapped by, when loaded.
     * Written here rather than by the transformer, which is also used on paths that aren't saving.
     */
    const addQueryFingerprint = (tabularData, transformedSettings) => {

        const settings = {};

        if (Array.isArray(tabularData.QueryEmbedding)) {

            settings.queryEmbedding =
                Ren.EmbeddingUtils.encodeEmbedding(tabularData.QueryEmbedding);

            const columnModels = tabularData.ColumnModels || [];
            const queryColumns = new Array(columnModels.length);

            for (let i = 0; i < columnModels.length; i++) {
                queryColumns[i] = columnModels[i].ColumnIdOrHeading;
            }

            settings.queryColumns = queryColumns;
        }

        const keys = Object.keys(transformedSettings);

        for (let i = 0; i < keys.length; i++) {
            settings[keys[i]] = transformedSettings[keys[i]];
        }

        return settings;
    };

    const transform = (visualisations) => {

        const result = {};

        visualisations.forEach(visualisation => {

            if (!visualisation.instance) return;
            if (!visualisation.dataGroupingSettingsGroup) return;
            if (!visualisation.instance.dataGroupingSettings) return;
            if (Ren.DefaultSettingsGroupGenerator.isAdHocSettingsGroup(visualisation.dataGroupingSettingsGroup)) return;
            if (visualisation.excludeFromSerialization) return;

            if (result[visualisation.dataGroupingSettingsGroup]) return;

            const dataGroupingSettingss = visualisation.instance.dataGroupingSettings;

            for (let i = 0; i < dataGroupingSettingss.length; i++) {

                const dataGroupingSettings = dataGroupingSettingss[i];

                // A grid set's settings hold column positions in their own grid's data tab, so they
                // are transformed against that rather than the visualisation's first tab.
                const tabularData = visualisation.instance.dataGrids?.[i]?.tabularData ??
                    Ren.DataSources.cloneTabularDataAndApplyTransformationsForVisualisation(
                        visualisation
                    );

                if (tabularData == null) continue;

                const transformedSettings = addQueryFingerprint(
                    tabularData,
                    Ren.DataGroupingSettingsTransformer.transform(tabularData, dataGroupingSettings)
                );

                delete transformedSettings.signifier;

                result[dataGroupingSettings.dataGroupingSettingsGroup] = transformedSettings;
            }
        });

        return result;
    };

    return {
        transform
    };
})();
