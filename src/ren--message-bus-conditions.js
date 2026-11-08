Ren.MessageBus_Conditions = (() => {

    let conditionsInterval = null;
    const conditions = [];
    const satisfiedDebouncedConditions = new Map();

    /**
     * Registers a condition to be checked periodically, invoking the callback whenever a predicate
     * is satisfied.
     */
    const onCondition = (predicate, callback, runOnce, debounceMs) => {

        conditions.push({ predicate, callback, runOnce, debounceMs });

        if (!conditionsInterval) conditionsInterval = setInterval(checkConditions, 10);
    };

    /**
     * Registers a callback to be invoked when a specific HTML element becomes visible in the DOM.
     * @param {HTMLElement} element - The HTML element to monitor for visibility.
     * @param {Function} callback - The callback function to invoke when the element becomes
     *   visible.
     * @param {boolean} runOnce - If true, the callback will be invoked only once.
     */
    const onElementVisible = (element, callback, runOnce) => {

        onCondition(() => element && Ren.HtmlUtils.isElementVisible(element), callback, runOnce);
    };

    /**
     * Checks all registered conditions and invokes their callbacks if their predicates are
     * satisfied.
     */
    const checkConditions = () => {

        for (let i = conditions.length - 1; i >= 0; i--) {

            const c = conditions[i];

            if (c.predicate()) {

                try {

                    if (!c.debounceMs) {

                        c.callback();

                        if (c.runOnce) conditions.splice(i, 1);
                    }
                    else {

                        if (!satisfiedDebouncedConditions.has(c)) {

                            satisfiedDebouncedConditions.set(c, Date.now());
                        }

                        const last = satisfiedDebouncedConditions.get(c);

                        if (Date.now() - last >= c.debounceMs) {

                            c.callback();
                            satisfiedDebouncedConditions.set(c, Date.now());

                            if (c.runOnce) conditions.splice(i, 1);
                        }
                    }
                }
                catch (e) {

                    console.trace("Error in message bus condition callback.");
                }
            }
        }

        if (conditions.length === 0) {

            clearInterval(conditionsInterval);
            conditionsInterval = null;
        }
    };

    setTimeout(() => {

        if (!Ren.UrlContext.onEditorPage()) {

            Ren.AllReportsLoadedMessage.notifyAllReportsLoadedOnceNoLoadingAnimationsArePresent();
        }

    }, 500);

    return {
        onCondition,
        onElementVisible
    };
})();
