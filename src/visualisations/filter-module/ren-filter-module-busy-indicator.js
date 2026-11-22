/**
 * Filter Module: the small spinner shown beside a clicked checkbox (or the "Invert" link) until the
 * page has finished updating for the filter it applied.  It fades in only once a second has passed,
 * timed by a CSS animation rather than a JavaScript timer, as the filter blocks the main thread
 * while it applies.
 */
Ren.FilterModule_BusyIndicator = (s) => {

    const reify = Ren.HtmlTemplateFunctions.reifyHtmlTemplate;

    const REVEAL_DELAY_MS = 1000;

    // A gap longer than this between two checks means work ran in it, so the page hadn't settled.
    const LONG_TASK_MS = 50;

    // How many checks in a row must find nothing running before the update counts as finished.
    const QUIET_CHECKS_NEEDED = 2;

    // By control key, as a re-render replaces the control an update is still under way for.
    const busyControls = new Map(); // { startTime, spinner, runCount }

    /**
     * Gets the key a control is known by across re-renders.
     */
    const keyOf = (kind, scopeKey, valueKey) =>
        kind + s.NODE_KEY_SEPARATOR + scopeKey +
        (valueKey === undefined ? "" : s.NODE_KEY_SEPARATOR + valueKey);

    // The spinner is positioned off the anchor's left edge, which the anchor's CSS must make it
    // relative to.
    const showSpinner = (anchor, busyControl) => {

        const spinner = reify("FilterModuleBusySpinner");

        // Shortened by the time already spent, so a spinner put back after a re-render carries on
        // from where the one it replaces had got to.
        spinner.style.animationDelay =
            (REVEAL_DELAY_MS - (performance.now() - busyControl.startTime)) + "ms";

        anchor.insertBefore(spinner, anchor.firstChild);
        busyControl.spinner = spinner;
    };

    const restoreSpinner = (anchor, key) => {

        const busyControl = busyControls.get(key);

        if (!busyControl || busyControl.spinner.parentElement === anchor) return;

        busyControl.spinner.remove();
        showSpinner(anchor, busyControl);
    };

    // A requestAnimationFrame callback alone runs before that frame is painted.
    const afterNextPaint = (callback) => {

        requestAnimationFrame(() => setTimeout(callback, 0));
    };

    // Waits for the page to catch up: no messages queued and no long task between frames.
    const whenSettled = (callback) => {

        let quietChecks = 0;
        let lastCheckTime = performance.now();

        const check = () => {

            const now = performance.now();
            const isQuiet = Ren.MessageBus.isIdle() && now - lastCheckTime < LONG_TASK_MS;

            lastCheckTime = now;
            quietChecks = isQuiet ? quietChecks + 1 : 0;

            if (quietChecks >= QUIET_CHECKS_NEEDED) {

                callback();
                return;
            }

            afterNextPaint(check);
        };

        afterNextPaint(check);
    };

    const runShowingSpinner = (anchor, key, action, event) => {

        let busyControl = busyControls.get(key);

        if (!busyControl) {

            busyControl = { startTime: performance.now(), spinner: null, runCount: 0 };
            busyControls.set(key, busyControl);

            showSpinner(anchor, busyControl);
        }

        busyControl.runCount++;

        // Deferred until the spinner is on screen, as its reveal can't start while blocked.
        afterNextPaint(() => {

            try {

                if (!s.visualisation.isDestroyed) action(event);
            }
            finally {

                whenSettled(() => {

                    busyControl.runCount--;

                    if (busyControl.runCount > 0) return;

                    busyControl.spinner.remove();
                    busyControls.delete(key);
                });
            }
        });
    };

    /**
     * Gets an event handler running the action with a spinner left of the anchor until the page
     * has finished updating.  Called as the control is built, so it also puts back the spinner of
     * an update still under way, which a re-render took away with the old control.
     */
    const wrapAction = (anchor, key, action) => {

        restoreSpinner(anchor, key);

        return (event) => runShowingSpinner(anchor, key, action, event);
    };

    /**
     * Gets a checkbox event handler, as wrapAction does, anchored on the checkbox's label.  The
     * checkbox must sit at its label's left edge.
     */
    const wrapCheckboxAction = (input, key, action) =>
        wrapAction(input.parentElement, key, action);

    return {
        keyOf,
        wrapAction,
        wrapCheckboxAction
    };
};
