/**
 * Reads the rendering engine out of a user agent string.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "Rendering Engine", 60
 */
if (!value) return "Unknown";
const ua = String(value);
if (/Trident\//.test(ua)) return "Trident";
if (/Gecko\/\d/.test(ua) && !/WebKit/.test(ua)) return "Gecko";
if (/WebKit\//.test(ua)) return "WebKit";
return "Other";
