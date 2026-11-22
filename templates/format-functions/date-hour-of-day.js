/**
 * Returns the hour of day (0-23) from a datetime value.
 *
 * TAGS: calculation, binning
 * BINNING: date-times, "Hour of Day", 20
 */
if (!@value) return null;
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return null;
const hour = dateObj.getHours();
return hour + "¬" + hour.toString().padStart(2, '0') + ":00";
