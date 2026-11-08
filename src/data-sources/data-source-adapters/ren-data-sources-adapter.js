Ren.DataSourcesAdapter = (() => {

    /**
     * Gets a value indicating whether the response is already formatted as a script element.
     */
    const isScriptElementHtml = (response) => response.startsWith("<script");

    /**
     * Converts a data source response into the tabular data set collection object it represents.
     * If the response is already a tabular data set collection, returns it as-is. If it is an array
     * of objects, or in the columns-and-rows shape, converts it to a tabular data set collection.
     *
     * Returns the collection alongside the JSON that represents it - the response itself, unless it
     * had to be adapted, in which case the adapted collection's own JSON.  That JSON is what goes
     * into the data source's script element on the page, which is where a downloaded report reads
     * the data source from when it is reopened.
     *
     * This is what a data source fetched from the server wants: it has the JSON in hand already, so
     * it can be parsed once here rather than read back out of the element it is put in.  Throws if
     * the response is not valid JSON, for the caller to report.
     */
    const adaptToTabularDataSetCollection = (responseJson, dataSourceUri) => {

        const parsedJson = JSON.parse(responseJson);

        const isColumnsAndRows = Ren.DataSourcesAdapter_ColumnsAndRows.isColumnsAndRows(parsedJson);

        const isArrayOfObjects = Ren.DataSourcesAdapter_ArrayOfObjects.isArrayOfObjects(parsedJson);

        if (isColumnsAndRows || isArrayOfObjects) {

            const tabularDataSetCollection = isColumnsAndRows
                ? Ren.DataSourcesAdapter_ColumnsAndRows.adaptColumnsAndRows(
                    parsedJson,
                    dataSourceUri,
                    dataSourceUri
                )
                : Ren.DataSourcesAdapter_ArrayOfObjects.adaptResponse(
                    parsedJson,
                    dataSourceUri,
                    dataSourceUri
                );

            return {
                tabularDataSetCollection,
                json: Ren.JsonUtils.serialize(tabularDataSetCollection)
            };
        }
        else {

            return {
                tabularDataSetCollection: parsedJson,
                json: responseJson
            };
        }
    };

    /**
     * Converts an array of objects in JSON format to a Ren tabular data set collection, as the
     * script element to put on the page.
     *
     * The element rather than its HTML, because the data is potentially large and every crossing
     * of the string / DOM boundary copies all of it: serialising here and parsing it back in
     * DataSources would cost three copies of the response for nothing.  A response that is already
     * a script element's HTML has no element to hand over, so it is parsed into one.
     */
    const adaptToScriptElement = (response, dataSourceUri) => {

        if (isScriptElementHtml(response)) return Ren.HtmlUtils.create(response);

        // Only an array has to be adapted, so a response that is already a tabular data set
        // collection skips being parsed at all.
        if (Ren.JsonUtils.isJsonArray(response)) {

            const parsedJson = Ren.JsonUtils.parse(response);

            if (parsedJson) {

                response = Ren.DataSourcesAdapter_ArrayOfObjects.adaptArrayOfObjects(
                    parsedJson,
                    dataSourceUri,
                    dataSourceUri
                );

                response = Ren.JsonUtils.serialize(response);
            }
        }

        // Note: _textContent escapes any closing-script-tag sequence in the response, so the data
        // round-trips safely when this element's outerHTML is later parsed via innerHTML or when a
        // downloaded report (with this script inlined) is reopened.  See HtmlUtils.
        return Ren.HtmlUtils.create("script")
            ._addClass("ren-tabular-data-set-collection-json")
            ._attr("type", "application/json")
            ._attr("data-source-uri", dataSourceUri)
            ._textContent(response);
    };

    return {
        adaptToScriptElement,
        adaptToTabularDataSetCollection,
        isScriptElementHtml
    };
})();
