/**
 * Format functions that read their parameters' values as data, the library's compiled by the
 * build, and functions compiled where the page doesn't allow eval.
 */

const run = (spec, value = "Pens", rowVals = { Flag: true }) =>
    Ren.FormatFunctions.createFunction(spec)(value, rowVals);

const isRefused = (result) => /^<span title="[^"]*">#VALUE!<\/span>$/.test(result);

// Runs action where new Function throws, as it does where the page's policy doesn't allow eval.
const withEvalBlocked = (action) => {

    const originalFunction = window.Function;

    window.Function = function () {
        throw new EvalError("Refused to evaluate a string as JavaScript.");
    };

    Ren.FunctionCompiler.forgetBlocking();

    try {

        return action();
    }
    finally {

        window.Function = originalFunction;
        Ren.FunctionCompiler.forgetBlocking();
    }
};

beforeEach(() => {

    window.injected = false;
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("parameters", () => {

    test("are referenced rather than written into the code", () => {

        const { code } = Ren.FunctionCompiler.referenceParameters(
            "return \"$a\" + '$ab' + `$a`;", ["a", "ab"]
        );

        expect(code).toBe(
            "return \"\" + parameters[\"a\"] + \"\" + '' + parameters[\"ab\"] + '' + `${parameters[\"a\"]}`;"
        );
    });

    test("written straight into code are left to be filled in", () => {

        const { code, bareNames } = Ren.FunctionCompiler.referenceParameters("return $code;", ["code"]);

        expect(code).toBe("return $code;");
        expect(bareNames).toEqual(["code"]);
    });

    test("are only text, whatever they hold", () => {

        const value = "\"; window.injected = true; \"";

        expect(run({ name: "append-string-if", parameters: { sourceColumn: "Flag", stringToAppend: value } }))
            .toBe("Pens" + value);
        expect(window.injected).toBe(false);
    });

    test("are escaped for a function that gives HTML", () => {

        const result = run({
            name: "text-colour",
            parameters: { colour: "red\"><img src=x onerror=\"window.injected = true\">" }
        });

        expect(result).not.toContain("<img");
        expect(result).toContain("&#34;");
    });

    test("holding an object are read as one", () => {

        expect(run({ name: "enum-keys", parameters: { values: "{\"Pens\": \"P\"}" } })).toBe("P");
    });

    test("holding a number are read as one", () => {

        const spec = {
            name: "greater-than-or-equal-to",
            parameters: { compareTo: "10", trueValue: "big", falseValue: "small" }
        };

        expect(run(spec, 12)).toBe("big");
        expect(run(spec, 9)).toBe("small");
    });
});

describe("the library's functions", () => {

    test("are compiled by the build", () => {

        const func = Ren.FormatFunctions.createFunction({
            name: "append-string-if",
            parameters: { sourceColumn: "Flag", stringToAppend: "!" }
        });

        expect(String(func)).toContain("parameters[\"stringToAppend\"]");
    });

    test("run where the page doesn't allow eval", () => {

        withEvalBlocked(() => {

            expect(run({
                name: "append-string-if",
                parameters: { sourceColumn: "Flag", stringToAppend: "?" + Math.random() }
            })).toMatch(/^Pens\?/);
        });
    });
});

describe("functions written into a report, where the page doesn't allow eval", () => {

    test("aren't compiled without a nonce", () => {

        withEvalBlocked(() => {

            expect(isRefused(run("return value + '#" + Math.random() + "';"))).toBe(true);
        });
    });

    test("are compiled with the page's nonce", () => {

        const nonced = document.createElement("script");

        nonced.setAttribute("nonce", "test-nonce");
        document.head.appendChild(nonced);

        try {

            withEvalBlocked(() => {

                expect(run("return value + '%';  // " + Math.random())).toBe("Pens%");
            });
        }
        finally {

            nonced.remove();
        }
    });

    test("that don't compile show why", () => {

        const nonced = document.createElement("script");

        nonced.setAttribute("nonce", "test-nonce");
        document.head.appendChild(nonced);

        try {

            withEvalBlocked(() => {

                expect(isRefused(run("return value +;  // " + Math.random()))).toBe(true);
            });
        }
        finally {

            nonced.remove();
        }
    });
});
