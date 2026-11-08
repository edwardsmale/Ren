/**
 * Reads the browser out of a user agent string.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "Browser", 10
 */
if (!value) return "Unknown";
const ua = String(value);
if (/Edg\/\d/.test(ua)) return "Edge";
if (/OPR\//.test(ua)) return "Opera";
if (/SamsungBrowser\//.test(ua)) return "Samsung Browser";
if (/Firefox\//.test(ua)) return "Firefox";
if (/Chrome\//.test(ua)) return "Chrome";
if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
if (/Trident\/|MSIE /.test(ua)) return "Internet Explorer";
return "Other";