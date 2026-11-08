/**
 * Transforms all non-virtual data sources so that they can be serialized as part of the report
 * settings.
 */
Ren.DataSourcesTransformer = (() => {

    const transform = () => {

        const result = [];

        const dataSources = Ren.DataSources.getDataSources();

        for (let i = 0; i < dataSources.length; i++) {

            const dataSource = dataSources[i];

            if (dataSource === "PENDING") continue;
            if (dataSource.isVirtualDataSource) continue;

            result.push({ dataSourceUri: dataSource.dataSourceUri });
        }

        return result;
    };

    return {
        transform
    };
})();
