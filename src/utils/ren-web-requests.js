/**
 * Functions for making web requests.
 */
Ren.WebRequests = (() => {

    const getCacheKey = (url, regexPattern) => {

        return regexPattern ? `${url}|${regexPattern}` : url;
    };

    const responseCache = {};
    const CACHE_SCRIPT_CLASS = "ren-web-request-cache";

    /**
     * Encodes a string to base64.
     */
    const encodeBase64 = (str) => {

        return btoa(unescape(encodeURIComponent(str)));
    };

    /**
     * Decodes a base64 string.
     */
    const decodeBase64 = (str) => {

        return decodeURIComponent(escape(atob(str)));
    };

    /**
     * Embeds all cached responses as script elements in the document, for use in downloaded
     * reports.
     * @returns {string[]} Array of script element outer HTML strings.
     */
    const embedCacheAsScriptElements = () => {

        const scriptElements = [];

        for (const cacheKey in responseCache) {

            const cacheEntry = responseCache[cacheKey];

            // Split cacheKey to get url and regexPattern
            const [url, regexPattern] = cacheKey.split('|');

            const scriptElement = document.createElement("script");
            scriptElement.type = "application/json";
            scriptElement.className = CACHE_SCRIPT_CLASS;
            scriptElement.setAttribute("data-url", url);

            if (regexPattern) {
                scriptElement.setAttribute("data-regex-pattern", regexPattern);
            }

            scriptElement.setAttribute("data-expires-at", cacheEntry.expiresAt.toString());
            scriptElement.setAttribute("data-encoded", "base64");

            // Encode response as base64 to avoid HTML parsing issues
            scriptElement.textContent = encodeBase64(cacheEntry.response);

            scriptElements.push(scriptElement.outerHTML);
        }

        return scriptElements;
    };

    /**
     * Loads cached responses from script elements in the document (for downloaded reports).
     */
    const loadCacheFromScriptElements = () => {

        const scriptElements = document.querySelectorAll("script." + CACHE_SCRIPT_CLASS);

        scriptElements.forEach((scriptElement) => {

            const url = scriptElement.getAttribute("data-url");
            const regexPattern = scriptElement.getAttribute("data-regex-pattern") || undefined;
            const expiresAt = scriptElement.getAttribute("data-expires-at");
            const encodedResponse = scriptElement.textContent;
            const isEncoded = scriptElement.getAttribute("data-encoded") === "base64";

            const response = isEncoded ? decodeBase64(encodedResponse) : encodedResponse;

            const cacheKey = getCacheKey(url, regexPattern);

            responseCache[cacheKey] = {
                response: response,
                expiresAt: expiresAt === "Infinity" ? Infinity : parseFloat(expiresAt)
            };
        });
    };

    Ren.Messages.Events.pageLoaded.handle(() => {

        loadCacheFromScriptElements();
    });

    /**
     * Makes a synchronous POST request via the proxy.  Optionally caches responses for the given
     * duration.  In downloaded reports, first checks for cached responses in script elements.
     * @param {string} url - The URL to request.
     * @param {number} [cacheDurationMs] - Optional cache duration.  0/undefined = no cache; -1
     *   caches for the lifetime of the page.
     * @param {RegExp} [regexPattern] - Optional regex to extract specific data from the response.
     * @returns {string|object} The response text, or an error object if failed.
     */
    const makeSynchronousPostRequest = (url, cacheDurationMs, regexPattern) => {

        const now = Date.now();
        const cacheKey = getCacheKey(url, regexPattern);

        // Check memory cache first
        if (cacheDurationMs && responseCache[cacheKey]) {

            const expiresAt = responseCache[cacheKey].expiresAt;

            if (expiresAt === Infinity || expiresAt > now) {

                return responseCache[cacheKey].response;
            }
            else {

                delete responseCache[cacheKey];
            }
        }

        // In downloaded reports, check for embedded script elements.
        if (Ren.UrlContext.isDownloadedReport()) {

            const scriptSelector = 'script.' + CACHE_SCRIPT_CLASS + '[data-url="' + url + '"]';
            const scriptElements = Array.from(document.querySelectorAll(scriptSelector));

            let scriptElement = null;

            if (regexPattern) {

                scriptElement = scriptElements.find(element => element.getAttribute("data-regex-pattern") === regexPattern);
            }
            else {

                scriptElement = scriptElements.find(element => !element.getAttribute("data-regex-pattern"));
            }

            if (scriptElement) {

                const encodedResponse = scriptElement.textContent;
                const isEncoded = scriptElement.getAttribute("data-encoded") === "base64";
                const response = isEncoded ? decodeBase64(encodedResponse) : encodedResponse;
                const scriptExpiresAt = scriptElement.getAttribute("data-expires-at");

                responseCache[cacheKey] = {
                    response: response,
                    expiresAt: scriptExpiresAt === "Infinity" ? Infinity : parseFloat(scriptExpiresAt)
                };

                return response;
            }
            else {

                console.warn(
                    "Ren.WebRequests: No cached script element found for URL: " + url +
                    (regexPattern ? ", regexPattern: " + regexPattern : "") +
                    ". Available cached keys: " + Object.keys(responseCache).join(", ")
                );
            }
        }

        const proxyUrl = Ren.Endpoints.getUrl(
            regexPattern ? "makeRequestAndExtract" : "makeRequest"
        );

        if (!proxyUrl) {

            return {
                failed: true,
                errorDetails: { url, status: 0, statusText: "No web request endpoint configured" }
            };
        }

        const xhr = new XMLHttpRequest();
        xhr.open("POST", proxyUrl, false); // synchronous
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.send(JSON.stringify({ url, regexPattern }));

        if (xhr.status === 200) {

            if (cacheDurationMs) {

                responseCache[cacheKey] = {
                    response: xhr.responseText,
                    expiresAt: cacheDurationMs === -1 ? Infinity : (now + cacheDurationMs)
                };
            }

            return xhr.responseText;
        }
        else {

            const errorDetails = {
                url,
                status: xhr.status,
                statusText: xhr.statusText,
                responseText: xhr.responseText
            };
            Ren.GlobalErrorHandler.logError("[WebRequests] Web request failed", errorDetails);

            Ren.Log.error("WebRequestFailed", url, null, null, errorDetails);

            return {
                failed: true,
                errorDetails
            };
        }
    };

    return {
        makeSynchronousPostRequest,
        embedCacheAsScriptElements,
        loadCacheFromScriptElements
    };
})();
