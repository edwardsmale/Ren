/**
 * Bins a date/time into the day it falls on, as the sortable date the day is and the date to show.
 *
 * TAGS: calculation, binning
 * BINNING: date-times, "By Date", 10
 * OUTPUT: date
 */
const date = Ren.DateUtils.parseDateTimeUniversal(value);
if (!date) return value;
const sortableDate = Ren.DateUtils.formatAsSortableDate(date);
return sortableDate + "¬" + Ren.DateUtils.sortableDateToddMMyyyy(sortableDate);
