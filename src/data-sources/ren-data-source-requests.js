/**
 * The options a data source is requested with: the Accept and Cache-Control headers Ren asks for,
 * then the dataSourceRequests section of ren.config, then each request hook registered through
 * Ren.Extensions.registerDataSourceRequestHook, which is where an auth token is added.
 */
Ren.DataSourceRequests = (() => {

    const hooks = [];

    Ren.Extensions.handle("dataSourceRequestHook", (hook) => hooks.push(hook));

    /**
     * Gets the fetch options to request the data source with, given those Ren itself needs.
     */
    const getOptions = async (dataSourceUri, options) => {

        const requestConfig = Ren.Config.getConfig().dataSourceRequests || {};

        options.headers = Object.assign({}, options.headers, requestConfig.headers);

        if (requestConfig.credentials) options.credentials = requestConfig.credentials;

        // A hook may change the options it is given or return others in their place.
        for (let index = 0; index < hooks.length; index++) {

            const hooked = await hooks[index](dataSourceUri, options);

            if (hooked) options = hooked;
        }

        return options;
    };

    return {
        getOptions
    };
})();
