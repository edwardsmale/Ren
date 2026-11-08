// ren.js runs inside this function, so the names declared at the top of its files (and Prism's)
// are its own rather than globals, which a page's own top-level let, const or class of the same
// name would clash with.  Ren itself is window.Ren.
(() => {
