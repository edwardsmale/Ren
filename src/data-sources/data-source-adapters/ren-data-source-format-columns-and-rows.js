/**
 * The columns-and-rows shape, { columns: [...], rows: [[...]] }, which is smaller than an array of
 * objects for not repeating the column names on every row.
 *
 * Asked for with data-format="columns-and-rows", and recognised by a body that starts with its
 * columns.  One that starts with its rows instead is still read, by
 * Ren.DataSourceFormat_TabularDataSetCollection once it has been parsed.  An array of objects
 * with column hints starts the same way, so it is read here too.
 */
Ren.DataSourceFormat_ColumnsAndRows = (() => {

    const LEADING_COLUMNS_PATTERN = /^\s*\{\s*"columns"\s*:/;

    // Only the start of a response is looked at, since one is tens of megabytes.
    const SNIFFED_LENGTH = 64;

    const sniff = (response) => LEADING_COLUMNS_PATTERN.test(response.substring(0, SNIFFED_LENGTH));

    const parse = (response, dataSourceUri) => {

        const parsedJson = JSON.parse(response);

        const tabularDataSetCollection =
            Ren.DataSourcesAdapter_ArrayOfObjects.isArrayOfObjects(parsedJson)
                ? Ren.DataSourcesAdapter_ArrayOfObjects.adaptResponse(
                    parsedJson,
                    dataSourceUri,
                    dataSourceUri
                )
                : Ren.DataSourcesAdapter_ColumnsAndRows.adaptColumnsAndRows(
                    parsedJson,
                    dataSourceUri,
                    dataSourceUri
                );

        return { tabularDataSetCollection, json: null };
    };

    return {
        name: "columns-and-rows",
        sniff,
        parse
    };
})();
