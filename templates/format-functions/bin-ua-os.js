/**
 * Reads the operating system out of a user agent string.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "OS", 30
 */
if (!value) return "Unknown";
const ua = String(value);
if (/Windows/.test(ua)) return "Windows";
if (/Android/.test(ua)) return "Android";
if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
if (/CrOS/.test(ua)) return "Chrome OS";
if (/Macintosh|Mac OS X/.test(ua)) return "macOS";
if (/Linux/.test(ua)) return "Linux";
return "Other";
