/**
 * Returns whether the datetime is during working hours (9am-5pm weekdays) or out of hours.
 *
 * TAGS: calculation, binning
 * BINNING: date-times, "Working Hours", 30
 */
if (!value) return null;
const dateObj = Ren.DateUtils.parseDate(value);
if (!dateObj) return null;
const hour = dateObj.getHours();
const dayOfWeek = dateObj.getDay();
const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
const isWorkingHours = isWeekday && hour >= 8 && hour < 18;
return (isWorkingHours ? "0" : "1") + "¬" + (isWorkingHours ? "Working Hours" : "Out of Hours");
