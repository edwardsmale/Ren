/**
 * Builds the links that ren.config describes: URLs that may be relative to a named base URL, and
 * templates that take a value and the other values in its row.
 *
 * In a template, "{value}" stands for the value and "{row.Heading}" for the value of the row's
 * Heading column, which "{row.Heading:date}" gives without its time.  Values substituted into a
 * URL are URL-encoded.
 */
Ren.Links = (() => {

    const PLACEHOLDER_PATTERN = /\{(value|row\.([^}:]+)(?::(date))?)\}/g;

    const registeredBaseUrls = {};

    Ren.Extensions.handle("baseUrl", (registration) => {

        registeredBaseUrls[registration.name] = registration.getBaseUrl;
    });

    /**
     * Gets the named base URL, from links.baseUrls in ren.config or else one registered through
     * Ren.Extensions.registerBaseUrl, or null if there is neither.
     */
    const getBaseUrl = (name) => {

        const baseUrls = Ren.Config.getConfig().links.baseUrls;

        if (typeof baseUrls[name] === "string") return baseUrls[name];

        if (registeredBaseUrls[name]) return registeredBaseUrls[name]();

        Ren.GlobalErrorHandler.logError(`[Links] No base URL is configured as "${name}".`);
        return null;
    };

    /**
     * Gets the URL relative to the named base URL, or as it is if no base URL is named.
     */
    const resolveUrl = (url, baseUrlName) => {

        if (!baseUrlName) return url;

        const baseUrl = getBaseUrl(baseUrlName);

        if (baseUrl === null) return url;

        return Ren.TextUtils.removeTrailing(baseUrl, "/") + Ren.TextUtils.ensureLeadingSlash(url);
    };

    const getRowValue = (rowValues, heading, isDate) => {

        const rowValue = rowValues ? rowValues[heading] : null;

        if (rowValue === null || rowValue === undefined || rowValue === "") return null;

        return isDate ? Ren.DateUtils.removeTimeComponent(rowValue) : String(rowValue);
    };

    /**
     * Gets the text of a template, or null if a row value it takes is missing.
     */
    const fillTemplate = (template, value, rowValues, isUrl) => {

        let isMissingValue = false;

        const text = template.replace(PLACEHOLDER_PATTERN, (match, name, heading, filter) => {

            const substitute = name === "value"
                ? String(value)
                : getRowValue(rowValues, heading, filter === "date");

            if (substitute === null) {

                isMissingValue = true;
                return "";
            }

            return isUrl ? encodeURIComponent(substitute) : substitute;
        });

        return isMissingValue ? null : text;
    };

    return {
        fillTemplate,
        getBaseUrl,
        resolveUrl
    };
})();
