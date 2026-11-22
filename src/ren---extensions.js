/**
 * The extension API, through which code outside the core (such as a host application's own
 * bundle) adds visualisation types and their defaults, cell menu items, search links, format
 * functions, HTML templates, data source formats, data source request hooks, named data source
 * options, page hooks, settings stores, base URLs and the log entry mapper.
 *
 * A registration made before the registry it is for has loaded is held until that registry
 * handles its kind, so that extensions can load before or after the scripts they extend.
 */
Ren.Extensions = (() => {

    const handlersByKind = {};
    const pendingByKind = {};

    const register = (kind, registration) => {

        const handler = handlersByKind[kind];

        if (handler) {
            handler(registration);
            return;
        }

        if (!pendingByKind[kind]) pendingByKind[kind] = [];

        pendingByKind[kind].push(registration);
    };

    /**
     * Called by a registry to receive the registrations of a kind, those already made first.
     */
    const handle = (kind, handler) => {

        handlersByKind[kind] = handler;

        const pending = pendingByKind[kind];

        delete pendingByKind[kind];

        if (!pending) return;

        for (let i = 0; i < pending.length; i++) handler(pending[i]);
    };

    /**
     * Registers a visualisation type, as described in ren-visualisation-types.js.
     *
     * @param {object} tagOptions - Optional.  selfClosing for a <ren-*> element with no content,
     *   htmlContaining for one whose content is HTML, and nestedTagNames for the <ren-*> elements
     *   a self-closing element may contain.
     */
    const registerVisualisationType = (type, tagOptions) =>
        register("visualisationType", { type, tagOptions: tagOptions || {} });

    /**
     * Registers the options a visualisation type's elements start with, such as the
     * dataSourceName or fetchUri of a data source for every <ren-date-selector>.  An element's
     * own attributes override them.
     *
     * @param {string} typeName - The type's visualisationTypeName, such as "DateSelector".
     * @param {object} defaults - The options, named as their attributes are, camel-cased.
     */
    const registerVisualisationDefaults = (typeName, defaults) =>
        register("visualisationDefaults", { typeName, defaults: defaults || {} });

    /**
     * Registers the menu items offered for a right-clicked data grid cell.
     *
     * @param {string[]|null} columnProperties - The column model properties that mark a column
     *   the items are for, any one being enough, or null for every column.
     * @param {function} buildItems - Given the cell's value and its row's values by column
     *   heading, returns the items, each carrying the root menu section it is placed in.
     */
    const registerCellMenuItems = (columnProperties, buildItems) =>
        register("cellMenuItems", { columnProperties, buildItems });

    /**
     * Registers a link in the Search submenu offered for any value.
     *
     * @param {function} getUrl - Given the value, returns the URL to search with.
     */
    const registerSearchLink = (id, text, getUrl) =>
        register("searchLink", { id, text, getUrl });

    /**
     * Registers a format function, which one of the same name on the page overrides.
     *
     * @param {string} source - The function's source, with its header comment.
     * @param {function} [compiled] - The function compiled from the source, as the build compiles
     *   the library's own, which is run in place of compiling the source on the page, so that it
     *   runs where the page's content security policy doesn't allow eval.  It's given the value,
     *   rowVals, groupSummaryStats, overallSummaryStats and compressedRowVals, and then the
     *   parameters' values (as strings, HTML-escaped for a function tagged html) and the report
     *   parameters.  Ren.FunctionCompiler.buildSources gives the source it compiles from.
     */
    const registerFormatFunction = (name, source, compiled) =>
        register("formatFunction", { name, source, compiled });

    /**
     * Registers an HTML template, which one of the same name on the page overrides.
     *
     * @param {string|function} source - The template, or a function compiled from it, given the
     *   parameters and returning the HTML, which is used without an eval.
     */
    const registerHtmlTemplate = (name, source) =>
        register("htmlTemplate", { name, source });

    /**
     * Registers a data source format, as described in ren-data-source-formats.js.
     */
    const registerDataSourceFormat = (format) => register("dataSourceFormat", format);

    /**
     * Registers a hook called before each data source is requested, as for adding an auth token.
     *
     * @param {function} hook - Given the URI and the fetch options, changes the options or returns
     *   others in their place, either of which it may do asynchronously.
     */
    const registerDataSourceRequestHook = (hook) => register("dataSourceRequestHook", hook);

    /**
     * Registers how a named data source is fetched, as described in ren-named-data-sources.js.
     *
     * @param {object} options - noCache to always fetch it afresh, and quiet for one the page polls
     *   in the background, whose requests aren't logged and whose failures aren't shown.
     */
    const registerNamedDataSourceOptions = (name, options) =>
        register("namedDataSourceOptions", { name, options: options || {} });

    /**
     * Registers the hooks through which a page that runs reports takes part in doing so, as
     * described in ren---page-hooks.js.
     */
    const registerPageHooks = (hooks) => register("pageHooks", hooks);

    /**
     * Registers a store of report settings, which settingsStore in ren.config names, as described
     * in ren-settings-store.js.
     */
    const registerSettingsStore = (name, store) => register("settingsStore", { name, store });

    /**
     * Registers a base URL that links in ren.config name, for one that differs between the
     * environments a page is served from.  A base URL given in links.baseUrls is used instead.
     *
     * @param {function} getBaseUrl - Returns the base URL, when a link is followed.
     */
    const registerBaseUrl = (name, getBaseUrl) => register("baseUrl", { name, getBaseUrl });

    /**
     * Registers the function that turns a log entry into the body POSTed to renLogInsert, which
     * ren.config's loggingEnabled requires.  A later registration replaces an earlier one.
     *
     * @param {function} mapLogEntry - Takes an entry with createdOn (a Date), logLevel,
     *   eventType, logGroup, topic, itemGuid, pageGuid, userGuid, sessionGuid, pageUrl, pageSeq,
     *   pageEventTypeSeq and data (an object, or null), and returns the body.
     */
    const registerLogEntryMapper = (mapLogEntry) => register("logEntryMapper", mapLogEntry);

    return {
        handle,
        registerBaseUrl,
        registerCellMenuItems,
        registerDataSourceFormat,
        registerDataSourceRequestHook,
        registerFormatFunction,
        registerHtmlTemplate,
        registerLogEntryMapper,
        registerNamedDataSourceOptions,
        registerPageHooks,
        registerSearchLink,
        registerSettingsStore,
        registerVisualisationDefaults,
        registerVisualisationType
    };
})();
