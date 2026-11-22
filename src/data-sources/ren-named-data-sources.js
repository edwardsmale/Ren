/**
 * The data sources given by name rather than by URI, as with a data-source-name (or its older name,
 * sql-filename), each fetched from the namedDataSources endpoint with its name on the end.  With no
 * such endpoint, a name gives no data.
 *
 * A host can say how a named data source is fetched, with Ren.Extensions
 * .registerNamedDataSourceOptions(name, options):
 *
 *   noCache  Always fetched afresh (Cache-Control: no-cache), as for one that changes by the
 *            second.
 *   quiet    One the page polls in the background: its requests and responses aren't logged to
 *            renLogInsert, and a failure is logged to the console but not shown in a popup.
 */
Ren.NamedDataSources = (() => {

    const NO_OPTIONS = Object.freeze({});

    const optionsByName = new Map();

    const getBaseUri = () => Ren.Endpoints.getUrl("namedDataSources");

    /**
     * Gets the URI of the named data source, or null where there is no namedDataSources endpoint.
     */
    const getUri = (name) => {

        const baseUri = getBaseUri();

        return baseUri ? baseUri + name : null;
    };

    /**
     * Gets a value indicating whether the URI is that of a named data source.
     */
    const isNamedUri = (uri) => {

        const baseUri = getBaseUri();

        return !!baseUri && !!uri && uri.startsWith(baseUri);
    };

    /**
     * Gets the name and any parameters of a named data source's URI, as for a log entry, or any
     * other URI as it is.
     */
    const removeBaseUri = (uri) => isNamedUri(uri) ? uri.substring(getBaseUri().length) : uri;

    /**
     * Gets the name of a named data source from its URI, or null for any other URI.
     */
    const getName = (uri) => isNamedUri(uri) ? removeBaseUri(uri).split("?")[0] : null;

    /**
     * Gets the options registered for the named data source with the specified URI, or none for
     * any other URI.
     */
    const getOptions = (uri) => optionsByName.get(getName(uri)) || NO_OPTIONS;

    /**
     * Gets the options registered for the named data source a log entry's topic names (its name
     * and any parameters, as removeBaseUri gives them).
     */
    const getOptionsForTopic = (topic) =>
        (typeof topic === "string" && optionsByName.get(topic.split("?")[0])) || NO_OPTIONS;

    Ren.Extensions.handle("namedDataSourceOptions", (registration) => {

        optionsByName.set(registration.name, Object.freeze({ ...registration.options }));
    });

    return {
        getName,
        getOptions,
        getOptionsForTopic,
        getUri,
        isNamedUri,
        removeBaseUri
    };
})();
