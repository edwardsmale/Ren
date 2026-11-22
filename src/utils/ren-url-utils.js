/**
 * Functions for modifying URLs.
 */
Ren.UrlUtils = (() => {

    /**
     * Parses a URL into its components: path, query string, and hash.
     */
    const parseUrl = (url) => {

        if (!url) return { path: "", queryString: "", hash: "" };

        const hashParts = url.split("#");
        const urlWithoutHash = hashParts[0];
        const hash = hashParts.length > 1 ? hashParts[1] : "";

        const queryParts = urlWithoutHash.split("?");
        const path = queryParts[0];
        const queryString = queryParts.length > 1 ? queryParts[1] : "";

        return { path, queryString, hash };
    };

    /**
     * Reconstructs a URL from its components.
     */
    const reconstructUrl = (path, queryString, hash) => {

        let url = path;

        if (queryString) {
            url += "?" + queryString;
        }

        if (hash) {
            url += "#" + hash;
        }

        return url;
    };

    /**
     * Gets a URL's query string as a URLSearchParams object.
     */
    const getQueryString = (url) => {

        if (!url) return new URLSearchParams();

        const { queryString } = parseUrl(url);

        return new URLSearchParams(queryString);
    };

    const getQueryStringAsArray = (url) => {

        if (!url) return [];

        const queryString = getQueryString(url);

        const queryArray = [];

        for (const [key, value] of queryString.entries()) {

            queryArray.push({ key, value });
        }

        return queryArray;
    };

    const getQueryStringAsObject = (url) => {

        if (!url) return {};

        const queryString = getQueryString(url);

        const queryObject = {};

        for (const [key, value] of queryString.entries()) {

            queryObject[key] = value;
        }

        return queryObject;
    };

    const mergeCurrentQueryStringIntoUrl = (url, keys) => {

        const currentQueryString = Ren.UrlUtils.getQueryStringAsObject(location.href);

        if (keys && Array.isArray(keys)) {

            const currentKeys = Object.keys(currentQueryString);

            for (let i = 0; i < currentKeys.length; i++) {

                if (!keys.includes(currentKeys[i])) {
                    delete currentQueryString[currentKeys[i]];
                }
            }
        }

        const newUrl = Ren.UrlUtils.addAllQueryParametersWhichAreNotInUrl(url, currentQueryString);

        return newUrl;
    };

    const mergeCurrentQueryStringSettingsParametersIntoUrl = (url) => {

        return mergeCurrentQueryStringIntoUrl(url, ["settingsName", "isPreset"]);
    };

    const getUrlPath = (url) => {

        if (!url) return "";

        const { path } = parseUrl(url);

        return path;
    };

    /**
     * Gets the hash part of a URL.
     */
    const getUrlHash = (url) => {

        if (!url) return "";

        const { hash } = parseUrl(url);

        return hash;
    };

    /**
     * Finds the key of an existing query parameter in a URL (case-insensitive).
     */
    const getExistingParameterKey = (url, key) => {

        const queryString = getQueryString(url);

        if (queryString.has(key)) return key;

        const existingKeys = Array.from(queryString.keys());

        for (let i = 0; i < existingKeys.length; i++) {

            if (existingKeys[i].toLowerCase() === key.toLowerCase()) return existingKeys[i];
        }

        return null;
    };

    /**
     * Finds the value of an existing query parameter in a URL.  Compares keys case-insensitively.
     */
    const getParameterValue = (url, key) => {

        const existingKey = getExistingParameterKey(url, key);

        if (existingKey === null) return null;

        const queryString = getQueryString(url);

        return queryString.get(existingKey);
    };

    /**
     * Creates a URL from a base URL, query string, and optional hash.
     */
    const createUrl = (baseUrl, queryString, hash) => {

        const { path, hash: existingHash } = parseUrl(baseUrl);
        const finalHash = hash !== undefined ? hash : existingHash;

        const queryStringToString = queryString.toString();

        return reconstructUrl(path, queryStringToString, finalHash);
    };

    /**
     * Removes any existing query parameter from a URL.  Compares keys case-insensitively.
     */
    const removeQueryParameter = (url, key) => {

        const existingKey = getExistingParameterKey(url, key);

        if (existingKey === null) return url;

        const { path, hash } = parseUrl(url);
        const queryString = getQueryString(url);

        queryString.delete(existingKey);

        return createUrl(path, queryString, hash);
    };

    const removeQueryString = (url) => {

        const { path, hash } = parseUrl(url);

        return reconstructUrl(path, "", hash);
    };

    /**
     * Updates the value of the existing query parameter in a URL, or adds the key-value pair if
     * the URL doesn't contain the query parameter.  Compares keys case-insensitively.
     */
    const upsertQueryParameter = (url, key, val) => {

        const existingKey = getExistingParameterKey(url, key);

        if (existingKey !== null) key = existingKey;
        if (existingKey !== null && (val === null || val === "")) return removeQueryParameter(url, key);
        if (val === null || val === "") return url;

        const { path, hash } = parseUrl(url);
        const queryString = getQueryString(url);

        queryString.set(key, val);

        return createUrl(path, queryString, hash);
    };

    /**
     * Upserts all of the query parameters in the given object to the URL.  Compares keys
     * case-insensitively.
     */
    const upsertAllQueryParameters = (url, parameters, excluding) => {

        let newUrl = url;

        for (const key in parameters) {

            if (excluding && excluding.includes(key)) continue;

            newUrl = upsertQueryParameter(newUrl, key, parameters[key]);
        }

        return newUrl;
    };

    const addAllQueryParametersWhichAreNotInUrl = (url, parameters) => {

        const { path, hash } = parseUrl(url);
        const queryString = getQueryString(url);

        for (const key in parameters) {

            if (!queryString.has(key)) {
                queryString.set(key, parameters[key]);
            }
        }

        return createUrl(path, queryString, hash);
    };

    /**
     * Replaces the query parameters in the URL with the given parameters.
     */
    const replaceQueryString = (url, parameters, excluding) => {

        const { path, hash } = parseUrl(url);

        return upsertAllQueryParameters(reconstructUrl(path, "", hash), parameters, excluding);
    };

    /**
     * Gets all query parameters of the given URL as an object.
     */
    const getAllQueryParameters = (url) => {

        const queryString = getQueryString(url);

        const parameters = {};

        queryString.forEach((value, key) => {

            // Likely redundant, as parseUrl has already separated off any hash fragment.
            if (value.includes("#")) {

                value = value.substring(0, value.indexOf("#"));
            }

            parameters[key] = value;
        });

        return parameters;
    };

    /**
     * If the value looks like a date, converts it to a sortable date format (YYYY-MM-DD).
     */
    const cleanDateValue = (value) => {

        value = value.replace(/ 00:00:00/, ""); // Remove time component if it is 00:00:00.
        value = Ren.DateUtils.toSortableDateAuto(value);

        return value;
    };

    /**
     * Sorts the query parameters of the given URL alphabetically by key.
     */
    const sortQueryParameters = (url) => {

        const { path, hash } = parseUrl(url);
        const queryString = getQueryString(url);
        const sortedQueryString = new URLSearchParams();

        const sortedKeys = Array.from(queryString.keys()).sort();

        for (let i = 0; i < sortedKeys.length; i++) {

            const modifiedKey = Ren.TextUtils.makeFirstCharLowerCase(sortedKeys[i]);

            // Don't include "compareDateRange" since it is a shortcut for setting compareStartDate
            // and compareEndDate.  (There isn't an equivalent for the start and end dates.)
            if (modifiedKey === "compareDateRange") continue;

            let value = queryString.get(sortedKeys[i]);

            value = cleanDateValue(value);

            sortedQueryString.set(modifiedKey, value);
        }

        return createUrl(path, sortedQueryString, hash);
    };

    // URLs are frequently sorted repeatedly during data source operations.
    const sortedDataSourceUriCache = new Map();

    /**
     * Sorts the query parameters of the given data source URI, with the date parameters first.
     */
    const sortDataSourceUriParameters = (url) => {

        if (!url) return url;

        const cached = sortedDataSourceUriCache.get(url);

        if (cached !== undefined) return cached;

        const sortedUrl = sortDataSourceUriParametersCore(url);

        sortedDataSourceUriCache.set(url, sortedUrl);

        // Also cache the sorted URL mapping to itself for fast lookups.
        if (sortedUrl !== url) {
            sortedDataSourceUriCache.set(sortedUrl, sortedUrl);
        }

        return sortedUrl;
    };

    const sortDataSourceUriParametersCore = (url) => {

        url = sortQueryParameters(url);

        const { path, hash } = parseUrl(url);

        const queryString = getQueryString(url);

        const sortedQueryString = new URLSearchParams();
        const priorityKeys = [
            "startDate",
            "endDate",
            "compareStartDate",
            "compareEndDate"
        ];

        for (let i = 0; i < priorityKeys.length; i++) {

            if (queryString.has(priorityKeys[i])) {

                sortedQueryString.set(priorityKeys[i], queryString.get(priorityKeys[i]));
            }
        }

        const remainingKeys = Array.from(queryString.keys()).sort();

        for (let i = 0; i < remainingKeys.length; i++) {

            if (priorityKeys.includes(remainingKeys[i])) continue;
            sortedQueryString.set(remainingKeys[i], queryString.get(remainingKeys[i]));
        }

        return createUrl(path, sortedQueryString, hash);
    };

    /**
     * Gets the domain of the given URL.
     */
    const getDomain = (url) => {

        if (!url || !url.match) return null;

        const match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);

        if (match === null) return null;

        return match[2] || null;
    };

    const ensureLeadingSlash = (url) => {

        return url.startsWith("/") ? url : "/" + url;
    };

    /**
     * Converts an absolute URL to a site-relative URL by removing the domain.
     */
    const makeSiteRelativeUrl = (url) => {

        const domain = getDomain(url);
        if (!domain) return url;

        const index = url.indexOf(domain);
        return url.substring(index + domain.length);
    };

    const canAccessUrl = (url) => {

        const xhr = new XMLHttpRequest();

        xhr.open("HEAD", url, false);

        try {

            xhr.send();
            return xhr.status === 200;
        }
        catch {

            return false;
        }
    };

    const domainAccessibility = new Map();

    const canAccessDomain = (url) => {

        const domain = getDomain(url);

        if (!domain) return false;

        if (domainAccessibility.has(domain)) return domainAccessibility.get(domain);

        const isAccessible = canAccessUrl("https://" + domain);

        domainAccessibility.set(domain, isAccessible);

        return isAccessible;
    };

    return {
        addAllQueryParametersWhichAreNotInUrl,
        canAccessDomain,
        canAccessUrl,
        ensureLeadingSlash,
        getAllQueryParameters,
        getDomain,
        getParameterValue,
        getQueryString,
        getQueryStringAsArray,
        getQueryStringAsObject,
        getUrlHash,
        getUrlPath,
        makeSiteRelativeUrl,
        mergeCurrentQueryStringIntoUrl,
        mergeCurrentQueryStringSettingsParametersIntoUrl,
        parseUrl,
        reconstructUrl,
        removeQueryParameter,
        removeQueryString,
        replaceQueryString,
        sortDataSourceUriParameters,
        sortQueryParameters,
        upsertAllQueryParameters,
        upsertQueryParameter
    };
})();
