/**
 * Transforms a data source object for display in the data source debug window.
 */
Ren.DataSourceDebugTransformer = () => {

    const transform = (dataSource) => {

        const transformedDataSource = Ren.ObjectUtils.clone(dataSource);

        // Remove these properties as they contain tonnes of data in the visualisation.
        Ren.ObjectUtils.recursivelyReplaceProperty(transformedDataSource, "RowModels", "[...]");
        Ren.ObjectUtils.recursivelyReplaceProperty(transformedDataSource, "CompressionDictionary", "[...]");
        Ren.ObjectUtils.recursivelyReplaceProperty(transformedDataSource, "_columnCVCache", "[...]");
        Ren.ObjectUtils.recursivelyReplaceProperty(transformedDataSource, "distinctColumnCVs", "[...]");

        return transformedDataSource;
    };

    return {
        transform
    };
};
