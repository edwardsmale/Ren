/**
 * Functions that combine the function calls needed to create data sources and add them to the
 * Ren.DataSources collection.
 */
Ren.DataSources_ProduceDataSource = (() => {

    /**
     * Creates a data source from a tabular data set collection, adds services to its tabular
     * data models, then adds the data source to the Ren.DataSources collection.
     */
    const produceDataSourceFromTabularDataSetCollection = (
        tabularDataSetCollection,
        dataSourceUri) => {

        Ren.TabularData_Services.addServicesToTabularDatas(tabularDataSetCollection);

        Ren.DataSources.upsertDataSource(
            dataSourceUri,
            tabularDataSetCollection
        );
    };

    /**
     * Creates a data source from an array of objects, adapting it into a tabular data set
     * collection, adding services to its tabular data models, then adding the data source to the
     * Ren.DataSources collection.
     */
    const produceDataSourceFromArrayOfObjects = (
        arrayOfObjects,
        dataSourceUri,
        tabularDataTitle) => {

        const tabularDataSetCollection = Ren.DataSourcesAdapter_ArrayOfObjects.adaptArrayOfObjects(
            arrayOfObjects,
            dataSourceUri,
            tabularDataTitle
        );

        if (!tabularDataSetCollection) return false; // No data

        produceDataSourceFromTabularDataSetCollection(
            tabularDataSetCollection,
            dataSourceUri
        );

        return true; // Success
    };

    /**
     * Creates a data source from an object of objects, adapting it into a tabular data set
     * collection, adding services to its tabular data models, then adding the data source to the
     * Ren.DataSources collection.
     */
    const produceDataSourceFromObjectOfObjects = (
        objectOfObjects,
        keyFieldName,
        dataSourceUri,
        tabularDataTitle) => {

        const tabularDataSetCollection = Ren.TabularDataAdapter_ObjectOfObjects.adaptObjectOfObjects(
            objectOfObjects,
            keyFieldName,
            dataSourceUri,
            tabularDataTitle
        );

        if (!tabularDataSetCollection) return false; // No data

        produceDataSourceFromTabularDataSetCollection(
            tabularDataSetCollection,
            dataSourceUri
        );

        return true; // Success
    };

    return {
        produceDataSourceFromTabularDataSetCollection,
        produceDataSourceFromArrayOfObjects,
        produceDataSourceFromObjectOfObjects
    };
})();
