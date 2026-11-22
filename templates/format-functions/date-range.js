/**
 * Formats a value holding two yyyy-MM-dd dates (the start, and the exclusive end) as the period
 * they span, as the date selector summarises it, e.g. "Q2 2024" or "May 2025".  A value without
 * two dates, or whose dates are not a recognised period, is shown as it is.
 *
 * TAGS: format, calculation
 */
if (typeof value !== "string") return value;

const dates = value.match(/\d{4}-\d{2}-\d{2}/g);
if (!dates || dates.length !== 2) return value;

return Ren.DateRangeSummariser.getDateRangeSummary(dates[0], dates[1]) ?? value;