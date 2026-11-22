/**
 * Functions for working with tabular data source script elements on the page.
 */
Ren.DataSourcesScriptElements = (() => {

    /**
     * Gets all the tabular data source script elements on the page.
     */
    const getAllTabularDataSourceScriptElements = () => {

        return Array.from(document.querySelectorAll(".ren-tabular-data-set-collection-json"));
    };

    /**
     * Gets the URIs of any data sources that already exist in the passed HTML string.
     */
    const getExistingScriptElementDataSourceUris = (downloadHtml) => {

        const re = /\x3Cscript[^>]+class=.ren-tabular-data-set-collection-json.[^>]+data-source-uri=.([/\w]+)./g;

        const existingDataSourceUris = new Set();

        let match = re.exec(downloadHtml);

        while (match !== null) {

            const dataSourceUri = match[1];

            existingDataSourceUris.add(dataSourceUri);

            match = re.exec(downloadHtml);
        }

        return existingDataSourceUris;
    };

    /**
     * Gets a value indicating whether any of the rows holds its values as something other than an
     * array of its own, which JSON.stringify cannot write.
     */
    const hasPackedRowValues = (rowModels) => {

        for (let index = 0; index < rowModels.length; index++) {

            const values = rowModels[index]?.CV;

            if (values != null && !Array.isArray(values)) return true;
        }

        return false;
    };

    /**
     * Gets the rows with every packed row's values copied out into an array of their own.  Other
     * rows are shared with the collection they came from.
     */
    const unpackRowValues = (rowModels) => {

        const unpacked = new Array(rowModels.length);

        for (let index = 0; index < rowModels.length; index++) {

            const rowModel = rowModels[index];
            const values = rowModel?.CV;

            unpacked[index] = values != null && !Array.isArray(values)
                ? Object.assign({}, rowModel, { CV: Array.from(values) })
                : rowModel;
        }

        return unpacked;
    };

    /**
     * Copies the collection down as far as its tabs, so a tab can be given different rows without
     * touching the live collection.  Everything beneath is shared.  A live tab refuses to be JSON
     * serialised, so its copy loses that guard.
     */
    const cloneCollectionShell = (collection) => {

        const shell = Object.assign({}, collection);

        shell.TabularDataSets = collection.TabularDataSets.map((tabularDataSet) => {

            const setCopy = Object.assign({}, tabularDataSet);

            if (Array.isArray(tabularDataSet.TabularDatas)) {

                setCopy.TabularDatas = tabularDataSet.TabularDatas.map((tabularData) => {

                    const tabularDataCopy = Object.assign({}, tabularData);

                    delete tabularDataCopy.toJSON;

                    return tabularDataCopy;
                });
            }

            return setCopy;
        });

        return shell;
    };

    /**
     * Gets the JSON for a tabular data set collection, in the form the scan reads back.  Binary
     * format rows can hold their values as views onto one flat array, which JSON.stringify writes
     * as {"0":1,"1":28}, so those rows are copied out into arrays first.
     */
    const serializeCollection = (collection) => {

        const sets = collection?.TabularDataSets;

        if (!Array.isArray(sets)) return Ren.JsonUtils.serialize(collection);

        const shell = cloneCollectionShell(collection);

        for (let setIndex = 0; setIndex < sets.length; setIndex++) {

            const tabularDatas = sets[setIndex]?.TabularDatas;

            if (!Array.isArray(tabularDatas)) continue;

            for (let tabIndex = 0; tabIndex < tabularDatas.length; tabIndex++) {

                const rowModels = tabularDatas[tabIndex]?.RowModels;

                if (!Array.isArray(rowModels) || !hasPackedRowValues(rowModels)) continue;

                shell.TabularDataSets[setIndex].TabularDatas[tabIndex].RowModels =
                    unpackRowValues(rowModels);
            }
        }

        return Ren.JsonUtils.serialize(shell);
    };

    // What a script element holding a binary response rather than JSON says it holds, in its
    // data-format attribute: the response deflated and Base92-encoded.
    const BINARY_DATA_FORMAT = "deflate-base92";

    const SCRIPT_END_TAG = "</scr" + "ipt>";

    /**
     * Gets a script element for a data source's binary response, as the parts of a Blob.  The
     * encoded bytes are kept as bytes, since for a large data source they are too long to be one
     * string alongside the rest of the report.
     */
    const createBinaryScriptElementParts = (dataSourceUri, deflatedBytes) => {

        const element = Ren.HtmlUtils.create("script")
            ._addClass("ren-tabular-data-set-collection-json")
            ._attr("data-source-uri", dataSourceUri)
            ._attr("data-format", BINARY_DATA_FORMAT)
            ._attr("data-byte-length", String(deflatedBytes.length))
            ._attr("type", "text/plain");

        const html = element.outerHTML;

        return [
            html.slice(0, html.length - SCRIPT_END_TAG.length),
            Ren.Base92.encode(deflatedBytes),
            SCRIPT_END_TAG
        ];
    };

    /**
     * Gets a value indicating whether a data source script element holds a binary response.
     */
    const isBinaryScriptElement = (element) =>
        element.getAttribute("data-format") === BINARY_DATA_FORMAT;

    /**
     * Resolves to the response bytes a binary data source script element holds.
     */
    const readBinaryScriptElement = (element) => {

        const byteLength = Ren.TextUtils.parseInt(element.getAttribute("data-byte-length"));

        const deflatedBytes = Ren.Base92.decode(element.textContent, byteLength);

        return Ren.DataSourceBinaryResponses.inflate(deflatedBytes);
    };

    /**
     * Puts a data source's JSON on the page as a script element, where a downloaded report finds
     * its data sources.  Built directly rather than as an HTML string, which would have the browser
     * escape and re-parse the whole payload; _textContent still defuses any closing script tag.
     */
    const addDataSourceScriptElement = (dataSourceUri, json) => {

        const scriptElement = Ren.HtmlUtils.create("script")
            ._addClass("ren-tabular-data-set-collection-json")
            ._attr("type", "application/json")
            ._attr("data-source-uri", dataSourceUri)
            ._textContent(json);

        Ren.HtmlUtils.getBody().appendChild(scriptElement);
    };

    /**
     * Removes the tabular data source script element for the specified data source URI from the
     * page.
     */
    const removeDataSourceScriptElement = (dataSourceUri) => {

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        const dataSourceScriptElement = document.querySelector(
            `.ren-tabular-data-set-collection-json[data-source-uri="${dataSourceUri}"]`
        );

        dataSourceScriptElement?.remove();
    };

    return {
        addDataSourceScriptElement,
        createBinaryScriptElementParts,
        getAllTabularDataSourceScriptElements,
        getExistingScriptElementDataSourceUris,
        isBinaryScriptElement,
        readBinaryScriptElement,
        removeDataSourceScriptElement,
        serializeCollection
    };
})();
