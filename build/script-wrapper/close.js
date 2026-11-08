})();

// Where ren.js is loaded as a CommonJS module, as a bundler may, require() gets Ren.  (ren.esm.js
// exports it as an ES module.)
if (typeof module === "object" && module && module.exports) module.exports = window.Ren;
