/**
 * Used by the 'date/time and day name' format option: the date and time in ren.config's format
 * followed by the abbreviated day name (e.g. 25/12/2026 14:30:00 - Fri).
 *
 * TAGS: format
 */
const formattedDate = Ren.ValueFormatter.formatDateTime(value);
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return formattedDate;
const dayNamesAbbrv = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
return formattedDate + " - " + dayNamesAbbrv[dateObj.getDay()];
