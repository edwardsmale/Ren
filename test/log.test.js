/**
 * Ren.Log: off unless loggingEnabled is set, and then POSTing the body the host's log entry mapper
 * makes, or saying that there's no mapper.
 */

let fetchSpy;

beforeEach(() => {

    jest.spyOn(Ren.Endpoints, "getUrl").mockReturnValue("/log");
    fetchSpy = jest.spyOn(Ren.FetchUtils, "fetch").mockReturnValue(Promise.resolve({ ok: true }));
});

afterEach(() => {

    jest.restoreAllMocks();
    Ren.configure({ loggingEnabled: false });
});

test("processLogQueue_LoggingEnabledWithoutMapper_ReportsOnceAndPostsNothing", () => {

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });

    Ren.configure({ loggingEnabled: true });
    Ren.Log.info("Opened", "Group");
    Ren.Log.processLogQueue();
    Ren.Log.processLogQueue();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("registerLogEntryMapper");
});

test("processLogQueue_LoggingNotEnabled_PostsNothing", () => {

    Ren.Extensions.registerLogEntryMapper((entry) => ({ type: entry.eventType }));

    Ren.Log.info("Opened", "Group");
    Ren.Log.processLogQueue();

    expect(fetchSpy).not.toHaveBeenCalled();
});

test("processLogQueue_LoggingEnabledWithMapper_PostsMappedEntry", () => {

    const entries = [];

    Ren.Extensions.registerLogEntryMapper((entry) => {

        entries.push(entry);

        return { type: entry.eventType, seq: entry.pageEventTypeSeq };
    });

    Ren.configure({ loggingEnabled: true });
    Ren.Log.error("Failed", "Group", "Topic", "item", { status: 500 });
    Ren.Log.processLogQueue();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/log");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({ type: "Failed", seq: 1 });
    expect(entries[0].createdOn).toBeInstanceOf(Date);
    expect(entries[0].logLevel).toBe(Ren.LogLevelEnum.Error);
    expect(entries[0].logGroup).toBe("Group");
    expect(entries[0].topic).toBe("Topic");
    expect(entries[0].itemGuid).toBe("item");
    expect(entries[0].pageGuid).toBe(Ren.UserContext.getPageGuid());
    expect(entries[0].data).toEqual({ status: 500 });
});

test("logHelpers_EachLevel_QueuesDefinedLogLevel", () => {

    const entries = [];

    Ren.Extensions.registerLogEntryMapper((entry) => {

        entries.push(entry);

        return {};
    });

    Ren.configure({ loggingEnabled: true });
    Ren.Log.error("E");
    Ren.Log.warning("W");
    Ren.Log.info("I");
    Ren.Log.debug("D");
    Ren.Log.processLogQueue();

    expect(entries.map(e => e.logLevel)).toEqual([
        Ren.LogLevelEnum.Error,
        Ren.LogLevelEnum.Warn,
        Ren.LogLevelEnum.Info,
        Ren.LogLevelEnum.Debug
    ]);
    expect(entries.every(e => typeof e.logLevel === "number")).toBe(true);
});
