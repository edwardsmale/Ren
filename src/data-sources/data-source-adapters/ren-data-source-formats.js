/**
 * The formats a data source's response can arrive in, and the choosing between them.
 *
 * A new format can be added here, or with Ren.Extensions.registerDataSourceFormat, without the
 * fetch path learning anything about it.
 *
 * A format is:
 *
 *   name          The name a visualisation asks for it by, in its data-format attribute.
 *   contentTypes  The response content types it claims.  Optional.
 *   sniff         Returns whether a response body is in this format, for a response whose content
 *                 type does not say.  Optional.
 *   parse         Converts a response body into { tabularDataSetCollection, json }, where json is
 *                 the JSON representing that collection when the format had it in hand already and
 *                 null when it did not.  Throws on a body it cannot read.
 *   handleResponse  Instead of parse, for a format that puts its own data source in place rather
 *                 than producing a collection.  Returns true when it has done so.
 *
 * A format has one of parse or handleResponse, never both.
 *
 * A binary format is declared instead with:
 *
 *   isBinary      True, which is what says the two below are to be used in place of the above.
 *   sniffBuffer   Returns whether a response's ArrayBuffer is in this format.
 *   parseBuffer   Converts one into { tabularDataSetCollection, json }, as parse does.
 *   supportsWorkerParse  True when the parse worker can read this format, so that
 *                 the response can be handed to it instead of read here.  Optional.
 *
 * A binary response is recognised by its bytes alone, before it is decoded, since the server falls
 * back to JSON for a collection the binary format cannot carry.
 */
Ren.DataSourceFormats = (() => {

    // The format a response is read as when neither the visualisation, the response's content type
    // nor the body itself says which it is.
    const DEFAULT_FORMAT_NAME = "tabular-data-set-collection";

    let formats = null;

    // Added by Ren.Extensions.registerDataSourceFormat.
    const extensionFormats = [];

    Ren.Extensions.handle("dataSourceFormat", (format) => {

        extensionFormats.push(format);
        formats = null;
    });

    /**
     * Gets the registered formats, in the order their sniffs are tried.
     * A format that recognises itself by something specific comes before one that recognises itself
     * by something loose. Built on first use, so that the order the scripts load in doesn't matter.
     */
    const getFormats = () => {

        if (formats === null) {

            formats = [
                Ren.DataSourceFormat_RenPack,
                Ren.DataSourceFormat_ScriptElementHtml,
                Ren.DataSourceFormat_ColumnsAndRows,
                Ren.DataSourceFormat_ArrayOfObjects
            ];

            for (let index = 0; index < extensionFormats.length; index++) {
                formats.push(extensionFormats[index]);
            }

            formats.push(Ren.DataSourceFormat_Tsv);
            formats.push(Ren.DataSourceFormat_TabularDataSetCollection);
        }

        return formats;
    };

    /**
     * Gets the format registered under the given name, or undefined when there is none.
     */
    const getByName = (name) => {

        const registeredFormats = getFormats();

        for (let index = 0; index < registeredFormats.length; index++) {

            if (registeredFormats[index].name === name) return registeredFormats[index];
        }

        return undefined;
    };

    /**
     * Gets the names of every registered format.
     */
    const getNames = () => getFormats().map(format => format.name);

    /**
     * Gets the first format claiming the given content type, or undefined when none does.  Any
     * parameters on the header (a charset, say) are ignored.
     */
    const getByContentType = (contentType) => {

        if (!contentType) return undefined;

        const mediaType = contentType.split(";")[0].trim().toLowerCase();

        const registeredFormats = getFormats();

        for (let index = 0; index < registeredFormats.length; index++) {

            const format = registeredFormats[index];

            if (format.isBinary === true) continue;

            if (format.contentTypes && format.contentTypes.indexOf(mediaType) !== -1) return format;
        }

        return undefined;
    };

    /**
     * Gets the first format whose sniff recognises the response body, or undefined when none does.
     */
    const getBySniff = (response) => {

        const registeredFormats = getFormats();

        for (let index = 0; index < registeredFormats.length; index++) {

            const format = registeredFormats[index];

            if (format.sniff && format.sniff(response)) return format;
        }

        return undefined;
    };

    /**
     * Chooses the format a fetched response is to be read as.
     *
     * What the visualisation asked for wins.  Failing that the body is sniffed before the content
     * type is consulted, since an endpoint that returns a script element still labels it as JSON.
     * Failing both, null, for a response that is in no format Ren knows.
     */
    const resolve = (formatName, contentType, response) => {

        if (formatName) {

            const namedFormat = getByName(formatName);

            // A binary format asked for and not received is not an error, since the server may have
            // answered with JSON instead.
            if (namedFormat && namedFormat.isBinary !== true) return namedFormat;

            if (!namedFormat) {

                console.warn(
                    `[DataSourceFormats] Unknown data format: ${formatName}.  ` +
                    `Expected one of: ${getNames().join(", ")}.  ` +
                    "Recognising the response by what it contains instead."
                );
            }
        }

        return getBySniff(response) ?? getByContentType(contentType) ?? null;
    };

    /**
     * Gets the binary format a fetched response is in, or null when it is not in one and is to be
     * decoded as text.  Decided by the bytes alone.
     */
    const resolveBinary = (buffer) => {

        const registeredFormats = getFormats();

        for (let index = 0; index < registeredFormats.length; index++) {

            const format = registeredFormats[index];

            if (format.isBinary === true && format.sniffBuffer(buffer)) return format;
        }

        return null;
    };

    /**
     * Gets the media types every binary format claims.
     */
    const getBinaryContentTypes = () => {

        const contentTypes = [];
        const registeredFormats = getFormats();

        for (let index = 0; index < registeredFormats.length; index++) {

            const format = registeredFormats[index];

            if (format.isBinary !== true || !format.contentTypes) continue;

            for (let typeIndex = 0; typeIndex < format.contentTypes.length; typeIndex++) {

                contentTypes.push(format.contentTypes[typeIndex]);
            }
        }

        return contentTypes;
    };

    return {
        DEFAULT_FORMAT_NAME,
        getBinaryContentTypes,
        getByName,
        getNames,
        resolve,
        resolveBinary
    };
})();
