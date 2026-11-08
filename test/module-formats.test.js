/**
 * ren.js loaded as a CommonJS module, as a bundler may load it: require() gets Ren.  (ren.esm.js,
 * the ES module, is tested in LoadingTests.cs.)
 */
const path = require("path");

const REN_FILE = path.join(
    __dirname, "..", "dist", process.env.REN_TEST_MINIFIED ? "ren.min.js" : "ren.js"
);

test("require() gets Ren, which is window.Ren", () => {

    let required;

    jest.isolateModules(() => {

        required = require(REN_FILE);
    });

    expect(required).toBe(window.Ren);
    expect(typeof required.configure).toBe("function");
});
