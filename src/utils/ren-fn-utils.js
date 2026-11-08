/**
 * Functions for working with functions.
 */
Ren.FnUtils = (() => {

    /**
     * Runs the given function in a deferred manner.  This is useful if the caller needs to allow
     * pending DOM updates to occur before the function is executed, e.g. to bind event handlers
     * to elements that are being created programmatically.
     */
    const defer = (fn, delayMs, secondDelayMs) => {

        const firstDelayMs = delayMs ?? 0;

        setTimeout(fn, firstDelayMs);

        if (secondDelayMs > firstDelayMs) {

            setTimeout(fn, secondDelayMs);
        }
    };

    /**
     * Polls for the given predicate to return a truthy value, calling the callback when it does,
     * passing the truthy value to the callback.
     */
    const onCondition = (
        predicate,
        callback,
        start = Date.now(),
        timeout = 2000,
        pollInterval = 50,
        throwOnFailure = false,
        finishedRef = { finished: false }
    ) => {

        if (finishedRef.finished) return;

        const check = () => {

            if (finishedRef.finished) return;

            const result = predicate();

            if (result) {

                finishedRef.finished = true;
                callback(result);
                return;
            }

            if (Date.now() - start < timeout) {

                setTimeout(check, pollInterval);
            }
            else if (throwOnFailure) {

                finishedRef.finished = true;
                throw new Error(`Predicate was not satisfied within the timeout period of ${timeout}ms.`);
            }
        };

        check();
    };

    /**
     * Polls for the existence of an element matching the given selector, calling the callback
     * when it does, passing the element to the callback.
     */
    const onElementExists = (
        selector,
        callback,
        timeout = 2000,
        pollInterval = 50,
        throwOnFailure = false
    ) => {

        const start = Date.now();
        const finishedRef = { finished: false };
        const predicate = () => Ren.HtmlUtils.get(selector);

        onCondition(
            predicate,
            callback,
            start,
            timeout,
            pollInterval,
            throwOnFailure,
            finishedRef
        );
    };

    const debounce = (fn, delay) => {

        let timeout;

        return function () {

            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, arguments), delay);
        };
    };

    return {
        defer,
        onCondition,
        onElementExists,
        debounce
    };
})();
