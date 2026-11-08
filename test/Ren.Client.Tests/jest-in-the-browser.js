/**
 * Runs one of test/'s Jest test files in a real browser page, for Ren.Client.Tests.  It gives the
 * page the parts of Jest the tests use (describe, test, the hooks, expect, jest.fn, jest.spyOn and
 * fake timers) and the parts of Node they use (require, module, __dirname, process.env, and the
 * bits of fs, path and util that read files from the page's server), then runs the file's tests one
 * at a time, as Jest does, and returns what happened to each.
 *
 * The page's server is Ren.Client.Tests itself, which serves the repo at http://localhost/, so a
 * path such as "/dist/ren.js" is a file in the repo.
 *
 * It's added to the page before anything else, so it keeps the real timers and Date before any
 * test fakes them.
 */
(function () {

    "use strict";

    const realTimers = {
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window),
        requestAnimationFrame: window.requestAnimationFrame.bind(window),
        cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
        Date: window.Date,
        performanceNow: window.performance.now.bind(window.performance)
    };

    const DEFAULT_TIMEOUT = 5000;
    const MAX_FAKE_TIMERS_RUN = 100000;

    // ---------------------------------------------------------------------------------------------
    // Reading the repo's files, synchronously, as Node's fs does.

    const request = (path, method) => {

        const xhr = new XMLHttpRequest();

        xhr.open(method || "GET", path, false);
        // Keeps every byte as one character, so binary files survive the trip.
        xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.send();

        return xhr;
    };

    const readBytes = (path) => {

        const xhr = request(path);

        if (xhr.status !== 200) {

            const error = new Error("ENOENT: no such file or directory, open '" + path + "'");

            error.code = "ENOENT";
            throw error;
        }

        const text = xhr.responseText;
        const bytes = new Uint8Array(text.length);

        for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;

        return bytes;
    };

    const readText = (path) => new TextDecoder("utf-8").decode(readBytes(path));

    // ---------------------------------------------------------------------------------------------
    // Node's path, fs and util, as far as the tests use them.  Paths are the server's: absolute ones
    // start at the repo's root.

    const normalize = (path) => {

        const absolute = path.charAt(0) === "/";
        const parts = [];
        const segments = path.split("/");

        for (let i = 0; i < segments.length; i++) {

            const segment = segments[i];

            if (segment === "" || segment === ".") continue;

            if (segment === "..") {

                if (parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
                else if (!absolute) parts.push("..");
            }
            else {
                parts.push(segment);
            }
        }

        return (absolute ? "/" : "") + parts.join("/") || (absolute ? "/" : ".");
    };

    const pathModule = {
        sep: "/",
        join: function () {
            return normalize(Array.prototype.filter.call(arguments, part => part !== "").join("/"));
        },
        resolve: function () {

            let resolved = "";

            for (let i = arguments.length - 1; i >= 0 && resolved.charAt(0) !== "/"; i--) {
                resolved = arguments[i] + (resolved ? "/" + resolved : "");
            }

            return normalize(resolved.charAt(0) === "/" ? resolved : "/" + resolved);
        },
        normalize,
        dirname: (path) => {

            const index = path.lastIndexOf("/");

            return index > 0 ? path.substring(0, index) : (index === 0 ? "/" : ".");
        },
        basename: (path, extension) => {

            const name = path.substring(path.lastIndexOf("/") + 1);

            return extension && name.endsWith(extension)
                ? name.substring(0, name.length - extension.length)
                : name;
        },
        extname: (path) => {

            const name = path.substring(path.lastIndexOf("/") + 1);
            const index = name.lastIndexOf(".");

            return index > 0 ? name.substring(index) : "";
        },
        relative: (from, to) => {

            const fromParts = normalize(from).split("/").filter(Boolean);
            const toParts = normalize(to).split("/").filter(Boolean);
            let common = 0;

            while (common < fromParts.length && fromParts[common] === toParts[common]) common++;

            return fromParts.slice(common).map(() => "..").concat(toParts.slice(common)).join("/");
        }
    };

    const fsModule = {
        readFileSync: (path, options) => {

            const encoding = typeof options === "string" ? options : options && options.encoding;

            return encoding ? readText(path) : readBytes(path);
        },
        existsSync: (path) => request(path, "HEAD").status === 200,
        readdirSync: () => {
            throw new Error("fs.readdirSync isn't available in the browser.  Test this in C# instead.");
        }
    };

    const utilModule = { TextEncoder: window.TextEncoder, TextDecoder: window.TextDecoder };

    // ---------------------------------------------------------------------------------------------
    // CommonJS modules: the test file, its helpers and anything else it requires.

    const moduleCache = {};

    /**
     * Runs the specified file's code in the page's global scope, as a script element would, with a
     * sourceURL so that stack traces and the debugger name the file.  Each module gets a function
     * around it, on the same line as its first, so that its line numbers are the file's.
     */
    const runInGlobalScope = (code, path) => (0, eval)(code + "\n//# sourceURL=" + location.origin + path);

    const loadModule = (path) => {

        if (moduleCache[path]) return moduleCache[path].exports;

        const module = { id: path, filename: path, exports: {}, loaded: false };

        let factory;

        try {
            factory = runInGlobalScope(
                "(function (exports, require, module, __filename, __dirname) {" + readText(path) + "\n})",
                path
            );
        }
        catch (error) {

            // A syntax error's stack doesn't say which file it's in.
            if (error instanceof SyntaxError) error.message += " (in " + path + ")";

            throw error;
        }

        moduleCache[path] = module;

        try {
            factory.call(module.exports, module.exports, createRequire(path), module, path, pathModule.dirname(path));
        }
        catch (error) {

            delete moduleCache[path];
            throw error;
        }

        module.loaded = true;

        return module.exports;
    };

    const createRequire = (fromPath) => {

        const require = (name) => {

            switch (name) {
                case "fs": return fsModule;
                case "path": return pathModule;
                case "util": return utilModule;
            }

            if (name.charAt(0) !== "." && name.charAt(0) !== "/") {
                throw new Error("Cannot find module '" + name + "' from '" + fromPath + "'");
            }

            let path = name.charAt(0) === "/" ? normalize(name) : pathModule.join(pathModule.dirname(fromPath), name);

            if (!pathModule.extname(path)) path += ".js";

            return loadModule(path);
        };

        return require;
    };

    // ---------------------------------------------------------------------------------------------
    // Formatting values for failure messages, roughly as Jest does.

    const format = (value, depth, seen) => {

        depth = depth || 0;
        seen = seen || [];

        if (value === null) return "null";
        if (value === undefined) return "undefined";

        switch (typeof value) {
            case "string": return JSON.stringify(value);
            case "number": return Object.is(value, -0) ? "-0" : String(value);
            case "bigint": return value + "n";
            case "boolean": return String(value);
            case "symbol": return value.toString();
            case "function": return value._isMockFunction ? "[MockFunction " + value.getMockName() + "]" : "[Function " + (value.name || "anonymous") + "]";
        }

        if (isAsymmetric(value)) return value.toString();
        if (value instanceof realTimers.Date) return isNaN(value) ? "Date { NaN }" : value.toISOString();
        if (value instanceof RegExp) return String(value);
        if (value instanceof Error) return "[" + value.name + ": " + value.message + "]";
        if (typeof Node !== "undefined" && value instanceof Node) {

            const html = value.outerHTML || value.textContent || value.nodeName;

            return html.length > 200 ? html.substring(0, 200) + "…" : html;
        }

        if (seen.indexOf(value) >= 0) return "[Circular]";
        if (depth > 5) return Array.isArray(value) ? "[Array]" : "[Object]";

        seen = seen.concat([value]);

        const inner = (item) => format(item, depth + 1, seen);
        const indent = "  ".repeat(depth + 1);
        const close = "  ".repeat(depth);
        const list = (items, open, end) => items.length === 0
            ? open + end
            : open + "\n" + items.map(item => indent + item + ",").join("\n") + "\n" + close + end;

        if (Array.isArray(value)) return list(Array.prototype.map.call(value, inner), "[", "]");

        if (ArrayBuffer.isView(value)) {
            return value.constructor.name + " " + list(Array.prototype.map.call(value, inner), "[", "]");
        }

        if (value instanceof Map) {
            return "Map " + list(Array.from(value, entry => inner(entry[0]) + " => " + inner(entry[1])), "{", "}");
        }

        if (value instanceof Set) return "Set " + list(Array.from(value, inner), "{", "}");

        const name = value.constructor && value.constructor !== Object ? value.constructor.name + " " : "";

        return (name === "" ? "" : name) + list(Object.keys(value).map(key => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)) + ": " + inner(value[key])), "{", "}");
    };

    // ---------------------------------------------------------------------------------------------
    // Equality, as Jest's toEqual has it: recursive, ignoring properties that are undefined and
    // objects' constructors, and comparing Maps, Sets and other iterables by their contents.

    const isAsymmetric = (value) => !!value && typeof value.asymmetricMatch === "function" && value.$$asymmetric === true;

    const toStringTag = (value) => Object.prototype.toString.call(value);

    const definedKeys = (object) => Object.keys(object)
        .filter(key => object[key] !== undefined)
        .concat(Object.getOwnPropertySymbols(object).filter(symbol => Object.prototype.propertyIsEnumerable.call(object, symbol) && object[symbol] !== undefined));

    const equals = (a, b, strict, aStack, bStack) => {

        if (isAsymmetric(a)) return a.asymmetricMatch(b);
        if (isAsymmetric(b)) return b.asymmetricMatch(a);

        if (a instanceof Error && b instanceof Error) return a.message === b.message;
        if (Object.is(a, b)) return true;
        if (a === null || b === null) return a === b;

        const tag = toStringTag(a);

        if (tag !== toStringTag(b)) return false;

        switch (tag) {
            case "[object Boolean]":
            case "[object String]":
            case "[object Number]":
                if (typeof a !== typeof b) return false;
                if (typeof a !== "object") return Object.is(a, b);
                return Object.is(a.valueOf(), b.valueOf());
            case "[object Date]":
                return +a === +b || (isNaN(+a) && isNaN(+b));
            case "[object RegExp]":
                return a.source === b.source && a.flags === b.flags;
        }

        if (typeof a !== "object" || typeof b !== "object") return false;

        if (typeof Node !== "undefined" && a instanceof Node && b instanceof Node) return a.isEqualNode(b);

        aStack = aStack || [];
        bStack = bStack || [];

        for (let i = aStack.length - 1; i >= 0; i--) {
            if (aStack[i] === a) return bStack[i] === b;
        }

        if (strict && a.constructor !== b.constructor) return false;

        aStack.push(a);
        bStack.push(b);

        try {

            if (!Array.isArray(a) && typeof a[Symbol.iterator] === "function" && typeof b[Symbol.iterator] === "function") {
                return iterableEquals(a, b, strict, aStack, bStack);
            }

            if (strict && Array.isArray(a) && a.length !== b.length) return false;

            const aKeys = strict ? Object.keys(a) : definedKeys(a);
            const bKeys = strict ? Object.keys(b) : definedKeys(b);

            if (aKeys.length !== bKeys.length) return false;

            for (let i = 0; i < aKeys.length; i++) {

                const key = aKeys[i];

                if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
                if (!equals(a[key], b[key], strict, aStack, bStack)) return false;
            }

            return true;
        }
        finally {

            aStack.pop();
            bStack.pop();
        }
    };

    const iterableEquals = (a, b, strict, aStack, bStack) => {

        if (a.constructor !== b.constructor) return false;

        if (a instanceof Set) {

            if (a.size !== b.size) return false;

            for (const item of a) {

                if (b.has(item)) continue;

                let found = false;

                for (const other of b) {
                    if (equals(item, other, strict, aStack, bStack)) { found = true; break; }
                }

                if (!found) return false;
            }

            return true;
        }

        if (a instanceof Map) {

            if (a.size !== b.size) return false;

            for (const entry of a) {

                if (b.has(entry[0]) && equals(entry[1], b.get(entry[0]), strict, aStack, bStack)) continue;

                let found = false;

                for (const other of b) {

                    if (equals(entry[0], other[0], strict, aStack, bStack) && equals(entry[1], other[1], strict, aStack, bStack)) {
                        found = true;
                        break;
                    }
                }

                if (!found) return false;
            }

            return true;
        }

        const aItems = Array.from(a);
        const bItems = Array.from(b);

        if (aItems.length !== bItems.length) return false;

        for (let i = 0; i < aItems.length; i++) {
            if (!equals(aItems[i], bItems[i], strict, aStack, bStack)) return false;
        }

        return true;
    };

    // ---------------------------------------------------------------------------------------------
    // expect.

    const asymmetric = (description, match) => ({
        $$asymmetric: true,
        asymmetricMatch: match,
        toString: () => description
    });

    class AssertionError extends Error {

        constructor(message) {

            super(message);
            this.name = "AssertionError";
        }
    }

    const describeThrown = (thrown) => thrown instanceof Error ? thrown.name + ": " + thrown.message : format(thrown);

    // Each matcher returns whether it passed and a function that describes the failure.
    const matchers = {

        toBe: (received, expected) => ({
            pass: Object.is(received, expected),
            message: () => "Expected: " + format(expected) + "\nReceived: " + format(received)
                + (equals(received, expected) && !Object.is(received, expected) ? "\n\nIf it should pass with deep equality, replace \"toBe\" with \"toEqual\"" : "")
        }),

        toEqual: (received, expected) => ({
            pass: equals(received, expected, false),
            message: () => "Expected: " + format(expected) + "\nReceived: " + format(received)
        }),

        toStrictEqual: (received, expected) => ({
            pass: equals(received, expected, true),
            message: () => "Expected: " + format(expected) + "\nReceived: " + format(received)
        }),

        toBeNull: (received) => ({ pass: received === null, message: () => "Received: " + format(received) }),
        toBeUndefined: (received) => ({ pass: received === undefined, message: () => "Received: " + format(received) }),
        toBeDefined: (received) => ({ pass: received !== undefined, message: () => "Received: " + format(received) }),
        toBeTruthy: (received) => ({ pass: !!received, message: () => "Received: " + format(received) }),
        toBeFalsy: (received) => ({ pass: !received, message: () => "Received: " + format(received) }),
        toBeNaN: (received) => ({ pass: Number.isNaN(received), message: () => "Received: " + format(received) }),

        toBeCloseTo: (received, expected, digits) => {

            const precision = digits === undefined ? 2 : digits;
            const pass = (received === Infinity && expected === Infinity) || (received === -Infinity && expected === -Infinity)
                || Math.abs(expected - received) < Math.pow(10, -precision) / 2;

            return {
                pass,
                message: () => "Expected: " + format(expected) + " (to " + precision + " digits)\nReceived: " + format(received)
            };
        },

        toBeGreaterThan: (received, expected) => ({ pass: received > expected, message: () => "Expected: > " + format(expected) + "\nReceived:   " + format(received) }),
        toBeGreaterThanOrEqual: (received, expected) => ({ pass: received >= expected, message: () => "Expected: >= " + format(expected) + "\nReceived:    " + format(received) }),
        toBeLessThan: (received, expected) => ({ pass: received < expected, message: () => "Expected: < " + format(expected) + "\nReceived:   " + format(received) }),
        toBeLessThanOrEqual: (received, expected) => ({ pass: received <= expected, message: () => "Expected: <= " + format(expected) + "\nReceived:    " + format(received) }),

        toBeInstanceOf: (received, expected) => ({
            pass: received instanceof expected,
            message: () => "Expected constructor: " + expected.name + "\nReceived: " + format(received)
        }),

        toContain: (received, expected) => ({
            pass: typeof received === "string"
                ? received.indexOf(String(expected)) >= 0
                : Array.from(received).some(item => item === expected),
            message: () => "Expected to contain: " + format(expected) + "\nReceived: " + format(received)
        }),

        toContainEqual: (received, expected) => ({
            pass: Array.from(received).some(item => equals(item, expected)),
            message: () => "Expected to contain equal: " + format(expected) + "\nReceived: " + format(received)
        }),

        toHaveLength: (received, expected) => ({
            pass: received != null && received.length === expected,
            message: () => "Expected length: " + expected + "\nReceived length: " + (received == null ? format(received) : received.length) + "\nReceived: " + format(received)
        }),

        toHaveProperty: function (received, path, value) {

            const keys = Array.isArray(path) ? path : String(path).split(".");
            let current = received;
            let has = true;

            for (let i = 0; i < keys.length; i++) {

                if (current == null || !(keys[i] in Object(current))) { has = false; break; }

                current = current[keys[i]];
            }

            return {
                pass: has && (arguments.length < 3 || equals(current, value)),
                message: () => "Expected path: " + format(path) + (arguments.length < 3 ? "" : "\nExpected value: " + format(value)) + "\nReceived: " + format(received)
            };
        },

        toMatch: (received, expected) => ({
            pass: typeof received === "string" && (typeof expected === "string" ? received.indexOf(expected) >= 0 : expected.test(received)),
            message: () => "Expected pattern: " + format(expected) + "\nReceived: " + format(received)
        }),

        toThrow: function (received, expected) {

            let thrown;
            let threw = false;

            if (this.fromPromise) {

                threw = true;
                thrown = received;
            }
            else {

                try {
                    received();
                }
                catch (error) {

                    threw = true;
                    thrown = error;
                }
            }

            const message = thrown && thrown.message !== undefined ? thrown.message : String(thrown);
            let pass = threw;

            if (threw && expected !== undefined) {

                if (typeof expected === "string") pass = message.indexOf(expected) >= 0;
                else if (expected instanceof RegExp) pass = expected.test(message);
                else if (typeof expected === "function") pass = thrown instanceof expected;
                else if (expected instanceof Error) pass = message === expected.message;
                else if (isAsymmetric(expected)) pass = expected.asymmetricMatch(thrown);
            }

            return {
                pass,
                message: () => (expected === undefined ? "" : "Expected: " + format(expected) + "\n")
                    + (threw ? "Thrown: " + describeThrown(thrown) : "Received function did not throw")
            };
        },

        toHaveBeenCalled: (received) => {

            assertMock(received);

            return {
                pass: received.mock.calls.length > 0,
                message: () => "Number of calls: " + received.mock.calls.length + formatCalls(received)
            };
        },

        toHaveBeenCalledTimes: (received, expected) => {

            assertMock(received);

            return {
                pass: received.mock.calls.length === expected,
                message: () => "Expected number of calls: " + expected + "\nReceived number of calls: " + received.mock.calls.length + formatCalls(received)
            };
        },

        toHaveBeenCalledWith: function (received) {

            assertMock(received);

            const expected = Array.prototype.slice.call(arguments, 1);

            return {
                pass: received.mock.calls.some(call => equals(call, expected)),
                message: () => "Expected: " + format(expected) + formatCalls(received)
            };
        },

        toHaveBeenLastCalledWith: function (received) {

            assertMock(received);

            const expected = Array.prototype.slice.call(arguments, 1);
            const calls = received.mock.calls;

            return {
                pass: calls.length > 0 && equals(calls[calls.length - 1], expected),
                message: () => "Expected: " + format(expected) + formatCalls(received)
            };
        },

        toHaveBeenNthCalledWith: function (received, n) {

            assertMock(received);

            const expected = Array.prototype.slice.call(arguments, 2);

            return {
                pass: received.mock.calls.length >= n && equals(received.mock.calls[n - 1], expected),
                message: () => "Expected call " + n + ": " + format(expected) + formatCalls(received)
            };
        },

        toHaveReturnedWith: (received, expected) => {

            assertMock(received);

            return {
                pass: received.mock.results.some(result => result.type === "return" && equals(result.value, expected)),
                message: () => "Expected return: " + format(expected)
            };
        }
    };

    matchers.toBeCalled = matchers.toHaveBeenCalled;
    matchers.toBeCalledTimes = matchers.toHaveBeenCalledTimes;
    matchers.toBeCalledWith = matchers.toHaveBeenCalledWith;
    matchers.lastCalledWith = matchers.toHaveBeenLastCalledWith;
    matchers.toThrowError = matchers.toThrow;

    const assertMock = (received) => {

        if (!received || !received._isMockFunction) {
            throw new AssertionError("Expected a mock function or spy, but received " + format(received));
        }
    };

    const formatCalls = (mock) => mock.mock.calls.length === 0
        ? ""
        : "\nCalls:\n" + mock.mock.calls.map((call, index) => "  " + (index + 1) + ": " + format(call, 1)).join("\n");

    const createExpectation = (received, negated, promise) => {

        const expectation = {};

        Object.keys(matchers).forEach(name => {

            expectation[name] = function () {

                const args = [received].concat(Array.prototype.slice.call(arguments));

                const check = (value, fromPromise) => {

                    args[0] = value;

                    const result = matchers[name].apply({ fromPromise }, args);

                    if (result.pass === negated) {

                        const label = "expect(received)" + (promise ? "." + promise : "") + (negated ? ".not" : "") + "." + name + "(" + (arguments.length ? "expected" : "") + ")";

                        throw new AssertionError(label + "\n\n" + result.message());
                    }
                };

                if (!promise) return check(received, false);

                return Promise.resolve(received).then(
                    value => {

                        if (promise === "rejects") {
                            throw new AssertionError("expect(received).rejects." + name + "()\n\nReceived promise resolved instead of rejected\nResolved to: " + format(value));
                        }

                        check(value, false);
                    },
                    reason => {

                        if (promise === "resolves") {
                            throw new AssertionError("expect(received).resolves." + name + "()\n\nReceived promise rejected instead of resolved\nRejected to: " + describeThrown(reason));
                        }

                        check(reason, true);
                    });
            };
        });

        return expectation;
    };

    const expect = (received) => {

        const expectation = createExpectation(received, false);

        expectation.not = createExpectation(received, true);
        expectation.resolves = createExpectation(received, false, "resolves");
        expectation.resolves.not = createExpectation(received, true, "resolves");
        expectation.rejects = createExpectation(received, false, "rejects");
        expectation.rejects.not = createExpectation(received, true, "rejects");

        return expectation;
    };

    expect.anything = () => asymmetric("Anything", value => value !== null && value !== undefined);

    expect.any = (type) => asymmetric("Any<" + (type.name || type) + ">", value => {

        if (type === String) return typeof value === "string" || value instanceof String;
        if (type === Number) return typeof value === "number" || value instanceof Number;
        if (type === Boolean) return typeof value === "boolean" || value instanceof Boolean;
        if (type === Function) return typeof value === "function";
        if (type === Object) return typeof value === "object" && value !== null;

        return value instanceof type;
    });

    expect.objectContaining = (object) => asymmetric("ObjectContaining " + format(object), value =>
        value !== null && typeof value === "object" && Object.keys(object).every(key => key in value && equals(value[key], object[key])));

    expect.arrayContaining = (array) => asymmetric("ArrayContaining " + format(array), value =>
        Array.isArray(value) && array.every(item => value.some(other => equals(other, item))));

    expect.stringContaining = (text) => asymmetric("StringContaining " + format(text), value =>
        typeof value === "string" && value.indexOf(text) >= 0);

    expect.stringMatching = (pattern) => asymmetric("StringMatching " + String(pattern), value =>
        typeof value === "string" && (typeof pattern === "string" ? new RegExp(pattern) : pattern).test(value));

    expect.extend = (more) => {

        Object.keys(more).forEach(name => {

            matchers[name] = function (received) {
                return more[name].apply({ isNot: false, equals }, arguments);
            };
        });
    };

    // ---------------------------------------------------------------------------------------------
    // Mock functions.

    const spies = [];

    const createMock = (implementation, name) => {

        let defaultImplementation = implementation;
        let onceImplementations = [];
        let mockName = name || "jest.fn()";

        const newState = () => ({ calls: [], results: [], instances: [], contexts: [], lastCall: undefined });

        const mock = function () {

            const args = Array.prototype.slice.call(arguments);
            const state = mock.mock;
            const result = { type: "incomplete", value: undefined };

            state.calls.push(args);
            state.instances.push(this);
            state.contexts.push(this);
            state.results.push(result);
            state.lastCall = args;

            const call = onceImplementations.length > 0 ? onceImplementations.shift() : defaultImplementation;

            try {

                const value = !call ? undefined : (new.target ? Reflect.construct(call, args, new.target) : call.apply(this, args));

                result.type = "return";
                result.value = value;

                return value;
            }
            catch (error) {

                result.type = "throw";
                result.value = error;
                throw error;
            }
        };

        mock._isMockFunction = true;
        mock.mock = newState();
        mock.getMockName = () => mockName;
        mock.mockName = (value) => { mockName = value; return mock; };
        mock.getMockImplementation = () => defaultImplementation;
        mock.mockImplementation = (value) => { defaultImplementation = value; return mock; };
        mock.mockImplementationOnce = (value) => { onceImplementations.push(value); return mock; };
        mock.mockReturnValue = (value) => mock.mockImplementation(() => value);
        mock.mockReturnValueOnce = (value) => mock.mockImplementationOnce(() => value);
        mock.mockResolvedValue = (value) => mock.mockImplementation(() => Promise.resolve(value));
        mock.mockResolvedValueOnce = (value) => mock.mockImplementationOnce(() => Promise.resolve(value));
        mock.mockRejectedValue = (value) => mock.mockImplementation(() => Promise.reject(value));
        mock.mockRejectedValueOnce = (value) => mock.mockImplementationOnce(() => Promise.reject(value));
        mock.mockReturnThis = () => mock.mockImplementation(function () { return this; });
        mock.mockClear = () => { mock.mock = newState(); return mock; };
        mock.mockReset = () => {

            mock.mockClear();
            defaultImplementation = undefined;
            onceImplementations = [];

            return mock;
        };
        mock.mockRestore = () => { mock.mockReset(); };

        return mock;
    };

    const spyOn = (object, methodName) => {

        if (object === null || (typeof object !== "object" && typeof object !== "function")) {
            throw new Error("Cannot spyOn on a primitive value; " + format(object) + " given");
        }

        const original = object[methodName];

        if (original && original._isMockFunction) return original;

        if (typeof original !== "function") {
            throw new Error("Cannot spy on the " + String(methodName) + " property because it is not a function; " + format(original) + " given instead");
        }

        const ownDescriptor = Object.getOwnPropertyDescriptor(object, methodName);

        const mock = createMock(function () { return original.apply(this, arguments); }, "spy");
        const reset = mock.mockReset;

        // A reset spy goes on calling the original, as Jest's does since 29.
        mock.mockReset = () => {

            reset();
            mock.mockImplementation(function () { return original.apply(this, arguments); });

            return mock;
        };

        mock.mockRestore = () => {

            mock.mockReset();

            if (ownDescriptor) Object.defineProperty(object, methodName, ownDescriptor);
            else delete object[methodName];

            const index = spies.indexOf(mock);

            if (index >= 0) spies.splice(index, 1);
        };

        Object.defineProperty(object, methodName, {
            value: mock,
            writable: true,
            configurable: true,
            enumerable: ownDescriptor ? ownDescriptor.enumerable : false
        });

        spies.push(mock);

        return mock;
    };

    const allMocks = [];

    const fn = (implementation) => {

        const mock = createMock(implementation);

        allMocks.push(mock);

        return mock;
    };

    // ---------------------------------------------------------------------------------------------
    // Fake timers, as Jest's modern ones: setTimeout, setInterval, requestAnimationFrame, Date and
    // performance.now all run on a clock that only moves when a test runs the timers.

    const clock = {
        installed: false,
        now: 0,
        nextId: 1,
        timers: new Map()
    };

    const addTimer = (callback, delay, args, interval, animationFrame) => {

        const id = clock.nextId++;

        delay = Math.max(0, Number(delay) || 0);

        clock.timers.set(id, {
            id,
            callback,
            args: args || [],
            callAt: animationFrame ? clock.now + (16 - (clock.now % 16)) : clock.now + delay,
            interval: interval ? Math.max(1, delay) : 0,
            animationFrame
        });

        return id;
    };

    const removeTimer = (id) => { clock.timers.delete(Number(id)); };

    const FakeDate = function () {

        if (!new.target) return new realTimers.Date(clock.now).toString();

        return Reflect.construct(realTimers.Date, arguments.length ? Array.prototype.slice.call(arguments) : [clock.now], new.target);
    };

    FakeDate.prototype = realTimers.Date.prototype;
    FakeDate.now = () => clock.now;
    FakeDate.parse = realTimers.Date.parse;
    FakeDate.UTC = realTimers.Date.UTC;

    const fakeTimers = {

        install: () => {

            if (clock.installed) return;

            clock.installed = true;
            clock.now = realTimers.Date.now();
            clock.timers.clear();

            window.setTimeout = function (callback, delay) { return addTimer(callback, delay, Array.prototype.slice.call(arguments, 2), false); };
            window.setInterval = function (callback, delay) { return addTimer(callback, delay, Array.prototype.slice.call(arguments, 2), true); };
            window.clearTimeout = removeTimer;
            window.clearInterval = removeTimer;
            window.requestAnimationFrame = (callback) => addTimer(callback, 16, null, false, true);
            window.cancelAnimationFrame = removeTimer;
            window.Date = FakeDate;
            window.performance.now = () => clock.now - startedAt;
        },

        uninstall: () => {

            if (!clock.installed) return;

            clock.installed = false;
            clock.timers.clear();

            window.setTimeout = realTimers.setTimeout;
            window.setInterval = realTimers.setInterval;
            window.clearTimeout = realTimers.clearTimeout;
            window.clearInterval = realTimers.clearInterval;
            window.requestAnimationFrame = realTimers.requestAnimationFrame;
            window.cancelAnimationFrame = realTimers.cancelAnimationFrame;
            window.Date = realTimers.Date;
            delete window.performance.now;
        },

        // Runs the timer due first, if there's one due by the specified time.
        runNext: (until, onlyIds) => {

            let next = null;

            clock.timers.forEach(timer => {

                if (onlyIds && !onlyIds.has(timer.id)) return;
                if (timer.callAt > until) return;
                if (!next || timer.callAt < next.callAt || (timer.callAt === next.callAt && timer.id < next.id)) next = timer;
            });

            if (!next) return false;

            clock.now = Math.max(clock.now, next.callAt);

            if (next.interval) next.callAt += next.interval;
            else clock.timers.delete(next.id);

            if (onlyIds) onlyIds.delete(next.id);

            if (next.animationFrame) next.callback.call(window, clock.now - startedAt);
            else if (typeof next.callback === "function") next.callback.apply(window, next.args);
            else (0, eval)(String(next.callback));

            return true;
        },

        assertInstalled: () => {

            if (!clock.installed) {
                console.warn("A function to advance timers was called but the timers APIs are not replaced with fake timers. Call `jest.useFakeTimers()` in this test file or enable fake timers for all tests by setting 'fakeTimers': {'enableGlobally': true} in Jest configuration file.");
            }

            return clock.installed;
        }
    };

    const startedAt = realTimers.Date.now() - realTimers.performanceNow();

    // ---------------------------------------------------------------------------------------------
    // jest.

    const jest = {
        fn,
        spyOn,
        isMockFunction: (value) => !!value && value._isMockFunction === true,
        clearAllMocks: () => { allMocks.concat(spies).forEach(mock => mock.mockClear()); return jest; },
        resetAllMocks: () => { allMocks.concat(spies).forEach(mock => mock.mockReset()); return jest; },
        restoreAllMocks: () => { spies.slice().forEach(mock => mock.mockRestore()); return jest; },
        isolateModules: (callback) => {

            const saved = Object.assign({}, moduleCache);

            Object.keys(moduleCache).forEach(key => delete moduleCache[key]);

            try {
                callback();
            }
            finally {

                Object.keys(moduleCache).forEach(key => delete moduleCache[key]);
                Object.assign(moduleCache, saved);
            }
        },
        useFakeTimers: () => { fakeTimers.install(); return jest; },
        useRealTimers: () => { fakeTimers.uninstall(); return jest; },
        runAllTimers: () => {

            if (!fakeTimers.assertInstalled()) return;

            for (let i = 0; i < MAX_FAKE_TIMERS_RUN; i++) {
                if (!fakeTimers.runNext(Infinity)) return;
            }

            throw new Error("Aborting after running " + MAX_FAKE_TIMERS_RUN + " timers, assuming an infinite loop!");
        },
        runOnlyPendingTimers: () => {

            if (!fakeTimers.assertInstalled()) return;

            const pending = new Set(clock.timers.keys());

            while (fakeTimers.runNext(Infinity, pending)) { /* Runs each timer that was pending. */ }
        },
        advanceTimersByTime: (milliseconds) => {

            if (!fakeTimers.assertInstalled()) return;

            const until = clock.now + milliseconds;

            for (let i = 0; i < MAX_FAKE_TIMERS_RUN; i++) {

                if (!fakeTimers.runNext(until)) {

                    clock.now = until;
                    return;
                }
            }

            throw new Error("Aborting after running " + MAX_FAKE_TIMERS_RUN + " timers, assuming an infinite loop!");
        },
        clearAllTimers: () => { clock.timers.clear(); },
        getTimerCount: () => clock.timers.size,
        now: () => clock.installed ? clock.now : realTimers.Date.now(),
        setSystemTime: (time) => { clock.now = time === undefined ? realTimers.Date.now() : +time; }
    };

    // ---------------------------------------------------------------------------------------------
    // describe, test and the hooks.  Collecting a file builds a tree of blocks; running it then runs
    // each test with the hooks of the blocks around it.

    const newBlock = (name, parent) => ({
        name,
        parent,
        children: [],
        beforeAll: [],
        afterAll: [],
        beforeEach: [],
        afterEach: [],
        only: false
    });

    let root = newBlock("", null);
    let currentBlock = root;
    let hasOnly = false;

    const formatEachName = (name, args, index) => {

        let argIndex = 0;

        return name.replace(/%([sdifjopP#%])/g, (match, type) => {

            if (type === "%") return "%";
            if (type === "#") return String(index);

            if (argIndex >= args.length) return match;

            const value = args[argIndex++];

            switch (type) {
                case "s": return typeof value === "string" ? value : format(value);
                case "d":
                case "i": return String(type === "i" ? Math.trunc(Number(value)) : Number(value));
                case "f": return String(Number(value));
                case "j": return JSON.stringify(value);
                default: return format(value);
            }
        });
    };

    const each = (define) => (table) => (name, callback, timeout) => {

        if (!Array.isArray(table)) throw new Error("each only takes an array of cases here, not a tagged template.");

        table.forEach((row, index) => {

            const args = Array.isArray(row) ? row : [row];

            define(formatEachName(name, args, index), function () { return callback.apply(this, args); }, timeout);
        });
    };

    const addTest = (name, callback, timeout, mode) => {

        if (typeof callback !== "function" && mode !== "todo") {
            throw new Error("Missing second argument. It must be a callback function.");
        }

        const test = { name, callback, timeout, mode, parent: currentBlock };

        if (mode === "only") hasOnly = true;

        currentBlock.children.push({ test });
    };

    const describe = (name, callback, mode) => {

        const block = newBlock(String(name), currentBlock);

        block.mode = mode;

        if (mode === "only") hasOnly = true;

        currentBlock.children.push({ block });

        const parent = currentBlock;

        currentBlock = block;

        try {

            const result = callback();

            if (result && typeof result.then === "function") {
                throw new Error("Returning a Promise from \"describe\" is not supported. Tests must be defined synchronously.");
            }
        }
        finally {
            currentBlock = parent;
        }
    };

    const test = (name, callback, timeout) => addTest(String(name), callback, timeout);

    test.only = (name, callback, timeout) => addTest(String(name), callback, timeout, "only");
    test.skip = (name, callback, timeout) => addTest(String(name), callback, timeout, "skip");
    test.todo = (name) => addTest(String(name), null, null, "todo");
    test.each = each(test);
    test.only.each = each(test.only);
    test.skip.each = each(test.skip);

    describe.only = (name, callback) => describe(name, callback, "only");
    describe.skip = (name, callback) => describe(name, callback, "skip");
    describe.each = each((name, callback) => describe(name, callback));
    describe.only.each = each(describe.only);
    describe.skip.each = each(describe.skip);

    const hook = (kind) => (callback, timeout) => { currentBlock[kind].push({ callback, timeout }); };

    // Runs a test or hook's function, which may take a done callback or return a promise, failing
    // it when it takes longer than its timeout.
    const callWithTimeout = (callback, timeout, context) => new Promise((resolve, reject) => {

        const limit = timeout || DEFAULT_TIMEOUT;

        const timer = realTimers.setTimeout(() => {
            reject(new Error("Exceeded timeout of " + limit + " ms for a " + context + ".\nAdd a timeout value to this test to increase the timeout, if this is a long-running test."));
        }, limit);

        const settle = (error) => {

            realTimers.clearTimeout(timer);

            if (error) reject(error);
            else resolve();
        };

        try {

            if (callback.length > 0) {

                const done = (error) => settle(error ? (error instanceof Error ? error : new Error(String(error))) : undefined);

                done.fail = (error) => settle(error instanceof Error ? error : new Error(String(error)));
                callback.call({}, done);
                return;
            }

            const result = callback.call({});

            if (result && typeof result.then === "function") result.then(() => settle(), error => settle(error || new Error("Rejected with " + format(error))));
            else settle();
        }
        catch (error) {
            settle(error);
        }
    });

    const blockPath = (block) => {

        const names = [];

        for (let current = block; current && current.parent; current = current.parent) names.unshift(current.name);

        return names;
    };

    const isSkipped = (block) => {

        for (let current = block; current; current = current.parent) if (current.mode === "skip") return true;

        return false;
    };

    const isInOnly = (block) => {

        for (let current = block; current; current = current.parent) if (current.mode === "only") return true;

        return false;
    };

    const shouldRun = (test) => {

        if (test.mode === "skip" || test.mode === "todo" || isSkipped(test.parent)) return false;

        return !hasOnly || test.mode === "only" || isInOnly(test.parent);
    };

    const countRunnable = (block) => block.children.reduce((count, child) =>
        count + (child.test ? (shouldRun(child.test) ? 1 : 0) : countRunnable(child.block)), 0);

    const describeError = (error) => {

        if (error instanceof Error) {

            const stack = String(error.stack || "");
            const message = error.name === "AssertionError" ? error.message : error.name + ": " + error.message;
            const frames = stack.split("\n").filter(line => /^\s+at /.test(line))
                // The shim's own frames only say how the test was called.
                .filter(line => line.indexOf("jest-in-the-browser.js") < 0)
                .slice(0, 8);

            return message + (frames.length ? "\n" + frames.join("\n") : "");
        }

        return "Thrown: " + format(error);
    };

    const runBlock = async (block, results, beforeAllError) => {

        if (countRunnable(block) === 0) {

            addSkippedResults(block, results);
            return;
        }

        let error = beforeAllError;

        if (!error) {

            for (let i = 0; i < block.beforeAll.length; i++) {

                try {
                    await callWithTimeout(block.beforeAll[i].callback, block.beforeAll[i].timeout, "hook");
                }
                catch (hookError) {

                    error = hookError;
                    break;
                }
            }
        }

        for (let i = 0; i < block.children.length; i++) {

            const child = block.children[i];

            if (child.block) await runBlock(child.block, results, error);
            else await runTest(child.test, results, error);
        }

        if (!beforeAllError) {

            for (let i = 0; i < block.afterAll.length; i++) {

                try {
                    await callWithTimeout(block.afterAll[i].callback, block.afterAll[i].timeout, "hook");
                }
                catch (hookError) {
                    results.push({ name: blockPath(block).concat(["(afterAll)"]).join(" › "), status: "failed", error: describeError(hookError), duration: 0 });
                }
            }
        }
    };

    const addSkippedResults = (block, results) => {

        block.children.forEach(child => {

            if (child.block) addSkippedResults(child.block, results);
            else results.push({ name: blockPath(child.test.parent).concat([child.test.name]).join(" › "), status: child.test.mode === "todo" ? "todo" : "skipped", error: null, duration: 0 });
        });
    };

    const runTest = async (test, results, beforeAllError) => {

        const name = blockPath(test.parent).concat([test.name]).join(" › ");

        if (!shouldRun(test)) {

            results.push({ name, status: test.mode === "todo" ? "todo" : "skipped", error: null, duration: 0 });
            return;
        }

        if (beforeAllError) {

            results.push({ name, status: "failed", error: describeError(beforeAllError), duration: 0 });
            return;
        }

        const blocks = [];

        for (let block = test.parent; block; block = block.parent) blocks.unshift(block);

        const started = realTimers.performanceNow();
        const errors = [];

        try {

            for (let i = 0; i < blocks.length; i++) {

                for (let j = 0; j < blocks[i].beforeEach.length; j++) {
                    await callWithTimeout(blocks[i].beforeEach[j].callback, blocks[i].beforeEach[j].timeout, "hook");
                }
            }

            await callWithTimeout(test.callback, test.timeout, "test");
        }
        catch (error) {
            errors.push(error);
        }

        // The afterEach hooks run from the innermost block out, even after a failure, so a test's
        // clean-up still happens.
        for (let i = blocks.length - 1; i >= 0; i--) {

            for (let j = 0; j < blocks[i].afterEach.length; j++) {

                try {
                    await callWithTimeout(blocks[i].afterEach[j].callback, blocks[i].afterEach[j].timeout, "hook");
                }
                catch (error) {
                    errors.push(error);
                }
            }
        }

        results.push({
            name,
            status: errors.length ? "failed" : "passed",
            error: errors.length ? errors.map(describeError).join("\n\n") : null,
            duration: Math.round(realTimers.performanceNow() - started)
        });
    };

    // ---------------------------------------------------------------------------------------------
    // The globals a Jest test file sees.

    Object.assign(window, {
        describe,
        test,
        it: test,
        xit: test.skip,
        xtest: test.skip,
        xdescribe: describe.skip,
        fit: test.only,
        fdescribe: describe.only,
        beforeAll: hook("beforeAll"),
        afterAll: hook("afterAll"),
        beforeEach: hook("beforeEach"),
        afterEach: hook("afterEach"),
        expect,
        jest,
        global: window,
        process: { env: {}, platform: "browser", version: "", versions: {}, cwd: () => "/" }
    });

    window.__renJest = {

        /**
         * Runs the scripts a page includes, then the specified test file's tests, returning what
         * happened to each.
         *
         * @param {string} testFile The test file's path from the repo's root, such as
         *     "/test/sort.test.js".
         * @param {string[]} scripts The scripts to run first, such as "/dist/ren.js".
         * @param {object} env What the test file sees as process.env.
         */
        run: async (testFile, scripts, env) => {

            Object.assign(window.process.env, env || {});

            const results = [];

            try {

                for (let i = 0; i < scripts.length; i++) runInGlobalScope(readText(scripts[i]), scripts[i]);

                // A test file's own top-level fit() etc. need it to be the current file.
                root = newBlock("", null);
                currentBlock = root;
                hasOnly = false;

                loadModule(testFile);
            }
            catch (error) {
                return { results, fileError: describeError(error) };
            }

            await runBlock(root, results);

            return { results, fileError: null };
        }
    };
})();
