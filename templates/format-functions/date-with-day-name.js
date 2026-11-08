/**
 * Used by the 'date and day name' format option: the date in ren.config's date format followed
 * by the abbreviated day name (e.g. 25/12/2026 - Fri).
 *
 * TAGS: format
 */
const formattedDate = Ren.ValueFormatter.formatDate(value);
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return formattedDate;
const dayNamesAbbrv = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
return formattedDate + " - " + dayNamesAbbrv[dateObj.getDay()];
