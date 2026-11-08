/**
 * Ren logs its own errors itself, rather than by taking over console.error, so a host page's
 * console.error calls are left to the page.  The page's uncaught errors are only caught where
 * renLogInsert is configured, as there's nowhere for them to go otherwise.
 */

const INDICATOR = "#ren-global-error-indicator";

let consoleErrorSpy;

beforeEach(() => {

    document.body.innerHTML = "";
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
});

afterEach(() => {

    jest.restoreAllMocks();
    Ren.configure({ featureFlags: { globalErrorHandler: true } });
});

const dispatchUncaughtError = (message) => {

    window.dispatchEvent(new ErrorEvent("error", { message, error: new Error(message) }));
};

test("logError_RensOwnError_WritesToConsoleAndShowsIndicator", () => {

    const error = new Error("Ren failed");

    Ren.GlobalErrorHandler.logError("[Test] Something failed:", error);

    expect(consoleErrorSpy).toHaveBeenCalledWith("[Test] Something failed:", error);
    expect(document.querySelector(INDICATOR).getAttribute("data-error-message"))
        .toBe("Ren failed");
});

test("consoleError_PagesOwnCall_ShowsNoIndicator", () => {

    console.error("The page's own error");

    expect(document.querySelector(INDICATOR)).toBeNull();
});

test("errorEvent_RenLogInsertNotConfigured_ShowsNoIndicator", () => {

    jest.spyOn(Ren.Endpoints, "has").mockReturnValue(false);

    dispatchUncaughtError("Host error");

    expect(document.querySelector(INDICATOR)).toBeNull();
});

test("errorEvent_RenLogInsertConfigured_ShowsIndicator", () => {

    jest.spyOn(Ren.Endpoints, "has").mockImplementation((name) => name === "renLogInsert");

    dispatchUncaughtError("Host error");

    expect(document.querySelector(INDICATOR).getAttribute("data-error-message"))
        .toBe("Host error");
});

test("errorEvent_RenLogInsertConfiguredButFlagOff_ShowsNoIndicator", () => {

    jest.spyOn(Ren.Endpoints, "has").mockImplementation((name) => name === "renLogInsert");
    Ren.configure({ featureFlags: { globalErrorHandler: false } });

    dispatchUncaughtError("Host error");

    expect(document.querySelector(INDICATOR)).toBeNull();
});

test("unhandledRejection_RenLogInsertNotConfigured_ShowsNoIndicator", () => {

    jest.spyOn(Ren.Endpoints, "has").mockReturnValue(false);

    const event = new Event("unhandledrejection");
    event.reason = new Error("Rejected");
    window.dispatchEvent(event);

    expect(document.querySelector(INDICATOR)).toBeNull();
});

test("unhandledRejection_RenLogInsertConfigured_ShowsIndicator", () => {

    jest.spyOn(Ren.Endpoints, "has").mockImplementation((name) => name === "renLogInsert");

    const event = new Event("unhandledrejection");
    event.reason = new Error("Rejected");
    window.dispatchEvent(event);

    expect(document.querySelector(INDICATOR)).not.toBeNull();
});
