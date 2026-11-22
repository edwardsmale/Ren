/**
 * Tab-separated values, with the column headings on the first row.
 *
 * Nothing on the server returns this yet; it is reachable by a visualisation asking for it with a
 * data-format attribute, and by a response that says it is text/tab-separated-values.  The
 * conversion itself is the one the data grid's cell selection already uses to make an ad hoc data
 * source out of copied cells.
 */
Ren.DataSourceFormat_Tsv = (() => {

    /**
     * Converts a TSV response body into the tabular data set collection it represents.
     *
     * No JSON is returned alongside the collection: unlike a response that is already the JSON of a
     * collection, there is none in hand here, so the caller serialises the collection itself if and
     * when it needs to.
     */
    const parse = (response, dataSourceUri) => {

        const tabularDataSetCollection = Ren.DataSourcesAdapter_Tsv.adaptTsvToCollection(
            response,
            dataSourceUri,
            dataSourceUri
        );

        return { tabularDataSetCollection, json: null };
    };

    return {
        name: "tsv",
        contentTypes: ["text/tab-separated-values"],
        parse
    };
})();
