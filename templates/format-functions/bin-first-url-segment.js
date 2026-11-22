/**
 * Bins a URL path by its first segment.
 *
 * TAGS: format, calculation, binning
 * BINNING: urls, "First URL Segment", 10
 */
const m = /^(\/?)([^\/]*)/.exec(value == null ? "" : String(value)); return m ? m[1] + m[2] : "";
