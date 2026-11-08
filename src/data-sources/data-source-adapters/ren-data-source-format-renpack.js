/**
 * The binary "RENP" tabular format: a JSON envelope without rows or compression dictionary,
 * followed by binary blocks holding those, each column at the narrowest width its values fit.  See
 * RenPackFormat.cs for the full layout, and Ren.DataSourceDecoding for the reader, which a parse
 * worker normally runs instead of parseBuffer.
 */
Ren.DataSourceFormat_RenPack = (() => {

    // "RENP".
    const MAGIC_R = 82;
    const MAGIC_E = 69;
    const MAGIC_N = 78;
    const MAGIC_P = 80;

    /**
     * Gets a value indicating whether a response body is in this format, from its magic bytes.
     */
    const sniffBuffer = (buffer) => {

        if (buffer.byteLength < Ren.DataSourceDecoding.RENPACK_HEADER_LENGTH) return false;

        const magic = new Uint8Array(buffer, 0, 4);

        return magic[0] === MAGIC_R && magic[1] === MAGIC_E &&
            magic[2] === MAGIC_N && magic[3] === MAGIC_P;
    };

    /**
     * Converts a response body into its tabular data set collection, throwing if it can't be read.
     * No JSON is returned, as serialising the collection is the cost this format exists to avoid.
     */
    const parseBuffer = (buffer) => {

        const collection = Ren.DataSourceDecoding.decodeRenPack(buffer).collection;

        Ren.DataSourceParseWorker.unpackCollection(collection);

        return { tabularDataSetCollection: collection, json: null };
    };

    return {
        name: "renpack",
        contentTypes: ["application/x-ren-tabular-v1"],
        isBinary: true,
        supportsWorkerParse: true,
        sniffBuffer,
        parseBuffer
    };
})();
