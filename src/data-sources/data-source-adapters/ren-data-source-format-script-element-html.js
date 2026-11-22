/**
 * A response that is already a data source script element's HTML rather than data in any parseable
 * format.
 *
 * This one is not parsed into a collection at all: it is its own markup that says which data source
 * it is, so it has to go onto the page for the scan to pick it up.  That is what handleResponse
 * does, and why this format has one where the others have a parse.
 */
Ren.DataSourceFormat_ScriptElementHtml = (() => {

    const sniff = (response) => Ren.DataSourcesAdapter.isScriptElementHtml(response);

    /**
     * Puts the response on the page and asks for a scan, which is what loads the data source it
     * describes.  Returns true, since the response has been dealt with in full.
     */
    const handleResponse = (response) => {

        Ren.DataSources.initialiseNewDataSource(response);

        return true;
    };

    return {
        name: "script-element-html",
        contentTypes: ["text/html"],
        sniff,
        handleResponse
    };
})();
