/**
 * A small timing harness, for measuring where the time goes when a report loads.
 *
 * Nothing here runs unless it is switched on, either by adding renPerf=1 to the page's query
 * string or by calling Ren.Perf.enable() from the console.  When it is off, time() calls the
 * function and returns, so a measured call site costs one property read.
 *
 * Measurements accumulate per name across the life of the page.  Ren.Perf.report() prints them,
 * and Ren.Perf.reset() clears them, which is what an A/B comparison of two code paths on the same
 * report wants between runs.
 */
Ren.Perf = (() => {

    // Read once: the query string does not change without a reload, and this is consulted on hot
    // paths.
    let enabled = location.search.indexOf("renPerf=1") !== -1;

    const entries = new Map();

    const getEntry = (name) => {

        let entry = entries.get(name);

        if (entry === undefined) {

            entry = { name, calls: 0, totalMs: 0, maxMs: 0, bytes: 0 };
            entries.set(name, entry);
        }

        return entry;
    };

    /**
     * Records a measurement that was taken elsewhere - by a worker, say, which has its own clock
     * and reports back how long each of its stages took.
     */
    const record = (name, milliseconds, bytes) => {

        if (!enabled) return;

        const entry = getEntry(name);

        entry.calls++;
        entry.totalMs += milliseconds;
        entry.bytes += bytes ?? 0;

        if (milliseconds > entry.maxMs) entry.maxMs = milliseconds;
    };

    /**
     * Times a synchronous function, records the result under the given name, and returns whatever
     * the function returned.  The function is called whether or not timing is enabled.
     */
    const time = (name, fn) => {

        if (!enabled) return fn();

        const start = performance.now();

        try {

            return fn();
        }
        finally {

            record(name, performance.now() - start);
        }
    };

    /**
     * The asynchronous counterpart of time(), for awaiting a promise and recording how long the
     * wait was.
     */
    const timeAsync = async (name, fn) => {

        if (!enabled) return fn();

        const start = performance.now();

        try {

            return await fn();
        }
        finally {

            record(name, performance.now() - start);
        }
    };

    /**
     * Starts a measurement that is finished by calling the returned function.  For a span that
     * does not correspond to a single call, such as one that begins in one handler and ends in
     * another.  The returned function is safe to call when timing is off.
     */
    const start = (name) => {

        if (!enabled) return () => { };

        const startedAt = performance.now();

        return (bytes) => record(name, performance.now() - startedAt, bytes);
    };

    const roundTo1DP = (value) => Math.round(value * 10) / 10;

    const megabytes = (bytes) => Math.round(bytes / 1048576 * 100) / 100;

    const report = () => {

        if (!entries.size) {

            console.log("[Perf] Nothing recorded." +
                (enabled ? "" : "  Timing is off - add renPerf=1 to the URL, or call Ren.Perf.enable()."));

            return;
        }

        const rows = [];

        entries.forEach(entry => {

            rows.push({
                Name: entry.name,
                Calls: entry.calls,
                "Total (ms)": roundTo1DP(entry.totalMs),
                "Mean (ms)": roundTo1DP(entry.totalMs / entry.calls),
                "Max (ms)": roundTo1DP(entry.maxMs),
                "MB": entry.bytes ? megabytes(entry.bytes) : ""
            });
        });

        rows.sort((a, b) => b["Total (ms)"] - a["Total (ms)"]);

        console.table(rows);
    };

    const reset = () => entries.clear();

    const enable = () => {

        enabled = true;
        console.log("[Perf] Timing enabled.  Ren.Perf.report() to see the numbers.");
    };

    const isEnabled = () => enabled;

    return {
        record,
        time,
        timeAsync,
        start,
        report,
        reset,
        enable,
        isEnabled
    };
})();
