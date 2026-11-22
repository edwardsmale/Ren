/**
 * Keeps the bytes of each data source that arrived in a binary format, so that a downloaded report
 * can carry them as they came rather than as JSON, which for a large data source is longer than
 * the longest string the browser can make.  They are held deflated, in a Blob, which the browser
 * is free to keep out of memory.
 */
Ren.DataSourceBinaryResponses = (() => {

    // Promises of the deflated bytes, or of null where deflating them failed, by data source URI.
    const deflatedResponses = new Map();

    // Async so that a browser without the streams it needs rejects rather than throws, which would
    // otherwise fail the fetch of the data source it was given.
    const deflate = async (bytes) => {

        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));

        return new Response(stream).blob();
    };

    /**
     * Keeps a data source's response bytes, which are not to be changed after.
     */
    const retain = (dataSourceUri, buffer) => {

        dataSourceUri = Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri);

        const deflated = deflate(buffer).catch((error) => {

            console.warn(
                `[DataSourceBinaryResponses] Could not keep the response for ${dataSourceUri}`,
                error
            );

            return null;
        });

        deflatedResponses.set(dataSourceUri, deflated);
    };

    const forget = (dataSourceUri) => {

        deflatedResponses.delete(Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri));
    };

    /**
     * Resolves to a data source's response bytes, deflated, or to null when none were kept.
     */
    const getDeflatedBytes = (dataSourceUri) => {

        const deflated = deflatedResponses.get(
            Ren.UrlUtils.sortDataSourceUriParameters(dataSourceUri)
        );

        if (deflated === undefined) return Promise.resolve(null);

        return deflated.then((blob) => blob === null
            ? null
            : blob.arrayBuffer().then((buffer) => new Uint8Array(buffer)));
    };

    /**
     * Resolves to the response bytes that getDeflatedBytes gave deflated.
     */
    const inflate = (deflatedBytes) => {

        const stream = new Blob([deflatedBytes]).stream()
            .pipeThrough(new DecompressionStream("deflate"));

        return new Response(stream).arrayBuffer();
    };

    return {
        forget,
        getDeflatedBytes,
        inflate,
        retain
    };
})();
