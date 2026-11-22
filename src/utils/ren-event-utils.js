/**
 * Functions for logging entries to the server-side Event store.
 */
Ren.EventUtils = (() => {

    const logEvent = (source = null, eventType = null, value = null, data) => {

        if (data != null) {

            data = Ren.ObjectUtils.isObject(data) ? JSON.stringify(data) : data;
        }

        const body = {
            CreatedOn: Ren.DateUtils.formatddMMyyyy_HHmmssfff(new Date()),
            Data: data
        };

        if (source !== null) body.Source = source;
        if (eventType !== null) body.EventType = eventType;
        if (value !== null) body.Value = value;

        const url = Ren.Endpoints.getUrl("eventInsert");

        if (!url) return Promise.resolve({ ok: true });

        return Ren.FetchUtils.fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
    };

    return {
        logEvent
    };
})();

