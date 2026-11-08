/**
 * Adds service functions to a TabularData object.
 */
Ren.TabularData_Services = (() => {

    /**
     * Decorates each tabularData with a dataTabIndex, starting from 1.
     *
     * Added for the non-ad hoc version of the data/value chart (and other visualisations).
     */
    const populateDataTabIndex = (tabularDatas) => {

        tabularDatas.forEach((tabularData, index) => {

            tabularData.dataTabIndex = index + 1;
        });
    };

    /**
     * For each tabular data model in the collection, adds services for decompression, resolving
     * column references, sorting, filtering, grouping, etc.
     */
    const addServicesToTabularDatas = (tabularDataSetCollection) => {

        tabularDataSetCollection.TabularDataSets.forEach((tabularDataSet) => {

            populateDataTabIndex(tabularDataSet.TabularDatas);

            tabularDataSet.TabularDatas.forEach((tabularData) => {

                tabularData.CompressionDictionary = Ren.CompressionDictionary(
                    tabularDataSetCollection.CompressionDictionary,
                    tabularData.IsColumnCompressed,
                    tabularData.ColumnValueEncodings
                );

                addServices(tabularData);
            });
        });
    };

    /**
     * Gives the tabular data a fresh compression dictionary, since the Ren.CompressionDictionary
     * has an array saying whether each column is compressed, and some transformations add or
     * remove columns.  Only operates if the tabular data has a compression dictionary (the likes
     * of <ren-default-dates> don't have compression dictionaries).
     */
    const updateCompressionDictionary = (tabularData) => {

        if (tabularData.CompressionDictionary) {

            tabularData.CompressionDictionary =
                tabularData.CompressionDictionary.updateTabularData(tabularData);
        }
    };

    /**
     * Adds services and properties which only depend on the tabularData itself.  Only operates if
     * the tabular data object doesn't already have services.
     */
    const addServicesToTabularData = (tabularData) => {

        addServices(tabularData, false);
    };

    /**
     * Recreates the tabular data object's services - but only if it had services before.  (The
     * likes of <ren-default-dates> don't have services.)
     */
    const updateTabularDataServices = (tabularData) => {

        if (tabularData.isGroupRow) {
            addServices(tabularData, true);
        }
    };

    const findColumnIndex = (tabularData, columnIdOrHeading) => {

        return tabularData.ColumnModels.findIndex(columnModel =>
            columnModel.ColumnIdOrHeading === columnIdOrHeading
        );
    };

    /**
     * Adds services and properties which only depend on the tabularData itself.  Only operates if
     * the tabular data object doesn't have services - unless overwrite is set to true.
     */
    const addServices = (tabularData, overwrite) => {

        // Exit if services already added (findColumnIndex is a property set by the code below).
        if (!overwrite && tabularData.findColumnIndex) return;

        tabularData.tabularDataGuid = Ren.RandomUtils.generateRandomClassName("tabular-data");
        tabularData.ColumnCount = tabularData.ColumnModels.length;
        tabularData.HasSubheadings = tabularData.HasSubheadings ? 1 : 0;
        tabularData.HeadingCount = tabularData.HasSubheadings ? 2 : 1;
        tabularData.DataRowCount = tabularData.RowModels.length;
        tabularData.ActualRowCount = tabularData.DataRowCount + tabularData.HeadingCount;
        tabularData.findColumnIndex = findColumnIndex.bind(null, tabularData);
        tabularData.ColumnModelFormats = tabularData.ColumnModels.map(c => c.ColumnFormat);
        tabularData.toJSON = _toJson;

        onRowCountChanged(tabularData);

        tabularData.columnResolver = Ren.DataGridColumnResolver(tabularData);

        Ren.TabularData_ColumnCvsPopulator.populateColumnCVs(tabularData);
    };

    // Stable isDataRow / isGroupRow functions — defined once and shared across all tabularData
    // instances.  They read DataRowCount directly from `this` (the tabularData object) so they
    // never need to be recreated when DataRowCount changes.
    function _isDataRow(rowIndex) { return rowIndex >= 0 && rowIndex < this.DataRowCount; }
    function _isGroupRow(rowIndex) { return rowIndex >= this.DataRowCount; }

    /**
     * Refuses to JSON serialise the tabular data (as Ren.ObjectUtils.clone would of anything
     * holding it), since serialising every row freezes the page and, on a large report, throws
     * "Invalid string length".  Failing at once, whatever the report's size, names the code that
     * tried.
     */
    function _toJson() {

        throw new Error(
            "[TabularData] " + this.tabularDataGuid + " must not be JSON serialised; " +
            "clone only the settings needed rather than an object that holds the tabular data."
        );
    }

    /**
     * Call this whenever the row count changes.
     */
    const onRowCountChanged = (tabularData) => {

        tabularData.isDataRow = _isDataRow.bind(tabularData);
        tabularData.isGroupRow = _isGroupRow.bind(tabularData);
    };

    return {
        onRowCountChanged,
        updateCompressionDictionary,
        addServicesToTabularDatas,
        updateTabularDataServices,
        addServicesToTabularData
    };
})();
