/**
 * Parses a fetched data source's JSON on a worker thread instead of the main one.
 *
 * A large report's response is tens of megabytes of JSON, and JSON.parse blocks the main thread for
 * as long as it takes to walk it.  The parse needs nothing from the DOM, so it can be done
 * elsewhere; the difficulty is the structured clone returning the result, which can cost as much as
 * the parse saved.
 *
 * Three modes exist so that the two costs can be measured against each other on the same report:
 *
 *   off    - the main thread parses, exactly as before.  The baseline.
 *   parse  - the worker parses and posts the object graph back.  Pays a full structured clone.
 *   packed - the worker parses, then packs every row's compressed values into one flat
 *            Float64Array per tab, which is transferred rather than copied.  The rows themselves
 *            are never cloned; the main thread rebuilds them as views over the transferred buffer.
 *
 * Choose with renParseWorker=off|parse|packed on the query string, or Ren.DataSourceParseWorker
 * .setMode() at runtime.  The default is off, so nothing changes until someone asks for it.
 *
 * A binary (RENP) response is decoded here too, by parseBinary, and that is on by default: its rows
 * and its compression dictionary come back in transferred buffers whichever thread reads them, so
 * unlike the JSON modes there is no clone to weigh the saving against.  renParseWorker=off leaves
 * Ren.DataSourceFormat_RenPack to read the response on the main thread, with the same
 * Ren.DataSourceDecoding reader the worker uses.
 *
 * Only the parse moves: the fetch, its headers and queueing, the error handling and the logging all
 * stay on the main thread, so a failure here can always fall back to the existing path.
 */
