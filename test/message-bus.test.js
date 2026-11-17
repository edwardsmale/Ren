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
