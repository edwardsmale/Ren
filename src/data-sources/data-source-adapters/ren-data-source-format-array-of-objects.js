/**
 * An array of objects, one per row, keyed by column name: [{ "Product": "Stapler", ... }, ...].
 * Optionally wrapped with column hints, as { "columns": [...], "rows": [...] } - see
 * Ren.DataSourcesAdapter_ArrayOfObjects.
 *
 * Asked for with data-format="array-of-objects", and recognised by a body that starts with "[".
 */
Ren.DataSourceFormat_ArrayOfObjects = (() => {

    const LEADING_BRACKET_PATTERN = /^\s*\[/;

    // Only the start of a response is looked at, since one is tens of megabytes.
    const SNIFFED_LENGTH = 64;

    const sniff = (response) => LEADING_BRACKET_PATTERN.test(response.substring(0, SNIFFED_LENGTH));

    const parse = (response, dataSourceUri) => {

        const parsedJson = JSON.parse(response);

        if (!Ren.DataSourcesAdapter_ArrayOfObjects.isArrayOfObjects(parsedJson)) {
            throw new Error("The response isn't an array of objects.");
        }

        const tabularDataSetCollection = Ren.DataSourcesAdapter_ArrayOfObjects.adaptResponse(
            parsedJson,
            dataSourceUri,
            dataSourceUri
        );

        return { tabularDataSetCollection, json: null };
    };

    return {
        name: "array-of-objects",
        sniff,
        parse
    };
})();
