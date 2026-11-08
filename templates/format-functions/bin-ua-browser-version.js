/**
 * Reads the browser and its major version out of a user agent string.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "Browser + Version", 20
 */
if (!value) return "Unknown";
const ua = String(value);
let m;
m = ua.match(/Edg\/(\d+)/); if (m) return "Edge " + m[1];
m = ua.match(/OPR\/(\d+)/); if (m) return "Opera " + m[1];
m = ua.match(/SamsungBrowser\/(\d+)/); if (m) return "Samsung Browser " + m[1];
m = ua.match(/Firefox\/(\d+)/); if (m) return "Firefox " + m[1];
m = ua.match(/Chrome\/(\d+)/); if (m) return "Chrome " + m[1];
if (/Safari\//.test(ua)) { m = ua.match(/Version\/(\d+)/); if (m) return "Safari " + m[1]; }
m = ua.match(/rv:(\d+).*Trident\//); if (m) return "IE " + m[1];
m = ua.match(/MSIE (\d+)/); if (m) return "IE " + m[1];
return "Other";
