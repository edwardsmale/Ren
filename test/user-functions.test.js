/**
 * The userFunctions feature flag: turned off, functions and HTML from report settings or the
 * function editor don't run, while the library's own functions still do.
 */

const setUserFunctions = (allowed) =>
    Ren.configure({ featureFlags: { userFunctions: allowed } });

// append-string-if writes $stringToAppend into a string literal in its code.
const appendStringIf = (stringToAppend) => ({
    name: "append-string-if",
    parameters: { sourceColumn: "Flag", stringToAppend }
});

const run = (spec) => Ren.FormatFunctions.createFunction(spec)("Pens", { Flag: true });

const isRefused = (result) => /^<span title="[^"]*">#VALUE!<\/span>$/.test(result);

beforeEach(() => {

    window.injected = false;
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {

    setUserFunctions(true);
    jest.restoreAllMocks();
});

describe("with user functions allowed", () => {

    test("a function written into the report runs", () => {

        expect(run("return value + '!';")).toBe("Pens!");
    });

    test("a function from the report's settings runs", () => {

        Ren.FormatFunctions.createFunctionsFromReportSettings({
            functions: { "settings-shout": "return value.toUpperCase();" }
        });

        expect(run({ name: "settings-shout" })).toBe("PENS");
    });
});

describe("with user functions turned off", () => {

    beforeEach(() => setUserFunctions(false));

    test("the library's own functions still run", () => {

        expect(run(appendStringIf(" - new"))).toBe("Pens - new");
    });

    test("a function written into the report is refused", () => {

        expect(isRefused(run("window.injected = true; return value;"))).toBe(true);
        expect(window.injected).toBe(false);
    });

    test("HTML written into the report is refused", () => {

        expect(isRefused(run({ html: "<b>@value</b>" }))).toBe(true);
    });

    test("a function from the report's settings is refused", () => {

        Ren.FormatFunctions.createFunctionsFromReportSettings({
            functions: { "settings-whisper": "window.injected = true; return value;" }
        });

        expect(isRefused(run({ name: "settings-whisper" }))).toBe(true);
        expect(window.injected).toBe(false);
    });

    test("a parameter value that would leave its string is refused", () => {

        expect(isRefused(run(appendStringIf("\" + (window.injected = true) + \"")))).toBe(true);
        expect(window.injected).toBe(false);
    });

    test("a parameter value that isn't a plain value is refused", () => {

        expect(isRefused(run({
            name: "append-string-if",
            parameters: { sourceColumn: "Flag", stringToAppend: { toString: () => "x" } }
        }))).toBe(true);
    });

    test("a function made before the flag was turned off doesn't run again", () => {

        setUserFunctions(true);
        expect(run("return value + '?';")).toBe("Pens?");

        setUserFunctions(false);
        expect(isRefused(run("return value + '?';"))).toBe(true);
    });

    test("the function editor's preview is told why", () => {

        expect(() => Ren.FormatFunctions.createFunction("return value;", {}, true))
            .toThrow("Functions written into a report are turned off.");
    });
});

describe("the function editor", () => {

    test("says writing functions is turned off rather than opening", () => {

        setUserFunctions(false);

        Ren.Messages.Requests.functionEditorWindow.notifyImmediately(
            () => "", () => {}, 10, 10, {}
        );

        const message = document.querySelector(".js-ren-popup-message-content");

        expect(message.textContent).toContain("Writing functions is turned off on this page.");
        expect(document.querySelector(".ren-calc-function-editor-window__editor-widget"))
            .toBeNull();
    });
});
