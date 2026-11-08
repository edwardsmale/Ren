/**
 * Functions for working fetch requests.
 */
Ren.FetchUtils = (() => {

    const queue = [];

    let inFlight = 0;

    const MAX_IN_FLIGHT = 3;

    // Fetch requests won't work in downloaded reports due to CORS errors.
    const isEnabled = () => !Ren.UrlContext.isDownloadedReport();

    const logServerError = (url, status) => {

        Ren.Log.error("FetchError", url, null, null, { status });
    };

    function processQueue() {

        if (!isEnabled()) return;

        while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {

            const { url, options, resolve, reject } = queue.shift();

            inFlight++;

            window.fetch(url, options).then(response => {

                if (response.status >= 500 && !options.suppressErrorLogging) {
                    logServerError(url, response.status);
                }

                resolve(response);

            }, reject).finally(() => {

                inFlight--;
                processQueue();
            });
        }
    }

    const fetch = function (url, options) {

        options ??= {};

        // A null URL is an endpoint that isn't configured, whose feature should not have been
        // offered.  It is answered as not found rather than requesting "null".
        if (url === null) {

            return Promise.resolve(new Response(null, { status: 404 }));
        }
        else if (!isEnabled()) {

            return Promise.resolve({ ok: true }); // Return a resolved promise.
        }
        else if (options.jumpQueue) {

            return window.fetch(url, options).then(response => {

                if (response.status >= 500 && !options.suppressErrorLogging) {
                    logServerError(url, response.status);
                }

                return response;
            });
        }
        else {

            return new Promise((resolve, reject) => {

                queue.push({ url, options, resolve, reject });
                processQueue();
            });
        }
    };

    return {
        fetch
    };
})();
