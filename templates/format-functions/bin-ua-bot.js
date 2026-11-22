/**
 * Reads the bot's name out of a user agent string, or "Not a bot" where it names none.
 *
 * TAGS: format, calculation, binning
 * BINNING: user-agents, "Bot Name", 70
 */
if (!value) return "Unknown";
const ua = String(value);
const match = ua.match(/compatible;[\s+]*([A-Za-z0-9_-]+)\//i);
if (match && match[1].toLowerCase() !== "msie") return match[1];
return "Not a bot";