Ren.DataSourceParseWorker = (() => {

    // The number of workers to keep.  Ren.FetchUtils allows three data source requests in flight at
    // once, so a fourth worker would never have anything to do.
    const MAX_WORKERS = 3;

    // How long to wait for a new worker to answer its readiness ping.  Generous: it only has to
    // evaluate a few hundred lines, and the wait happens once per page, before the first data
    // source's body is read.
    const HANDSHAKE_TIMEOUT_MS = 3000;

    const MODES = { off: true, parse: true, packed: true };

    const readMode = () => {

        const match = /[?&]renParseWorker=(off|parse|packed)/.exec(location.search);

        return match ? match[1] : "off";
    };

    let mode = readMode();

    // Whether a binary response is decoded on a worker.  Unlike the modes above this is on unless
    // it is turned off: a binary format's rows and dictionary come back in transferred buffers
    // rather than as an object graph, so there is no structured clone to weigh the saving against
    // and nothing to compare.  renParseWorker=off stands it down along with everything else.
    let binaryEnabled = !/[?&]renParseWorker=off/.test(location.search);

    /**
     * The worker's whole source, written as a function and stringified rather than kept in its own
     * file so that it is linted with everything else and needs no route or cache-busting of its
     * own.  Nothing in here may reference Ren or the DOM: the worker has neither, and is instead
     * given its own instance of Ren.DataSourceDecoding as decoding.
     */
    const workerSource = (decoding) => {

        /**
         * Packs one tab's rows into flat buffers that can be transferred instead of copied.
         *
         * In a compressed collection every CV entry is a number or null and nothing else, which is
         * what makes the values packable into a Float64Array.  The guarantee is checked rather than
         * assumed: anything unexpected abandons the pack and leaves the rows to be cloned normally.
         *
         * Nulls cannot live in a Float64Array, so they are recorded in a byte mask alongside, with
         * a per-row summary byte so that the overwhelmingly common null-free rows are rebuilt
         * without consulting the mask at all.
         */
        const packRows = (tabularData) => {

            const rowModels = tabularData.RowModels;

            if (!Array.isArray(rowModels) || !rowModels.length) return null;

            const rowCount = rowModels.length;
            const columnCount = tabularData.ColumnModels.length;

            if (!columnCount) return null;

            const values = new Float64Array(rowCount * columnCount);
            const rowHasNull = new Uint8Array(rowCount);

            // Allocated only if a null is actually met, which for many reports is never.
            let nullMask = null;

            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                const compressedValues = rowModels[rowIndex].CV;

                // A row without a CV array means the collection is not compressed after all.
                if (compressedValues === null || compressedValues === undefined) return null;

                const offset = rowIndex * columnCount;

                for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

                    const value = compressedValues[columnIndex];

                    if (typeof value === "number") {

                        values[offset + columnIndex] = value;
                        continue;
                    }

                    if (value === null || value === undefined) {

                        if (nullMask === null) nullMask = new Uint8Array(rowCount * columnCount);

                        nullMask[offset + columnIndex] = 1;
                        rowHasNull[rowIndex] = 1;
                        continue;
                    }

                    // A string, or anything else: not packable, so give up and let the rows travel
                    // as they are.
                    return null;
                }
            }

            return { rowCount, columnCount, values, rowHasNull, nullMask };
        };

        /**
         * Packs every tab of every set, replacing each tab's RowModels with the packed buffers so
         * that the rows are not cloned on the way back. Returns the buffers to transfer, or null if
         * any tab could not be packed - in which case nothing is changed and the rows travel whole.
         */
        const packCollection = (collection) => {

            const sets = collection.TabularDataSets;

            if (!Array.isArray(sets)) return null;

            const packedPerTab = [];

            for (let setIndex = 0; setIndex < sets.length; setIndex++) {

                const tabularDatas = sets[setIndex].TabularDatas;

                if (!Array.isArray(tabularDatas)) return null;

                for (let tabIndex = 0; tabIndex < tabularDatas.length; tabIndex++) {

                    const packed = packRows(tabularDatas[tabIndex]);

                    if (packed === null) return null;

                    packedPerTab.push({ setIndex, tabIndex, packed });
                }
            }

            const transferables = [];

            for (let i = 0; i < packedPerTab.length; i++) {

                const entry = packedPerTab[i];
                const packed = entry.packed;
                const tabularData = sets[entry.setIndex].TabularDatas[entry.tabIndex];

                tabularData.RowModels = null;

                tabularData.PackedRows = {
                    rowCount: packed.rowCount,
                    columnCount: packed.columnCount,
                    values: packed.values.buffer,
                    rowHasNull: packed.rowHasNull.buffer,
                    nullMask: packed.nullMask === null ? null : packed.nullMask.buffer
                };

                transferables.push(packed.values.buffer, packed.rowHasNull.buffer);

                if (packed.nullMask !== null) transferables.push(packed.nullMask.buffer);
            }

            return transferables;
        };

        /**
         * Decodes a binary response, which is always a RENP one - the only binary format there is.
         * There is no text to hand back when this fails, since the bytes were never decoded on the
         * main thread, so a failure is reported rather than fallen back from.
         */
        const handleBinaryMessage = (id, buffer) => {

            const startedAt = performance.now();

            const decoded = decoding.decodeRenPack(buffer);

            // Nothing decoded is a view onto the response, so it goes back too, for the main
            // thread to keep for a downloaded report.
            decoded.transferables.push(buffer);

            self.postMessage(
                {
                    id,
                    collection: decoded.collection,
                    buffer,
                    timings: { renPackMs: performance.now() - startedAt },
                    postedAt: performance.now()
                },
                decoded.transferables
            );
        };

        self.onmessage = (e) => {

            const id = e.data.id;

            // The handshake the main thread does before it entrusts any bytes to this worker.  A
            // worker whose script fails to evaluate never answers it, and is stood down while
            // nothing is at stake.
            if (e.data.ping === true) {

                self.postMessage({ id, pong: true });
                return;
            }

            const requestedMode = e.data.mode;
            const buffer = e.data.buffer;

            const timings = {};

            try {

                if (e.data.binary === true) {

                    handleBinaryMessage(id, buffer);
                    return;
                }

                let startedAt = performance.now();

                const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));

                timings.decodeMs = performance.now() - startedAt;

                startedAt = performance.now();

                let collection;

                try {

                    collection = JSON.parse(text);
                }
                catch (parseError) {

                    // Let the main thread report an unparseable response the way it always has,
                    // with the text in hand.
                    self.postMessage({ id, fallback: "unparseable", text });
                    return;
                }

                timings.parseMs = performance.now() - startedAt;

                // Anything but a collection - an array of objects, or columns and rows - needs one
                // of Ren's adapters to become one.  They are not available here, so hand it back.
                if (!collection || Array.isArray(collection.TabularDataSets) === false) {

                    self.postMessage({ id, fallback: "notACollection", text });
                    return;
                }

                startedAt = performance.now();

                collection = decoding.replaceEscapedNewlinesInCollection(collection);

                timings.newlinesMs = performance.now() - startedAt;

                let transferables = [];

                if (requestedMode === "packed") {

                    startedAt = performance.now();

                    const packedTransferables = packCollection(collection);

                    timings.packMs = performance.now() - startedAt;

                    if (packedTransferables !== null) transferables = packedTransferables;
                }

                self.postMessage(
                    { id, collection, text, timings, postedAt: performance.now() },
                    transferables
                );
            }
            catch (error) {

                self.postMessage({ id, fallback: "error", error: String(error && error.message) });
            }
        };
    };

    let workerUrl = null;
    let pool = null;
    let nextWorkerIndex = 0;
    let nextRequestId = 1;
    let unavailableReason = null;

    // Resolves to whether the pool answered its readiness handshake.  Held so that the handshake is
    // done once, and cleared whenever the pool is stood down so that it is done again if the mode
    // is switched back on.
    let readyPromise = null;

    const pending = new Map();

    const createWorkerUrl = () => {

        const blob = new Blob(
            [
                "(" + workerSource.toString() + ")(" +
                "(" + Ren.createDataSourceDecoding.toString() + ")());"
            ],
            { type: "application/javascript" }
        );

        return URL.createObjectURL(blob);
    };

    const onWorkerMessage = (e) => {

        const entry = pending.get(e.data.id);

        if (entry === undefined) return;

        pending.delete(e.data.id);
        entry.resolve(e.data);
    };

    const terminate = () => {

        readyPromise = null;

        if (pool !== null) {

            for (let i = 0; i < pool.length; i++) pool[i].terminate();

            pool = null;
        }

        if (workerUrl !== null) {

            URL.revokeObjectURL(workerUrl);
            workerUrl = null;
        }
    };

    const onWorkerError = (e) => {

        // A worker that has failed to start is not going to start for the next request either, so
        // stand the pool down and let everything fall back to the main thread.  The bytes of any
        // request in flight went with the transfer, so those callers are told to give up rather
        // than to re-parse a buffer that is no longer theirs.
        console.warn(
            "[DataSourceParseWorker] Worker error, falling back to the main thread:",
            e.message ?? e
        );

        unavailableReason = e.message ?? "worker error";

        pending.forEach(entry => entry.resolve({ fallback: "error" }));
        pending.clear();

        terminate();
    };

    /**
     * Builds the pool on first use.  A page that never loads a server-side data source therefore
     * never creates a worker, and a browser or content security policy that refuses to make one
     * leaves the mode permanently off rather than failing once per request.
     */
    const ensurePool = () => {

        if (pool !== null) return true;
        if (unavailableReason !== null) return false;

        try {

            workerUrl = createWorkerUrl();

            const workerCount = Math.max(
                1,
                Math.min(MAX_WORKERS, (navigator.hardwareConcurrency ?? 2) - 1)
            );

            pool = [];

            for (let i = 0; i < workerCount; i++) {

                const worker = new Worker(workerUrl);

                worker.onmessage = onWorkerMessage;
                worker.onerror = onWorkerError;

                pool.push(worker);
            }

            return true;
        }
        catch (error) {

            // The likeliest cause is a content security policy that does not allow blob: workers.
            console.warn(
                "[DataSourceParseWorker] Could not create workers, falling back to the main thread:",
                error
            );

            unavailableReason = String(error && error.message);
            pool = null;

            return false;
        }
    };

    /**
     * Builds the pool and waits for every worker to answer a ping before any of them is given a
     * response body to parse, resolving to whether the pool is usable.  The result is remembered,
     * so the handshake happens once per page rather than once per data source.
     *
     * The bytes are transferred rather than copied, so a worker that dies holding them takes the
     * only copy with it.  Nearly every way that can happen - a content security policy forbidding
     * blob: workers, a syntax error in the worker source, no Worker at all - shows itself when the
     * script is evaluated, which is what this handshake waits for.
     */
    const ensureReady = () => {

        if (readyPromise !== null) return readyPromise;

        if (!ensurePool()) {

            readyPromise = Promise.resolve(false);
            return readyPromise;
        }

        const timeReady = Ren.Perf.start("worker.poolStartup");

        const pings = pool.map(worker => new Promise((resolve) => {

            const id = nextRequestId++;

            pending.set(id, { resolve });

            // A worker that answers neither the ping nor onerror would otherwise leave every data
            // source waiting on a handshake that never completes, so a silence is a failure too.
            setTimeout(() => {

                if (pending.delete(id)) resolve({ timedOut: true });

            }, HANDSHAKE_TIMEOUT_MS);

            worker.postMessage({ id, ping: true });
        }));

        readyPromise = Promise.all(pings).then(results => {

            timeReady();

            const allReady = results.every(result => result.pong === true);

            if (!allReady) {

                console.warn("[DataSourceParseWorker] Workers did not answer the readiness " +
                    "handshake; parsing stays on the main thread.");

                unavailableReason = "worker did not answer the readiness handshake";
                terminate();
            }

            return allReady;
        });

        return readyPromise;
    };

    const isEnabled = () => mode !== "off" && unavailableReason === null;

    const isBinaryEnabled = () => binaryEnabled && unavailableReason === null;

    const getMode = () => mode;

    /**
     * Switches decoding of binary responses on a worker on and off at runtime, for comparing it
     * with the main thread's reader without reloading.  Returns whether it is on afterwards.
     */
    const setBinaryEnabled = (enabled) => {

        binaryEnabled = enabled === true;

        // Only a previous failure needs clearing, so that the pool is tried again.
        if (binaryEnabled) unavailableReason = null;

        return binaryEnabled;
    };

    /**
     * Switches mode at runtime, for comparing the paths without reloading.  Returns the mode in
     * force afterwards.
     */
    const setMode = (newMode) => {

        if (MODES[newMode] !== true) {

            console.warn(
                "[DataSourceParseWorker] Unknown mode: " + newMode +
                ".  Expected off, parse or packed."
            );

            return mode;
        }

        mode = newMode;

        // The mode is read per request, so the existing workers can serve the new one; only a
        // previous failure needs clearing, so that the pool is tried again.
        if (newMode !== "off") unavailableReason = null;

        return mode;
    };

    /**
     * Sends one request to the next worker in the pool, and resolves with its answer.
     */
    const send = (message, transferables) => {

        const id = nextRequestId++;
        const worker = pool[nextWorkerIndex % pool.length];

        nextWorkerIndex++;

        message.id = id;

        return new Promise((resolve) => {

            pending.set(id, { resolve });

            worker.postMessage(message, transferables);
        });
    };

    /**
     * Records what a worker reported about its own stages, and what its answer cost to come back.
     */
    const recordTimings = (result) => {

        if (!result.timings) return;

        Ren.Perf.record("worker.decode", result.timings.decodeMs);
        Ren.Perf.record("worker.parse", result.timings.parseMs);
        Ren.Perf.record("worker.newlines", result.timings.newlinesMs);

        if (result.timings.packMs !== undefined) {

            Ren.Perf.record("worker.pack", result.timings.packMs);
        }

        if (result.timings.renPackMs !== undefined) {

            Ren.Perf.record("worker.renPack", result.timings.renPackMs);
        }

        // The gap between the worker posting and the main thread receiving it is the structured
        // clone plus transfer - the cost this whole exercise is weighed against.  Both threads
        // share one clock origin, so the two readings compare.
        Ren.Perf.record(
            "worker.transferAndClone",
            Math.max(0, performance.now() - result.postedAt)
        );
    };

    /**
     * Parses a fetched response body on a worker.  The buffer is transferred rather than copied, so
     * the main thread neither decodes the UTF-8 nor can read the bytes afterwards.
     *
     * Resolves to { collection, text } on success, to { fallback: true, text } where the worker
     * could not make a collection of the JSON but has handed the text back, and to null where no
     * worker was used at all and the body is still owned outside.
     */
    const parse = async (buffer) => {

        if (!isEnabled() || !await ensureReady()) return null;

        const byteLength = buffer.byteLength;

        const roundTrip = Ren.Perf.start("worker.roundTrip");

        return send({ mode, buffer }, [buffer])
            .then(result => {

                roundTrip(byteLength);
                recordTimings(result);

                if (result.fallback) {

                    // Without the text there is nothing to fall back to: the bytes went to a worker
                    // that then died.  Null would wrongly mean the body is still owned outside.
                    if (result.text === undefined) return { lost: true };

                    return { fallback: true, text: result.text };
                }

                return { collection: result.collection, text: result.text };
            });
    };

    /**
     * Decodes a binary (RENP) response body on a worker.  Everything expensive about reading that
     * format - decoding its dictionary and transposing its columns back into rows - happens on the
     * worker, and both come back in transferred buffers for unpackCollection to rebuild.
     *
     * Resolves to { collection, buffer } on success, buffer being the response handed back, to
     * { lost: true } where the worker could not read the
     * response - there is no text of a binary body to hand back, so the bytes go with it - and to
     * null where no worker was used at all and the buffer is still owned outside.
     */
    const parseBinary = async (buffer) => {

        if (!isBinaryEnabled() || !await ensureReady()) return null;

        const byteLength = buffer.byteLength;

        const roundTrip = Ren.Perf.start("worker.binaryRoundTrip");

        return send({ binary: true, buffer }, [buffer])
            .then(result => {

                roundTrip(byteLength);
                recordTimings(result);

                if (result.fallback) {

                    return { lost: true };
                }

                return { collection: result.collection, buffer: result.buffer };
            });
    };

    /**
     * Rebuilds the compression dictionary of a collection whose strings were posted back as one
     * flat blob and a table of their lengths.  Slicing them back out is far cheaper than the copy
     * of every string posting the array itself would have cost, since a substring shares the large
     * string's characters rather than copying them.
     */
    const unpackDictionary = (collection) => {

        const packed = collection.PackedDictionary;

        if (!packed) return;

        const unpack = Ren.Perf.start("main.unpackDictionary");

        const count = packed.count;
        const blob = packed.blob;
        const lengths = new Uint32Array(packed.lengths);
        const nullLength = Ren.DataSourceDecoding.PACKED_NULL_STRING_LENGTH;

        const strings = new Array(count);

        let position = 0;

        for (let index = 0; index < count; index++) {

            const length = lengths[index];

            if (length === nullLength) {

                strings[index] = null;
                continue;
            }

            strings[index] = blob.substring(position, position + length);

            position += length;
        }

        collection.CompressionDictionary = strings;

        delete collection.PackedDictionary;

        unpack();
    };

    /**
     * Rebuilds the RowModels of any tab whose rows were packed into transferred buffers.  A
     * null-free row becomes a view onto the shared buffer, which costs one small object and no
     * per-cell work; a view cannot be spliced, which is why Ren.ObjectUtils.cloneTabularData turns
     * one back into a plain array.  A row with nulls is rebuilt as a plain array with its nulls in
     * place, since a Float64Array cannot hold one.
     */
    const unpackCollection = (collection) => {

        // A binary response's dictionary travels packed too; a JSON one's never does, and this
        // costs a property read.
        unpackDictionary(collection);

        const sets = collection.TabularDataSets;

        if (!Array.isArray(sets)) return;

        const unpack = Ren.Perf.start("main.unpackRows");

        for (let setIndex = 0; setIndex < sets.length; setIndex++) {

            const tabularDatas = sets[setIndex].TabularDatas;

            if (!Array.isArray(tabularDatas)) continue;

            for (let tabIndex = 0; tabIndex < tabularDatas.length; tabIndex++) {

                const tabularData = tabularDatas[tabIndex];
                const packed = tabularData.PackedRows;

                if (!packed) continue;

                const rowCount = packed.rowCount;
                const columnCount = packed.columnCount;

                const values = new Float64Array(packed.values);
                const rowHasNull = new Uint8Array(packed.rowHasNull);
                const nullMask = packed.nullMask === null ? null : new Uint8Array(packed.nullMask);

                const rowModels = new Array(rowCount);

                for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {

                    const offset = rowIndex * columnCount;

                    if (rowHasNull[rowIndex] === 0) {

                        rowModels[rowIndex] = { CV: values.subarray(offset, offset + columnCount) };
                        continue;
                    }

                    const compressedValues = new Array(columnCount);

                    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {

                        compressedValues[columnIndex] = nullMask[offset + columnIndex] === 1
                            ? null
                            : values[offset + columnIndex];
                    }

                    rowModels[rowIndex] = { CV: compressedValues };
                }

                tabularData.RowModels = rowModels;

                delete tabularData.PackedRows;
            }
        }

        unpack();
    };

    /**
     * Resolves to whether a worker is going to parse the next response.
     */
    const isAvailable = async () => isEnabled() && await ensureReady();

    /**
     * Resolves to whether a worker is going to decode the next binary response, which is what tells
     * a caller whether to hand its buffer over or to read it itself.
     */
    const isBinaryAvailable = async () => isBinaryEnabled() && await ensureReady();

    return {
        isEnabled,
        isAvailable,
        isBinaryEnabled,
        isBinaryAvailable,
        getMode,
        setMode,
        setBinaryEnabled,
        parse,
        parseBinary,
        unpackCollection,
        terminate
    };
})();
