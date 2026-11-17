Ren.MessageBus = (() => {

    let interval = null;
    const messageQueue = [];

    // While sendQueuedMessages is sending, a message notified by a listener is sent in the same
    // batch, so starting the timer for it would only make a tick that finds the queue empty, and
    // nest timers deeper (which the browser delays further).
    let isSendingQueuedMessages = false;

    // Bucketed by message type ID, so dispatch never scans every listener on the bus.  Within a
    // bucket, registration order is invocation order.
    const listenerBuckets = new Map();

    // Buckets holding runOnce or orphaned listeners.  Only these are swept, so the common case -
    // nothing to reclaim - costs nothing.
    const bucketsToSweep = new Set();

    const messageTypes = new Map();
    let nextMessageTypeId = 1;

    // Dispatch loops nest when a listener notifies a message immediately, and the buckets must not
    // be spliced until the outermost one has finished.
    let dispatchDepth = 0;

    // The owner new listeners are tagged with, stacked as registration nests (e.g. a render that
    // synchronously creates child visualisations).
    let currentOwner = null;
    const ownerStack = [];

    const startInterval = () => {

        if (interval || isSendingQueuedMessages) return;

        interval = setInterval(sendQueuedMessages, 1);
    };

    const stopInterval = () => {

        if (!interval) return;

        clearInterval(interval);
        interval = null;
    };

    const getOrCreateBucket = messageTypeId => {

        let bucket = listenerBuckets.get(messageTypeId);

        if (!bucket) {

            bucket = [];
            listenerBuckets.set(messageTypeId, bucket);
        }

        return bucket;
    };

    const addListener = (messageTypeId, callback, runOnce) => {

        const listener = { messageTypeId, callback, runOnce, owner: currentOwner };

        getOrCreateBucket(messageTypeId).push(listener);

        // A runOnce listener is reclaimable by the next sweep whether or not it has been invoked,
        // so its bucket is dirty from the moment it is registered.
        if (runOnce) bucketsToSweep.add(messageTypeId);

        return listener;
    };

    const orphanListener = listener => {

        listener.orphaned = true;
        bucketsToSweep.add(listener.messageTypeId);
    };

    /**
     * Removes a listener returned by handle.  Null is ignored.
     */
    const removeListener = listener => {

        if (!listener) return;

        orphanListener(listener);
        sweepListenersIfNotDispatching();
    };

    // The queued message waiting under each message type and dedupe key (undefined for a message
    // type without parameters, whose every notify supersedes the last), so that a later notify
    // finds the one it supersedes without scanning the queue.  A message leaves this when its
    // dispatch starts, after which nothing supersedes it.
    const pendingMessages = new Map();

    /**
     * Marks the waiting message as superseded rather than splicing it out, which would shift the
     * indexes sendQueuedMessages is working through; it is skipped when its turn comes, and
     * cleared from the queue with the rest of its batch.
     */
    const supersedePendingMessage = (messageTypeId, dedupeKey) => {

        const byKey = pendingMessages.get(messageTypeId);

        if (!byKey) return;

        const pending = byKey.get(dedupeKey);

        if (!pending) return;

        pending.isSuperseded = true;
        byKey.delete(dedupeKey);
    };

    const trackPendingMessage = (messageObj, dedupeKey) => {

        let byKey = pendingMessages.get(messageObj.messageTypeId);

        if (!byKey) {

            byKey = new Map();
            pendingMessages.set(messageObj.messageTypeId, byKey);
        }

        messageObj.isTracked = true;
        byKey.set(dedupeKey, messageObj);
    };

    const untrackPendingMessage = messageObj => {

        const byKey = pendingMessages.get(messageObj.messageTypeId);

        if (byKey && byKey.get(messageObj.dedupeKey) === messageObj) {

            byKey.delete(messageObj.dedupeKey);
        }
    };

    const checkArguments = (messageTypeId, argCount, parameterCount) => {

        if (argCount === parameterCount) return;

        const message =
            `Message ${messageTypes.get(messageTypeId)} has ${parameterCount} parameters, ` +
            `but ${argCount} were passed.`;

        throw new Error(message);
    };

    /**
     * Faster than Array.from, which has to go through the iterator protocol.
     */
    const argsToArray = args => {

        const argCount = args.length;
        const copy = new Array(argCount);

        for (let i = 0; i < argCount; i++) copy[i] = args[i];

        return copy;
    };

    const createParameterisedMessageObj = (messageTypeId, parameterCount, args) => {

        checkArguments(messageTypeId, args.length, parameterCount);

        return { messageTypeId, args: argsToArray(args) };
    };

    /**
     * Splicing during a dispatch loop would shift the indexes that loop is iterating over.
     */
    const sweepListenersIfNotDispatching = () => {

        if (dispatchDepth > 0) return;
        if (bucketsToSweep.size === 0) return;

        removeRunOnceAndOrphanedListeners();
    };

    /**
     * Each bucket is spliced in place so that any reference held to it elsewhere stays valid.
     */
    const removeRunOnceAndOrphanedListeners = () => {

        bucketsToSweep.forEach(messageTypeId => {

            const bucket = listenerBuckets.get(messageTypeId);

            if (!bucket) return;

            for (let i = bucket.length - 1; i >= 0; i--) {

                if (bucket[i].runOnce || bucket[i].orphaned) bucket.splice(i, 1);
            }
        });

        bucketsToSweep.clear();
    };

    /**
     * Runs registerFn with `owner` active, so every listener registered during the call is tagged
     * with that owner and can later be removed with removeListenersByOwner.
     */
    const withOwner = (owner, registerFn) => {

        ownerStack.push(currentOwner);
        currentOwner = owner;

        try {
            
            return registerFn();
        }
        finally {

            currentOwner = ownerStack.pop();
        }
    };

    /**
     * A null owner is ignored so that untagged (singleton) listeners are never mass-removed.
     */
    const removeListenersByOwner = (owner) => {

        if (owner == null) return;

        listenerBuckets.forEach(bucket => {

            for (let i = 0; i < bucket.length; i++) {

                if (bucket[i].owner === owner) orphanListener(bucket[i]);
            }
        });
    };

    /**
     * Gets a value indicating whether no messages are waiting to be dispatched.
     */
    const isIdle = () => messageQueue.length === 0;

    /**
     * Creates a message type, with notify, notifyImmediately and handle methods.
     */
    const createMessageType = (parameterNames, options = {}) => {

        const messageTypeId = ++nextMessageTypeId;
        const handle = (callback, runOnce) => addListener(messageTypeId, callback, runOnce);

        if (!parameterNames || !parameterNames.length) {

            return {
                messageTypeId,
                notify: function () {

                    supersedePendingMessage(messageTypeId, undefined);
                    checkArguments(messageTypeId, arguments.length, 0);

                    if (options.isImmediate) {

                        invokeListeners(messageTypeId, null);
                        return;
                    }

                    const messageObj = { messageTypeId };

                    if (options.removeIf) messageObj.removeIf = options.removeIf;

                    // The error is captured but not formatted here: reading .stack is what costs,
                    // and it is only ever read if a listener throws.
                    messageObj.notifyError = new Error();
                    trackPendingMessage(messageObj, undefined);
                    messageQueue.push(messageObj);

                    startInterval();
                },
                notifyImmediately: function () {

                    supersedePendingMessage(messageTypeId, undefined);
                    checkArguments(messageTypeId, arguments.length, 0);

                    invokeListeners(messageTypeId, null);
                },
                handle
            };
        }
        else {

            const parameterCount = parameterNames.length;
            const dedupeKeyFn = options.dedupeKey;

            return {
                messageTypeId,
                notify: function () {

                    const messageObj = createParameterisedMessageObj(
                        messageTypeId,
                        parameterCount,
                        arguments
                    );

                    if (dedupeKeyFn) {

                        // Stored on the message, so that it can be untracked when dispatched.
                        messageObj.dedupeKey = dedupeKeyFn.apply(null, messageObj.args);

                        supersedePendingMessage(messageTypeId, messageObj.dedupeKey);
                    }

                    if (options.removeIf) messageObj.removeIf = options.removeIf;

                    if (options.isImmediate) {

                        invokeListeners(messageTypeId, messageObj.args);
                        return;
                    }

                    messageObj.notifyError = new Error();

                    if (dedupeKeyFn) trackPendingMessage(messageObj, messageObj.dedupeKey);

                    messageQueue.push(messageObj);
                    startInterval();
                },
                notifyImmediately: function () {

                    const messageObj = createParameterisedMessageObj(
                        messageTypeId,
                        parameterCount,
                        arguments
                    );

                    invokeListeners(messageTypeId, messageObj.args);
                },
                handle
            };
        }
    };

    /**
     * Populates the messageTypes map with names corresponding to their IDs.
     */
    const populateMessageNames = types => {

        for (const name in types) {

            if (Object.prototype.hasOwnProperty.call(types, name)) {

                const event = types[name];
                messageTypes.set(event.messageTypeId, name);
            }
        }
    };

    const outputListenerStackTrace = (notifyError, messageTypeId) => {

        const formattedStack = `Notification: ${messageTypes.get(messageTypeId)}\n` +
            notifyError.stack.split("\n")
                .filter(l => !l.includes("Object.notify") && !l.startsWith("Error"))
                .join("\n");

        console.warn("%c" + formattedStack, "font-style: italic;");
    };

    const sendQueuedMessages = () => {

        stopInterval();
        dispatchDepth++;

        const wasSendingQueuedMessages = isSendingQueuedMessages;
        isSendingQueuedMessages = true;

        try {

            dispatchQueuedMessages();
        }
        finally {

            isSendingQueuedMessages = wasSendingQueuedMessages;
            dispatchDepth--;

            // So that, if a throw ended the batch early, what is left in the queue is still sent.
            if (!isSendingQueuedMessages && messageQueue.length) startInterval();
        }

        sweepListenersIfNotDispatching();
    };

    /**
     * A removeIf that throws is reported as a listener's error would be, and the message is
     * dropped.
     */
    const isRemoved = (removeIf, args, messageTypeId, notifyError) => {

        try {

            return removeIf.apply(null, args);
        }
        catch (e) {

            Ren.GlobalErrorHandler.logError("[MessageBus] Error in removeIf:", e);

            if (notifyError) outputListenerStackTrace(notifyError, messageTypeId);

            return true;
        }
    };

    const dispatchQueuedMessages = () => {

        while (true) {

            const len = messageQueue.length;

            for (let i = 0; i < len; i++) {

                const messageObj = messageQueue[i];

                if (messageObj.isSuperseded) continue;
                if (messageObj.isTracked) untrackPendingMessage(messageObj);

                const { messageTypeId, args, removeIf, notifyError } = messageObj;
                const bucket = listenerBuckets.get(messageTypeId);

                if (!bucket) continue;

                // A message about something destroyed since it was queued is dropped.  Asked once
                // for the message, not once per listener, as it's the same answer for each.
                if (removeIf && isRemoved(removeIf, args, messageTypeId, notifyError)) continue;

                // Don't cache bucket.length as it may change during iteration.

                for (let j = 0; j < bucket.length; j++) {

                    const listener = bucket[j];

                    // So a superseded generation's handlers don't fire before the sweep reclaims
                    // them.
                    if (listener.orphaned) continue;

                    try {

                        // Orphaned before invoking, so a callback that synchronously re-dispatches
                        // this message type can't re-enter it; the sweep comes too late for that.
                        if (listener.runOnce) orphanListener(listener);

                        const result = args
                            ? listener.callback.apply(null, args)
                            : listener.callback();

                        if (result === false) {

                            orphanListener(listener);
                        }
                    }
                    catch (e) {

                        Ren.GlobalErrorHandler.logError(
                            "[MessageBus] Error in listener callback:",
                            e
                        );

                        if (notifyError) {

                            outputListenerStackTrace(notifyError, messageTypeId);
                        }
                    }
                }
            }

            messageQueue.splice(0, len);

            if (messageQueue.length === 0) break;
        }
    };

    const invokeListeners = (messageTypeId, messageArgs) => {

        dispatchDepth++;

        try {

            invokeListenersCore(messageTypeId, messageArgs);
        }
        finally {

            dispatchDepth--;
        }

        sweepListenersIfNotDispatching();
    };

    const invokeListenersCore = (messageTypeId, messageArgs) => {

        const bucket = listenerBuckets.get(messageTypeId);

        if (!bucket) return;

        // Don't cache bucket.length as it may change during iteration.

        for (let i = 0; i < bucket.length; i++) {

            const listener = bucket[i];

            if (listener.orphaned) continue;

            try {

                // Orphaned before invoking, so a synchronous re-entry can't re-invoke it.
                if (listener.runOnce) orphanListener(listener);

                const result = listener.callback.apply(null, messageArgs);

                if (result === false) {

                    orphanListener(listener);
                }
            }
            catch (e) {

                Ren.GlobalErrorHandler.logError("[MessageBus] Error in listener callback:", e);
            }
        }
    };

    return {
        messageTypes,
        populateMessageNames,
        createMessageType,
        sendQueuedMessages,
        withOwner,
        removeListener,
        removeListenersByOwner,
        isIdle
    };
})();
