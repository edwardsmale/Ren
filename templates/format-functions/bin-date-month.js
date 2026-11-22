/**
 * Bins a date into the month it falls in, as the sortable date that month starts on and the month
 * to show, e.g. "Aug 2026".
 *
 * TAGS: calculation, binning
 * BINNING: dates, "By Month", 20
 * OUTPUT: date
 */
const date = Ren.DateUtils.parseDateTimeUniversal(value);
if (!date) return value;
const monthStart = Ren.DateUtils.formatAsSortableDate(Ren.DateUtils.startOfMonth(date));
return monthStart + "¬" + Ren.DateUtils.sortableDateToMMMyyyy(monthStart);
