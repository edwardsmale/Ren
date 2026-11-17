/**
 * Runs work in tasks of its own, one piece per task so the page can be drawn between them, with
 * the work for what's in view before the rest.
 *
 * A filter change redraws every visualisation following the filter, which on a large report can
 * take a second or more.  Taken in the order they subscribed, the ones on screen could wait on
 * ones scrolled out of view or on hidden tabs; this way they're redrawn first, and the rest
 * follow.  The first task waits on a timeout, as each piece of work did before, so that events
 * fired in a burst are still answered together; the rest follow on as soon as they can.
 */
Ren.InViewFirstQueue = (() => {

    const inView = [];
    const outOfView = [];

    let isRunScheduled = false;

    // Posted messages aren't slowed when they follow one another, as nested timeouts are.
    const channel = typeof MessageChannel === "function" ? new MessageChannel() : null;

    const runNext = () => {

        isRunScheduled = false;

        const work = inView.length ? inView.shift() : outOfView.shift();

        if (!work) return;

        // Scheduled first, so that work which throws doesn't hold up the rest.
        if (inView.length || outOfView.length) scheduleRun(false);

        work();
    };

    const scheduleRun = (isFirst) => {

        if (isRunScheduled) return;

        isRunScheduled = true;

        if (isFirst || !channel) {

            setTimeout(runNext, 0);
            return;
        }

        channel.port2.postMessage(null);
    };

    if (channel) channel.port1.onmessage = runNext;

    /**
     * Gets a value indicating whether any part of an element is in the window.  One not displayed,
     * such as on a hidden tab, isn't.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    const isInView = (element) => {

        const rect = element.getBoundingClientRect();

        return rect.width > 0 && rect.height > 0 &&
            rect.bottom > 0 && rect.right > 0 &&
            rect.top < window.innerHeight && rect.left < window.innerWidth;
    };

    /**
     * Queues work to run in a task of its own.
     *
     * @param {Function} work
     * @param {Element} [element] - What the work draws.  Without one, it's taken to be in view.
     */
    const add = (work, element) => {

        if (!element || isInView(element)) {
            inView.push(work);
        }
        else {
            outOfView.push(work);
        }

        scheduleRun(true);
    };

    return {
        add,
        isInView
    };
})();
