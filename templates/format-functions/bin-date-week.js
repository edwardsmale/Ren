/**
 * Bins a date into the week it falls in, as the sortable date that week starts on and the week
 * commencing date to show.
 *
 * TAGS: calculation, binning
 * BINNING: dates, "By Week", 10
 * OUTPUT: date
 */
const date = Ren.DateUtils.parseDateTimeUniversal(value);
if (!date) return value;
const weekStart = Ren.DateUtils.formatAsSortableDate(Ren.DateUtils.startOfWeek(date));
return weekStart + "¬w/c " + Ren.DateUtils.sortableDateToddMMyyyy(weekStart);
