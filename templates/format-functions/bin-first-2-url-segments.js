/**
 * Bins a URL path by its first two segments.
 *
 * TAGS: format, calculation, binning
 * BINNING: urls, "First 2 URL Segments", 20
 */
const s = value == null ? "" : String(value); const stripped = s.replace(/^\//, ""); const m = /^([^\/]+\/[^\/]+)\//.exec(stripped); return m ? "/" + m[1] : stripped;
