/**
 * Reads the device kind - desktop, tablet or mobile - out of a user agent string.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "Device Type", 50
 */
if (!value) return "Unknown";
const ua = String(value);
if (/iPad/.test(ua)) return "Tablet";
if (/Mobi|iPhone|iPod|BlackBerry|Windows Phone|Android.*Mobile/.test(ua)) return "Mobile";
if (/Android/.test(ua)) return "Tablet";
return "Desktop";
