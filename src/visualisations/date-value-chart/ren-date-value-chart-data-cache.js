/**
 * What a date/value chart's data costs to work out once, held across the redraws its own date
 * range brings.
 *
 * Panning and zooming a chart redraws it, but the range only chooses which bins are drawn:
 * normalising the rows, calculating them, binning them and aggregating each bin all see the same
 * data either way.  Holding that working here turns a pan from a walk over every row into a walk
 * over the bins.
 *
 * Everything is keyed on the row array itself, weakly, so rows that have gone take their working
 * with them, and each kind is bounded so that the charts sharing one data set cannot fill it.
 */
Ren.DateValueChart_DataCache = (() => {

    // How many of each kind are kept for one data set: enough for the charts sharing it, and for
    // the bin periods a zoom coarsens through.
    const MAX_ENTRIES = {

        // One per bin period, as zooming out coarsens through them and back.
        bins: 10,
        calculatedRows: 4,
        dateCoverage: 8,
        normalisedRows: 4,
        splitValueCount: 4
    };

    const DEFAULT_MAX_ENTRIES = 4;

    const storesByRows = new WeakMap();

    const getStore = (rows, kind) => {

        let stores = storesByRows.get(rows);

        if (!stores) {

            stores = {};
            storesByRows.set(rows, stores);
        }

        return stores[kind] || (stores[kind] = new Map());
    };

    /**
     * Gets a kind of working for a data set under a key, building it on the first read.  A store
     * is held in least-recently-read order, so a read moves its entry to the end and a write past
     * the kind's limit drops the entry at the front.
     */
    const readOrBuild = (rows, kind, key, build) => {

        if (!rows) return build();

        const store = getStore(rows, kind);

        if (store.has(key)) {

            const cached = store.get(key);

            store.delete(key);
            store.set(key, cached);

            return cached;
        }

        const built = build();

        store.set(key, built);

        while (store.size > (MAX_ENTRIES[kind] || DEFAULT_MAX_ENTRIES)) {

            store.delete(store.keys().next().value);
        }

        return built;
    };

    /**
     * Drops everything held for a data set, for a change its keys do not describe.
     */
    const clear = (rows) => {

        if (rows) storesByRows.delete(rows);
    };

    return {
        clear,
        readOrBuild
    };
})();
