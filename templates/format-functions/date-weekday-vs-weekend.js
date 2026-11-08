/**
 * Returns whether the date is a weekday or weekend.
 *
 * TAGS: calculation, binning
 * BINNING: dates, "Weekday / Weekend", 70
 */
if (!@value) return null;
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return null;
const dayOfWeek = dateObj.getDay();
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
return (isWeekend ? "1" : "0") + "¬" + (isWeekend ? "Weekend" : "Weekday");
