/**
 * Reads the operating system and its version out of a user agent string.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "OS + Version", 40
 */
if (!value) return "Unknown";
const ua = String(value);
let m;
m = ua.match(/Windows NT (\d+\.\d+)/);
if (m) {
    const v = { "10.0": "10", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista", "5.1": "XP", "5.0": "2000" }[m[1]];
    return "Windows " + (v || m[1]);
}
m = ua.match(/Android (\d+)/); if (m) return "Android " + m[1];
m = ua.match(/(?:iPhone|iPad)(?: OS| CPU iPhone OS) (\d+)/); if (m) return "iOS " + m[1];
m = ua.match(/Mac OS X (\d+[_.]\d+)/); if (m) return "macOS " + m[1].replace("_", ".");
if (/Linux/.test(ua)) return "Linux";
return "Other";
