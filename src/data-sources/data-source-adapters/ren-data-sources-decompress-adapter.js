Ren.DataSourcesDecompressAdapter = (() => {

    /**
     * Decompresses a tabular data set collection.
     */
    const decompress = (tabularDataSetCollection) => {

        if (!tabularDataSetCollection.IsCompressed) {
            return tabularDataSetCollection;
        }

        Ren.TabularData_Services.addServicesToTabularDatas(tabularDataSetCollection);

        tabularDataSetCollection.TabularDataSets.forEach(tds => {

            tds.TabularDatas.forEach(td => {

                td.RowModels.forEach(rm => {

                    rm.RowValues = [];

                    for (let columnIndex = 0; columnIndex < td.ColumnModels.length; columnIndex++) {

                        const cv = rm.CV[columnIndex];

                        const decompressedValue = td.CompressionDictionary.decompressValue(cv, columnIndex);

                        rm.RowValues.push(decompressedValue);
                    }

                    delete rm.CV;
                });
            });
        });

        tabularDataSetCollection.IsCompressed = false;
    };

    return {
        decompress
    };
})();
