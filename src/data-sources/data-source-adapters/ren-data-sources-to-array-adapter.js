Ren.DataSourcesToArrayAdapter = (() => {

    /**
     * Converts a tabular data set collection into a simple array of objects.  The fields parameter
     * is an object that maps the field names to the column headings in the tabular data set, e.g.
     *
     * {
     *
     *     StartDate: { heading: "StartDate", type: "Date" },
     *     EndDate: { heading: "EndDate", type: "Date" },
     *     SearchCount: { heading: "Users Who Searched", type: "Number" },
     *     SearchConversionRate: { heading: "Search Conversion Rate %", type: "Number" }
     * }
     */
    const toArray = (tabularDataSetCollection, fields, dataTabIndex) => {

        dataTabIndex = dataTabIndex ?? 1;

        const tabularData = tabularDataSetCollection
            .TabularDataSets[0]
            .TabularDatas[dataTabIndex - 1];

        const columnHeadings = tabularData.ColumnModels.map(c => c.Heading);

        const rowValues = tabularData.RowModels.map(r => {

            const row = {};

            r.RowValues.forEach((value, i) => {

                const heading = columnHeadings[i];

                const field = Object.entries(fields).find(f => f[1].heading === heading);

                if (field) {

                    row[field[0]] = Ren.DataSourcesValueConvertor.convertValue(
                        value,
                        field[1].type
                    );
                }
            });

            return row;
        });

        return rowValues;
    };

    return {
        toArray
    };
})();
