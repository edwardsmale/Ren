/**
 * The server URLs Ren calls, from the endpoints in ren.config.  Where an endpoint is not
 * configured, the feature that calls it is not offered.
 */
Ren.Endpoints = (() => {

    /**
     * Gets a value indicating whether the named endpoint is configured.
     */
    const has = (name) => !!Ren.Config.getConfig().endpoints[name];

    /**
     * Gets the URL of the named endpoint, with the configured baseUrl in front of one starting
     * with "/", or null where the endpoint is not configured.
     */
    const getUrl = (name) => {

        const endpoints = Ren.Config.getConfig().endpoints;
        const url = endpoints[name];

        if (!url) return null;

        return url.startsWith("/") ? (endpoints.baseUrl || "") + url : url;
    };

    return {
        getUrl,
        has
    };
})();
