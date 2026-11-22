/**
 * Returns the day of week from a date/datetime value.
 *
 * TAGS: calculation, binning
 * BINNING: dates, "Day of Week", 50
 */
if (!@value) return null;
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return null;
const dayOfWeek = dateObj.getDay();
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
return dayOfWeek + "¬" + dayNames[dayOfWeek];
