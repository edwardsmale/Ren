Ren.DataSourcesAdapter_Tsv = (() => {

    /**
     * Converts a TSV string (such as when creating an ad hoc data source from selected cells) into
     * a Ren tabular data set collection.
     */
    const adaptTsvToCollection = (tsv, dataSourceUri, tabularDataTitle, skipEmptyColumns) => {

        if (skipEmptyColumns) tsv = Ren.TsvUtils.removeEmptyColumns(tsv);

        const lines = tsv.split(/\r?\n/);

        // A file's last line ends with a newline, which leaves an empty line after it.
        if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

        const rows = lines.map(row => row.split("\t"));

        const arrayOfObjects = rows
            .slice(1) // Skip the first row (header row).
            .map(row => {

                const obj = {};

                for (let i = 0; i < row.length; i++) {

                    const value = row[i].trim();
                    obj[rows[0][i]] = value === "" ? null : value;
                }
                return obj;
            });

        return Ren.DataSourcesAdapter_ArrayOfObjects.adaptArrayOfObjects(
            arrayOfObjects,
            dataSourceUri,
            tabularDataTitle
        );
    };

    /**
     * Converts a TSV string into a Ren tabular data set collection, serialised as JSON ready to go
     * into a data source script element.
     */
    const adaptTsv = (tsv, dataSourceUri, tabularDataTitle, skipEmptyColumns) => {

        const data = adaptTsvToCollection(
            tsv,
            dataSourceUri,
            tabularDataTitle,
            skipEmptyColumns
        );

        const serialisedTabularData = Ren.JsonUtils.serialize(data);

        return serialisedTabularData;
    };

    return {
        adaptTsv,
        adaptTsvToCollection
    };
})();
