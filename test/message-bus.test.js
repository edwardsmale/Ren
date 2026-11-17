describe("Ren.MessageBus", () => {

    const owner = {};

    const handle = (messageType, callback) =>
        Ren.MessageBus.withOwner(owner, () => messageType.handle(callback));

    afterEach(() => {

        Ren.MessageBus.removeListenersByOwner(owner);
        Ren.MessageBus.sendQueuedMessages();
    });

    test("RemoveIf_TrueAtDispatch_MessageDroppedAndListenersKept", () => {

        const messageType = Ren.MessageBus.createMessageType(["item"], {
            removeIf: item => item.isDestroyed === true
        });

        const received = [];

        handle(messageType, item => { received.push(item.name); });
        handle(messageType, item => { received.push(item.name + "2"); });

        const destroyed = { name: "a" };

        messageType.notify(destroyed);
        destroyed.isDestroyed = true;
        Ren.MessageBus.sendQueuedMessages();

        messageType.notify({ name: "b" });
        Ren.MessageBus.sendQueuedMessages();

        expect(received).toEqual(["b", "b2"]);
    });

    test("RemoveIf_ManyListeners_AskedOncePerMessage", () => {

        const removeIf = jest.fn(() => false);
        const messageType = Ren.MessageBus.createMessageType(["item"], { removeIf });

        for (let i = 0; i < 5; i++) handle(messageType, () => {});

        messageType.notify({});
        Ren.MessageBus.sendQueuedMessages();

        expect(removeIf).toHaveBeenCalledTimes(1);
    });

    test("Notify_SameDedupeKey_OnlyLastSentInItsPlace", () => {

        const messageType = Ren.MessageBus.createMessageType(["key", "value"], {
            dedupeKey: key => key
        });

        const received = [];

        handle(messageType, (key, value) => { received.push(key + value); });

        messageType.notify("a", 1);
        messageType.notify("b", 1);
        messageType.notify("a", 2);
        Ren.MessageBus.sendQueuedMessages();

        expect(received).toEqual(["b1", "a2"]);
    });

    test("Notify_NoParameters_OnlyLastSent", () => {

        const messageType = Ren.MessageBus.createMessageType();
        const listener = jest.fn();

        handle(messageType, listener);

        messageType.notify();
        messageType.notify();
        messageType.notify();
        Ren.MessageBus.sendQueuedMessages();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    test("Notify_SameKeyAsMessageAlreadySentInBatch_LaterMessagesStillSent", () => {

        const deduped = Ren.MessageBus.createMessageType(["key"], { dedupeKey: key => key });
        const other = Ren.MessageBus.createMessageType(["value"]);

        const received = [];
        let isRenotified = false;

        handle(deduped, key => { received.push(key); });

        handle(other, value => {

            received.push(value);

            if (!isRenotified) {

                isRenotified = true;
                deduped.notify("a");
            }
        });

        deduped.notify("a");
        other.notify(1);
        other.notify(2);
        Ren.MessageBus.sendQueuedMessages();

        expect(received).toEqual(["a", 1, 2, "a"]);
    });

    test("Notify_FromListenerDuringBatch_SentInSameBatchWithoutStartingTimer", () => {

        const first = Ren.MessageBus.createMessageType();
        const second = Ren.MessageBus.createMessageType();

        const received = [];

        handle(first, () => { received.push("first"); second.notify(); });
        handle(second, () => { received.push("second"); });

        first.notify();

        const setIntervalSpy = jest.spyOn(window, "setInterval");

        try {

            Ren.MessageBus.sendQueuedMessages();

            expect(received).toEqual(["first", "second"]);
            expect(setIntervalSpy).toHaveBeenCalledTimes(0);
            expect(Ren.MessageBus.isIdle()).toBe(true);
        }
        finally {

            setIntervalSpy.mockRestore();
        }
    });
});
