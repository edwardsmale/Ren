/**
 * The user, session and page guids that Ren's log records: kept under Ren's own storage keys, the
 * older ones moved to them, nothing stored unless renLogInsert is configured, and the page's kept
 * off window.
 */

let hasLogEndpoint;

beforeEach(() => {

    localStorage.clear();
    sessionStorage.clear();

    hasLogEndpoint = true;
    jest.spyOn(Ren.Endpoints, "has").mockImplementation(
        (name) => name === "renLogInsert" && hasLogEndpoint
    );
});

afterEach(() => {

    jest.restoreAllMocks();
});

test("new user and session guids are kept under Ren's keys", () => {

    const userGuid = Ren.UserContext.getUserGuid();
    const sessionGuid = Ren.UserContext.getSessionGuid();

    expect(userGuid).toMatch(/^u/);
    expect(sessionGuid).toMatch(/^s/);
    expect(localStorage.getItem("ren-user-guid")).toBe(userGuid);
    expect(sessionStorage.getItem("ren-session-guid")).toBe(sessionGuid);
});

test("guids under the older keys are moved to Ren's", () => {

    localStorage.setItem("userGuid", "u-older");
    sessionStorage.setItem("sessionGuid", "s-older");

    expect(Ren.UserContext.getUserGuid()).toBe("u-older");
    expect(Ren.UserContext.getSessionGuid()).toBe("s-older");
    expect(localStorage.getItem("userGuid")).toBeNull();
    expect(sessionStorage.getItem("sessionGuid")).toBeNull();
});

test("guids already under Ren's keys are kept", () => {

    localStorage.setItem("ren-user-guid", "u-kept");
    sessionStorage.setItem("ren-session-guid", "s-kept");

    expect(Ren.UserContext.getUserGuid()).toBe("u-kept");
    expect(Ren.UserContext.getSessionGuid()).toBe("s-kept");
    expect(Ren.UserContext.getUserGuid()).toBe("u-kept");
});

test("without renLogInsert nothing is put in storage", () => {

    hasLogEndpoint = false;
    localStorage.setItem("userGuid", "u-older");

    expect(Ren.UserContext.getUserGuid()).toBeNull();
    expect(Ren.UserContext.getSessionGuid()).toBeNull();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem("userGuid")).toBe("u-older");
    expect(sessionStorage.length).toBe(0);
});

test("the page guid stays the same and isn't on window", () => {

    const pageGuid = Ren.UserContext.getPageGuid();

    expect(pageGuid).toMatch(/^p/);
    expect(Ren.UserContext.getPageGuid()).toBe(pageGuid);
    expect(window.pageGuid).toBeUndefined();
});

test("Ren sets no RenPrism global", () => {

    expect(window.RenPrism).toBeUndefined();
});
